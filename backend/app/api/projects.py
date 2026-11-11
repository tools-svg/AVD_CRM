import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, desc, asc
from app.database.session import get_db
from app.models.all_models import (
    Project, 
    Module, 
    User, 
    Company, 
    ProjectShare, 
    ActivityLog, 
    Update,
    ProjectEmployeeAssignment,
    Notification
)
from app.schemas.schemas import ProjectOut, ProjectCreate, ProjectUpdate, ModuleOut
from app.permissions.deps import get_current_user, require_roles, get_permitted_company_ids
from app.services.project_service import calculate_and_update_project_progress

router = APIRouter(prefix="/projects", tags=["Projects"])

def _format_project_out(p: Project, db: Session) -> ProjectOut:
    modules_out = []
    for m in p.modules:
        if not m.is_deleted:
            updates_count = len(m.updates)
            attachments_count = len(m.attachments)
            modules_out.append(ModuleOut(
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
                assigned_to_name=m.assigned_to.full_name if m.assigned_to else None,
                assigned_to_avatar=m.assigned_to.avatar_url if m.assigned_to else None,
                sort_order=m.sort_order,
                updates_count=updates_count,
                attachments_count=attachments_count,
                created_at=m.created_at
            ))

    active_share = db.query(ProjectShare).filter(
        ProjectShare.project_id == p.id,
        ProjectShare.is_revoked == False
    ).first()

    # Get all assigned employees
    assignments = db.query(ProjectEmployeeAssignment).filter(
        ProjectEmployeeAssignment.project_id == p.id
    ).all()
    assigned_ids = [a.user_id for a in assignments]
    if p.lead_id and p.lead_id not in assigned_ids:
        assigned_ids.append(p.lead_id)

    assigned_users_data = []
    if assigned_ids:
        users = db.query(User).filter(User.id.in_(assigned_ids)).all()
        for u in users:
            assigned_users_data.append({
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "avatar_url": u.avatar_url,
                "role_name": u.role.name if u.role else "Employee"
            })

    return ProjectOut(
        id=p.id,
        title=p.title,
        description=p.description,
        company_id=p.company_id,
        creator_id=p.creator_id,
        lead_id=p.lead_id,
        status=p.status,
        priority=p.priority,
        progress=p.progress,
        start_date=p.start_date,
        deadline=p.deadline,
        is_draft=p.is_draft,
        creator_name=p.creator.full_name if p.creator else None,
        lead_name=p.lead.full_name if p.lead else None,
        company_name=p.company.name if p.company else None,
        assigned_employee_ids=assigned_ids,
        assigned_employees=assigned_users_data,
        modules=modules_out,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_shared=active_share is not None,
        share_token=active_share.token if active_share else None
    )

@router.get("", response_model=List[ProjectOut])
def list_projects(
    company_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    include_drafts: bool = False, # Section 11: Drafts must NOT appear in main project list
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Project).filter(Project.is_deleted == False)

    role_name = current_user.role.name if current_user.role else ""
    permitted_company_ids = get_permitted_company_ids(current_user, db)

    # Scoping by role
    if role_name == "Manager":
        if permitted_company_ids is not None:
            if not permitted_company_ids:
                return []
            query = query.filter(Project.company_id.in_(permitted_company_ids))
    elif role_name == "Employee":
        # Only projects assigned to employee or where employee has assigned modules
        query = query.filter(
            (Project.lead_id == current_user.id) |
            (Project.employee_assignments.any(ProjectEmployeeAssignment.user_id == current_user.id)) |
            (Project.modules.any(Module.assigned_to_id == current_user.id))
        )

    if company_id:
        if permitted_company_ids is not None and company_id not in permitted_company_ids:
            raise HTTPException(status_code=403, detail="Cannot access projects outside assigned company")
        query = query.filter(Project.company_id == company_id)

    if status_filter:
        query = query.filter(Project.status == status_filter)

    # Exclude drafts by default
    if not include_drafts:
        query = query.filter(Project.is_draft == False)

    # SECTION 7: Project Priority & Status Sorting Order
    # 1. Urgent
    # 2. High
    # 3. Medium
    # 4. Low
    # Within same priority: earliest deadline first
    # 5. Closed
    # 6. Cancelled (always at the bottom)
    status_rank = case(
        (Project.status == 'Closed', 2),
        (Project.status == 'Cancelled', 3),
        else_=1
    )

    priority_rank = case(
        (Project.priority == 'Urgent', 1),
        (Project.priority == 'High', 2),
        (Project.priority == 'Medium', 3),
        (Project.priority == 'Low', 4),
        else_=5
    )

    projects = query.order_by(
        status_rank.asc(),
        priority_rank.asc(),
        Project.deadline.asc().nulls_last(),
        Project.created_at.desc()
    ).all()

    return [_format_project_out(p, db) for p in projects]

