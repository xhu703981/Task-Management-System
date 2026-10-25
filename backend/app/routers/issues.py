from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from app.access import RANK, get_issue, get_project, project_role, require_role, visible_project_ids
from app.database import get_db
from app.models import Issue, Project, ProjectMember, Sprint, User
from app.schemas import (
    BulkCounts, BulkDeleteRequest, BulkResult, BulkUpdateRequest, BulkUpdateResponse, IssueCreate, IssueOut,
    IssueUpdate, StatusMove, StatusMoveOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/issues", tags=["issues"])


class Invalid(Exception):
    """A rule the issue's final state breaks; the single endpoints answer 422, bulk reports it per issue."""


def check_links(db: Session, issue: Issue, fields: dict):
    """Check the issue as it would be after `fields` are applied (current values + changes).

    - the assignee is a member of the project
    - the parent is an epic in the same project, and an epic itself has no parent
    - an epic with children can't turn into another type
    - the sprint is in the same project and not completed
    """
    final = {name: fields.get(name, getattr(issue, name, None)) for name in ("assignee_id", "parent_id", "sprint_id", "issue_type")}
    project_id = issue.project_id

    if final["assignee_id"] is not None and db.get(ProjectMember, (project_id, final["assignee_id"])) is None:
        raise Invalid("Assignee is not a member of this project")

    if final["parent_id"] is not None:
        parent = db.get(Issue, final["parent_id"])
        if parent is None or parent.project_id != project_id or parent.issue_type != "epic" or parent.id == issue.id:
            raise Invalid("Parent must be an epic in the same project")
        if final["issue_type"] == "epic":
            raise Invalid("An epic can't have a parent")

    if issue.id is not None and issue.issue_type == "epic" and final["issue_type"] != "epic":
        if db.scalar(select(exists().where(Issue.parent_id == issue.id))):
            raise Invalid("This epic still has child issues; remove them from the epic first")

    if final["sprint_id"] is not None and final["sprint_id"] != issue.sprint_id:
        sprint = db.get(Sprint, final["sprint_id"])
        if sprint is None or sprint.project_id != project_id or sprint.status == "completed":
            raise Invalid("Sprint must be a planned or active sprint of this project")


def apply_changes(db: Session, issue: Issue, fields: dict):
    try:
        check_links(db, issue, fields)
    except Invalid as e:
        raise HTTPException(status_code=422, detail=str(e))
    for field, value in fields.items():
        setattr(issue, field, value)


def require_deleter(db: Session, issue: Issue, user: User):
    """The reporter (while still able to write) or a project Admin may delete an issue."""
    role = project_role(db, issue.project_id, user)
    is_reporter = issue.reporter_id == user.id and role is not None and RANK[role] >= RANK["Member"]
    if not (is_reporter or role == "Admin"):
        raise HTTPException(status_code=403, detail="Only the reporter or a project Admin can delete an issue")


@router.get("", response_model=list[IssueOut])
def list_issues(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Every issue in every project the user can see, most recently updated first."""
    query = select(Issue).where(Issue.project_id.in_(visible_project_ids(current_user)))
    return db.scalars(query.order_by(Issue.updated_at.desc())).all()


@router.post("", response_model=IssueOut, status_code=201)
def create_issue(payload: IssueCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_project(db, payload.project_id, current_user)
    require_role(db, project.id, current_user, "Member")
    issue = Issue(project_id=project.id)
    apply_changes(db, issue, payload.model_dump(exclude={"project_id"}))
    # Bump the project's counter and read the new value in one statement. Postgres locks the project
    # row until we commit, so two people creating issues at once get different numbers.
    number = db.scalar(
        update(Project)
        .where(Project.id == project.id)
        .values(last_issue_number=Project.last_issue_number + 1)
        .returning(Project.last_issue_number)
    )
    issue.number = number
    issue.issue_key = f"{project.key}-{number}"
    issue.reporter_id = current_user.id
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


# The bulk routes come before /{issue_key}: FastAPI tries routes in order, and "bulk" would
# otherwise be taken as an issue key.
@router.patch("/bulk", response_model=BulkUpdateResponse)
def bulk_update(payload: BulkUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Apply the same changes to many issues. Each issue succeeds or fails on its own."""
    changes = payload.updates.model_dump(exclude_unset=True)
    results: list[BulkResult] = []
    updated: list[Issue] = []
    for key in payload.issue_keys:
        try:
            issue = get_issue(db, key, current_user)
            require_role(db, issue.project_id, current_user, "Member")
            check_links(db, issue, changes)
        except HTTPException as e:
            results.append(BulkResult(issue_key=key.upper(), status="Failed", error=e.detail))
            continue
        except Invalid as e:
            results.append(BulkResult(issue_key=issue.issue_key, status="Failed", error=str(e)))
            continue
        for field, value in changes.items():
            setattr(issue, field, value)
        updated.append(issue)
        results.append(BulkResult(issue_key=issue.issue_key, status="Updated"))
    db.commit()
    stamps = {i.issue_key: i.updated_at for i in updated}  # reloaded after commit: the trigger's new value
    for r in results:
        r.updated_at = stamps.get(r.issue_key)
    return BulkUpdateResponse(
        summary=BulkCounts(total=len(results), success_count=len(updated), failure_count=len(results) - len(updated)),
        results=results,
    )


@router.delete("/bulk", status_code=204)
def bulk_delete(payload: BulkDeleteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete many issues: all of them, or (if any is missing or not allowed) none of them."""
    issues = [get_issue(db, key, current_user) for key in payload.issue_keys]
    for issue in issues:
        require_deleter(db, issue, current_user)
    for issue in issues:
        db.delete(issue)
    db.commit()


@router.get("/{issue_key}", response_model=IssueOut)
def read_issue(issue_key: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_issue(db, issue_key, current_user)


@router.patch("/{issue_key}", response_model=IssueOut)
def update_issue(
    issue_key: str,
    payload: IssueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = get_issue(db, issue_key, current_user)
    require_role(db, issue.project_id, current_user, "Member")
    changes = payload.model_dump(exclude_unset=True)
    #exclude_unset=True means "only include fields that are in model_fields_set.
    apply_changes(db, issue, changes)
    db.commit()
    db.refresh(issue)
    return issue


@router.put("/{issue_key}/status", response_model=StatusMoveOut)
def move_status(
    issue_key: str,
    payload: StatusMove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The board's drag-and-drop: only the status changes."""
    issue = get_issue(db, issue_key, current_user)
    require_role(db, issue.project_id, current_user, "Member")
    issue.status = payload.status
    db.commit()
    db.refresh(issue)
    return issue


@router.delete("/{issue_key}", status_code=204)
def delete_issue(issue_key: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    issue = get_issue(db, issue_key, current_user)
    require_deleter(db, issue, current_user)
    # Its comments go with it (ON DELETE CASCADE); if it's an epic, its children stay (SET NULL).
    db.delete(issue)
    db.commit()
