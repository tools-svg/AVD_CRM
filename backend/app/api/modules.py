import os
import uuid
import aiofiles
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import Module, Project, Update, Attachment, User, ActivityLog, Notification, ProjectEmployeeAssignment, ModuleEmployeeAssignment
from app.schemas.schemas import ModuleOut, ModuleCreate, ModuleUpdate, UpdateOut, AttachmentOut, UpdateReviewPayload
from app.permissions.deps import get_current_user, require_roles
from app.core.config import settings
from app.services.project_service import calculate_and_update_project_progress

router = APIRouter(prefix="/modules", tags=["Modules"])

def _format_module_out(m: Module) -> ModuleOut:
    assigned_ids = [ea.user_id for ea in m.employee_assignments]
    assigned_names = [ea.user.full_name for ea in m.employee_assignments if ea.user]
    if not assigned_names and m.assigned_to:
        assigned_names = [m.assigned_to.full_name]
    if not assigned_ids and m.assigned_to_id:
        assigned_ids = [m.assigned_to_id]

    display_name = ", ".join(assigned_names) if assigned_names else (m.assigned_to.full_name if m.assigned_to else None)

    latest_update = m.updates[0] if m.updates else None
    latest_update_status = latest_update.approval_status if latest_update else None
    latest_update_text = latest_update.description_text if latest_update else None
    has_pending_update = any(u.approval_status == "pending" for u in m.updates)

    return ModuleOut(
        id=m.id,
        project_id=m.project_id,
        name=m.name,
        description=m.description,
        status=m.status,
        priority=m.priority,
        progress=m.progress,
        start_date=m.start_date,
        deadline=m.deadline,
        assigned_to_id=m.assigned_to_id,
        assigned_to_name=display_name,
        assigned_to_avatar=m.assigned_to.avatar_url if m.assigned_to else None,
        assigned_employee_ids=assigned_ids,
        assigned_employee_names=assigned_names,
        sort_order=m.sort_order,
        updates_count=len(m.updates),
        attachments_count=len(m.attachments),
        latest_update_status=latest_update_status,
        latest_update_text=latest_update_text,
        has_pending_update=has_pending_update,
        created_at=m.created_at
    )

