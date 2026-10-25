import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.access import get_project, require_role, visible_project_ids
from app.database import get_db
from app.models import Issue, Project, ProjectMember, Sprint, User
from app.schemas import (
    BoardColumn, BoardOut, IssueOut, IssueStatus, IssueType, ProjectCreate, ProjectMemberAdd,
    ProjectMemberUpdate, ProjectOut, ProjectSummary, ProjectUpdate, SummaryStats,
)
from app.security import get_current_user, require_workspace_admin

router = APIRouter(prefix="/projects", tags=["projects"])

COLUMNS = [("todo", "To Do"), ("in_progress", "In Progress"), ("in_review", "In Review"), ("done", "Done")]


def with_issue_counts(db: Session, projects: list[Project]) -> list[Project]:
    """Set project.issue_count (issues that exist now) with one GROUP BY query for all of them."""
    counts = dict(
        db.execute(
            select(Issue.project_id, func.count())
            .where(Issue.project_id.in_([p.id for p in projects]))
            .group_by(Issue.project_id)
        ).all()
    )
    for p in projects:
        p.issue_count = counts.get(p.id, 0)  # a plain attribute, not a column; ProjectOut reads it
    return projects


def project_out(db: Session, project: Project) -> Project:
    db.refresh(project)
    return with_issue_counts(db, [project])[0]


def get_member(db: Session, project_id: int, user_id: int) -> ProjectMember:
    member = db.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def check_not_last_admin(db: Session, member: ProjectMember):
    if member.role != "Admin":
        return
    admins = db.scalar(
        select(func.count()).where(ProjectMember.project_id == member.project_id, ProjectMember.role == "Admin")
    )
    if admins == 1:
        raise HTTPException(status_code=409, detail="A project needs at least one Admin")


def active_sprint(db: Session, project_id: int) -> Sprint | None:
    return db.scalars(select(Sprint).where(Sprint.project_id == project_id, Sprint.status == "active")).first()


# ---------- Projects ----------

@router.get("", response_model=list[ProjectOut])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.scalars(
        select(Project).where(Project.id.in_(visible_project_ids(current_user))).order_by(Project.id)
    ).all()
    return with_issue_counts(db, list(projects))


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, admin: User = Depends(require_workspace_admin), db: Session = Depends(get_db)):
    # The creator leads the project and is its first Admin member.
    project = Project(**payload.model_dump(), lead_id=admin.id)
    project.members.append(ProjectMember(user_id=admin.id, role="Admin"))
    db.add(project)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Project key already taken")
    return project_out(db, project)


@router.get("/{project_id}", response_model=ProjectOut)
def read_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return with_issue_counts(db, [get_project(db, project_id, current_user)])[0]


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id, current_user)
    require_role(db, project_id, current_user, "Admin")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("lead_id") is not None and db.get(ProjectMember, (project_id, changes["lead_id"])) is None:
        raise HTTPException(status_code=422, detail="The lead must be a member of the project")
    for field, value in changes.items():
        setattr(project, field, value)
    db.commit()
    return project_out(db, project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project(db, project_id, current_user)
    require_role(db, project_id, current_user, "Admin")
    # The database deletes its issues, sprints and memberships with it (ON DELETE CASCADE).
    db.delete(project)
    db.commit()


# ---------- Members ----------

@router.post("/{project_id}/members", response_model=ProjectOut, status_code=201)
def add_member(
    project_id: int,
    payload: ProjectMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id, current_user, lock=True)
    require_role(db, project_id, current_user, "Admin")
    if db.get(User, payload.user_id) is None:
        raise HTTPException(status_code=422, detail="User not found")
    if db.get(ProjectMember, (project_id, payload.user_id)) is not None:
        raise HTTPException(status_code=409, detail="Already a member")
    db.add(ProjectMember(project_id=project_id, user_id=payload.user_id, role=payload.role))
    db.commit()
    return project_out(db, project)


@router.patch("/{project_id}/members/{user_id}", response_model=ProjectOut)
def update_member(
    project_id: int,
    user_id: int,
    payload: ProjectMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id, current_user, lock=True)
    require_role(db, project_id, current_user, "Admin")
    member = get_member(db, project_id, user_id)
    if payload.role != "Admin":
        check_not_last_admin(db, member)
    member.role = payload.role
    db.commit()
    return project_out(db, project)


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id, current_user, lock=True)
    if user_id != current_user.id:  # anyone may leave; removing someone else needs a project Admin
        require_role(db, project_id, current_user, "Admin")
    member = get_member(db, project_id, user_id)
    check_not_last_admin(db, member)
    if project.lead_id == user_id:
        project.lead_id = None  # the lead must be a member
    # Their issues and comments stay; only the membership goes.
    db.delete(member)
    db.commit()


