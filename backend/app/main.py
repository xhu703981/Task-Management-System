from fastapi import FastAPI

from app.routers import auth, comments, issues, projects, sprints, users

app = FastAPI()
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(sprints.router)
app.include_router(issues.router)
app.include_router(comments.router)


@app.get("/health")
def health():
    return {"status": "ok"}
