from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, computed_field


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
    username: str = Field(max_length=64)
    name: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=255)  # Password must be at least 8 characters long
    role: Literal["Admin", "Member", "Guest"] = "Member"  # has to be exactly one of the three roles, default is "Member"


class Token(BaseModel):
    access_token: str
    token_type: str


IssueStatus = Literal["backlog", "todo", "in_progress", "in_review", "done", "canceled"]

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


class IssueCreate(BaseModel):
    team_id: int
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    status: IssueStatus = "backlog"
    priority: int = Field(default=0, ge=0, le=4)
    assignee_id: int | None = None
    labels: Labels = []
    project_id: int | None = None


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    number: int
    title: str
    description: str
    status: str
    priority: int
    creator_id: int
    assignee_id: int | None
    labels: list[str]
    project_id: int | None
    created_at: datetime
    updated_at: datetime


class IssueUpdate(BaseModel):
    title: str = Field(default=None, min_length=1, max_length=255)
    description: str = None
    status: IssueStatus = None
    priority: int = Field(default=None, ge=0, le=4)
    assignee_id: int | None = None
    labels: Labels = None
    project_id: int | None = None


TeamRole = Literal["owner", "member"]
TEAM_KEY = r"^[A-Z]{1,5}$"
HEX_COLOR = r"^#[0-9a-fA-F]{6}$"


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    role: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    key: str
    color: str
    created_at: datetime
    members: list[TeamMemberOut]


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    key: str = Field(pattern=TEAM_KEY)
    color: str = Field(pattern=HEX_COLOR)


class TeamUpdate(BaseModel):
    # No key: it's fixed after creation.
    name: str = Field(default=None, min_length=1, max_length=255)
    color: str = Field(default=None, pattern=HEX_COLOR)


class TeamMemberAdd(BaseModel):
    user_id: int
    role: TeamRole = "member"


class TeamMemberUpdate(BaseModel):
    role: TeamRole


# Trimmed first, then checked, so a comment of only spaces is rejected.
CommentBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CommentCreate(BaseModel):
    body: CommentBody


class CommentUpdate(BaseModel):
    body: CommentBody


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issue_id: int
    author_id: int
    body: str
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def edited(self) -> bool:
        return self.updated_at > self.created_at


ProjectStatus = Literal["planned", "in_progress", "completed", "canceled"]
# Trimmed before the length check, so "Q4 launch " can't sneak past the unique-name rule as a different name.
ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProjectCreate(BaseModel):
    team_id: int
    name: ProjectName
    description: str = ""
    status: ProjectStatus = "planned"


class ProjectUpdate(BaseModel):
    # No team_id: moving a project would leave its issues in a different team than the project.
    name: ProjectName = None
    description: str = None
    status: ProjectStatus = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    name: str
    description: str
    status: str
    created_at: datetime
