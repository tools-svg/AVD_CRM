from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import Notification, User
from app.schemas.schemas import NotificationOut, NotificationCreate
from app.permissions.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.post("", response_model=NotificationOut)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates an in-app notification with deduplication (Requirement 4.6).
    Prevents duplicate notifications for identical events within 5 minutes.
    """
    target_user_id = payload.user_id if payload.user_id else current_user.id

    # Deduplication check
    cutoff = datetime.utcnow() - timedelta(minutes=5)
    existing = db.query(Notification).filter(
        Notification.user_id == target_user_id,
        Notification.title == payload.title.strip(),
        Notification.message == payload.message.strip(),
        Notification.created_at >= cutoff
    ).first()

    if existing:
        return NotificationOut(
            id=existing.id,
            user_id=existing.user_id,
            sender_id=existing.sender_id,
            sender_name=existing.sender.full_name if existing.sender else None,
            sender_avatar=existing.sender.avatar_url if existing.sender else None,
            title=existing.title,
            message=existing.message,
            link=existing.link,
            type=existing.type,
            is_read=existing.is_read,
            created_at=existing.created_at
        )

    notif = Notification(
        user_id=target_user_id,
        sender_id=current_user.id,
        title=payload.title.strip(),
        message=payload.message.strip(),
        type=payload.type or "info",
        link=payload.link,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    return NotificationOut(
        id=notif.id,
        user_id=notif.user_id,
        sender_id=notif.sender_id,
        sender_name=current_user.full_name,
        sender_avatar=current_user.avatar_url,
        title=notif.title,
        message=notif.message,
        link=notif.link,
        type=notif.type,
        is_read=notif.is_read,
        created_at=notif.created_at
    )


@router.get("", response_model=List[NotificationOut])
def get_user_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()

    results = []
    for n in notifs:
        sender_user = n.sender if n.sender else None
        results.append(NotificationOut(
            id=n.id,
            user_id=n.user_id,
            sender_id=n.sender_id,
            sender_name=sender_user.full_name if sender_user else None,
            sender_avatar=sender_user.avatar_url if sender_user else None,
            title=n.title,
            message=n.message,
            link=n.link,
            type=n.type,
            is_read=n.is_read,
            created_at=n.created_at
        ))
    return results

@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}
