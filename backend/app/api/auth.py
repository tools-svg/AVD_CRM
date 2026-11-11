import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.database.session import get_db
from app.models.all_models import User, UserCompanyAssignment, UserSession
from app.schemas.schemas import (
    Token, 
    LoginRequest, 
    UserOut, 
    UserSelfUpdate,
    SessionHeartbeatRequest,
    SessionLogoutRequest,
    UserSessionOut,
    UserSessionPageOut
)
from app.core.security import verify_password, create_access_token, get_password_hash
from app.permissions.deps import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    role_name = user.role.name if user.role else "Employee"
    token = create_access_token(subject=user.id, role=role_name)

    # User Login Tracking (Requirement 3)
    session_id = secrets.token_hex(24)
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)
    user_agent = request.headers.get("user-agent", "")[:250]

    user_session = UserSession(
        session_id=session_id,
        user_id=user.id,
        username=user.username,
        role_name=role_name,
        ip_address=client_ip,
        user_agent=user_agent,
        login_time=datetime.utcnow(),
        last_heartbeat=datetime.utcnow(),
        status="active"
    )
    db.add(user_session)
    db.commit()

    company_assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == user.id).all()
    company_ids = [ca.company_id for ca in company_assignments]

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "role_id": user.role_id,
            "role_name": role_name,
            "company_ids": company_ids,
            "session_id": session_id
        }
    }

@router.post("/logout")
def logout(payload: SessionLogoutRequest, db: Session = Depends(get_db)):
    """
    Explicit logout tracking (Requirement 3.2).
    Marks confirmed manual logout time and sets status to 'logged_out'.
    """
    if payload.session_id:
        sess = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
        if sess and sess.status == "active":
            sess.logout_time = datetime.utcnow()
            sess.status = "logged_out"
            db.commit()
    return {"message": "Logged out successfully"}

@router.post("/heartbeat")
def heartbeat(payload: SessionHeartbeatRequest, db: Session = Depends(get_db)):
    """
    Active session heartbeat handler (Requirement 3.4).
    Updates last_heartbeat to detect unexpected browser closures.
    """
    if not payload.session_id:
        return {"status": "ignored"}
    sess = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
    if sess:
        sess.last_heartbeat = datetime.utcnow()
        if sess.status in ["expired", "interrupted"]:
            sess.status = "active"
        db.commit()
        return {"status": "alive"}
    return {"status": "not_found"}

@router.get("/sessions", response_model=UserSessionPageOut)
def get_user_sessions(
    search: Optional[str] = Query(None, description="Search employee username or full name"),
    status: Optional[str] = Query(None, description="active, logged_out, expired, interrupted"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer"]))
):
    """
    Dedicated Developer Activity / Session History audit view (Requirement 3).
    Restricted strictly to Developer role accounts.
    """
    # Auto-expire active sessions with no heartbeat for > 15 minutes
    expiry_cutoff = datetime.utcnow() - timedelta(minutes=15)
    stale_sessions = db.query(UserSession).filter(
        UserSession.status == "active",
        UserSession.last_heartbeat < expiry_cutoff
    ).all()
    for s in stale_sessions:
        s.status = "expired"
    if stale_sessions:
        db.commit()

    query = db.query(UserSession, User.full_name).outerjoin(User, UserSession.user_id == User.id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                UserSession.username.ilike(term),
                User.full_name.ilike(term),
                UserSession.role_name.ilike(term)
            )
        )

    if status and status.strip() and status != "all":
        query = query.filter(UserSession.status == status.strip())

    if date_from:
        try:
            df = datetime.fromisoformat(date_from.replace('Z', ''))
            query = query.filter(UserSession.login_time >= df)
        except Exception:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', ''))
            # Include entire end date
            dt = dt.replace(hour=23, minute=59, second=59)
            query = query.filter(UserSession.login_time <= dt)
        except Exception:
            pass

    total_count = query.count()
    results = query.order_by(desc(UserSession.login_time)).offset((page - 1) * page_size).limit(page_size).all()

    session_items = []
    now = datetime.utcnow()
    for sess, full_name in results:
        # Calculate duration in seconds
        end_time = sess.logout_time if sess.logout_time else (sess.last_heartbeat if sess.status != "active" else now)
        duration_sec = max(0, int((end_time - sess.login_time).total_seconds()))

        session_items.append(UserSessionOut(
            id=sess.id,
            session_id=sess.session_id,
            user_id=sess.user_id,
            username=sess.username,
            employee_name=full_name or sess.username,
            role_name=sess.role_name,
            ip_address=sess.ip_address,
            user_agent=sess.user_agent,
            login_time=sess.login_time,
            last_heartbeat=sess.last_heartbeat,
            logout_time=sess.logout_time,
            duration_seconds=duration_sec,
            status=sess.status,
            created_at=sess.created_at
        ))

    return UserSessionPageOut(
        total_count=total_count,
        page=page,
        page_size=page_size,
        sessions=session_items
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == current_user.id).all()
    company_ids = [ca.company_id for ca in company_assignments]
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        role_id=current_user.role_id,
        role_name=current_user.role.name if current_user.role else None,
        is_active=current_user.is_active,
        company_ids=company_ids,
        created_at=current_user.created_at
    )

@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserSelfUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Member profile editing (Section 3.3).
    Allows user to update their full name, avatar_url, or password.
    """
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None
    if payload.password is not None and payload.password.strip():
        current_user.hashed_password = get_password_hash(payload.password.strip())

    db.commit()
    db.refresh(current_user)

    company_assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == current_user.id).all()
    company_ids = [ca.company_id for ca in company_assignments]
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        avatar_url=current_user.avatar_url,
        role_id=current_user.role_id,
        role_name=current_user.role.name if current_user.role else None,
        is_active=current_user.is_active,
        company_ids=company_ids,
        created_at=current_user.created_at
    )

