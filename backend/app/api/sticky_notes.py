from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import StickyNote, StickyNoteMention, User, Notification, UserCompanyAssignment
from app.schemas.schemas import StickyNoteOut, StickyNoteCreate, StickyNoteUpdate
from app.permissions.deps import get_current_user

router = APIRouter(prefix="/sticky-notes", tags=["Sticky Notes"])

def _format_note_out(note: StickyNote) -> StickyNoteOut:
    mentioned_users = []
    for m in note.mentions:
        if m.mentioned_user:
            mentioned_users.append({
                "id": m.mentioned_user.id,
                "username": m.mentioned_user.username,
                "full_name": m.mentioned_user.full_name,
                "avatar_url": m.mentioned_user.avatar_url
            })

    return StickyNoteOut(
        id=note.id,
        user_id=note.user_id,
        user_name=note.user.full_name if note.user else "Unknown",
        title=note.title,
        content=note.content,
        color=note.color,
        tab_order=note.tab_order,
        mentioned_users=mentioned_users,
        created_at=note.created_at,
        updated_at=note.updated_at
    )

def _resolve_team_mentions(author_id: int, db: Session) -> List[int]:
    """
    Finds all eligible employees in the same sub-company as the note author.
    Excludes the note author. Prevents notifying unrelated sub-companies.
    """
    author_assignments = db.query(UserCompanyAssignment).filter(
        UserCompanyAssignment.user_id == author_id
    ).all()
    company_ids = [a.company_id for a in author_assignments]

    if not company_ids:
        # Fallback if no specific company assigned
        return []

    team_users = db.query(User).join(UserCompanyAssignment).filter(
        UserCompanyAssignment.company_id.in_(company_ids),
        User.id != author_id,
        User.is_active == True
    ).all()

    return list({u.id for u in team_users})

@router.get("", response_model=List[StickyNoteOut])
def list_sticky_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notes = db.query(StickyNote).filter(
        (StickyNote.user_id == current_user.id) |
        (StickyNote.mentions.any(StickyNoteMention.mentioned_user_id == current_user.id))
    ).order_by(StickyNote.tab_order.asc(), StickyNote.created_at.asc()).all()

    return [_format_note_out(n) for n in notes]

@router.post("", response_model=StickyNoteOut)
def create_sticky_note(
    payload: StickyNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = StickyNote(
        user_id=current_user.id,
        title=payload.title,
        content=payload.content,
        color=payload.color,
        tab_order=payload.tab_order
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Resolve target recipient user IDs (individual and/or entire team)
    target_uids = set(payload.mentioned_user_ids or [])
    if payload.mention_all_team or "@Entire Team" in payload.content:
        team_uids = _resolve_team_mentions(current_user.id, db)
        target_uids.update(team_uids)

    # Filter out current user from recipients
    target_uids.discard(current_user.id)

    note_snippet = note.content[:100] + ("..." if len(note.content) > 100 else "")

    for uid in target_uids:
        db.add(StickyNoteMention(sticky_note_id=note.id, mentioned_user_id=uid))
        # SECTION 4: Create rich in-app notification with sender details and note preview
        db.add(Notification(
            user_id=uid,
            sender_id=current_user.id,
            title=f"Mentioned in '{note.title}'",
            message=f"{current_user.full_name} mentioned you in note: \"{note_snippet}\"",
            link="/home",
            type="mention"
        ))

    db.commit()
    db.refresh(note)
    return _format_note_out(note)

@router.put("/{note_id}", response_model=StickyNoteOut)
def update_sticky_note(
    note_id: int,
    payload: StickyNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.query(StickyNote).filter(StickyNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Sticky note not found")

    is_creator = note.user_id == current_user.id
    is_mentioned = any(m.mentioned_user_id == current_user.id for m in note.mentions)
    if not is_creator and not is_mentioned:
        raise HTTPException(status_code=403, detail="Access denied to private note")

    update_data = payload.dict(exclude_unset=True)
    mentioned_ids = update_data.pop("mentioned_user_ids", None)
    mention_all = update_data.pop("mention_all_team", False)

    for k, v in update_data.items():
        setattr(note, k, v)

    # Process mentions if updated
    if is_creator and (mentioned_ids is not None or mention_all or "@Entire Team" in note.content):
        existing_mentions = {m.mentioned_user_id for m in note.mentions}
        target_uids = set(mentioned_ids or [])
        if mention_all or "@Entire Team" in note.content:
            target_uids.update(_resolve_team_mentions(note.user_id, db))
        target_uids.discard(current_user.id)

        # Newly mentioned users who haven't been notified yet
        newly_mentioned = target_uids - existing_mentions

        # Reset mentions
        db.query(StickyNoteMention).filter(StickyNoteMention.sticky_note_id == note.id).delete()
        note_snippet = note.content[:100] + ("..." if len(note.content) > 100 else "")

        for uid in target_uids:
            db.add(StickyNoteMention(sticky_note_id=note.id, mentioned_user_id=uid))
            if uid in newly_mentioned:
                db.add(Notification(
                    user_id=uid,
                    sender_id=current_user.id,
                    title=f"Mentioned in '{note.title}'",
                    message=f"{current_user.full_name} mentioned you in note: \"{note_snippet}\"",
                    link="/home",
                    type="mention"
                ))

    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)

    return _format_note_out(note)

@router.delete("/{note_id}")
def delete_sticky_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.query(StickyNote).filter(StickyNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Sticky note not found")

    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only creator can delete this note")

    db.delete(note)
    db.commit()
    return {"message": "Sticky note deleted successfully"}
