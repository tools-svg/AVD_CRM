from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import Company, User, UserCompanyAssignment, Project, ActivityLog
from app.schemas.schemas import CompanyOut, CompanyCreate, CompanyUpdate, CompanyStatsOut
from app.permissions.deps import get_current_user, require_roles, get_permitted_company_ids

router = APIRouter(prefix="/companies", tags=["Companies"])

def _format_company_out(c: Company, db: Session) -> CompanyOut:
    active_projs = db.query(Project).filter(
        Project.company_id == c.id,
        Project.is_deleted == False,
        Project.is_draft == False
    ).all()
    completed = sum(1 for p in active_projs if p.status == "Closed")
    ongoing = sum(1 for p in active_projs if p.status in ["In Progress", "Review", "On Hold"])

    stats = CompanyStatsOut(
        company_id=c.id,
        company_name=c.name,
        company_code=c.code,
        total_projects=len(active_projs),
        completed_projects=completed,
        ongoing_projects=ongoing
    )

    return CompanyOut(
        id=c.id,
        name=c.name,
        code=c.code,
        logo_url=c.logo_url,
        description=c.description,
        is_active=c.is_active,
        created_at=c.created_at,
        stats=stats
    )

@router.get("", response_model=List[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Company).filter(Company.is_active == True)
    permitted_ids = get_permitted_company_ids(current_user, db)
    if permitted_ids is not None:
        if not permitted_ids:
            return []
        query = query.filter(Company.id.in_(permitted_ids))
    companies = query.all()
    return [_format_company_out(c, db) for c in companies]

@router.post("", response_model=CompanyOut, dependencies=[Depends(require_roles(["Developer"]))])
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Company).filter((Company.name == payload.name) | (Company.code == payload.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Company name or code already exists")
    company = Company(**payload.dict())
    db.add(company)
    db.commit()
    db.refresh(company)

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Created Company",
        entity_type="company",
        entity_id=company.id,
        details=f"Company '{company.name}' ({company.code}) created by Developer"
    ))
    db.commit()

    return _format_company_out(company, db)

@router.put("/{company_id}", response_model=CompanyOut, dependencies=[Depends(require_roles(["Developer"]))])
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(company, key, val)
    db.commit()
    db.refresh(company)

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Updated Company",
        entity_type="company",
        entity_id=company.id,
        details=f"Company '{company.name}' updated by Developer"
    ))
    db.commit()

    return _format_company_out(company, db)

@router.delete("/{company_id}", dependencies=[Depends(require_roles(["Developer"]))])
def delete_company(
    company_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    SECTION 14.2: Before deleting a company, check whether projects or active records
    are associated with it to prevent accidental destruction of business data.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    active_projects_count = db.query(Project).filter(
        Project.company_id == company_id,
        Project.is_deleted == False
    ).count()

    if active_projects_count > 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deactivate company '{company.name}'. It has {active_projects_count} active project(s). Reassign or archive projects first, or use force=true."
        )

    company.is_active = False
    db.commit()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="Deactivated Company",
        entity_type="company",
        entity_id=company.id,
        details=f"Company '{company.name}' deactivated by Developer (force={force})"
    ))
    db.commit()

    return {"message": f"Company '{company.name}' deactivated successfully"}
