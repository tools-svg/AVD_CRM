from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy import false
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import Project, Module, User, Company, ProjectEmployeeAssignment
from app.schemas.schemas import DashboardStatsOut, CompanyStatsOut
from app.permissions.deps import get_current_user, get_permitted_company_ids

router = APIRouter(prefix="/statistics", tags=["Dashboard Statistics"])

@router.get("", response_model=DashboardStatsOut)
def get_dashboard_statistics(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_name = current_user.role.name if current_user.role else ""
    permitted_company_ids = get_permitted_company_ids(current_user, db)

    # Base query: non-deleted and non-draft projects only (Section 11)
    proj_query = db.query(Project).filter(Project.is_deleted == False, Project.is_draft == False)
    scope_desc = "Organization-wide"

    if role_name == "Manager":
        if permitted_company_ids is not None:
            if not permitted_company_ids:
                proj_query = proj_query.filter(false())
            else:
                proj_query = proj_query.filter(Project.company_id.in_(permitted_company_ids))
        scope_desc = "Assigned Company Scope"
    elif role_name == "Employee":
        proj_query = proj_query.filter(
            (Project.lead_id == current_user.id) |
            (Project.employee_assignments.any(ProjectEmployeeAssignment.user_id == current_user.id)) |
            (Project.modules.any(Module.assigned_to_id == current_user.id))
        )
        scope_desc = f"Assigned to {current_user.full_name}"

    if company_id:
        proj_query = proj_query.filter(Project.company_id == company_id)

    projects = proj_query.all()

    # Calculations:
    # Completed = Closed
    # Ongoing = In Progress, Review, On Hold (Not Started and Cancelled excluded)
    completed_projects = sum(1 for p in projects if p.status == "Closed")
    ongoing_projects = sum(1 for p in projects if p.status in ["In Progress", "Review", "On Hold"])

    # SECTION 6.2: Compute Company-Specific Statistics
    company_stats_list = []
    comp_query = db.query(Company).filter(Company.is_active == True)
    if permitted_company_ids is not None:
        if not permitted_company_ids:
            comp_query = comp_query.filter(false())
        else:
            comp_query = comp_query.filter(Company.id.in_(permitted_company_ids))
    companies = comp_query.all()

    for c in companies:
        c_projects = db.query(Project).filter(
            Project.company_id == c.id,
            Project.is_deleted == False,
            Project.is_draft == False
        )
        if role_name == "Employee":
            c_projects = c_projects.filter(
                (Project.lead_id == current_user.id) |
                (Project.employee_assignments.any(ProjectEmployeeAssignment.user_id == current_user.id)) |
                (Project.modules.any(Module.assigned_to_id == current_user.id))
            )
        c_projs = c_projects.all()
        c_completed = sum(1 for p in c_projs if p.status == "Closed")
        c_ongoing = sum(1 for p in c_projs if p.status in ["In Progress", "Review", "On Hold"])

        company_stats_list.append(CompanyStatsOut(
            company_id=c.id,
            company_name=c.name,
            company_code=c.code,
            total_projects=len(c_projs),
            completed_projects=c_completed,
            ongoing_projects=c_ongoing
        ))

    return DashboardStatsOut(
        total_projects=len(projects),
        completed_projects=completed_projects,
        ongoing_projects=ongoing_projects,
        scope_description=scope_desc,
        company_stats=company_stats_list
    )
