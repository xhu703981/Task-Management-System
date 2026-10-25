from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

password_hasher = PasswordHash((Argon2Hasher(),))

ALGORITHM = "HS256"

# Swagger's Authorize button logs in through this form endpoint (the app itself uses JSON /auth/login).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    # Google-only users have no password, so no password can match.
    return hashed is not None and password_hasher.verify(password, hashed)


def create_token(user_id: int, kind: str) -> str:
    """kind is "access" (sent with every request, short-lived) or "refresh" (only trades for a new access token)."""
    seconds = settings.jwt_access_expire if kind == "access" else settings.jwt_refresh_expire
    expire = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    payload = {"sub": str(user_id), "type": kind, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_access_token(user_id: int) -> str:
    return create_token(user_id, "access")


def user_from_token(db: Session, token: str, kind: str) -> User:
    """The user a valid, unexpired token of this kind belongs to; otherwise 401.

    Checking the kind matters: without it a 7-day refresh token would also work as an access token.
    """
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    except jwt.InvalidTokenError:
        raise unauthorized
    if payload.get("type") != kind:
        raise unauthorized
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise unauthorized
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return user_from_token(db, token, "access")


def require_workspace_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only workspace Admins can do this")
    return current_user
