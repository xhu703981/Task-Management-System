from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, LoginResponse, RefreshRequest, Token, UserCreate, UserOut
from app.security import create_token, hash_password, user_from_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.scalars(select(User).where(User.username == username)).first()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return user


def login_response(user: User) -> LoginResponse:
    return LoginResponse(
        access_token=create_token(user.id, "access"),
        refresh_token=create_token(user.id, "refresh"),
        expires_in=settings.jwt_access_expire,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # The very first account becomes the workspace Admin; otherwise nobody could create projects.
    first_user = not db.scalar(select(exists().where(User.id.isnot(None))))
    user = User(
        email=payload.email.lower(),
        username=payload.username,
        name=payload.name or payload.username,
        password_hash=hash_password(payload.password),
        role="Admin" if first_user else "Member",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
    # Why not check "does this email exist?" first, then insert?
    # Two sign-ups could arrive at almost the same moment.
    # Both would check, both would see "free", and both would insert.
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or username already taken")
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    return login_response(authenticate(db, payload.username, payload.password))


@router.post("/token", response_model=LoginResponse, include_in_schema=False)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """The same login as a form post: what Swagger's Authorize button sends (OAuth2 password flow)."""
    return login_response(authenticate(db, form.username, form.password))


@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    # Pure JWT: nothing is stored, so logout just means the client deletes both tokens.
    user = user_from_token(db, payload.refresh_token, "refresh")
    return Token(access_token=create_token(user.id, "access"), expires_in=settings.jwt_access_expire)