@router.post("", response_model=ModuleOut)
def create_module(
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Section 8: Add Module with Automatic Employee Inheritance.
    The backend determines employee assignments based on parent project assignments.
    If parent project has multiple employees, inherits ALL of them.
    If parent project has no assigned employees, rejects creation.
    """
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="Parent project ID is required")

    parent_proj = db.query(Project).filter(Project.id == payload.project_id, Project.is_deleted == False).first()
    if not parent_proj:
        raise HTTPException(status_code=404, detail="Parent project not found")

    # Authorisation check
    user_role = current_user.role.name if current_user.role else ""
    if user_role not in ["Developer", "Director", "Project Manager", "Manager"]:
        # If Employee, verify they belong to this project
        is_assigned = db.query(ProjectEmployeeAssignment).filter(
            ProjectEmployeeAssignment.project_id == parent_proj.id,
            ProjectEmployeeAssignment.user_id == current_user.id
        ).first()
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Not authorized to create modules for this project")

    # Fetch parent project's assigned employees
    proj_assignments = db.query(ProjectEmployeeAssignment).filter(
        ProjectEmployeeAssignment.project_id == parent_proj.id
    ).all()

    # Section 8.4: Validation - Reject if parent project has no assigned employees
    if not proj_assignments:
        raise HTTPException(
            status_code=400,
            detail="Cannot add module: The parent project has no assigned employees. At least one employee must be assigned to the project before adding modules."
        )

    assigned_user_ids = [pa.user_id for pa in proj_assignments]
    if parent_proj.lead_id and parent_proj.lead_id not in assigned_user_ids:
        assigned_user_ids.append(parent_proj.lead_id)

    # First employee as primary assignee for backwards compatibility
    primary_assignee_id = assigned_user_ids[0]

    mod = Module(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        status=payload.status or "Not Started",
        priority=payload.priority or "Medium",
        progress=payload.progress or 0.0,
        start_date=payload.start_date,
        deadline=payload.deadline,
        assigned_to_id=primary_assignee_id,
        sort_order=payload.sort_order or 0
    )
    db.add(mod)
    db.flush()

    # Section 8.3: Inherit ALL assigned employees (not just the first one)
    for uid in assigned_user_ids:
        db.add(ModuleEmployeeAssignment(module_id=mod.id, user_id=uid))

    # Initial update record for description history
    if payload.description:
        update_rec = Update(
            module_id=mod.id,
            user_id=current_user.id,
            description_text=payload.description
        )
        db.add(update_rec)

    # Notify all assigned employees (except creator)
    for uid in assigned_user_ids:
        if uid != current_user.id:
            db.add(Notification(
                user_id=uid,
                sender_id=current_user.id,
                title="Assigned to Module",
                message=f"{current_user.full_name} assigned you to module '{mod.name}' (inherited from {parent_proj.title})",
                link=f"/projects/{mod.project_id}",
                type="assignment"
            ))

    mod_id = mod.id
    project_id = mod.project_id
    db.commit()

    # SECTION 17: Recalculate parent project progress
    if project_id:
        calculate_and_update_project_progress(project_id, db)

    fresh_mod = db.query(Module).filter(Module.id == mod_id).first()
    return _format_module_out(fresh_mod or mod)

@router.put("/{module_id}", response_model=ModuleOut)
def update_module(
    module_id: int,
    payload: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mod = db.query(Module).filter(Module.id == module_id, Module.is_deleted == False).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    mod_id = mod.id
    project_id = mod.project_id
    old_status = mod.status
    old_assigned_to = mod.assigned_to_id
    mod_name = mod.name

    for key, val in payload.dict(exclude_unset=True).items():
        setattr(mod, key, val)

    mod.updated_at = datetime.utcnow()

    # Notify newly assigned user
    if mod.assigned_to_id and mod.assigned_to_id != old_assigned_to and mod.assigned_to_id != current_user.id:
        db.add(Notification(
            user_id=mod.assigned_to_id,
            sender_id=current_user.id,
            title="Module Assignment",
            message=f"You have been assigned to '{mod_name}' by {current_user.full_name}",
            link=f"/projects/{project_id}",
            type="assignment"
        ))

    db.commit()

    # SECTION 17: Recalculate parent project progress
    if project_id:
        calculate_and_update_project_progress(project_id, db)

    fresh_mod = db.query(Module).filter(Module.id == mod_id).first()
    return _format_module_out(fresh_mod or mod)

@router.delete("/{module_id}")
def delete_module(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Director", "Project Manager", "Manager"]))
):
    mod = db.query(Module).filter(Module.id == module_id, Module.is_deleted == False).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    project_id = mod.project_id
    mod.is_deleted = True
    db.commit()

    # SECTION 17: Recalculate parent project progress
    if project_id:
        calculate_and_update_project_progress(project_id, db)

    return {"message": "Module deleted successfully"}

@router.post("/{module_id}/updates")
async def post_module_update(
    module_id: int,
    description_text: str = Form(...),
    status_change: Optional[str] = Form(None),
    progress_change: Optional[float] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mod = db.query(Module).filter(Module.id == module_id, Module.is_deleted == False).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    project = mod.project or db.query(Project).filter(Project.id == mod.project_id).first()

    # All updates submitted to a module must be reviewed and accepted/rejected by the project creator
    # Never directly auto-accept: always start as 'pending'
    approval_status = "pending"

    update_record = Update(
        module_id=mod.id,
        user_id=current_user.id,
        description_text=description_text,
        status_change=status_change,
        progress_change=progress_change,
        approval_status=approval_status
    )
    db.add(update_record)
    db.flush()

    # Process uploaded files
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_attachments = []

    if files:
        for file in files:
            if not file.filename:
                continue
            ext = os.path.splitext(file.filename)[1].lower()
            safe_filename = f"{uuid.uuid4().hex}{ext}"
            file_destination = os.path.join(settings.UPLOAD_DIR, safe_filename)

            content = await file.read()
            if len(content) > 20 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"File {file.filename} exceeds 20MB limit")

            async with aiofiles.open(file_destination, 'wb') as f:
                await f.write(content)

            att = Attachment(
                module_id=mod.id,
                update_id=update_record.id,
                file_name=file.filename,
                file_path=f"/uploads/{safe_filename}",
                file_size=len(content),
                file_type=file.content_type,
                uploaded_by_id=current_user.id
            )
            db.add(att)
            saved_attachments.append(att)

    db.commit()

    # The approval request notification goes ONLY to the project creator!
    # Employees must NEVER receive the approval request.
    project_creator_id = project.creator_id if project else None
    project_title = project.title if project else "Project"

    if project_creator_id:
        db.add(Notification(
            user_id=project_creator_id,
            sender_id=current_user.id,
            title="Update Approval Request",
            message=f"{current_user.full_name} submitted an update for module '{mod.name}' in project '{project_title}'. Accept or reject the update.",
            link=f"/projects/{mod.project_id}",
            type="update_approval",
            related_type="update",
            related_id=update_record.id,
            action_status="pending"
        ))

    # Send in-app confirmation notification to the employee who submitted
    if current_user.id != project_creator_id:
        db.add(Notification(
            user_id=current_user.id,
            sender_id=current_user.id,
            title="Update Submitted",
            message=f"Your update for module '{mod.name}' in project '{project_title}' has been submitted and is awaiting approval by the project creator.",
            link=f"/projects/{mod.project_id}",
            type="info",
            related_type="update",
            related_id=update_record.id,
            action_status="pending"
        ))

    db.commit()

    return {
        "message": "Update submitted for approval. The project creator has been notified to accept or reject.",
        "update_id": update_record.id,
        "approval_status": "pending",
        "attachments_count": len(saved_attachments)
    }

@router.post("/updates/{update_id}/review")
def review_module_update(
    update_id: int,
    payload: UpdateReviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    update_rec = db.query(Update).filter(Update.id == update_id).with_for_update().first()
    if not update_rec:
        raise HTTPException(status_code=404, detail="Update not found")

    mod = db.query(Module).filter(Module.id == update_rec.module_id, Module.is_deleted == False).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    project = mod.project
    if not project or project.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the project creator can accept or reject this update.")

    if update_rec.approval_status != "pending":
        raise HTTPException(status_code=409, detail="This update has already been reviewed")

    action = payload.action.lower()
    if action not in ["accept", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")

    if action == "accept":
        update_rec.approval_status = "accepted"
        update_rec.reviewed_by_id = current_user.id
        update_rec.reviewed_at = datetime.utcnow()
        update_rec.rejection_reason = None

        # Apply update text and changes to module
        mod.description = update_rec.description_text
        if update_rec.status_change:
            mod.status = update_rec.status_change
        if update_rec.progress_change is not None:
            mod.progress = update_rec.progress_change
        mod.updated_at = datetime.utcnow()

        # Recalculate parent project progress
        if mod.project_id:
            calculate_and_update_project_progress(mod.project_id, db)

        # Mark matching approval notifications as accepted
        db.query(Notification).filter(
            Notification.related_type == "update",
            Notification.related_id == update_rec.id
        ).update({"action_status": "accepted", "is_read": True}, synchronize_session=False)

        # Notify the author who posted the update
        if update_rec.user_id != current_user.id:
            db.add(Notification(
                user_id=update_rec.user_id,
                sender_id=current_user.id,
                title="Update Accepted",
                message=f"Your update for module '{mod.name}' in project '{project.title}' was accepted by {current_user.full_name}.",
                link=f"/projects/{project.id}",
                type="update_accepted",
                related_type="update",
                related_id=update_rec.id,
                action_status="accepted"
            ))

    elif action == "reject":
        update_rec.approval_status = "rejected"
        update_rec.reviewed_by_id = current_user.id
        update_rec.reviewed_at = datetime.utcnow()
        update_rec.rejection_reason = payload.reason

        # Mark matching approval notifications as rejected
        db.query(Notification).filter(
            Notification.related_type == "update",
            Notification.related_id == update_rec.id
        ).update({"action_status": "rejected", "is_read": True}, synchronize_session=False)

        # Notify the author who posted the update
        if update_rec.user_id != current_user.id:
            reason_suffix = f" Reason: {payload.reason}" if payload.reason else ""
            db.add(Notification(
                user_id=update_rec.user_id,
                sender_id=current_user.id,
                title="Update Rejected",
                message=f"Your update for module '{mod.name}' in project '{project.title}' was rejected by {current_user.full_name}.{reason_suffix}",
                link=f"/projects/{project.id}",
                type="update_rejected",
                related_type="update",
                related_id=update_rec.id,
                action_status="rejected"
            ))

    db.commit()
    db.refresh(update_rec)

    return {
        "message": f"Update {action}ed successfully",
        "update_id": update_rec.id,
        "approval_status": update_rec.approval_status
    }

@router.get("/updates/pending", response_model=List[UpdateOut])
def get_pending_module_updates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pending_updates = db.query(Update).join(Module, Update.module_id == Module.id).join(
        Project, Module.project_id == Project.id
    ).filter(
        Update.approval_status == "pending",
        Project.creator_id == current_user.id,
        Module.is_deleted == False,
        Project.is_deleted == False
    ).order_by(Update.created_at.asc()).all()

    results = []
    for update_rec in pending_updates:
        mod = update_rec.module
        project = mod.project if mod else None
        results.append(UpdateOut(
            id=update_rec.id,
            module_id=update_rec.module_id,
            user_id=update_rec.user_id,
            user_name=update_rec.user.full_name if update_rec.user else "Unknown",
            user_avatar=update_rec.user.avatar_url if update_rec.user else None,
            project_id=project.id if project else None,
            project_name=project.title if project else None,
            module_name=mod.name if mod else None,
            description_text=update_rec.description_text,
            status_change=update_rec.status_change,
            progress_change=update_rec.progress_change,
            approval_status=update_rec.approval_status,
            reviewed_by_id=update_rec.reviewed_by_id,
            reviewed_by_name=update_rec.reviewed_by.full_name if update_rec.reviewed_by else None,
            reviewed_at=update_rec.reviewed_at,
            rejection_reason=update_rec.rejection_reason,
            created_at=update_rec.created_at
        ))
    return results

@router.get("/{module_id}/updates", response_model=List[UpdateOut])
def get_module_updates(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    mod = db.query(Module).filter(
        Module.id == module_id,
        Module.is_deleted == False
    ).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    updates = db.query(Update).filter(
        Update.module_id == module_id,
        Update.approval_status == "accepted"
    ).order_by(Update.created_at.asc()).all()
    results = []
    for u in updates:
        results.append(UpdateOut(
            id=u.id,
            module_id=u.module_id,
            user_id=u.user_id,
            user_name=u.user.full_name if u.user else "Unknown",
            user_avatar=u.user.avatar_url if u.user else None,
            project_id=mod.project_id,
            project_name=mod.project.title if mod.project else None,
            module_name=mod.name,
            description_text=u.description_text,
            status_change=u.status_change,
            progress_change=u.progress_change,
            approval_status=u.approval_status or "accepted",
            reviewed_by_id=u.reviewed_by_id,
            reviewed_by_name=u.reviewed_by.full_name if u.reviewed_by else None,
            reviewed_at=u.reviewed_at,
            rejection_reason=u.rejection_reason,
            created_at=u.created_at
        ))
    return results

@router.get("/{module_id}/images", response_model=List[AttachmentOut])
def get_module_images(
    module_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    attachments = db.query(Attachment).filter(
        Attachment.module_id == module_id
    ).order_by(Attachment.created_at.desc()).all()

    results = []
    for a in attachments:
        results.append(AttachmentOut(
            id=a.id,
            module_id=a.module_id,
            update_id=a.update_id,
            file_name=a.file_name,
            file_path=a.file_path,
            file_size=a.file_size,
            file_type=a.file_type,
            uploaded_by_id=a.uploaded_by_id,
            uploaded_by_name=a.uploaded_by.full_name if a.uploaded_by else "Unknown",
            created_at=a.created_at
        ))
    return results
