from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import false, or_
from app.database.session import get_db
from app.models.all_models import Project, Module, User, Company, ProjectEmployeeAssignment
from app.schemas.schemas import SearchResultItem
from app.permissions.deps import get_current_user, get_permitted_company_ids

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("", response_model=List[SearchResultItem])
def search_global(
    q: str = Query(..., min_length=1, description="Search query string"),
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query_str = f"%{q.strip()}%"
    role_name = current_user.role.name if current_user.role else ""
    permitted_company_ids = get_permitted_company_ids(current_user, db)

    results: List[SearchResultItem] = []

    # 1. Search Projects
    proj_query = db.query(Project).filter(
        Project.is_deleted == False,
        Project.is_draft == False,
        or_(
            Project.title.ilike(query_str),
            Project.description.ilike(query_str)
        )
    )

    if role_name == "Manager" and permitted_company_ids is not None:
        if not permitted_company_ids:
            proj_query = proj_query.filter(false())
        else:
            proj_query = proj_query.filter(Project.company_id.in_(permitted_company_ids))
    elif role_name == "Employee":
        proj_query = proj_query.filter(
            (Project.lead_id == current_user.id) |
            (Project.employee_assignments.any(ProjectEmployeeAssignment.user_id == current_user.id)) |
            (Project.modules.any(Module.assigned_to_id == current_user.id))
        )

    matched_projects = proj_query.limit(limit).all()
    for p in matched_projects:
        results.append(SearchResultItem(
            type="project",
            id=p.id,
            project_id=p.id,
            title=p.title,
            subtitle=f"{p.company.name if p.company else 'AVD'} • {p.status}",
            status=p.status,
            priority=p.priority,
            snippet=p.description[:80] if p.description else None
        ))

    # 2. Search Modules
    mod_query = db.query(Module).join(Project, Module.project_id == Project.id).filter(
        Module.is_deleted == False,
        Project.is_deleted == False,
        Project.is_draft == False,
        or_(
            Module.name.ilike(query_str),
            Module.description.ilike(query_str)
        )
    )

    if role_name == "Manager" and permitted_company_ids is not None:
        if not permitted_company_ids:
            mod_query = mod_query.filter(false())
        else:
            mod_query = mod_query.filter(Project.company_id.in_(permitted_company_ids))
    elif role_name == "Employee":
        mod_query = mod_query.filter(
            (Module.assigned_to_id == current_user.id) |
            (Project.lead_id == current_user.id)
        )

    matched_modules = mod_query.limit(limit).all()
    for m in matched_modules:
        results.append(SearchResultItem(
            type="module",
            id=m.id,
            project_id=m.project_id or 0,
            title=m.name,
            subtitle=f"Project: {m.project.title if m.project else 'Initiative'} • {m.status}",
            status=m.status,
            priority=m.priority,
            snippet=m.description[:80] if m.description else None
        ))

    # 3. Search Employees (permitted for Developer, Director, PM, Manager)
    if role_name in ["Developer", "Director", "Project Manager", "Manager"]:
        user_query = db.query(User).filter(
            User.is_active == True,
            or_(
                User.full_name.ilike(query_str),
                User.username.ilike(query_str),
                User.email.ilike(query_str)
            )
        )
        matched_users = user_query.limit(5).all()
        for u in matched_users:
            results.append(SearchResultItem(
                type="employee",
                id=u.id,
                project_id=0,
                title=u.full_name,
                subtitle=f"Role: {u.role.name if u.role else 'Member'} • {u.email}",
                status="Active",
                priority=None,
                snippet=f"Username: {u.username}"
            ))

    return results

