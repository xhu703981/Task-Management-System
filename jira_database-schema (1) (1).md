# TaskManagement Database Schema

---

## Table of Contents

- [Overview](#overview)
- [Setup: extensions and shared trigger](#setup-extensions-and-shared-trigger)
- [Database Tables](#database-tables)
  - [Table: users](#table-users)
  - [Table: projects](#table-projects)
  - [Table: project_members](#table-project_members)
  - [Table: sprints](#table-sprints)
  - [Table: issues](#table-issues)
  - [Table: comments](#table-comments)
  - [Table: attachments](#table-attachments)
  - [Table: notifications](#table-notifications)
- [Key Relationships](#key-relationships)
- [Notes on Implementation](#notes-on-implementation)

---

## Overview

This schema defines the backend structure for TaskManagement, a Jira-style issue tracker. It is optimized for high-performance PostgreSQL operations, utilizing pgvector for AI search and supporting a microservices-style event architecture with Kafka.

All timestamps are `TIMESTAMPTZ` (stored in UTC, converted on read), so times stay correct for users in different time zones.

---

## Setup: extensions and shared trigger

Two extensions must exist before the tables are created, and the `update_*_modtime` triggers below all call one shared function.

```sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector: VECTOR type + hnsw index (needs the pgvector/pgvector:pg16 image)
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram index for fuzzy name search (gin_trgm_ops)

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Database Tables

### Table: users

| Column           | Type      | Constraints      | Description                                                        |
| ---------------- | --------- | ---------------- | ------------------------------------------------------------------ |
| id               | SERIAL    | PRIMARY KEY      | Unique identifier for each user                                    |
| username         | TEXT      | UNIQUE, NOT NULL | User's chosen username                                             |
| email            | TEXT      | UNIQUE, NOT NULL | User's email address                                               |
| name             | TEXT      | NOT NULL         | Display name ("Keya Wang")                                         |
| role             | TEXT      | NOT NULL, DEFAULT 'Member' | Workspace role: Admin (creates projects, manages users) or Member |
| password_hash    | TEXT      |                  | Hashed password (NULL for OAuth users)                             |
| auth_provider    | TEXT      |                  | Authentication provider (NULL for local auth, "google" for Google) |
| auth_provider_id | TEXT      |                  | Provider-specific user ID                                          |
| created_at       | TIMESTAMPTZ | NOT NULL         | When the user was created                                          |
| updated_at       | TIMESTAMPTZ | NOT NULL         | When the user was last updated                                     |

**Indexes:**

- PRIMARY KEY on `id` (automatically created)
- UNIQUE INDEX on `username` (automatically created by UNIQUE constraint)
- UNIQUE INDEX on `email` (automatically created by UNIQUE constraint)
- UNIQUE INDEX on `(auth_provider, auth_provider_id)` for OAuth lookups: one Google account maps to exactly one user

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Admin', 'Member')),
    password_hash TEXT, -- NULL for OAuth users
    auth_provider TEXT, -- 'google', 'github', etc.
    auth_provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- every user can log in somehow: with a password, or through a provider
    CHECK (password_hash IS NOT NULL OR auth_provider IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth ON users (auth_provider, auth_provider_id);

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table: projects

| Column      | Type      | Constraints          | Description                             |
| ----------- | --------- | -------------------- | --------------------------------------- |
| id          | SERIAL    | PRIMARY KEY          | Unique project ID                       |
| name        | TEXT      | NOT NULL             | Project display name                    |
| key         | TEXT      | UNIQUE, NOT NULL     | Short code prefix (e.g., "PROJ", "API"); can't change after creation |
| description | TEXT      | NOT NULL, DEFAULT '' | What the project is about               |
| lead_id     | INTEGER   | REFERENCES users(id) | Displayed owner (permissions come from project_members.role) |
| last_issue_number | INTEGER | NOT NULL, DEFAULT 0 | Last issue number handed out; the next issue is KEY-(last_issue_number+1). Not the number of issues: deleting CIM-3 does not lower it |
| is_archived | BOOLEAN   | DEFAULT FALSE        | Flag for active/archived status         |
| created_at  | TIMESTAMPTZ | NOT NULL             | Date of project creation                |
| updated_at  | TIMESTAMPTZ | NOT NULL             | Last configuration change               |

**Indexes:**

- PRIMARY KEY on `id`
- UNIQUE INDEX on `key`
- INDEX on `lead_id`
- GIN INDEX on `name` using pg_trgm
- No index on `is_archived`: a workspace has tens of projects, and Postgres scans a table that small faster than it would use an index on a true/false column.

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'), -- 2-10 chars, starts with a letter (Jira's rule)
    description TEXT NOT NULL DEFAULT '',
    lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_issue_number INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_lead ON projects (lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_name_search ON projects USING gin (name gin_trgm_ops);

CREATE TRIGGER update_projects_modtime BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table: project_members

| Column     | Type      | Constraints                 | Description                          |
| ---------- | --------- | --------------------------- | ------------------------------------ |
| project_id | INTEGER   | PK, REFERENCES projects(id) | The project the user belongs to      |
| user_id    | INTEGER   | PK, REFERENCES users(id)    | The user granted access              |
| role       | TEXT      | DEFAULT 'Member'            | Access level (Admin, Member, Viewer) |
| joined_at  | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP   | When the user was added              |

**Indexes:**

- PRIMARY KEY on `(project_id, user_id)`: also serves "members of a project" (leading column)
- INDEX on `user_id`: "projects I belong to" (the PK can't serve it because `user_id` is the second column)

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Admin', 'Member', 'Viewer')),
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members (user_id);
```

---

### Table: sprints

| Column         | Type      | Constraints                       | Description                    |
| -------------- | --------- | --------------------------------- | ------------------------------ |
| id             | SERIAL    | PRIMARY KEY                       | Unique sprint identifier       |
| project_id     | INTEGER   | NOT NULL, REFERENCES projects(id) | Project the sprint belongs to  |
| name           | TEXT      | NOT NULL                          | Sprint name (e.g., "Sprint 1") |
| goal           | TEXT      | NULL                              | Sprint goal/objective          |
| start_date     | TIMESTAMPTZ | NULL                              | Sprint start date              |
| end_date       | TIMESTAMPTZ | NULL                              | Sprint end date                |
| completed_date | TIMESTAMPTZ | NULL                              | Date sprint was completed      |
| status         | TEXT      | NOT NULL                          | planned, active, completed     |
| created_by     | INTEGER   | REFERENCES users(id)              | User who created the sprint    |
| created_at     | TIMESTAMPTZ | DEFAULT NOW()                     | Creation timestamp             |
| updated_at     | TIMESTAMPTZ | DEFAULT NOW()                     | Last update timestamp          |

**Indexes:**

- PRIMARY KEY on `id`
- INDEX on `(project_id, status)`: "active / planned sprints of a project". Its leading column also covers plain `project_id` lookups, so a separate `project_id` index isn't needed.
- INDEX on `(project_id, start_date)`: sprints of a project in date order
- A standalone `status` or `completed_date` index is not worth it: every sprint query is scoped to one project, and a project has only tens of sprints.
- OPTIONAL: UNIQUE PARTIAL INDEX on `project_id WHERE status = 'active'` enforces "at most one active sprint per project" in the database.

**SQL for creating the table:**

```sql
CREATE TABLE sprints (
    id SERIAL PRIMARY KEY,

    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    goal TEXT,

    start_date TIMESTAMPTZ NULL,
    end_date TIMESTAMPTZ NULL,
    completed_date TIMESTAMPTZ NULL,

    status TEXT NOT NULL DEFAULT 'planned',

    created_by INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_sprints_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sprints_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_sprints_status
        CHECK (status IN ('planned', 'active', 'completed')),

    CONSTRAINT chk_sprints_dates
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_status ON sprints (project_id, status);
CREATE INDEX IF NOT EXISTS idx_sprints_project_start ON sprints (project_id, start_date);

CREATE TRIGGER update_sprints_modtime BEFORE UPDATE ON sprints
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table: issues

| Column       | Type      | Constraints                       | Description               |
| ------------ | --------- | --------------------------------- | ------------------------- |
| id           | SERIAL    | PRIMARY KEY                       | Internal unique ID        |
| issue_key    | TEXT      | UNIQUE, NOT NULL                  | Human-readable key ("CIM-12") |
| project_id   | INTEGER   | NOT NULL, REFERENCES projects(id) | Parent project            |
| number       | INTEGER   | NOT NULL, UNIQUE with project_id  | The 12 in CIM-12          |
| issue_type   | TEXT      | NOT NULL, DEFAULT 'task'          | task, bug, story, epic    |
| parent_id    | INTEGER   | REFERENCES issues(id)             | The epic this issue belongs to |
| title        | TEXT      | NOT NULL                          | Issue headline            |
| description  | TEXT      |                                   | Detailed task information |
| status       | TEXT      | NOT NULL, DEFAULT 'todo'          | todo, in_progress, in_review, done. "Backlog" is not a status: it means sprint_id IS NULL |
| priority     | SMALLINT  | NOT NULL, DEFAULT 3               | 1 Highest, 2 High, 3 Medium, 4 Low, 5 Lowest (sorts correctly with ORDER BY) |
| assignee_id  | INTEGER   | REFERENCES users(id)              | Assigned user             |
| reporter_id  | INTEGER   | REFERENCES users(id)              | Issue creator             |
| story_points | INTEGER   | DEFAULT 0                         | Estimated effort          |
| sprint_id    | INTEGER   | REFERENCES sprints(id)            | Sprint it's planned in; NULL = backlog |
| labels       | TEXT[]    | NOT NULL, DEFAULT '{}', at most 5 | Free-text tags ("frontend", "bug-bash") |
| due_date     | TIMESTAMPTZ |                                 | Deadline; shown on the project calendar |
| embedding    | VECTOR(1536) |                                | Title+description embedding for semantic search |
| created_at   | TIMESTAMPTZ | NOT NULL                          | Creation timestamp        |
| updated_at   | TIMESTAMPTZ | NOT NULL                          | Last activity timestamp   |

**Indexes:**

- UNIQUE on `(project_id, number)`: its leading column also serves every "issues of a project" lookup, so a separate `project_id` index would be redundant
- INDEX on `assignee_id`
- INDEX on `sprint_id` (sprint board, and the `ON DELETE SET NULL` when a sprint is deleted)
- INDEX on `parent_id` (children of an epic)
- HNSW INDEX on `embedding` for AI search

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    issue_key TEXT UNIQUE NOT NULL, -- e.g., 'PROJ-101'
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    issue_type TEXT NOT NULL DEFAULT 'task' CHECK (issue_type IN ('task', 'bug', 'story', 'epic')),
    parent_id INTEGER REFERENCES issues(id) ON DELETE SET NULL, -- the epic; deleting an epic keeps its children
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
    priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1 Highest ... 5 Lowest
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    story_points INTEGER NOT NULL DEFAULT 0 CHECK (story_points >= 0),
    sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL, -- deleting a sprint sends its issues back to the backlog
    labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 5),
    due_date TIMESTAMPTZ,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues (assignee_id);
CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues (sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_parent ON issues (parent_id);
CREATE INDEX IF NOT EXISTS idx_issues_embedding ON issues USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER update_issues_modtime BEFORE UPDATE ON issues
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table: comments

| Column     | Type      | Constraints                     | Description                       |
| ---------- | --------- | ------------------------------- | --------------------------------- |
| id         | SERIAL    | PRIMARY KEY                     | Unique identifier for the comment |
| issue_id   | INTEGER   | NOT NULL, REFERENCES issues(id) | Parent issue                      |
| author_id  | INTEGER   | REFERENCES users(id)            | User who wrote the comment        |
| parent_id  | INTEGER   | REFERENCES comments(id)         | Parent comment for threading      |
| content    | TEXT      | NOT NULL                        | Comment body                      |
| is_edited  | BOOLEAN   | DEFAULT FALSE                   | Shows edited state in UI          |
| created_at | TIMESTAMPTZ | NOT NULL                        | Creation timestamp                |
| updated_at | TIMESTAMPTZ | NOT NULL                        | Last modification timestamp       |

**Indexes:**

INDEX on issue_id (To load all comments for one ticket instantly)

INDEX on author_id (To find all comments by a specific user)

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_issue ON comments (issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments (author_id);

CREATE TRIGGER update_comments_modtime BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table: attachments

| Column       | Type      | Constraints                     | Description                             |
| ------------ | --------- | ------------------------------- | --------------------------------------- |
| id           | UUID      | PRIMARY KEY                     | Unique ID (usually matches S3 file key) |
| issue_id     | INTEGER   | NOT NULL, REFERENCES issues(id) | The issue this file belongs to          |
| uploader_id  | INTEGER   | REFERENCES users(id)            | The user who uploaded the file          |
| file_name    | TEXT      | NOT NULL                        | Original filename                       |
| file_url     | TEXT      | NOT NULL                        | Public/Private URL to cloud storage     |
| file_size    | BIGINT    | NOT NULL                        | Size in bytes                           |
| content_type | TEXT      | NOT NULL                        | MIME type (e.g., image/png)             |
| created_at   | TIMESTAMPTZ | NOT NULL, DEFAULT now()         | Date of upload                          |

**Indexes:**

- INDEX on issue_id (To list all files on a ticket)

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_issue ON attachments (issue_id);
```

---

### Table: notifications

| Column     | Type      | Constraints                    | Description                            |
| ---------- | --------- | ------------------------------ | -------------------------------------- |
| id         | SERIAL    | PRIMARY KEY                    | Unique notification ID                 |
| user_id    | INTEGER   | NOT NULL, REFERENCES users(id) | Recipient of the notification          |
| message    | TEXT      | NOT NULL                       | Notification body text                 |
| link       | TEXT      |                                | Redirect path (e.g., "/issue/API-101") |
| is_read    | BOOLEAN   | DEFAULT FALSE                  | Status for unread badges               |
| created_at | TIMESTAMPTZ | DEFAULT now()                  | When the alert was triggered           |

**Indexes:**

- PRIMARY KEY on `id`
- INDEX on `user_id`
- PARTIAL INDEX on unread notifications (`is_read = FALSE`)

**SQL for creating the table:**

```sql
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    link TEXT, -- Deep link to issue or comment
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_unread_notifications_user
ON notifications(user_id)
WHERE is_read = FALSE;
```

---

## Key Relationships

**Relationship 1: User-to-Project (Ownership)**

- Type: One-to-Many
- Description: A single user acts as the "Project Lead," possessing administrative authority over the project's settings and lifecycle.
- Implementation: Through the `lead_id` foreign key in the projects table.
- Creation requirement:
- Deletion behavior: If a user is deleted, the project remains, but the lead_id is typically SET NULL or reassigned to a system administrator to prevent project "orphaning."
- Resource persistence:

**Relationship 2: User-to-Project (Membership)**

- Type: Many-to-Many
- Description: Defines the group of users who are authorized to participate in a project (Developers, Testers, Viewers).
- Implementation: Through a join table (e.g., project_members) containing `user_id` and `project_id`.
- Deletion behavior: When a user is deleted, resources remain but user association is removed (SET NULL)
- Resource persistence: Removing a user from a project membership does not delete their historical contributions (like comments or past assignments) within that project.

**Relationship 3: Project-to-Issue**

- Type: One-to-Many
- Description: A single project acts as a container for multiple issues, tasks, and bugs.
- Implementation: Through `project_id` foreign key in the issues table.
- Creation requirement: Issues must be associated with a valid project to generate a unique `issue_key`
- Deletion behavior: When a project is deleted, all associated issues are permanently removed (ON DELETE CASCADE).

**Relationship 4:Issue-to-Comment**

- Type: One-to-Many
- Description: Each issue can have an ongoing conversation thread consisting of multiple comments.
- Implementation: Through `issue_id` foreign key in the comments table.
- Creation requirement: All resources must be created by authenticated users (enforced at application level)
- Nesting logic: Includes a self-referencing `parent_id` to support threaded replies within the same issue.
- Deletion behavior: Deleting an issue removes all related comments. Deleting a parent comment removes all nested replies (ON DELETE CASCADE).

**Relationship 5:Issue-to-Attachment**

- Type: One-to-Many
- Description: An issue can have multiple supporting files, images, or documents attached to it.
- Implementation: Through `issue_id` foreign key in the attachments table.
- Storage requirement: The database stores metadata and a pointer (file_url), while the physical file resides in cloud storage.
- Deletion behavior: Deleting an issue removes the database record and triggers a cleanup of the physical file in storage.

**Relationship 6: User-to-Notification**

- Type: One-to-Many
- Description: A single user receives multiple alerts based on mentions, assignments, or status updates.
- Implementation: Through `user_id` foreign key in the notifications table.
- Creation requirement: Entries are typically generated via a Kafka event consumer when a relevant action occurs elsewhere in the system.
- Deletion behavior: Notifications are removed if the recipient user is deleted (ON DELETE CASCADE).

**Relationship 7: Project-to-Sprint**

- Type: One-to-Many
- Description: A project plans its work in time-boxed sprints.
- Implementation: Through the `project_id` foreign key in the sprints table.
- Deletion behavior: Deleting a project deletes its sprints (ON DELETE CASCADE).

**Relationship 8: Sprint-to-Issue**

- Type: One-to-Many (optional)
- Description: An issue is planned in at most one sprint at a time; an issue with no sprint is in the backlog.
- Implementation: Through the nullable `sprint_id` foreign key in the issues table. The sprint must belong to the same project as the issue (enforced at application level).
- Deletion behavior: Deleting a sprint keeps its issues and moves them back to the backlog (ON DELETE SET NULL).

**Relationship 9: Epic-to-Issue**

- Type: One-to-Many (self-referencing, optional)
- Description: An epic (an issue with `issue_type = 'epic'`) groups the stories, tasks and bugs of one larger piece of work.
- Implementation: Through the nullable `parent_id` foreign key in the issues table. The parent must be an epic in the same project, and an epic can't have a parent (enforced at application level).
- Deletion behavior: Deleting an epic keeps its children; they only lose the parent (ON DELETE SET NULL).

---

## Notes on Implementation

1. **Foreign Key Constraints**
   - Every relationship uses hard foreign keys in PostgreSQL to ensure data integrity at the database level.

2. **Performance**
   - All "Many" sides of these relationships (e.g., issue_id in comments) are indexed to ensure that loading an issue page remains fast even with thousands of comments.

3. **Microservices Decoupling**
   - While these are DB relationships, the Notification and Search logic use an Event-Driven approach. The database stores the state, but Kafka moves the data between the "Action" and the "Alert."
