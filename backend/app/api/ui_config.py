import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import UIConfiguration, UIChangeHistory, UIVersionSnapshot, User, ActivityLog
from app.schemas.schemas import (
    UIConfigUpdate,
    UIConfigOut,
    UIChangeHistoryOut,
    UIVersionSnapshotCreate,
    UIVersionSnapshotOut
)
from app.permissions.deps import get_current_user, require_roles

router = APIRouter(prefix="/ui-config", tags=["Developer UI Customization"])


def _naive_utc(value: datetime) -> datetime:
    if value is None:
        return datetime.utcnow()
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value

DEFAULT_CONFIGS: Dict[str, Dict[str, Any]] = {
    "global_theme": {
        "backgroundColor": "#EBE5E5",
        "cardBackgroundColor": "#E8E4E4",
        "surfaceColor": "#F5F3F4",
        "primaryButtonColor": "#0A0A0A",
        "primaryTextColor": "#333333",
        "secondaryTextColor": "#888888",
        "borderColor": "#E1DCDC",
        "cardBorderRadius": "14px",
        "buttonBorderRadius": "9px"
    },
    "navbar": {
        "showSlideshow": True,
        "slideshowIntervalMs": 3500,
        "showCustomizationDropdown": True,
        "showNotificationBell": True,
        "titleText": "AVD Management"
    },
    "statistics": {
        "visible": True,
        "card1Label": "Total Projects",
        "card2Label": "Completed",
        "card3Label": "Ongoing"
    },
    "project_list": {
        "initialRows": 3,
        "showStatus": True,
        "showPriority": True,
        "showProgress": True,
        "showDeadline": True,
        "showLastUpdated": True,
        "showViewButton": True
    },
    "sticky_notes": {
        "visible": True,
        "panelWidthPercent": 25,
        "defaultColor": "#F4E9D2"
    },
    "gantt": {
        "visible": True,
        "defaultView": "Weekly",
        "enableDragDrop": True,
        "showTodayMarker": True
    }
}

