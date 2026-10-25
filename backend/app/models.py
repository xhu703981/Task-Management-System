from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, FetchedValue, ForeignKey, Index, Integer, SmallInteger, Text,
    UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def created_at_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now())


def updated_at_column() -> Mapped[datetime]:
    # The database trigger update_<table>_modtime sets updated_at on every UPDATE (see the baseline
    # migration). FetchedValue tells SQLAlchemy the database changes it, so after an UPDATE it
    # reloads the value instead of keeping the stale one in Python.
    return mapped_column(DateTime(timezone=True), server_default=func.now(), server_onupdate=FetchedValue())


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('Admin', 'Member')", name="role_valid"),
        # Every user can log in somehow: with a password, or through a provider like Google.
        CheckConstraint("password_hash IS NOT NULL OR auth_provider IS NOT NULL", name="can_log_in"),
        # One Google account maps to exactly one user. Local users have (NULL, NULL), and NULLs never
        # count as equal in a UNIQUE index, so any number of local users is fine.
        Index("ix_users_auth_provider", "auth_provider", "auth_provider_id", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(Text, unique=True)
    email: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, server_default="Member")
    password_hash: Mapped[str | None] = mapped_column(Text)
    auth_provider: Mapped[str | None] = mapped_column(Text)
    auth_provider_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

# Mapped[T] is a generic type annotation from the ORM that marks an attribute as a mapped column.
# SQLAlchemy reads it to infer the SQL type and nullability, and type checkers read it to know the attribute is a query expression on the class and a plain T on an instance.


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("key ~ '^[A-Z][A-Z0-9]{1,9}$'", name="key_valid"),
        # Trigram index: fast fuzzy search on the name (WHERE name ILIKE '%migr%').
        Index("ix_projects_name_trgm", "name", postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    key: Mapped[str] = mapped_column(Text, unique=True)
    description: Mapped[str] = mapped_column(Text, server_default="")
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    last_issue_number: Mapped[int] = mapped_column(Integer, server_default="0")
    is_archived: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()

    # Not a column: project.members loads this project's ProjectMember rows. The cascade says they belong
    # to the project, so deleting the project deletes them (matching ON DELETE CASCADE in the database).
    members: Mapped[list["ProjectMember"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", passive_deletes=True
    )


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        CheckConstraint("role IN ('Admin', 'Member', 'Viewer')", name="role_valid"),
    )

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    role: Mapped[str] = mapped_column(Text, server_default="Member")
    joined_at: Mapped[datetime] = created_at_column()

    #ondelete="CASCADE". This says what happens to membership rows when the thing they point to is deleted:
    # - When a project is deleted, all its membership rows are deleted too. A membership in a project that doesn't exist means nothing.
    # - When a user is deleted, their memberships are deleted as well.


class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = (
        CheckConstraint("status IN ('planned', 'active', 'completed')", name="status_valid"),
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date > start_date", name="dates_valid"),
        Index("ix_sprints_project_id_status", "project_id", "status"),
        Index("ix_sprints_project_id_start_date", "project_id", "start_date"),
        # Partial unique index: only rows with status 'active' are in it, so a project can have
        # many planned and completed sprints but at most one active one.
        Index("uq_sprints_one_active", "project_id", unique=True, postgresql_where=text("status = 'active'")),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    goal: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, server_default="planned")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint("issue_type IN ('task', 'bug', 'story', 'epic')", name="issue_type_valid"),
        CheckConstraint("status IN ('todo', 'in_progress', 'in_review', 'done')", name="status_valid"),
        CheckConstraint("priority BETWEEN 1 AND 5", name="priority_valid"),
        CheckConstraint("story_points >= 0", name="story_points_valid"),
        CheckConstraint("cardinality(labels) <= 5", name="labels_max_5"),
        # Also serves "issues of a project" lookups (project_id is the leading column).
        UniqueConstraint("project_id", "number", name="uq_issues_project_id_number"),
        Index(
            "ix_issues_embedding", "embedding",
            postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_key: Mapped[str] = mapped_column(Text, unique=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer)
    issue_type: Mapped[str] = mapped_column(Text, server_default="task")
    # The epic this issue belongs to. Deleting the epic keeps its children.
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("issues.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default="")
    status: Mapped[str] = mapped_column(Text, server_default="todo")
    priority: Mapped[int] = mapped_column(SmallInteger, server_default="3")
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    story_points: Mapped[int] = mapped_column(Integer, server_default="0")
    # NULL = in the backlog. Deleting a sprint sends its issues back to the backlog.
    sprint_id: Mapped[int | None] = mapped_column(ForeignKey("sprints.id", ondelete="SET NULL"), index=True)
    labels: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    # Threaded replies. Deleting a comment deletes its replies.
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    is_edited: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
