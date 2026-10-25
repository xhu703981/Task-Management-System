# TaskManagement API Documentation

---

## Table of Contents

- [TaskManagement API Documentation](#taskmanagement-api-documentation)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [API Endpoints](#api-endpoints)
    - [0. Conventions](#0-conventions)
      - [Objects](#objects)
    - [1. User Management Endpoints](#1-user-management-endpoints)
      - [1.1. Register User (Username/Password)](#11-register-user-usernamepassword)
      - [1.2. Register with Google](#12-register-with-google)
      - [1.3. Login (Username/Password)](#13-login-usernamepassword)
      - [1.4. Refresh Token](#14-refresh-token)
      - [1.5. Logout (Client-side)](#15-logout-client-side)
      - [1.6. Get User Profile](#16-get-user-profile)
      - [1.7. Update User Profile](#17-update-user-profile)
      - [1.8. Request Password Reset](#18-request-password-reset)
      - [1.9. Confirm Password Reset](#19-confirm-password-reset)
      - [1.10. Change Password (Logged-in User)](#110-change-password-logged-in-user)
      - [1.11. Update Workspace Role](#111-update-workspace-role)
      - [1.12. List Users and Get User](#112-list-users-and-get-user)
    - [2. Project and Board Management Endpoints](#2-project-and-board-management-endpoints)
      - [2.1. List Projects](#21-list-projects)
      - [2.2. Create Project](#22-create-project)
      - [2.3. Get Project Summary](#23-get-project-summary)
      - [2.4. Get Project Timeline](#24-get-project-timeline)
      - [2.5. Get Project Backlog](#25-get-project-backlog)
      - [2.6. Get Project Board](#26-get-project-board)
      - [2.7. Get Project Calendar](#27-get-project-calendar)
      - [2.8. Get Project List](#28-get-project-list)
      - [2.9. Get Project Development](#29-get-project-development)
      - [2.10. Get Archived Work](#210-get-archived-work)
      - [2.11. Get Project](#211-get-project)
      - [2.12. Update Project Settings](#212-update-project-settings)
      - [2.13. Delete Project](#213-delete-project)
      - [2.14. Manage Project Members](#214-manage-project-members)
    - [3. Sprint Operations Endpoints](#3-sprint-operations-endpoints)
      - [3.1. Create Sprint](#31-create-sprint)
      - [3.2. Get and Update Sprint](#32-get-and-update-sprint)
      - [3.3. Start Sprint](#33-start-sprint)
      - [3.4. Complete Sprint](#34-complete-sprint)
      - [3.5. Get Project Sprints](#35-get-project-sprints)
      - [3.6. Get Sprint Issues](#36-get-sprint-issues)
      - [3.7. Add Issues to Sprint](#37-add-issues-to-sprint)
      - [3.8. Delete Sprint](#38-delete-sprint)
    - [4. Issue Operations Endpoints](#4-issue-operations-endpoints)
      - [4.1. Create Issue](#41-create-issue)
      - [4.2. Get Issue Details](#42-get-issue-details)
      - [4.3. Update Issue Details](#43-update-issue-details)
      - [4.4. Move Issue Status](#44-move-issue-status)
      - [4.5. List Issue Comments](#45-list-issue-comments)
      - [4.6. Add Issue Comment](#46-add-issue-comment)
      - [4.7. Bulk Update Issues](#47-bulk-update-issues)
      - [4.8. Bulk Delete Issues](#48-bulk-delete-issues)
      - [4.9. Delete Issue](#49-delete-issue)
      - [4.10. Edit and Delete Comment](#410-edit-and-delete-comment)
    - [5. Artificial Intelligence Endpoints](#5-artificial-intelligence-endpoints)
      - [5.1. Semantic Issue Search](#51-semantic-issue-search)
      - [5.2. AI Project Assistant](#52-ai-project-assistant)
      - [5.3. Issue Summary Generation](#53-issue-summary-generation)
    - [6. Attachment Management Endpoints](#6-attachment-management-endpoints)
      - [6.1. Request Upload URL](#61-request-upload-url)
      - [6.2. Confirm Upload Completion](#62-confirm-upload-completion)
      - [6.3. Get Attachment Preview](#63-get-attachment-preview)
      - [6.4. List Issue Attachments](#64-list-issue-attachments)
    - [7. Notification Endpoints](#7-notification-endpoints)
      - [7.1. Get Unread Count](#71-get-unread-count)
      - [7.2. Connect to Notification Stream](#72-connect-to-notification-stream)
      - [7.3. Mark All as Read](#73-mark-all-as-read)
    - [8. Analytics Endpoints](#8-analytics-endpoints)
      - [8.1. Get Velocity Chart](#81-get-velocity-chart)
      - [8.2. Get Burn-down Data](#82-get-burn-down-data)
      - [8.3. AI Predicted Bottlenecks](#83-ai-predicted-bottlenecks)
  - [Environment Variables](#environment-variables)

---

## Overview

This document outlines the API endpoints for the **TaskManagement** service. All paths are served under `/api` (e.g. `POST /api/auth/login`). TaskManagement allows users to:

1. **User Management**
   1. Create user accounts via standard credentials or Google OAuth
   2. Secure sessions using JWT authentication with refresh token support
   3. Manage user profiles and Role-Based Access Control (RBAC)

2. **Project and Board Management**
   1. Create projects and visualize workflows through Timelines, Backlogs, and Kanban Boards
   2. Access specialized views including project calendars and development tracking
   3. Manage project lifecycles by archiving work and updating global settings

3. **Issue Operations**
   1. Create and track individual tasks (Issues) with detailed descriptions
   2. Manage workflow stages by moving issues across status columns
   3. Foster collaboration through threaded comments on specific tasks

4. **Artificial Intelligence**
   1. Execute Semantic Search to find information based on intent rather than just keywords
   2. Use "Ask AI" for natural language querying of project data
   3. Generate instant ticket summaries and receive real-time streaming AI responses

5. **Attachment Management**
   1. Request secure upload URLs for file handling
   2. Store and preview attachments linked directly to project issues
   3. Maintain a organized list of all assets associated with specific tasks

6. **Notifications**
   1. Track unread activity counts across projects
   2. Connect to a real-time notification stream for instant updates
   3. Perform bulk actions like marking all alerts as read

7. **Analytics**
   1. Monitor team performance with Velocity Charts and Burn-down data
   2. Leverage AI to predict and identify potential project bottlenecks
   3. Access data-driven insights to optimize sprint planning

---

## API Endpoints

### 0. Conventions

**Implemented (sections 1–4).** Sections 5–8 are planned and not built yet.

- **Auth:** every endpoint except register, login and refresh needs `Authorization: Bearer {access_token}`. Access tokens last 1 hour; a refresh token (7 days) trades for a new one.
- **Roles:** the workspace role (`users.role`: `Admin` | `Member`) and the project role (`project_members.role`: `Admin` | `Member` | `Viewer`).
  - **See** a project and everything in it: any project member, or a workspace Admin.
  - **Write** (create/edit issues, comments, sprints): project Admin or Member, or a workspace Admin.
  - **Manage** (project settings, members, deleting sprints): project Admin, or a workspace Admin.
  - **Create projects, set workspace roles:** workspace Admin.
- **Hidden means 404:** a project you can't see (and its issues, sprints, comments) answers `404`, not `403`, so outsiders can't learn it exists. `403` means "you can see it, but your role can't do this".
- **Issue keys** like `CIM-12` are case-insensitive in paths (`/issues/cim-12` works).
- **PATCH** changes only the fields sent. Sending a field as `null` clears it where that's allowed (e.g. `assignee_id`).
- **Errors** look like `{"detail": "Only project Admins can do this"}`. `422` = the request breaks a rule (bad value, assignee not a member, ...); `409` = it conflicts with the current state (duplicate key, sprint already active, last Admin, ...).
- **Values:** `status` = `todo` | `in_progress` | `in_review` | `done` ("backlog" = `sprint_id` is null). `priority` = 1 Highest, 2 High, 3 Medium, 4 Low, 5 Lowest. `issue_type` = `task` | `bug` | `story` | `epic`.

#### Objects

These shapes are returned by many endpoints below.

**User**

```json
{ "id": 42, "email": "henry@example.com", "username": "henry_dev", "name": "Henry", "role": "Member", "created_at": "2026-05-29T14:30:00Z" }
```

**Project**: `issue_count` is how many issues exist now; `members` lists every member's role.

```json
{
  "id": 101,
  "name": "Cloud Infrastructure Migration",
  "key": "CIM",
  "description": "Moving legacy architecture to a secure microservices model.",
  "lead_id": 42,
  "is_archived": false,
  "issue_count": 42,
  "created_at": "2026-01-15T09:00:00Z",
  "updated_at": "2026-05-01T12:00:00Z",
  "members": [
    { "user_id": 42, "role": "Admin", "joined_at": "2026-01-15T09:00:00Z" },
    { "user_id": 88, "role": "Member", "joined_at": "2026-01-20T10:00:00Z" }
  ]
}
```

**Issue**: people, the epic and the sprint are ids; the client looks them up in the lists it already has.

```json
{
  "id": 402,
  "issue_key": "CIM-402",
  "project_id": 101,
  "number": 402,
  "issue_type": "task",
  "parent_id": 380,
  "title": "Configure Kafka KRaft mode",
  "description": "Migration from Zookeeper to KRaft for the event bus.",
  "status": "todo",
  "priority": 2,
  "assignee_id": 42,
  "reporter_id": 88,
  "story_points": 3,
  "sprint_id": 12345,
  "labels": ["infra", "kafka"],
  "due_date": "2026-06-10T23:59:59Z",
  "created_at": "2026-05-29T20:45:00Z",
  "updated_at": "2026-05-29T20:45:00Z"
}
```

**Sprint**

```json
{
  "id": 12345,
  "project_id": 101,
  "name": "Sprint 1",
  "goal": "Complete the user authentication module",
  "status": "planned",
  "start_date": "2026-06-15T09:00:00Z",
  "end_date": "2026-06-29T17:00:00Z",
  "completed_date": null,
  "created_by": 42,
  "created_at": "2026-06-10T10:00:00Z"
}
```

**Comment**: replies carry `parent_id`.

```json
{ "id": 501, "issue_id": 402, "author_id": 42, "parent_id": null, "content": "The Redis cache-aside logic is passing.", "is_edited": false, "created_at": "2026-05-29T21:25:00Z", "updated_at": "2026-05-29T21:25:00Z" }
```

---

### 1. User Management Endpoints

#### 1.1. Register User (Username/Password)

**Purpose:** Create an account. New accounts are workspace `Member`s; a `role` in the body is ignored. The very first account becomes the workspace `Admin` (otherwise nobody could create projects).

**Endpoint:** `/auth/register`

**Method:** `POST`

**Request Body:** (`name` is optional and defaults to the username; password at least 8 characters)

```json
{
  "username": "henry_dev",
  "email": "henry@example.com",
  "password": "securepassword123",
  "name": "Henry"
}
```

**Response:** (201 Created) a **User**.

**Errors:** 409 email or username taken · 422 invalid email / short password

---

#### 1.2. Register with Google

**Planned.**

**Purpose:** Create a new user account with Google authentication.

**Endpoint:** `/auth/google`

**Method:** `POST`

**Request Body:**

```json
{
  "token": "google_oauth_token"
}
```

**Response:** (201 Created) a **User**.

---

#### 1.3. Login (Username/Password)

**Purpose:** Authenticate and get an access token and a refresh token. (Swagger's Authorize button uses the same login as a form post at `/auth/token`.)

**Endpoint:** `/auth/login`

**Method:** `POST`

**Request Body:**

```json
{
  "username": "henry_dev",
  "password": "securepassword123"
}
```

**Response:** (200 OK)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": 42, "email": "henry@example.com", "username": "henry_dev", "name": "Henry", "role": "Admin", "created_at": "2026-05-29T14:30:00Z" }
}
```

**Errors:** 401 incorrect username or password

---

#### 1.4. Refresh Token

**Purpose:** Get a new access token using a refresh token. An access token is rejected here, and a refresh token is rejected everywhere else.

**Endpoint:** `/auth/refresh`

**Method:** `POST`

**Request Body:**

```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** (200 OK)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Errors:** 401 invalid, expired, or not a refresh token

---

#### 1.5. Logout (Client-side)

**Purpose:** Client removes tokens from storage. No server-side action required with pure JWT.

**Note:** In a pure JWT implementation, logout is handled client-side by removing the tokens from storage. The frontend application should delete both the access token and refresh token from localStorage or cookies when the user logs out, and then redirect to the login page.

---

#### 1.6. Get User Profile

**Purpose:** The current user, plus each project they belong to with their role there and how many unfinished issues are assigned to them.

**Endpoint:** `/users/me`

**Method:** `GET`

**Response:** (200 OK)

```json
{
  "id": 42,
  "email": "henry@example.com",
  "username": "henry_dev",
  "name": "Henry",
  "role": "Member",
  "created_at": "2026-05-29T14:30:00Z",
  "involved_projects": [
    { "project_id": 101, "name": "Cloud Migration", "key": "CIM", "role": "Admin", "active_tasks": 5 },
    { "project_id": 202, "name": "API Gateway Redesign", "key": "API", "role": "Member", "active_tasks": 2 }
  ]
}
```

---

#### 1.7. Update User Profile

**Purpose:** Update the current user's username, email, or display name.

**Endpoint:** `/users/me`

**Method:** `PATCH`

**Request Body:**

```json
{
  "username": "henry_updated",
  "email": "new_henry@example.com",
  "name": "Henry D."
}
```

**Response:** (200 OK) a **User**.

**Errors:** 409 email or username taken

---

#### 1.8. Request Password Reset

**Planned.**

**Purpose:** Start a password-reset flow by sending a reset link to the user's email.

**Endpoint:** `/auth/password-reset/request`

**Method:** `POST`

**Request Body:**

```json
{
  "email": "henry@example.com"
}
```

**Response:** (200 OK) `{ "message": "Password reset email sent." }` (also when the email is unknown, so the endpoint can't be used to find out who has an account)

---

#### 1.9. Confirm Password Reset

**Planned.**

**Purpose:** Complete password reset using the token sent by email.

**Endpoint:** `/auth/password-reset/confirm`

**Method:** `POST`

**Request Body:**

```json
{
  "token": "abcdef1234567890",
  "new_password": "NewP@ssw0rd!"
}
```

**Response:** (200 OK) `{ "message": "Password has been reset successfully." }`

---

#### 1.10. Change Password (Logged-in User)

**Purpose:** Allow a signed-in user to update their password.

**Endpoint:** `/users/me/password`

**Method:** `PATCH`

**Request Body:**

```json
{
  "current_password": "OldP@ss1",
  "new_password": "NewP@ssw0rd!"
}
```

**Response:** (200 OK) `{ "message": "Password changed successfully." }`

**Errors:** 400 current password is incorrect · 422 new password shorter than 8

---

#### 1.11. Update Workspace Role

**Purpose:** Set a user's workspace role: `Admin` (creates projects, manages users) or `Member`. (Workspace Admin only.) What a user can do inside a project is set separately by their project role (2.14).

**Endpoint:** `/users/{id}/role`

**Method:** `PATCH`

**Request Body:**

```json
{
  "role": "Admin"
}
```

**Response:** (200 OK) the updated **User**.

**Errors:** 403 not a workspace Admin · 404 user not found · 409 would leave the workspace without an Admin

---

#### 1.12. List Users and Get User

**Purpose:** Everyone in the workspace (for assignee and member pickers), or one user.

**Endpoint:** `/users` and `/users/{id}`

**Method:** `GET`

**Response:** (200 OK) a list of **User**, or one **User**. 404 if the id doesn't exist.

---

### 2. Project and Board Management Endpoints

#### 2.1. List Projects

**Purpose:** The projects the user can see (their own; a workspace Admin sees all). Populates the project switcher and dashboard.

**Endpoint:** `/projects`

**Method:** `GET`

**Response:** (200 OK) a list of **Project**.

---

#### 2.2. Create Project

**Purpose:** Create a project. Workspace Admins only. The creator becomes its lead and its first project Admin. The key (2–10 characters, capital letters and digits, starting with a letter) is permanent: issue keys like `CIM-12` are stored, so it can't change later.

**Endpoint:** `/projects`

**Method:** `POST`

**Request Body:**

```json
{
  "name": "Cloud Infrastructure Migration",
  "key": "CIM",
  "description": "Moving legacy architecture to a secure microservices model."
}
```

**Response:** (201 Created) the new **Project**.

**Errors:** 403 not a workspace Admin · 409 key taken · 422 invalid key

---

#### 2.3. Get Project Summary

**Purpose:** High-level counts of a project's health.

**Endpoint:** `/projects/{project_id}/summary`

**Method:** `GET`

**Response:** (200 OK) (`days_remaining` counts down to the active sprint's end; `null` without an active sprint)

```json
{
  "project_id": 101,
  "name": "Cloud Infrastructure Migration",
  "status": "Active",
  "active_sprint_id": 12345,
  "stats": {
    "open_issues": 24,
    "completed_issues": 115,
    "member_count": 8,
    "days_remaining": 45
  }
}
```

---

#### 2.4. Get Project Timeline

**Planned.** Needs a milestones table, which the schema doesn't have yet.

**Purpose:** Retrieve the milestones, roadmap, and scheduled releases for the project.

**Endpoint:** `/projects/{project_id}/timeline`

**Method:** `GET`

---

#### 2.5. Get Project Backlog

**Purpose:** Unfinished issues that aren't planned in any sprint (`sprint_id` null, status not `done`), most urgent first.

**Endpoint:** `/projects/{project_id}/backlog`

**Method:** `GET`

**Response:** (200 OK) a list of **Issue**, ordered by priority, then number.

---

#### 2.6. Get Project Board

**Purpose:** The Scrum board: the active sprint's issues in one column per status. With no active sprint, `sprint_id` is null and the columns are empty.

**Endpoint:** `/projects/{project_id}/board`

**Method:** `GET`

**Response:** (200 OK) (each `issues` item is a full **Issue**, shortened here)

```json
{
  "project_id": 101,
  "sprint_id": 12345,
  "columns": [
    { "id": "todo", "name": "To Do", "issues": [{ "issue_key": "CIM-12", "title": "Setup VPC Peering", "priority": 2, "issue_type": "task", "assignee_id": null }] },
    { "id": "in_progress", "name": "In Progress", "issues": [{ "issue_key": "CIM-10", "title": "Write Dockerfiles", "priority": 3, "issue_type": "story", "assignee_id": 42 }] },
    { "id": "in_review", "name": "In Review", "issues": [] },
    { "id": "done", "name": "Done", "issues": [] }
  ]
}
```

---

#### 2.7. Get Project Calendar

**Planned.** Issue deadlines come from `issues.due_date`; meeting events need a table first.

**Purpose:** Fetch all date-bound tasks, sprint deadlines, and launch events organized chronologically by date.

**Endpoint:** `/projects/{project_id}/calendar`

**Method:** `GET`

---

#### 2.8. Get Project List

**Purpose:** Every issue of the project for the "List" tab, newest first, narrowed by any filters given.

**Endpoint:** `/projects/{project_id}/list`

**Method:** `GET`

**Query Parameters:** (all optional)

- `status`: `todo` | `in_progress` | `in_review` | `done`
- `priority`: Integer 1-5
- `issue_type`: `task` | `bug` | `story` | `epic`
- `assignee_id`: Integer
- `sprint_id`: Integer
- `search`: String; matches the title or the key, ignoring case (`search=kafka`, `search=cim-40`)

**Response:** (200 OK) a list of **Issue**.

---

#### 2.9. Get Project Development

**Planned.** Needs a repository integration.

**Purpose:** Retrieve integrations, repository URLs, build/deployment statuses, and CI/CD pipelines connected to the project workspace.

**Endpoint:** `/projects/{project_id}/development`

**Method:** `GET`

---

#### 2.10. Get Archived Work

**Planned.**

**Purpose:** Access historic, archived issues, epics, or completed sprint history no longer active on the live boards.

**Endpoint:** `/projects/{project_id}/archive`

**Method:** `GET`

---

#### 2.11. Get Project

**Purpose:** One project with its settings and members.

**Endpoint:** `/projects/{project_id}`

**Method:** `GET`

**Response:** (200 OK) a **Project**.

---

#### 2.12. Update Project Settings

**Purpose:** Rename, describe, change the lead (must be a project member; `null` = no lead), or archive. Project Admins only. The key can't be changed.

**Endpoint:** `/projects/{project_id}`

**Method:** `PATCH`

**Request Body:**

```json
{
  "name": "Cloud Migration 2.0",
  "description": "Phase two",
  "lead_id": 88,
  "is_archived": false
}
```

**Response:** (200 OK) the updated **Project**.

**Errors:** 403 not a project Admin · 422 lead is not a member

---

#### 2.13. Delete Project

**Purpose:** Delete a project with all its issues, comments, sprints and memberships. Project Admins only.

**Endpoint:** `/projects/{project_id}`

**Method:** `DELETE`

**Response:** (204 No Content)

---

#### 2.14. Manage Project Members

**Purpose:** Add a member, change a member's role, or remove a member. Project Admins only, except that anyone may remove themselves (leave). A project always keeps at least one Admin. Removing someone keeps their issues and comments; if they were the lead, the project has no lead afterwards.

| Action      | Method   | Endpoint                                  | Body                                   | Response             |
| ----------- | -------- | ----------------------------------------- | -------------------------------------- | -------------------- |
| Add         | `POST`   | `/projects/{project_id}/members`          | `{ "user_id": 88, "role": "Member" }`  | 201, the **Project** |
| Change role | `PATCH`  | `/projects/{project_id}/members/{user_id}` | `{ "role": "Viewer" }`                 | 200, the **Project** |
| Remove      | `DELETE` | `/projects/{project_id}/members/{user_id}` |                                        | 204                  |

**Errors:** 403 not a project Admin · 404 not a member · 409 already a member, or would remove/demote the last Admin · 422 user doesn't exist

---

### 3. Sprint Operations Endpoints

Creating, editing, starting and completing sprints needs a project Admin or Member; deleting needs a project Admin.

#### 3.1. Create Sprint

**Purpose:** Create a new sprint within a specific project. Sprints are created in the `planned` state.

**Endpoint:** `/projects/{project_id}/sprints`

**Method:** `POST`

**Request Body:** (`goal` and the dates are optional; they're needed before the sprint can start)

```json
{
  "name": "Sprint 1",
  "goal": "Complete the user authentication module",
  "start_date": "2026-06-15T09:00:00Z",
  "end_date": "2026-06-29T17:00:00Z"
}
```

**Response:** (201 Created) the new **Sprint**.

**Errors:** 404 project not found · 422 `end_date` not after `start_date`

---

#### 3.2. Get and Update Sprint

**Purpose:** Read one sprint, or update its name, goal, or dates. A completed sprint can't be changed.

**Endpoint:** `/sprints/{sprint_id}`

**Method:** `GET` · `PATCH`

**Request Body:** (PATCH)

```json
{
  "name": "Sprint 1 - Updated",
  "goal": "Complete user auth and basic profile views"
}
```

**Response:** (200 OK) the **Sprint**.

**Errors:** 404 sprint not found · 409 sprint is completed · 422 invalid dates

---

#### 3.3. Start Sprint

**Purpose:** Move a sprint from `planned` to `active`.

**Endpoint:** `/sprints/{sprint_id}/start`

**Method:** `POST`

**Response:** (200 OK) the **Sprint** with `"status": "active"`.

**Errors:** 404 sprint not found · 409 sprint is not `planned`, lacks a start/end date, or the project already has an active sprint (the database's partial unique index decides, so two people pressing Start at once can't both win)

---

#### 3.4. Complete Sprint

**Purpose:** Move an active sprint to `completed`. Its `done` issues stay with it; unfinished issues move to the destination sprint, or to the backlog.

**Endpoint:** `/sprints/{sprint_id}/complete`

**Method:** `POST`

**Request Body:**

| Field                 | Type            | Description                                                                          |
| --------------------- | --------------- | ------------------------------------------------------------------------------------ |
| destination_sprint_id | integer \| null | A planned sprint of the same project to move unfinished issues to; `null` = backlog |

```json
{
  "destination_sprint_id": 98765
}
```

**Response:** (200 OK)

```json
{
  "id": 12345,
  "status": "completed",
  "completed_date": "2026-06-29T17:05:00Z",
  "completed_issues": 8,
  "moved_issues": 3
}
```

**Errors:** 404 sprint not found · 409 sprint is not `active` · 422 destination is not a planned sprint of this project

---

#### 3.5. Get Project Sprints

**Purpose:** List the sprints of a project, newest first.

**Endpoint:** `/projects/{project_id}/sprints`

**Method:** `GET`

**Query Parameters:**

- `status`: `planned` | `active` | `completed` (optional)
- `limit`: integer 1-200, default 50

**Response:** (200 OK) a list of **Sprint**.

---

#### 3.6. Get Sprint Issues

**Purpose:** List the issues planned in a sprint, most urgent first.

**Endpoint:** `/sprints/{sprint_id}/issues`

**Method:** `GET`

**Response:** (200 OK) a list of **Issue**.

---

#### 3.7. Add Issues to Sprint

**Purpose:** Move existing issues of the same project into a sprint (sets their `sprint_id`): all of them, or, if any key is invalid, none. To move an issue back to the backlog, `PATCH /issues/{issue_key}` with `"sprint_id": null`.

**Endpoint:** `/sprints/{sprint_id}/issues`

**Method:** `POST`

**Request Body:**

```json
{
  "issue_keys": ["CIM-12", "CIM-13"]
}
```

**Response:** (200 OK)

```json
{
  "sprint_id": 12345,
  "added": ["CIM-12", "CIM-13"]
}
```

**Errors:** 404 sprint not found · 409 sprint is `completed` · 422 an issue doesn't exist or belongs to another project

---

#### 3.8. Delete Sprint

**Purpose:** Delete a sprint. Its issues stay and go back to the backlog. Project Admins only.

**Endpoint:** `/sprints/{sprint_id}`

**Method:** `DELETE`

**Response:** (204 No Content)

---

### 4. Issue Operations Endpoints

Creating and editing issues needs a project Admin or Member; Viewers can read.

**Link rules** (checked on create, update, and bulk update, against the issue as it would be after the change; breaking one answers 422):

- the assignee is a member of the issue's project
- the parent is an epic of the same project, and an epic has no parent
- an epic that still has child issues can't change to another type
- the sprint belongs to the same project and isn't completed

#### 4.1. Create Issue

**Purpose:** Create a work item. It gets the next number of its project (`CIM-403`); numbers are never reused, even after a delete. The creator becomes the reporter.

**Endpoint:** `/issues`

**Method:** `POST`

**Request Body:** (only `project_id` and `title` are required; the rest shows the defaults or examples)

```json
{
  "project_id": 101,
  "title": "Configure Kafka KRaft mode",
  "description": "Migration from Zookeeper to KRaft for the event bus.",
  "issue_type": "task",
  "status": "todo",
  "priority": 3,
  "assignee_id": 42,
  "parent_id": null,
  "sprint_id": null,
  "story_points": 0,
  "labels": ["infra"],
  "due_date": null
}
```

Labels are trimmed and merged ignoring case (`["Bug", "bug"]` → `["Bug"]`); at most 5.

**Response:** (201 Created) the new **Issue**.

**Errors:** 403 Viewer · 404 project not found · 422 a link rule or a value is invalid

---

#### 4.2. Get Issue Details

**Purpose:** One issue, or every issue the user can see (most recently updated first).

**Endpoint:** `/issues/{issue_key}` · `/issues`

**Method:** `GET`

**Response:** (200 OK) an **Issue**, or a list of **Issue**.

---

#### 4.3. Update Issue Details

**Purpose:** Change any of an issue's fields except `project_id` (moving projects would change its key).

**Endpoint:** `/issues/{issue_key}`

**Method:** `PATCH`

**Request Body:**

```json
{
  "status": "in_review",
  "priority": 3,
  "sprint_id": null
}
```

**Response:** (200 OK) the updated **Issue**.

**Errors:** 403 Viewer · 404 not found · 422 a link rule or a value is invalid

---

#### 4.4. Move Issue Status

**Purpose:** Dedicated endpoint for board drag-and-drop: only the status changes.

**Endpoint:** `/issues/{issue_key}/status`

**Method:** `PUT`

**Request Body:**

```json
{
  "status": "done"
}
```

**Response:** (200 OK)

```json
{
  "issue_key": "CIM-402",
  "status": "done",
  "updated_at": "2026-05-29T21:20:00Z"
}
```

---

#### 4.5. List Issue Comments

**Purpose:** All comments of an issue, oldest first, as a flat list. Replies carry `parent_id`, so the client nests them into threads.

**Endpoint:** `/issues/{issue_key}/comments`

**Method:** `GET`

**Response:** (200 OK) a list of **Comment**.

---

#### 4.6. Add Issue Comment

**Purpose:** Add a comment to an issue. Send `parent_id` to reply to an existing comment of the same issue (threading). Project Admins and Members.

**Endpoint:** `/issues/{issue_key}/comments`

**Method:** `POST`

**Request Body:**

```json
{
  "content": "I've updated the Kafka producer settings.",
  "parent_id": null
}
```

**Response:** (201 Created) the new **Comment**.

**Errors:** 403 Viewer · 422 empty content, or the parent is on another issue

---

#### 4.7. Bulk Update Issues

**Purpose:** Apply the same changes to many issues (e.g. from the List view). Each issue succeeds or fails on its own; one bad issue doesn't stop the rest.

**Endpoint:** `/issues/bulk`

**Method:** `PATCH`

**Request Body:** (`updates` may set `status`, `priority`, `assignee_id`, `sprint_id`; at most 100 keys)

```json
{
  "issue_keys": ["CIM-402", "CIM-405"],
  "updates": { "status": "in_review" }
}
```

**Response:** (200 OK)

```json
{
  "summary": {
    "total": 2,
    "success_count": 1,
    "failure_count": 1
  },
  "results": [
    {
      "issue_key": "CIM-402",
      "status": "Updated",
      "updated_at": "2026-05-29T21:55:00Z",
      "error": null
    },
    {
      "issue_key": "CIM-405",
      "status": "Failed",
      "updated_at": null,
      "error": "Assignee is not a member of this project"
    }
  ]
}
```

---

#### 4.8. Bulk Delete Issues

**Purpose:** Delete many issues: all of them, or (if any key is missing or not allowed) none.

**Endpoint:** `/issues/bulk`

**Method:** `DELETE`

**Request Body:**

```json
{
  "issue_keys": ["CIM-402", "CIM-405"]
}
```

**Response:** (204 No Content)

**Errors:** 403 not allowed to delete one of them (see 4.9) · 404 one of them doesn't exist

---

#### 4.9. Delete Issue

**Purpose:** Delete one issue and its comments. Allowed for its reporter (if still a project Admin or Member) and for project Admins. Deleting an epic keeps its children; they just lose the parent.

**Endpoint:** `/issues/{issue_key}`

**Method:** `DELETE`

**Response:** (204 No Content)

---

#### 4.10. Edit and Delete Comment

**Purpose:** Only the author can edit a comment (it's then marked `is_edited`). The author or a project Admin can delete it; its replies are deleted with it.

| Action | Method   | Endpoint                  | Body                       | Response             |
| ------ | -------- | ------------------------- | -------------------------- | -------------------- |
| Edit   | `PATCH`  | `/comments/{comment_id}`  | `{ "content": "Fixed." }`  | 200, the **Comment** |
| Delete | `DELETE` | `/comments/{comment_id}`  |                            | 204                  |

---

### 5. Artificial Intelligence Endpoints

#### 5.1. Semantic Issue Search

**Purpose:** Search for issues using natural language queries. Unlike standard keyword search, this uses vector embeddings to find relevant tasks even if the exact words don't match (e.g., searching "database lag" finds "Optimize Redis caching").

**Endpoint:** `/ai/search`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "project_id": 101,
  "query": "problems with message bus performance",
  "limit": 5
}
```

**Response:** (200 OK)

```json
{
  "query": "problems with message bus performance",
  "results": [
    {
      "issue_key": "CIM-402",
      "title": "Configure Kafka KRaft mode",
      "score": 0.92,
      "summary": "Migration to KRaft to improve metadata performance."
    },
    {
      "issue_key": "CIM-415",
      "title": "Investigate producer latency",
      "score": 0.85,
      "summary": "High latency observed in event-driven messaging service."
    }
  ]
}
```

---

#### 5.2. AI Project Assistant

**Purpose:** An interactive chat endpoint that answers questions about project status, blockers, or history. This uses Server-Sent Events (SSE) to stream the response back for a "typing" effect.

**Endpoint:** `/ai/assistant`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`
- `Accept: text/event-stream`

**Request Body:**

```json
{
  "project_id": 101,
  "message": "Which tasks are currently blocking the Kafka migration?",
  "stream": true
}
```

**Response:**

- 200 Stream of data chunks

---

#### 5.3. Issue Summary Generation

**Purpose:** Automatically generate a concise summary or "TL;DR" for an issue that has a long comment history.

**Endpoint:** `/ai/summarize/{issue_key}`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Response:** (200 OK)

```json
{
  "issue_key": "CIM-402",
  "summary": "The team is migrating Kafka to KRaft mode to remove Zookeeper dependency. Henry is currently debugging producer latency issues in the dev environment.",
  "generated_at": "2026-05-29T22:10:00Z"
}
```

---

### 6. Attachment Management Endpoints

#### 6.1. Request Upload URL

**Purpose:** Obtain a temporary, pre-signed URL to upload a file directly to cloud storage. This keeps file traffic off your main application server.

**Endpoint:** `/attachments/upload-url`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "issue_key": "CIM-402",
  "file_name": "architecture_diagram.png",
  "content_type": "image/png"
}
```

**Response:** (200 OK)

```json
{
  "upload_url": "https://storage.googleapis.com/planner-assets/temp-12345?signature=...",
  "file_id": "file_uuid_998",
  "expires_at": "2026-05-29T22:30:00Z"
}
```

---

#### 6.2. Confirm Upload Completion

**Purpose:** Notify the backend that the file has been successfully uploaded to the cloud. The backend then attaches the file record to the issue and moves it from "temp" to "permanent" storage.

**Endpoint:** `/attachments/confirm`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "file_id": "file_uuid_998",
  "status": "success"
}
```

**Response:** (200 OK)

```json
{
  "issue_key": "CIM-402",
  "attachment": {
    "id": "file_uuid_998",
    "file_name": "architecture_diagram.png",
    "size_bytes": 1048576,
    "uploaded_at": "2026-05-29T22:15:00Z"
  }
}
```

---

#### 6.3. Get Attachment Preview

**Purpose:** Generate a secure, short-lived link to view or download an attachment. For images, this often points to a "thumbnail" version.

**Endpoint:** `/attachments/{file_id}/preview`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

**Response:** (200 OK)

```json
{
  "file_id": "file_uuid_998",
  "download_url": "https://storage.googleapis.com/planner-assets/perm/architecture_diagram.png?token=...",
  "thumbnail_url": "https://storage.googleapis.com/planner-assets/thumbs/architecture_diagram_sm.png",
  "expires_in_seconds": 3600
}
```

---

#### 6.4. List Issue Attachments

**Purpose:** Get a list of all files currently attached to a specific issue.

**Endpoint:** `/issues/{issue_key}/attachments`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

**Response:** (200 OK)

```json
[
  {
    "id": "file_uuid_998",
    "file_name": "architecture_diagram.png",
    "content_type": "image/png",
    "size_kb": 1024,
    "uploaded_by": "henry_dev",
    "uploaded_at": "2026-05-29T22:15:00Z"
  },
  {
    "id": "file_uuid_441",
    "file_name": "logs.txt",
    "content_type": "text/plain",
    "size_kb": 12,
    "uploaded_by": "lydiagao",
    "uploaded_at": "2026-05-28T10:05:00Z"
  }
]
```

---

### 7. Notification Endpoints

#### 7.1. Get Unread Count

**Purpose:** Fetch the current number of unread notifications to display as a "badge" count (e.g., the little red number over a bell icon) in the navigation bar.

**Endpoint:** `/notifications/unread-count`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

**Response:** (200 OK)

```json
{
  "unread_count": 3,
  "last_checked_at": "2026-05-29T22:15:00Z"
}
```

---

#### 7.2. Connect to Notification Stream

**Purpose:** Establish a persistent, real-time connection. Instead of polling every 10 seconds, the server "pushes" new notifications to the client the moment they happen.

**Endpoint:** `/notifications/stream`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

- `Accept: text/event-stream`

- `Cache-Control: no-cache`

- `Connection: keep-alive`

**Response:**

- 200 Stream of data chunks

---

#### 7.3. Mark All as Read

**Purpose:** Clear the unread status for all notifications belonging to the current user. This is typically triggered when the user opens the notification panel.

**Endpoint:** `/notifications/read-all`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Response:** (200 OK)

```json
{
  "status": "success",
  "marked_count": 3,
  "timestamp": "2026-05-29T22:25:00Z"
}
```

---

### 8. Analytics Endpoints

#### 8.1. Get Velocity Chart

**Purpose:** Retrieve the amount of work (usually in Story Points) the team completes in each sprint. This helps in predicting how much work can be handled in future iterations.

**Endpoint:** `/analytics/velocity`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

**Query Parameters:**

- `project_id={id}` - Project to analyze (required)
- `period=day|week|month|year` - Time period for analytics (default: month)
- `start_date=YYYY-MM-DD` - Start date for custom range (optional)
- `end_date=YYYY-MM-DD` - End date for custom range (optional)

**Response:**

```json (200 OK)
{
  "project_id": 101,
  "period_type": "month",
  "range": {
    "start": "2026-01-01",
    "end": "2026-05-29"
  },
  "data": [
    {
      "label": "2026-01",
      "completed_count": 45,
      "story_points": 120
    },
    {
      "label": "2026-02",
      "completed_count": 38,
      "story_points": 110
    },
    {
      "label": "2026-03",
      "completed_count": 52,
      "story_points": 145
    }
  ],
  "totals": {
    "total_completed": 135,
    "average_per_period": 45
  }
}
```

---

#### 8.2. Get Burn-down Data

**Purpose:** Track the total work remaining in the current sprint. This endpoint provides the "Ideal" line versus the "Actual" remaining work.

**Endpoint:** `/analytics/burndown`

**Method:** `GET`

**Headers:**

- `Authorization: Bearer {access_token}`

**Query Parameters:**

- `sprint_id={id}` - sprint for analytics (default: current)

**Response:** (200 OK)

```json
{
  "sprint_id": 55,
  "start_date": "2026-05-15",
  "end_date": "2026-05-30",
  "data_points": [
    { "date": "2026-05-15", "ideal_remaining": 100, "actual_remaining": 100 },
    { "date": "2026-05-16", "ideal_remaining": 90, "actual_remaining": 95 },
    { "date": "2026-05-17", "ideal_remaining": 80, "actual_remaining": 75 }
  ]
}
```

---

#### 8.3. AI Predicted Bottlenecks

**Purpose:** Use an LLM to analyze the current distribution of tasks and identify likely delays (e.g., too many issues stuck in "In Review" or an overloaded assignee).

**Endpoint:** `/analytics/ai-bottlenecks`

**Method:** `POST`

**Headers:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "project_id": 101,
  "include_historical_data": true
}
```

**Response:**

```json
{
  "bottlenecks": [
    {
      "type": "Stage Congestion",
      "location": "In Review",
      "severity": "High",
      "insight": "There are 8 tickets currently in 'In Review' with only 1 developer assigned as a reviewer. This is likely to delay the sprint goal."
    },
    {
      "type": "Resource Overload",
      "location": "User: henry_dev",
      "severity": "Medium",
      "insight": "Henry has 15 story points assigned for the next 3 days. Average completion rate suggests a 20% overflow risk."
    }
  ],
  "generated_at": "2026-05-29T22:30:00Z"
}
```

---

## Environment Variables

The application requires the following environment variables to be set:

| Variable           | Description                          | Default                            |
| ------------------ | ------------------------------------ | ---------------------------------- |
| DATABASE_URL       | Full PostgreSQL connection string    | postgresql+psycopg://user:pass@localhost:5433/taskmanagement |
| REDIS_URL          | Redis connection for caching/pub-sub | localhost:6379                     |
| KAFKA_BROKERS      | List of Kafka broker addresses       | localhost:9092                     |
| JWT_SECRET_KEY     | Secret key for signing JWTs          | None                               |
| JWT_ACCESS_EXPIRE  | Access token expiration in seconds   | 3600 (1 hour)                      |
| JWT_REFRESH_EXPIRE | Refresh token expiration in seconds  | 604800 (7 days)                    |
| LITELLM_BASE_URL   | URL of the LiteLLM proxy (holds the provider API keys) | http://localhost:4000             |
