from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Issue, User
from app.schemas import IssueCreate, IssueOut, IssueUpdate
from app.security import get_current_user

router = APIRouter(prefix="/issues", tags=["issues"])

ASSIGNEE_EDITABLE = {"status", "description"}


def visible_to(user: User):
    return or_(Issue.creator_id == user.id, Issue.assignee_id == user.id)


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
    if payload.assignee_id is not None and db.get(User, payload.assignee_id) is None:
        raise HTTPException(status_code=422, detail="Assignee not found")
    issue = Issue(**payload.model_dump(), creator_id=current_user.id)
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
    if issue.creator_id != current_user.id and not changes.keys() <= ASSIGNEE_EDITABLE:
        raise HTTPException(status_code=403, detail="Assignees can only change status and description")
    if changes.get("assignee_id") is not None and db.get(User, changes["assignee_id"]) is None:
        raise HTTPException(status_code=422, detail="Assignee not found")

    for field, value in changes.items():
        setattr(issue, field, value)
    db.commit()
    db.refresh(issue)
    return issue

# rules: deleting is only allowed for the creator
#        editing is allowed for the creator and assignee, but the assignee can only change status and description


@router.delete("/{issue_id}", status_code=204)
def delete_issue(issue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Issue).where(Issue.id == issue_id, visible_to(current_user))
    issue = db.scalars(query).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete an issue")
    db.delete(issue)
    db.commit()
