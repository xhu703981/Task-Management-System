from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Issue, Project, ProjectMember, User
from app.schemas import InvolvedProject, MeOut, MessageOut, PasswordChange, UserOut, UserRoleUpdate, UserUpdate
from app.security import get_current_user, hash_password, require_workspace_admin, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Logged-in users only: the people pickers need everyone, outsiders need no one.
    return db.scalars(select(User).order_by(User.id)).all()


@router.get("/me", response_model=MeOut)
def read_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # For each of my projects: my role there, and how many unfinished issues are assigned to me.
    active_tasks = (
        select(func.count())
        .where(Issue.project_id == Project.id, Issue.assignee_id == current_user.id, Issue.status != "done")
        .scalar_subquery()
    )
    rows = db.execute(
        select(Project.id, Project.name, Project.key, ProjectMember.role, active_tasks)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id)
        .order_by(Project.id)
    ).all()
    projects = [InvolvedProject(project_id=r[0], name=r[1], key=r[2], role=r[3], active_tasks=r[4]) for r in rows]
    return MeOut(**UserOut.model_validate(current_user).model_dump(), involved_projects=projects)
# - Swagger UI never reads your code. It only reads `openapi.json` and draws what that file describes.
# - **Authorize button:** appears when `openapi.json` has a `securitySchemes` section.
# - **Padlock:** appears on each endpoint that has a `security` field.
# - **FastAPI's role:** when you use one of its security classes (`OAuth2PasswordBearer`, `HTTPBearer`, `APIKeyHeader`), FastAPI writes both fields for you. Reading the header manually with `Header()` does the same thing at runtime, but FastAPI doesn't know it's a login, so you get no button and no padlocks.


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes:
        changes["email"] = changes["email"].lower()
    for field, value in changes.items():
        setattr(current_user, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or username already taken")
    db.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=MessageOut)
def change_password(
    payload: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return MessageOut(message="Password changed successfully.")


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: int,
    payload: UserRoleUpdate,
    admin: User = Depends(require_workspace_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id, with_for_update=True)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "Admin" and payload.role != "Admin":
        admins = db.scalar(select(func.count()).where(User.role == "Admin"))
        if admins == 1:
            raise HTTPException(status_code=409, detail="The workspace needs at least one Admin")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user
