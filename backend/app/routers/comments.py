from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Comment, Issue, TeamMember, User
from app.routers.issues import visible_to
from app.schemas import CommentCreate, CommentOut, CommentUpdate
from app.security import get_current_user

router = APIRouter(tags=["comments"])


def get_visible_issue(db: Session, issue_id: int, user: User) -> Issue:
    issue = db.scalars(select(Issue).where(Issue.id == issue_id, visible_to(user))).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


def get_visible_comment(db: Session, comment_id: int, user: User) -> Comment:
    # A comment is visible when its issue is: join to the issue and reuse the same rule.
    query = (
        select(Comment)
        .join(Issue, Comment.issue_id == Issue.id)
        .where(Comment.id == comment_id, visible_to(user))
    )
    comment = db.scalars(query).first()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


@router.get("/issues/{issue_id}/comments", response_model=list[CommentOut])
def list_comments(issue_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_visible_issue(db, issue_id, current_user)
    query = select(Comment).where(Comment.issue_id == issue_id).order_by(Comment.created_at, Comment.id)
    return db.scalars(query).all()


@router.post("/issues/{issue_id}/comments", response_model=CommentOut, status_code=201)
def create_comment(
    issue_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_visible_issue(db, issue_id, current_user)
    comment = Comment(issue_id=issue_id, author_id=current_user.id, body=payload.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = get_visible_comment(db, comment_id, current_user)
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit a comment")
    comment.body = payload.body
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = get_visible_comment(db, comment_id, current_user)
    team_id = db.get(Issue, comment.issue_id).team_id
    membership = db.get(TeamMember, (team_id, current_user.id))
    if not (comment.author_id == current_user.id or membership.role == "owner" or current_user.role == "Admin"):
        raise HTTPException(status_code=403, detail="Only the author, a team owner or an Admin can delete a comment")
    db.delete(comment)
    db.commit()
