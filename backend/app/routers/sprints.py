from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.access import get_issue, get_project, get_sprint, require_role
from app.database import get_db
from app.models import Issue, Sprint, User
from app.schemas import (
    IssueOut, SprintComplete, SprintCompleteOut, SprintCreate, SprintIssuesAdd, SprintIssuesAdded, SprintOut,
    SprintUpdate,
)
from app.security import get_current_user

router = APIRouter(tags=["sprints"])


def check_dates(start: datetime | None, end: datetime | None):
    # The database has the same CHECK; this turns its error into a clear 422 before we get there.
    if start and end and end <= start:
        raise HTTPException(status_code=422, detail="end_date must be after start_date")


@router.post("/projects/{project_id}/sprints", response_model=SprintOut, status_code=201)
def create_sprint(
    project_id: int,
    payload: SprintCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_project(db, project_id, current_user)
    require_role(db, project_id, current_user, "Member")
    check_dates(payload.start_date, payload.end_date)
    sprint = Sprint(project_id=project_id, created_by=current_user.id, **payload.model_dump())
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return sprint


@router.get("/projects/{project_id}/sprints", response_model=list[SprintOut])
def list_sprints(
    project_id: int,
    status: Literal["planned", "active", "completed"] | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The project's sprints, newest first."""
    get_project(db, project_id, current_user)
    query = select(Sprint).where(Sprint.project_id == project_id)
    if status:
        query = query.where(Sprint.status == status)
    return db.scalars(query.order_by(Sprint.id.desc()).limit(limit)).all()


@router.get("/sprints/{sprint_id}", response_model=SprintOut)
def read_sprint(sprint_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_sprint(db, sprint_id, current_user)


@router.patch("/sprints/{sprint_id}", response_model=SprintOut)
def update_sprint(
    sprint_id: int,
    payload: SprintUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sprint = get_sprint(db, sprint_id, current_user)
    require_role(db, sprint.project_id, current_user, "Member")
    if sprint.status == "completed":
        raise HTTPException(status_code=409, detail="A completed sprint can't be changed")
    changes = payload.model_dump(exclude_unset=True)
    check_dates(changes.get("start_date", sprint.start_date), changes.get("end_date", sprint.end_date))
    for field, value in changes.items():
        setattr(sprint, field, value)
    db.commit()
    db.refresh(sprint)
    return sprint


@router.delete("/sprints/{sprint_id}", status_code=204)
def delete_sprint(sprint_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sprint = get_sprint(db, sprint_id, current_user)
    require_role(db, sprint.project_id, current_user, "Admin")
    # Its issues stay and go back to the backlog (issues.sprint_id is ON DELETE SET NULL).
    db.delete(sprint)
    db.commit()


@router.post("/sprints/{sprint_id}/start", response_model=SprintOut)
def start_sprint(sprint_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sprint = get_sprint(db, sprint_id, current_user)
    require_role(db, sprint.project_id, current_user, "Member")
    if sprint.status != "planned":
        raise HTTPException(status_code=409, detail="Only a planned sprint can be started")
    if sprint.start_date is None or sprint.end_date is None:
        raise HTTPException(status_code=409, detail="Set the sprint's start and end dates first")
    sprint.status = "active"
    try:
        db.commit()
    except IntegrityError:
        # uq_sprints_one_active: the project already has an active sprint. Letting the unique index
        # decide (instead of checking first) is also correct when two people press Start at once.
        db.rollback()
        raise HTTPException(status_code=409, detail="This project already has an active sprint")
    db.refresh(sprint)
    return sprint


@router.post("/sprints/{sprint_id}/complete", response_model=SprintCompleteOut)
def complete_sprint(
    sprint_id: int,
    payload: SprintComplete,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Close an active sprint. Unfinished issues move to the destination sprint, or the backlog."""
    sprint = get_sprint(db, sprint_id, current_user)
    require_role(db, sprint.project_id, current_user, "Member")
    if sprint.status != "active":
        raise HTTPException(status_code=409, detail="Only an active sprint can be completed")
    dest_id = payload.destination_sprint_id
    if dest_id is not None:
        dest = db.get(Sprint, dest_id)
        if dest is None or dest.project_id != sprint.project_id or dest.status != "planned":
            raise HTTPException(status_code=422, detail="Destination must be a planned sprint of this project")

    completed = db.scalar(select(func.count()).where(Issue.sprint_id == sprint.id, Issue.status == "done"))
    # One UPDATE moves every unfinished issue; rowcount says how many there were.
    moved = db.execute(
        update(Issue).where(Issue.sprint_id == sprint.id, Issue.status != "done").values(sprint_id=dest_id)
    ).rowcount
    sprint.status = "completed"
    sprint.completed_date = datetime.now(timezone.utc)
    db.commit()
    return SprintCompleteOut(
        id=sprint.id, status=sprint.status, completed_date=sprint.completed_date,
        completed_issues=completed, moved_issues=moved,
    )


@router.get("/sprints/{sprint_id}/issues", response_model=list[IssueOut])
def sprint_issues(sprint_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_sprint(db, sprint_id, current_user)
    return db.scalars(select(Issue).where(Issue.sprint_id == sprint_id).order_by(Issue.priority, Issue.number)).all()


@router.post("/sprints/{sprint_id}/issues", response_model=SprintIssuesAdded)
def add_issues_to_sprint(
    sprint_id: int,
    payload: SprintIssuesAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move issues into the sprint: all of them, or (if any is invalid) none."""
    sprint = get_sprint(db, sprint_id, current_user)
    require_role(db, sprint.project_id, current_user, "Member")
    if sprint.status == "completed":
        raise HTTPException(status_code=409, detail="Can't add issues to a completed sprint")
    issues = []
    for key in payload.issue_keys:
        try:
            issue = get_issue(db, key, current_user)
        except HTTPException:
            issue = None
        if issue is None or issue.project_id != sprint.project_id:
            raise HTTPException(status_code=422, detail=f"{key.upper()} is not an issue of this project")
        issues.append(issue)
    for issue in issues:
        issue.sprint_id = sprint.id
    db.commit()
    return SprintIssuesAdded(sprint_id=sprint.id, added=[i.issue_key for i in issues])