# ---------- Views of a project's issues ----------

@router.get("/{project_id}/summary", response_model=ProjectSummary)
def project_summary(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project(db, project_id, current_user)
    done = Issue.status == "done"
    open_count, done_count = db.execute(
        select(func.count().filter(~done), func.count().filter(done)).where(Issue.project_id == project_id)
    ).one()
    sprint = active_sprint(db, project_id)
    days = None
    if sprint and sprint.end_date:
        days = max(0, math.ceil((sprint.end_date - datetime.now(timezone.utc)).total_seconds() / 86400))
    return ProjectSummary(
        project_id=project.id,
        name=project.name,
        status="Archived" if project.is_archived else "Active",
        active_sprint_id=sprint.id if sprint else None,
        stats=SummaryStats(
            open_issues=open_count, completed_issues=done_count,
            member_count=len(project.members), days_remaining=days,
        ),
    )


@router.get("/{project_id}/backlog", response_model=list[IssueOut])
def project_backlog(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unfinished issues not planned in any sprint, most urgent first."""
    get_project(db, project_id, current_user)
    return db.scalars(
        select(Issue)
        .where(Issue.project_id == project_id, Issue.sprint_id.is_(None), Issue.status != "done")
        .order_by(Issue.priority, Issue.number)
    ).all()


@router.get("/{project_id}/board", response_model=BoardOut)
def project_board(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The active sprint's issues in one column per status (empty columns when no sprint is active)."""
    get_project(db, project_id, current_user)
    sprint = active_sprint(db, project_id)
    issues = []
    if sprint:
        issues = db.scalars(select(Issue).where(Issue.sprint_id == sprint.id).order_by(Issue.priority, Issue.number)).all()
    columns = [
        BoardColumn(id=status, name=name, issues=[i for i in issues if i.status == status])
        for status, name in COLUMNS
    ]
    return BoardOut(project_id=project_id, sprint_id=sprint.id if sprint else None, columns=columns)


@router.get("/{project_id}/list", response_model=list[IssueOut])
def project_list(
    project_id: int,
    status: IssueStatus | None = None,
    priority: int | None = Query(default=None, ge=1, le=5),
    issue_type: IssueType | None = None,
    assignee_id: int | None = None,
    sprint_id: int | None = None,
    search: str | None = Query(default=None, max_length=255),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every issue of the project, newest first, narrowed by any filters given."""
    get_project(db, project_id, current_user)
    query = select(Issue).where(Issue.project_id == project_id)
    if status:
        query = query.where(Issue.status == status)
    if priority:
        query = query.where(Issue.priority == priority)
    if issue_type:
        query = query.where(Issue.issue_type == issue_type)
    if assignee_id is not None:
        query = query.where(Issue.assignee_id == assignee_id)
    if sprint_id is not None:
        query = query.where(Issue.sprint_id == sprint_id)
    if search:
        # Matches the title or the key; the % wildcards around it mean "contains".
        pattern = f"%{search}%"
        query = query.where(Issue.title.ilike(pattern) | Issue.issue_key.ilike(pattern))
    return db.scalars(query.order_by(Issue.number.desc())).all()
