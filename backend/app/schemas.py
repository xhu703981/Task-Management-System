from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints

# ---------- Users and auth ----------

WorkspaceRole = Literal["Admin", "Member"]
ProjectRole = Literal["Admin", "Member", "Viewer"]
Password = Annotated[str, Field(min_length=8, max_length=255)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    name: str
    role: str
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr = Field(max_length=255) # EmailStr checks for valid email format
    username: str = Field(min_length=1, max_length=64)
    name: str = Field(default=None, min_length=1, max_length=255)  # optional; defaults to the username
    password: str = Field(min_length=8, max_length=255)  # Password must be at least 8 characters long
    # No role: people who sign up are Members. Only an Admin can promote someone (PATCH /users/{id}/role).


class UserRoleUpdate(BaseModel):
    role: WorkspaceRole  # has to be exactly one of the two roles


class UserUpdate(BaseModel):
    email: EmailStr = Field(default=None, max_length=255)
    username: str = Field(default=None, min_length=1, max_length=64)
    name: str = Field(default=None, min_length=1, max_length=255)


class PasswordChange(BaseModel):
    current_password: str
    new_password: Password


class InvolvedProject(BaseModel):
    project_id: int
    name: str
    key: str
    role: str
    active_tasks: int


class MeOut(UserOut):
    involved_projects: list[InvolvedProject]


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginResponse(Token):
    refresh_token: str
    user: UserOut


class MessageOut(BaseModel):
    message: str


# ---------- Projects ----------

PROJECT_KEY = r"^[A-Z][A-Z0-9]{1,9}$"
# Trimmed before the length check, so "Q4 launch " and "Q4 launch" count as the same name.
ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProjectMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    role: str
    joined_at: datetime


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    description: str
    lead_id: int | None
    is_archived: bool
    issue_count: int  # issues that exist now (set by the router, not a column)
    created_at: datetime
    updated_at: datetime
    members: list[ProjectMemberOut]


class ProjectCreate(BaseModel):
    name: ProjectName
    key: str = Field(pattern=PROJECT_KEY)
    description: str = ""


class ProjectUpdate(BaseModel):
    # No key: issue keys like CIM-12 are stored, so changing the key would leave them pointing nowhere.
    name: ProjectName = None
    description: str = None
    lead_id: int | None = None  # must be a project member; null = no lead
    is_archived: bool = None


class ProjectMemberAdd(BaseModel):
    user_id: int
    role: ProjectRole = "Member"


class ProjectMemberUpdate(BaseModel):
    role: ProjectRole


class SummaryStats(BaseModel):
    open_issues: int
    completed_issues: int
    member_count: int
    days_remaining: int | None  # days left in the active sprint; None without one


class ProjectSummary(BaseModel):
    project_id: int
    name: str
    status: Literal["Active", "Archived"]
    active_sprint_id: int | None
    stats: SummaryStats


# ---------- Issues ----------

IssueStatus = Literal["todo", "in_progress", "in_review", "done"]
IssueType = Literal["task", "bug", "story", "epic"]
Priority = Annotated[int, Field(ge=1, le=5)]  # 1 Highest, 2 High, 3 Medium, 4 Low, 5 Lowest

LabelName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]


def merge_labels(labels: list[str]) -> list[str]:
    """Drop repeats, treating "Bug" and "bug" as the same label; the first spelling wins."""
    merged: list[str] = []
    seen: set[str] = set()
    for label in labels:
        if label.lower() not in seen:
            seen.add(label.lower())
            merged.append(label)
    if len(merged) > 5:
        raise ValueError("An issue can have at most 5 labels")
    return merged


# Each item is trimmed and length-checked first (LabelName), then the whole list is merged and counted.
Labels = Annotated[list[LabelName], AfterValidator(merge_labels)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class IssueCreate(BaseModel):
    project_id: int
    title: Title
    description: str = ""
    issue_type: IssueType = "task"
    status: IssueStatus = "todo"
    priority: Priority = 3
    assignee_id: int | None = None
    parent_id: int | None = None
    sprint_id: int | None = None
    story_points: int = Field(default=0, ge=0)
    labels: Labels = []
    due_date: datetime | None = None


class IssueUpdate(BaseModel):
    # No project_id: moving an issue to another project would change its key.
    title: Title = None
    description: str = None
    issue_type: IssueType = None
    status: IssueStatus = None
    priority: Priority = None
    assignee_id: int | None = None
    parent_id: int | None = None
    sprint_id: int | None = None
    story_points: int = Field(default=None, ge=0)
    labels: Labels = None
    due_date: datetime | None = None


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issue_key: str
    project_id: int
    number: int
    issue_type: str
    parent_id: int | None
    title: str
    description: str
    status: str
    priority: int
    assignee_id: int | None
    reporter_id: int | None
    story_points: int
    sprint_id: int | None
    labels: list[str]
    due_date: datetime | None
    created_at: datetime
    updated_at: datetime


class StatusMove(BaseModel):
    status: IssueStatus


class StatusMoveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    issue_key: str
    status: str
    updated_at: datetime


class BulkUpdates(BaseModel):
    """The fields a bulk edit may set, the same for every selected issue."""
    status: IssueStatus = None
    priority: Priority = None
    assignee_id: int | None = None
    sprint_id: int | None = None


class BulkUpdateRequest(BaseModel):
    issue_keys: list[str] = Field(min_length=1, max_length=100)
    updates: BulkUpdates


class BulkResult(BaseModel):
    issue_key: str
    status: Literal["Updated", "Failed"]
    updated_at: datetime | None = None
    error: str | None = None


class BulkCounts(BaseModel):
    total: int
    success_count: int
    failure_count: int


class BulkUpdateResponse(BaseModel):
    summary: BulkCounts
    results: list[BulkResult]


class BulkDeleteRequest(BaseModel):
    issue_keys: list[str] = Field(min_length=1, max_length=100)


class BoardColumn(BaseModel):
    id: IssueStatus
    name: str
    issues: list[IssueOut]


class BoardOut(BaseModel):
    project_id: int
    sprint_id: int | None  # the active sprint shown on the board; None = no active sprint
    columns: list[BoardColumn]


# ---------- Sprints ----------

SprintName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class SprintCreate(BaseModel):
    name: SprintName
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintUpdate(BaseModel):
    name: SprintName = None
    goal: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class SprintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    goal: str | None
    status: str
    start_date: datetime | None
    end_date: datetime | None
    completed_date: datetime | None
    created_by: int | None
    created_at: datetime


class SprintComplete(BaseModel):
    destination_sprint_id: int | None = None  # a planned sprint of the same project; None = backlog


class SprintCompleteOut(BaseModel):
    id: int
    status: str
    completed_date: datetime
    completed_issues: int
    moved_issues: int


class SprintIssuesAdd(BaseModel):
    issue_keys: list[str] = Field(min_length=1, max_length=100)


class SprintIssuesAdded(BaseModel):
    sprint_id: int
    added: list[str]


# ---------- Comments ----------

# Trimmed first, then checked, so a comment of only spaces is rejected.
CommentBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CommentCreate(BaseModel):
    content: CommentBody
    parent_id: int | None = None  # reply to this comment (same issue)


class CommentUpdate(BaseModel):
    content: CommentBody


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issue_id: int
    author_id: int | None
    parent_id: int | None
    content: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime
