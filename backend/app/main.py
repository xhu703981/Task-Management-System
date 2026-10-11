from fastapi import FastAPI

from app.routers import auth, issues, users

app = FastAPI()
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(issues.router)


@app.get("/health")
def health():
    return {"status": "ok"}
