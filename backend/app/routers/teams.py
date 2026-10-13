from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Issue, Team, TeamMember, User
from app.schemas import TeamCreate, TeamMemberAdd, TeamMemberUpdate, TeamOut, TeamUpdate
from app.security import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])


def get_team(db: Session, team_id: int, user: User, lock: bool = False) -> Team:
    """The team, if the user is in it or is a workspace Admin; otherwise 404.

    lock=True locks the team row until commit, so two requests changing its members wait their turn.
    """
    team = db.get(Team, team_id, with_for_update=lock)
    if team is None or (user.role != "Admin" and db.get(TeamMember, (team_id, user.id)) is None):
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def require_manager(db: Session, team: Team, user: User):
    """Team owners and workspace Admins can manage a team."""
    membership = db.get(TeamMember, (team.id, user.id))
    if user.role != "Admin" and (membership is None or membership.role != "owner"):
        raise HTTPException(status_code=403, detail="Only team owners can do this")


def get_member(db: Session, team: Team, user_id: int) -> TeamMember:
    member = db.get(TeamMember, (team.id, user_id))
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


def check_not_last_owner(db: Session, member: TeamMember):
    if member.role != "owner":
        return
    owners = db.scalar(
        select(func.count()).where(TeamMember.team_id == member.team_id, TeamMember.role == "owner")
    )
    if owners == 1:
        raise HTTPException(status_code=409, detail="A team needs at least one owner")


@router.get("", response_model=list[TeamOut])
def list_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Team).order_by(Team.id)
    if current_user.role != "Admin":
        query = query.where(Team.id.in_(select(TeamMember.team_id).where(TeamMember.user_id == current_user.id)))
    return db.scalars(query).all()


@router.post("", response_model=TeamOut, status_code=201)
def create_team(payload: TeamCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = Team(**payload.model_dump())
    team.members.append(TeamMember(user_id=current_user.id, role="owner"))
    db.add(team)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Team key already taken")
    db.refresh(team)
    return team


@router.get("/{team_id}", response_model=TeamOut)
def read_team(team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_team(db, team_id, current_user)


@router.patch("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = get_team(db, team_id, current_user)
    require_manager(db, team, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = get_team(db, team_id, current_user)
    require_manager(db, team, current_user)
    # The database would refuse anyway (issues.team_id has no ON DELETE); this gives a clear message.
    if db.scalar(select(func.count()).where(Issue.team_id == team_id)):
        raise HTTPException(status_code=409, detail="Move or delete this team's issues first")
    db.delete(team)
    db.commit()


@router.post("/{team_id}/members", response_model=TeamOut, status_code=201)
def add_member(
    team_id: int,
    payload: TeamMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = get_team(db, team_id, current_user, lock=True)
    require_manager(db, team, current_user)
    if db.get(User, payload.user_id) is None:
        raise HTTPException(status_code=422, detail="User not found")
    if db.get(TeamMember, (team_id, payload.user_id)) is not None:
        raise HTTPException(status_code=409, detail="Already a member")
    db.add(TeamMember(team_id=team_id, user_id=payload.user_id, role=payload.role))
    db.commit()
    db.refresh(team)
    return team


@router.patch("/{team_id}/members/{user_id}", response_model=TeamOut)
def update_member(
    team_id: int,
    user_id: int,
    payload: TeamMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = get_team(db, team_id, current_user, lock=True)
    require_manager(db, team, current_user)
    member = get_member(db, team, user_id)
    if payload.role == "member":
        check_not_last_owner(db, member)
    member.role = payload.role
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}/members/{user_id}", status_code=204)
def remove_member(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = get_team(db, team_id, current_user, lock=True)
    if user_id != current_user.id:  # anyone may leave; removing someone else needs a manager
        require_manager(db, team, current_user)
    member = get_member(db, team, user_id)
    check_not_last_owner(db, member)
    db.delete(member)
    db.commit()
