from fastapi import FastAPI

from app.routers import auth, comments, issues, teams, users

app = FastAPI()
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(issues.router)
app.include_router(comments.router)


@app.get("/health")
def health():
    return {"status": "ok"}
