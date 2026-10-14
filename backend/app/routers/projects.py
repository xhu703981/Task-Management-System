from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Team, TeamMember, User
from app.routers.teams import require_manager
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate
from app.security import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])

DUPLICATE_NAME = "This team already has a project with that name"


def visible_to(user: User):
    """Projects in any team the user is a member of (the same rule as issues)."""
    my_team_ids = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    return Project.team_id.in_(my_team_ids)


def get_project(db: Session, project_id: int, user: User) -> Project:
    project = db.scalars(select(Project).where(Project.id == project_id, visible_to(user))).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def commit_or_409(db: Session):
    """Commit; if the unique (team_id, name) rule fails, undo and say why."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=DUPLICATE_NAME)


@router.get("", response_model=list[ProjectOut])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Project).where(visible_to(current_user)).order_by(Project.created_at, Project.id)).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.get(TeamMember, (payload.team_id, current_user.id)) is None:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    project = Project(**payload.model_dump())
    db.add(project)
    commit_or_409(db)
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def read_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_project(db, project_id, current_user)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    commit_or_409(db)
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project(db, project_id, current_user)
    require_manager(db, db.get(Team, project.team_id), current_user)
    # Its issues stay: the database sets their project_id to NULL (ON DELETE SET NULL).
    db.delete(project)
    db.commit()
