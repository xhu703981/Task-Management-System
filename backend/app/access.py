"""Who can see and change what.

Workspace role (users.role):        Admin | Member
Project role (project_members.role): Admin | Member | Viewer

- See a project and everything in it: any project member, or a workspace Admin.
- Write (create and edit issues, comments, sprints): project Admin or Member, or a workspace Admin.
- Manage (project settings, members, deleting sprints): project Admin, or a workspace Admin.

A project you can't see answers 404, not 403, so outsiders can't even learn that it exists.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Comment, Issue, Project, ProjectMember, Sprint, User

RANK = {"Viewer": 0, "Member": 1, "Admin": 2}


def project_role(db: Session, project_id: int, user: User) -> str | None:
    """The user's effective role in a project: workspace Admins act as project Admins everywhere."""
    if user.role == "Admin":
        return "Admin"
    member = db.get(ProjectMember, (project_id, user.id))
    return member.role if member else None


def require_role(db: Session, project_id: int, user: User, needed: str) -> str:
    """403 unless the user's project role is at least `needed`. Call it after the 404 visibility check."""
    role = project_role(db, project_id, user)
    if role is None or RANK[role] < RANK[needed]:
        what = "project Admins" if needed == "Admin" else "project Admins and Members"
        raise HTTPException(status_code=403, detail=f"Only {what} can do this")
    return role


def visible_project_ids(user: User):
    """A subquery of the project ids the user may see (use with .in_())."""
    if user.role == "Admin":
        return select(Project.id)
    return select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)


def get_project(db: Session, project_id: int, user: User, lock: bool = False) -> Project:
    """The project if the user can see it, else 404.

    lock=True locks the project row until commit (SELECT ... FOR UPDATE), so two requests changing
    its members take turns instead of both passing the "last Admin" check.
    """
    project = db.get(Project, project_id, with_for_update=lock)
    if project is None or project_role(db, project_id, user) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def get_issue(db: Session, issue_key: str, user: User) -> Issue:
    """The issue with this key ("cim-12" works too) if the user can see its project, else 404."""
    issue = db.scalars(
        select(Issue).where(Issue.issue_key == issue_key.upper(), Issue.project_id.in_(visible_project_ids(user)))
    ).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


def get_sprint(db: Session, sprint_id: int, user: User) -> Sprint:
    sprint = db.get(Sprint, sprint_id)
    if sprint is None or project_role(db, sprint.project_id, user) is None:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return sprint


def get_comment(db: Session, comment_id: int, user: User) -> tuple[Comment, Issue]:
    """The comment and its issue, if the user can see the issue's project, else 404."""
    row = db.execute(
        select(Comment, Issue)
        .join(Issue, Comment.issue_id == Issue.id)
        .where(Comment.id == comment_id, Issue.project_id.in_(visible_project_ids(user)))
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return row.Comment, row.Issue