@router.get("/drafts", response_model=List[ProjectOut])
def get_user_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    SECTION 11: Returns saved drafts for the current user.
    """
    drafts = db.query(Project).filter(
        Project.is_draft == True,
        Project.is_deleted == False,
        Project.creator_id == current_user.id
    ).order_by(Project.updated_at.desc()).all()

    return [_format_project_out(p, db) for p in drafts]

@router.delete("/drafts/{draft_id}")
def delete_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    SECTION 11: Discards/deletes a saved draft.
    """
    draft = db.query(Project).filter(
        Project.id == draft_id,
        Project.is_draft == True,
        Project.is_deleted == False,
        Project.creator_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    db.delete(draft)
    db.commit()
    return {"message": "Draft discarded successfully"}

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role_name = current_user.role.name if current_user.role else ""
    permitted_company_ids = get_permitted_company_ids(current_user, db)

    if role_name == "Manager" and permitted_company_ids is not None:
        if project.company_id not in permitted_company_ids:
            raise HTTPException(status_code=403, detail="Access denied to this company's project")

    if role_name == "Employee":
        is_assigned = (
            (project.lead_id == current_user.id) or
            any(a.user_id == current_user.id for a in project.employee_assignments) or
            any(m.assigned_to_id == current_user.id for m in project.modules)
        )
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Access denied to non-assigned project")

    return _format_project_out(project, db)

@router.post("", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot create projects")

    # SECTION 12: Employee assignment is mandatory for active projects!
    assigned_ids = payload.assigned_employee_ids or []
    if payload.lead_id and payload.lead_id not in assigned_ids:
        assigned_ids.append(payload.lead_id)

    if not payload.is_draft and not assigned_ids:
        raise HTTPException(
            status_code=400,
            detail="Employee assignment is mandatory. Please select at least one employee before creating the project."
        )

    permitted_company_ids = get_permitted_company_ids(current_user, db)
    if role_name == "Manager" and permitted_company_ids is not None:
        if payload.company_id not in permitted_company_ids:
            raise HTTPException(status_code=403, detail="Cannot create project in an unassigned company")

    primary_lead_id = payload.lead_id or (assigned_ids[0] if assigned_ids else current_user.id)

    project = Project(
        title=payload.title,
        description=payload.description,
        company_id=payload.company_id,
        creator_id=current_user.id,
        lead_id=primary_lead_id,
        status=payload.status,
        priority=payload.priority,
        progress=0.0,
        start_date=payload.start_date,
        deadline=payload.deadline,
        is_draft=payload.is_draft
    )
    db.add(project)
    db.flush()

    # Persist Employee Assignments (Section 12)
    for uid in assigned_ids:
        db.add(ProjectEmployeeAssignment(project_id=project.id, user_id=uid))

    # Optional initial modules with automatic employee assignment inheritance (Section 12)
    if payload.modules:
        default_employee_id = primary_lead_id
        for idx, m_in in enumerate(payload.modules):
            mod_assignee = m_in.assigned_to_id or default_employee_id
            mod = Module(
                project_id=project.id,
                name=m_in.name,
                description=m_in.description,
                status=m_in.status,
                priority=m_in.priority,
                progress=m_in.progress,
                start_date=m_in.start_date or project.start_date,
                deadline=m_in.deadline or project.deadline,
                assigned_to_id=mod_assignee,
                sort_order=idx
            )
            db.add(mod)
            db.flush()
            if m_in.description:
                db.add(Update(
                    module_id=mod.id,
                    user_id=current_user.id,
                    description_text=m_in.description
                ))

    # Trigger project assignment notifications ONLY for active projects (NOT for drafts!)
    if not project.is_draft:
        for uid in assigned_ids:
            if uid != current_user.id:
                db.add(Notification(
                    user_id=uid,
                    sender_id=current_user.id,
                    title="Project Assignment",
                    message=f"{current_user.full_name} assigned you to project '{project.title}'",
                    link=f"/projects/{project.id}",
                    type="assignment"
                ))

        db.add(ActivityLog(
            user_id=current_user.id,
            action="Created Project",
            entity_type="project",
            entity_id=project.id,
            details=f"Project '{project.title}' created"
        ))

    proj_id = project.id
    db.commit()

    # Recalculate progress strictly using Section 17 formula
    calculate_and_update_project_progress(proj_id, db)

    fresh_project = db.query(Project).filter(Project.id == proj_id).first()
    return _format_project_out(fresh_project, db)

@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    role_name = current_user.role.name if current_user.role else ""
    if role_name == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot edit project settings")

    was_draft = project.is_draft
    update_data = payload.dict(exclude_unset=True)

    # Handle employee assignments if provided
    assigned_ids = update_data.pop("assigned_employee_ids", None)
    if assigned_ids is not None:
        # Mandatory validation if publishing draft or active project
        becoming_active = (payload.is_draft is False) or (not project.is_draft and payload.is_draft is None)
        if becoming_active and not assigned_ids and not payload.lead_id and not project.lead_id:
            raise HTTPException(status_code=400, detail="Employee assignment is mandatory")

        db.query(ProjectEmployeeAssignment).filter(
            ProjectEmployeeAssignment.project_id == project.id
        ).delete()
        for uid in assigned_ids:
            db.add(ProjectEmployeeAssignment(project_id=project.id, user_id=uid))
        if assigned_ids and not payload.lead_id:
            project.lead_id = assigned_ids[0]

    for key, val in update_data.items():
        setattr(project, key, val)

    # Recalculate progress strictly according to Section 17
    calculate_and_update_project_progress(project.id, db)

    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)

    # If project transitioned from Draft -> Published, send assignment notifications
    if was_draft and not project.is_draft:
        current_assigned = [a.user_id for a in project.employee_assignments]
        if project.lead_id and project.lead_id not in current_assigned:
            current_assigned.append(project.lead_id)
        for uid in current_assigned:
            if uid != current_user.id:
                db.add(Notification(
                    user_id=uid,
                    sender_id=current_user.id,
                    title="Project Assignment",
                    message=f"{current_user.full_name} assigned you to project '{project.title}'",
                    link=f"/projects/{project.id}",
                    type="assignment"
                ))
        db.commit()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Updated Project",
        entity_type="project",
        entity_id=project.id,
        details=f"Project '{project.title}' updated (draft={project.is_draft})"
    ))
    db.commit()

    fresh_project = db.query(Project).filter(Project.id == project.id).first()
    return _format_project_out(fresh_project, db)

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    confirm_name: Optional[str] = Query(None, description="Exact project title for GitHub-style typed deletion confirmation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    SECTION 13: GitHub-Style Deletion Confirmation.
    Requires exact typed project name match. Only Developer or Director permitted.
    """
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "Project Manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project Manager is strictly prohibited from deleting projects"
        )
    if role_name not in ["Developer", "Director"]:
        raise HTTPException(status_code=403, detail="Only Developer or Director can delete projects")

    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # GitHub-Style typed confirmation validation
    if not confirm_name or confirm_name.strip() != project.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Confirmation failed. You must type '{project.title}' exactly to confirm destructive deletion."
        )

    project.is_deleted = True
    db.commit()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Deleted Project",
        entity_type="project",
        entity_id=project.id,
        details=f"Project '{project.title}' permanently soft-deleted after exact typed confirmation"
    ))
    db.commit()

    return {"message": f"Project '{project.title}' deleted successfully"}

@router.post("/{project_id}/complete", response_model=ProjectOut)
def complete_project(
    project_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in ["Developer", "Director", "Project Manager", "Manager"]:
        raise HTTPException(status_code=403, detail="Unauthorized to complete project")

    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    active_modules = [m for m in project.modules if not m.is_deleted]
    unfinished = [m for m in active_modules if m.status != "Closed"]
    if unfinished and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Project has {len(unfinished)} unfinished module(s). Please confirm or complete modules first."
        )

    project.status = "Closed"
    calculate_and_update_project_progress(project.id, db)
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Completed Project",
        entity_type="project",
        entity_id=project.id,
        details=f"Project '{project.title}' marked as Closed by {current_user.full_name}"
    ))
    db.commit()

    fresh_project = db.query(Project).filter(Project.id == project.id).first()
    return _format_project_out(fresh_project, db)

@router.post("/{project_id}/share")
def share_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director"]))
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing_share = db.query(ProjectShare).filter(
        ProjectShare.project_id == project_id,
        ProjectShare.is_revoked == False
    ).first()

    if existing_share:
        return {"token": existing_share.token, "share_url": f"/public/project/{existing_share.token}"}

    token = secrets.token_urlsafe(32)
    share = ProjectShare(
        project_id=project_id,
        token=token,
        created_by_id=current_user.id,
        is_revoked=False
    )
    db.add(share)
    db.commit()

    return {"token": token, "share_url": f"/public/project/{token}"}

@router.delete("/{project_id}/share")
def revoke_share(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director"]))
):
    shares = db.query(ProjectShare).filter(
        ProjectShare.project_id == project_id,
        ProjectShare.is_revoked == False
    ).all()

    for s in shares:
        s.is_revoked = True
        s.revoked_at = datetime.utcnow()
    db.commit()

    return {"message": "Public sharing link revoked successfully"}

@router.post("/{project_id}/employees/{user_id}", response_model=ProjectOut)
def add_employee_to_project(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager", "Manager"]))
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(ProjectEmployeeAssignment).filter(
        ProjectEmployeeAssignment.project_id == project_id,
        ProjectEmployeeAssignment.user_id == user_id
    ).first()

    if not existing:
        db.add(ProjectEmployeeAssignment(project_id=project_id, user_id=user_id))
        if not project.lead_id:
            project.lead_id = user_id

        if user_id != current_user.id:
            db.add(Notification(
                user_id=user_id,
                sender_id=current_user.id,
                title="Project Assignment",
                message=f"{current_user.full_name} assigned you to project '{project.title}'",
                link=f"/projects/{project.id}",
                type="assignment"
            ))

        db.add(ActivityLog(
            user_id=current_user.id,
            action="Assigned Employee to Project",
            entity_type="project",
            entity_id=project.id,
            details=f"Employee '{target_user.full_name}' was assigned to project '{project.title}'"
        ))
        db.commit()

    return _format_project_out(project, db)

@router.delete("/{project_id}/employees/{user_id}")
def remove_employee_from_project(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager", "Manager"]))
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_user = db.query(User).filter(User.id == user_id).first()
    target_name = target_user.full_name if target_user else f"User {user_id}"

    # Remove assignment
    db.query(ProjectEmployeeAssignment).filter(
        ProjectEmployeeAssignment.project_id == project_id,
        ProjectEmployeeAssignment.user_id == user_id
    ).delete()

    # Unassign from any modules in this project
    db.query(Module).filter(
        Module.project_id == project_id,
        Module.assigned_to_id == user_id
    ).update({Module.assigned_to_id: None}, synchronize_session=False)

    # If this user was the lead, reassign lead to remaining assigned employee or current_user
    if project.lead_id == user_id:
        remaining = db.query(ProjectEmployeeAssignment).filter(
            ProjectEmployeeAssignment.project_id == project_id
        ).first()
        project.lead_id = remaining.user_id if remaining else current_user.id

    if user_id != current_user.id and target_user:
        db.add(Notification(
            user_id=user_id,
            sender_id=current_user.id,
            title="Project Unassignment",
            message=f"You have been unassigned from project '{project.title}' by {current_user.full_name}",
            link=f"/home",
            type="info"
        ))

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Removed Employee from Project",
        entity_type="project",
        entity_id=project.id,
        details=f"Employee '{target_name}' was removed from project '{project.title}'"
    ))
    db.commit()

    return {
        "message": f"Employee '{target_name}' removed from project successfully",
        "project": _format_project_out(project, db)
    }
