from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import (
    User, 
    Role, 
    UserCompanyAssignment, 
    ActivityLog,
    Project,
    ProjectEmployeeAssignment,
    Module,
    ModuleEmployeeAssignment,
    Comment,
    Update,
    Attachment,
    StickyNote,
    StickyNoteMention,
    Notification,
    ProjectShare,
    ProjectPayment,
    UIConfiguration,
    UIChangeHistory,
    UIVersionSnapshot,
    UserSession
)
from app.schemas.schemas import UserOut, UserCreate, UserUpdate, RoleOut
from app.core.security import get_password_hash
from app.permissions.deps import get_current_user, require_roles

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserOut])
def list_users(
    company_id: Optional[int] = None,
    role_name: Optional[str] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(User)
    if not include_inactive and current_user.role.name != "Developer":
        query = query.filter(User.is_active == True)

    if role_name:
        query = query.join(Role).filter(Role.name == role_name)
    if company_id:
        query = query.join(UserCompanyAssignment).filter(UserCompanyAssignment.company_id == company_id)

    users = query.all()
    results = []
    for u in users:
        company_assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == u.id).all()
        results.append(UserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            avatar_url=u.avatar_url,
            role_id=u.role_id,
            role_name=u.role.name if u.role else None,
            is_active=u.is_active,
            company_ids=[ca.company_id for ca in company_assignments],
            created_at=u.created_at
        ))
    return results

@router.get("/roles", response_model=List[RoleOut])
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Role).all()

@router.post("", response_model=UserOut, dependencies=[Depends(require_roles(["Developer", "Director"]))])
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    hashed_pw = get_password_hash(payload.password)
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hashed_pw,
        full_name=payload.full_name,
        avatar_url=payload.avatar_url,
        role_id=payload.role_id,
        is_active=payload.is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if payload.company_ids:
        for cid in payload.company_ids:
            db.add(UserCompanyAssignment(user_id=user.id, company_id=cid))
        db.commit()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Created User",
        entity_type="user",
        entity_id=user.id,
        details=f"User '{user.username}' ({user.full_name}) created by Developer"
    ))
    db.commit()

    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        is_active=user.is_active,
        company_ids=payload.company_ids or [],
        created_at=user.created_at
    )

@router.put("/{user_id}", response_model=UserOut, dependencies=[Depends(require_roles(["Developer", "Director"]))])
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        user.hashed_password = get_password_hash(update_data.pop("password"))

    company_ids = update_data.pop("company_ids", None)
    if company_ids is not None:
        db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == user.id).delete()
        for cid in company_ids:
            db.add(UserCompanyAssignment(user_id=user.id, company_id=cid))

    for k, v in update_data.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Updated User",
        entity_type="user",
        entity_id=user.id,
        details=f"User '{user.username}' updated by Developer"
    ))
    db.commit()

    company_assignments = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == user.id).all()
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        is_active=user.is_active,
        company_ids=[ca.company_id for ca in company_assignments],
        created_at=user.created_at
    )

@router.delete("/{user_id}", dependencies=[Depends(require_roles(["Developer", "Director"]))])
def delete_user(
    user_id: int,
    hard: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate or delete your own account")

    if hard:
        target_username = user.username
        target_fullname = user.full_name or user.username

        # 1. Reassign any projects where this user was creator or lead to current_user
        db.query(Project).filter(Project.creator_id == user_id).update(
            {Project.creator_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(Project).filter(Project.lead_id == user_id).update(
            {Project.lead_id: current_user.id}, 
            synchronize_session=False
        )

        # 2. Unassign from all modules
        db.query(Module).filter(Module.assigned_to_id == user_id).update(
            {Module.assigned_to_id: None}, 
            synchronize_session=False
        )

        # 3. Delete project and module employee assignments
        db.query(ProjectEmployeeAssignment).filter(
            ProjectEmployeeAssignment.user_id == user_id
        ).delete(synchronize_session=False)

        db.query(ModuleEmployeeAssignment).filter(
            ModuleEmployeeAssignment.user_id == user_id
        ).delete(synchronize_session=False)

        # 4. Clean up sticky notes & mentions
        db.query(StickyNoteMention).filter(
            StickyNoteMention.mentioned_user_id == user_id
        ).delete(synchronize_session=False)

        user_note_ids = [n.id for n in db.query(StickyNote.id).filter(StickyNote.user_id == user_id).all()]
        if user_note_ids:
            db.query(StickyNoteMention).filter(
                StickyNoteMention.sticky_note_id.in_(user_note_ids)
            ).delete(synchronize_session=False)
            db.query(StickyNote).filter(
                StickyNote.user_id == user_id
            ).delete(synchronize_session=False)

        # 5. Delete notifications where user is recipient or sender
        db.query(Notification).filter(
            (Notification.user_id == user_id) | (Notification.sender_id == user_id)
        ).delete(synchronize_session=False)

        # 6. Reassign historical audit/content logs to current_user so integrity is preserved
        db.query(Comment).filter(Comment.user_id == user_id).update(
            {Comment.user_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(Update).filter(Update.user_id == user_id).update(
            {Update.user_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(Attachment).filter(Attachment.uploaded_by_id == user_id).update(
            {Attachment.uploaded_by_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(ProjectPayment).filter(ProjectPayment.recorded_by_id == user_id).update(
            {ProjectPayment.recorded_by_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(ProjectShare).filter(ProjectShare.created_by_id == user_id).update(
            {ProjectShare.created_by_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(UIConfiguration).filter(UIConfiguration.updated_by_id == user_id).update(
            {UIConfiguration.updated_by_id: None}, 
            synchronize_session=False
        )
        db.query(UIChangeHistory).filter(UIChangeHistory.changed_by_id == user_id).update(
            {UIChangeHistory.changed_by_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(UIVersionSnapshot).filter(UIVersionSnapshot.created_by_id == user_id).update(
            {UIVersionSnapshot.created_by_id: current_user.id}, 
            synchronize_session=False
        )
        db.query(ActivityLog).filter(ActivityLog.user_id == user_id).update(
            {ActivityLog.user_id: current_user.id}, 
            synchronize_session=False
        )

        # 7. Clean up company assignments & user sessions
        db.query(UserCompanyAssignment).filter(
            UserCompanyAssignment.user_id == user_id
        ).delete(synchronize_session=False)
        db.query(UserSession).filter(
            UserSession.user_id == user_id
        ).delete(synchronize_session=False)

        # 8. Delete user record
        db.delete(user)
        db.commit()

        # 9. Record Activity Log
        db.add(ActivityLog(
            user_id=current_user.id,
            action="Deleted User Permanently",
            entity_type="user",
            entity_id=user_id,
            details=f"User '{target_username}' ({target_fullname}) deleted permanently by {current_user.full_name}"
        ))
        db.commit()
        return {"message": f"Employee '{target_fullname}' (@{target_username}) deleted successfully", "is_deleted": True}

    # Toggle active state or deactivate
    user.is_active = not user.is_active
    db.commit()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Toggled User Status",
        entity_type="user",
        entity_id=user.id,
        details=f"User '{user.username}' active status changed to {user.is_active}"
    ))
    db.commit()

    status_str = "activated" if user.is_active else "deactivated"
    return {"message": f"User '{user.username}' {status_str} successfully", "is_active": user.is_active}
