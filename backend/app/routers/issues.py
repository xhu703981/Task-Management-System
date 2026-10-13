from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Issue, Team, TeamMember, User
from app.schemas import IssueCreate, IssueOut, IssueUpdate
from app.security import get_current_user

router = APIRouter(prefix="/issues", tags=["issues"])


def visible_to(user: User):
    """Issues in any team the user is a member of."""
    my_team_ids = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    return Issue.team_id.in_(my_team_ids)


def check_assignee(db: Session, team_id: int, assignee_id: int | None):
    if assignee_id is not None and db.get(TeamMember, (team_id, assignee_id)) is None:
        raise HTTPException(status_code=422, detail="Assignee is not a member of this team")


@router.get("", response_model=list[IssueOut])
def list_issues(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Issue).where(visible_to(current_user)).order_by(Issue.updated_at.desc())
    return db.scalars(query).all()


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Issue).where(Issue.id == issue_id, visible_to(current_user))
    issue = db.scalars(query).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("", response_model=IssueOut, status_code=201)
def create_issue(
    payload: IssueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.get(TeamMember, (payload.team_id, current_user.id)) is None:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    check_assignee(db, payload.team_id, payload.assignee_id)
    # Bump the team's counter and read the new value in one statement. Postgres locks the team row
    # until we commit, so two people creating issues at once get different numbers.
    number = db.scalar(
        update(Team)
        .where(Team.id == payload.team_id)
        .values(issue_count=Team.issue_count + 1)
        .returning(Team.issue_count)
    )
    issue = Issue(**payload.model_dump(), number=number, creator_id=current_user.id)
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


@router.patch("/{issue_id}", response_model=IssueOut)
def update_issue(
    issue_id: int,
    payload: IssueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = select(Issue).where(Issue.id == issue_id, visible_to(current_user))
    issue = db.scalars(query).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    changes = payload.model_dump(exclude_unset=True)
    #exclude_unset=True means "only include fields that are in model_fields_set.
    check_assignee(db, issue.team_id, changes.get("assignee_id"))

    for field, value in changes.items():
        setattr(issue, field, value)
    db.commit()
    db.refresh(issue)
    return issue


@router.delete("/{issue_id}", status_code=204)
def delete_issue(issue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Issue).where(Issue.id == issue_id, visible_to(current_user))
    issue = db.scalars(query).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    membership = db.get(TeamMember, (issue.team_id, current_user.id))
    if not (issue.creator_id == current_user.id or membership.role == "owner" or current_user.role == "Admin"):
        raise HTTPException(status_code=403, detail="Only the creator, a team owner or an Admin can delete an issue")
    db.delete(issue)
    db.commit()
