from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import get_current_user, hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
# - Swagger UI never reads your code. It only reads `openapi.json` and draws what that file describes.
# - **Authorize button:** appears when `openapi.json` has a `securitySchemes` section.
# - **Padlock:** appears on each endpoint that has a `security` field.
# - **FastAPI's role:** when you use one of its security classes (`OAuth2PasswordBearer`, `HTTPBearer`, `APIKeyHeader`), FastAPI writes both fields for you. Reading the header manually with `Header()` does the same thing at runtime, but FastAPI doesn't know it's a login, so you get no button and no padlocks.


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(
        email=payload.email.lower(),
        username=payload.username,
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=payload.role,
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
