from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import Project, Module, GanttDependency, User
from app.schemas.schemas import GanttDependencyCreate, GanttDependencyOut
from app.permissions.deps import get_current_user, get_permitted_company_ids

router = APIRouter(prefix="/gantt", tags=["Gantt Chart"])

@router.get("/data")
def get_gantt_data(
    company_id: Optional[int] = None,
    project_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "End User":
        raise HTTPException(status_code=403, detail="End Users cannot access Gantt chart")

    permitted_company_ids = get_permitted_company_ids(current_user, db)

    proj_query = db.query(Project).filter(Project.is_deleted == False, Project.is_draft == False)

    if role_name == "Manager" and permitted_company_ids is not None:
        if not permitted_company_ids:
            return {"projects": [], "modules": [], "dependencies": []}
        proj_query = proj_query.filter(Project.company_id.in_(permitted_company_ids))
    elif role_name == "Employee":
        proj_query = proj_query.filter(
            (Project.lead_id == current_user.id) |
            (Project.modules.any(Module.assigned_to_id == current_user.id))
        )

    if company_id:
        proj_query = proj_query.filter(Project.company_id == company_id)

    if project_id:
        proj_query = proj_query.filter(Project.id == project_id)

    projects = proj_query.all()
    project_ids = [p.id for p in projects]
    if not project_ids:
        return {"projects": [], "modules": [], "dependencies": []}

    mod_query = db.query(Module).filter(
        Module.project_id.in_(project_ids),
        Module.is_deleted == False
    )

    if role_name == "Employee":
        mod_query = mod_query.filter(Module.assigned_to_id == current_user.id)
    elif employee_id:
        mod_query = mod_query.filter(Module.assigned_to_id == employee_id)

    modules = mod_query.order_by(Module.sort_order.asc(), Module.start_date.asc()).all()

    mod_ids = [m.id for m in modules]
    if not mod_ids:
        dependencies = []
    else:
        dependencies = db.query(GanttDependency).filter(
            GanttDependency.predecessor_id.in_(mod_ids),
            GanttDependency.successor_id.in_(mod_ids)
        ).all()

    # Format projects
    formatted_projects = []
    for p in projects:
        # Include project if it has modules or matches employee filter
        p_mods = [m for m in modules if m.project_id == p.id]
        if employee_id and not p_mods and p.lead_id != employee_id:
            continue

        formatted_projects.append({
            "id": p.id,
            "title": p.title,
            "company_name": p.company.name if p.company else "",
            "start_date": p.start_date.isoformat() if p.start_date else datetime.utcnow().isoformat(),
            "deadline": p.deadline.isoformat() if p.deadline else datetime.utcnow().isoformat(),
            "progress": p.progress,
            "status": p.status,
            "priority": p.priority,
            "lead_name": p.lead.full_name if p.lead else None,
            "lead_avatar": p.lead.avatar_url if p.lead else None
        })

    # Format modules
    formatted_modules = []
    for m in modules:
        # Predecessor ids
        preds = [d.predecessor_id for d in dependencies if d.successor_id == m.id]
        formatted_modules.append({
            "id": m.id,
            "project_id": m.project_id,
            "name": m.name,
            "start_date": m.start_date.isoformat() if m.start_date else datetime.utcnow().isoformat(),
            "deadline": m.deadline.isoformat() if m.deadline else datetime.utcnow().isoformat(),
            "progress": m.progress,
            "status": m.status,
            "priority": m.priority,
            "assigned_to_id": m.assigned_to_id,
            "assigned_to_name": m.assigned_to.full_name if m.assigned_to else "Unassigned",
            "assigned_to_avatar": m.assigned_to.avatar_url if m.assigned_to else None,
            "dependencies": preds
        })

    formatted_deps = [
        {
            "id": d.id,
            "predecessor_id": d.predecessor_id,
            "successor_id": d.successor_id,
            "dependency_type": d.dependency_type
        }
        for d in dependencies
    ]

    return {
        "projects": formatted_projects,
        "modules": formatted_modules,
        "dependencies": formatted_deps
    }

@router.put("/modules/{module_id}/timeline")
def update_module_timeline(
    module_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Persists drag & drop changes to start date and deadline.
    """
    mod = db.query(Module).filter(Module.id == module_id, Module.is_deleted == False).first()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    if "start_date" in payload and payload["start_date"]:
        mod.start_date = datetime.fromisoformat(payload["start_date"].replace("Z", "+00:00"))
    if "deadline" in payload and payload["deadline"]:
        mod.deadline = datetime.fromisoformat(payload["deadline"].replace("Z", "+00:00"))
    if "progress" in payload and payload["progress"] is not None:
        mod.progress = float(payload["progress"])

    mod.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(mod)

    # Rollup to project strictly according to Section 17
    if mod.project_id:
        from app.services.project_service import calculate_and_update_project_progress
        calculate_and_update_project_progress(mod.project_id, db)

    return {"message": "Timeline updated successfully"}

@router.post("/dependencies", response_model=GanttDependencyOut)
def create_dependency(
    payload: GanttDependencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.predecessor_id == payload.successor_id:
        raise HTTPException(status_code=400, detail="Cannot depend on itself")

    existing = db.query(GanttDependency).filter(
        GanttDependency.predecessor_id == payload.predecessor_id,
        GanttDependency.successor_id == payload.successor_id
    ).first()
    if existing:
        return existing

    dep = GanttDependency(
        predecessor_id=payload.predecessor_id,
        successor_id=payload.successor_id,
        dependency_type=payload.dependency_type
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep

@router.delete("/dependencies/{dep_id}")
def delete_dependency(
    dep_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dep = db.query(GanttDependency).filter(GanttDependency.id == dep_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependency not found")
    db.delete(dep)
    db.commit()
    return {"message": "Dependency removed"}