@router.get("/snapshots/list", response_model=List[UIVersionSnapshotOut], dependencies=[Depends(require_roles(["Developer"]))])
def list_snapshots(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(UIVersionSnapshot).order_by(UIVersionSnapshot.created_at.desc())
    if role:
        query = query.filter(UIVersionSnapshot.role == role)
    snapshots = query.all()
    results = []
    for s in snapshots:
        user = db.query(User).filter(User.id == s.created_by_id).first()
        results.append(UIVersionSnapshotOut(
            id=s.id,
            snapshot_name=s.snapshot_name,
            role=s.role,
            full_config_json=s.full_config_json,
            created_by_name=user.full_name if user else "Developer",
            created_at=s.created_at
        ))
    return results


@router.get("/undo/history", response_model=List[UIChangeHistoryOut], dependencies=[Depends(require_roles(["Developer"]))])
def get_undo_history(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns UI change history with 24-hour undo availability indicator.
    """
    query = db.query(UIChangeHistory).order_by(UIChangeHistory.changed_at.desc())
    if role:
        query = query.filter(UIChangeHistory.role == role)

    records = query.limit(100).all()
    now = datetime.utcnow()
    results = []

    for r in records:
        time_diff = now - _naive_utc(r.changed_at)
        is_undoable = (time_diff <= timedelta(hours=24)) and not r.is_reverted

        user = db.query(User).filter(User.id == r.changed_by_id).first()
        results.append(UIChangeHistoryOut(
            id=r.id,
            config_id=r.config_id,
            role=r.role,
            component_key=r.component_key,
            previous_config_json=r.previous_config_json,
            new_config_json=r.new_config_json,
            changed_by_name=user.full_name if user else "Developer",
            changed_at=r.changed_at,
            is_reverted=r.is_reverted,
            is_undoable=is_undoable
        ))

    return results


@router.get("/{role}")
def get_role_ui_config(
    role: str,
    db: Session = Depends(get_db)
):
    """
    Returns full active UI configuration for the given role.
    Falls back to safe default configs if not customized yet.
    """
    saved_configs = db.query(UIConfiguration).filter(
        UIConfiguration.role == role,
        UIConfiguration.is_active == True
    ).all()

    result = dict(DEFAULT_CONFIGS)
    for cfg in saved_configs:
        try:
            result[cfg.component_key] = json.loads(cfg.config_json)
        except Exception:
            pass

    return {
        "role": role,
        "configurations": result
    }

@router.put("/save", dependencies=[Depends(require_roles(["Developer"]))])
def save_ui_config(
    payload: UIConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Saves a UI component customization.
    Immediately records prior config in ui_change_history for 24-hr undo!
    """
    try:
        # Validate JSON
        parsed = json.loads(payload.config_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON configuration: {str(e)}")

    existing = db.query(UIConfiguration).filter(
        UIConfiguration.role == payload.role,
        UIConfiguration.component_key == payload.component_key
    ).first()

    previous_json = existing.config_json if existing else json.dumps(DEFAULT_CONFIGS.get(payload.component_key, {}))

    if existing:
        existing.config_json = payload.config_json
        existing.updated_by_id = current_user.id
        existing.updated_at = datetime.utcnow()
        config_id = existing.id
    else:
        new_cfg = UIConfiguration(
            role=payload.role,
            component_key=payload.component_key,
            config_json=payload.config_json,
            updated_by_id=current_user.id,
            is_active=True
        )
        db.add(new_cfg)
        db.flush()
        config_id = new_cfg.id

    # Record in 24-hr Undo History
    history_entry = UIChangeHistory(
        config_id=config_id,
        role=payload.role,
        component_key=payload.component_key,
        previous_config_json=previous_json,
        new_config_json=payload.config_json,
        changed_by_id=current_user.id,
        changed_at=datetime.utcnow(),
        is_reverted=False
    )
    db.add(history_entry)

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Updated UI Customization",
        entity_type="ui_config",
        entity_id=config_id,
        details=f"Updated '{payload.component_key}' for role '{payload.role}'"
    ))

    db.commit()

    return {
        "message": "UI configuration saved and applied immediately",
        "history_id": history_entry.id,
        "config_id": config_id
    }

@router.post("/undo/{history_id}", dependencies=[Depends(require_roles(["Developer"]))])
def undo_ui_change(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reverts a UI change if within the 24-hour rollback window.
    """
    history = db.query(UIChangeHistory).filter(UIChangeHistory.id == history_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="Change history record not found")

    if history.is_reverted:
        raise HTTPException(status_code=400, detail="This change has already been reverted")

    time_diff = datetime.utcnow() - _naive_utc(history.changed_at)
    if time_diff > timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"24-hour rollback window expired for this change (made {time_diff.total_seconds() / 3600:.1f} hours ago)"
        )

    config = db.query(UIConfiguration).filter(UIConfiguration.id == history.config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration record not found")

    # Revert configuration to previous state
    config.config_json = history.previous_config_json
    config.updated_at = datetime.utcnow()
    config.updated_by_id = current_user.id

    history.is_reverted = True
    history.reverted_at = datetime.utcnow()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Reverted UI Customization",
        entity_type="ui_config",
        entity_id=config.id,
        details=f"Rollback performed on '{history.component_key}' for role '{history.role}'"
    ))

    db.commit()

    return {
        "message": "Change reverted successfully within 24-hour rollback window",
        "restored_config": json.loads(config.config_json)
    }

@router.post("/snapshots", response_model=UIVersionSnapshotOut, dependencies=[Depends(require_roles(["Developer"]))])
def create_snapshot(
    payload: UIVersionSnapshotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    snapshot = UIVersionSnapshot(
        snapshot_name=payload.snapshot_name,
        role=payload.role,
        full_config_json=payload.full_config_json,
        created_by_id=current_user.id
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return UIVersionSnapshotOut(
        id=snapshot.id,
        snapshot_name=snapshot.snapshot_name,
        role=snapshot.role,
        full_config_json=snapshot.full_config_json,
        created_by_name=current_user.full_name,
        created_at=snapshot.created_at
    )

