from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


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


class IssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    status: IssueStatus = "backlog"
    priority: int = Field(default=0, ge=0, le=4)
    assignee_id: int | None = None


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    status: str
    priority: int
    creator_id: int
    assignee_id: int | None
    created_at: datetime
    updated_at: datetime


class IssueUpdate(BaseModel):
    title: str = Field(default=None, min_length=1, max_length=255)
    description: str = None
    status: IssueStatus = None
    priority: int = Field(default=None, ge=0, le=4)
    assignee_id: int | None = None
