from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.session import get_db
from app.models.all_models import (
    Project, 
    ProjectFinance, 
    ProjectPayment, 
    User, 
    Company,
    ActivityLog
)
from app.schemas.schemas import (
    ProjectFinanceOut,
    ProjectFinanceUpdate,
    ProjectPaymentCreate,
    ProjectPaymentOut,
    ProjectFinanceDashboardOut,
    FinanceSummaryStats
)
from app.permissions.deps import get_current_user, require_roles, get_permitted_company_ids

router = APIRouter(prefix="/finances", tags=["Project Finances"])

def _calculate_finance_status(quoted: float, received: float, requested_status: Optional[str] = None) -> str:
    """
    Enforces payment status business logic (Requirement 2):
    - 50% Received MUST be backed by actual payment >= 50% of quoted.
    - Fully Received when received >= quoted and quoted > 0.
    - Quoted when received == 0.
    - Partially Received when 0 < received < 50%.
    - Manual overrides like 'On Hold', 'Overdue', 'Cancelled' are preserved.
    """
    if requested_status in ["On Hold", "Overdue", "Cancelled"]:
        return requested_status

    if requested_status == "50% Received":
        if quoted <= 0 or received < (quoted * 0.5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot set status to '50% Received': Actual received amount ({received}) is less than 50% of quoted ({quoted})."
            )
        return "50% Received"

    if quoted > 0 and received >= quoted:
        return "Fully Received"
    elif quoted > 0 and received >= (quoted * 0.5):
        return "50% Received"
    elif received > 0:
        return "Partially Received"
    else:
        return "Quoted"


def _format_finance_out(pf: ProjectFinance, project: Project) -> ProjectFinanceOut:
    total_received = sum(p.amount for p in pf.payments)
    remaining = max(0.0, pf.quoted_amount - total_received)

    payments_out = []
    for p in pf.payments:
        payments_out.append(ProjectPaymentOut(
            id=p.id,
            finance_id=p.finance_id,
            project_id=p.project_id,
            amount=p.amount,
            payment_date=p.payment_date,
            payment_method=p.payment_method,
            reference_number=p.reference_number,
            notes=p.notes,
            recorded_by_id=p.recorded_by_id,
            recorded_by_name=p.recorded_by.full_name if p.recorded_by else None,
            created_at=p.created_at
        ))

    return ProjectFinanceOut(
        id=pf.id,
        project_id=project.id,
        project_title=project.title,
        company_id=project.company_id,
        company_name=project.company.name if project.company else None,
        currency=pf.currency or "₹",
        quoted_amount=pf.quoted_amount,
        total_received=round(total_received, 2),
        remaining_amount=round(remaining, 2),
        status=pf.status,
        notes=pf.notes,
        payment_count=len(pf.payments),
        payments=payments_out,
        created_at=pf.created_at,
        updated_at=pf.updated_at
    )


@router.get("", response_model=ProjectFinanceDashboardOut)
def get_all_finances(
    company_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager"]))
):
    """
    Project finances dashboard listing and aggregate summary.
    Restricted strictly to Developer, Director, and Project Manager roles.
    """
    permitted_company_ids = get_permitted_company_ids(current_user, db)

    query = db.query(Project).filter(Project.is_deleted == False, Project.is_draft == False)
    if permitted_company_ids is not None:
        query = query.filter(Project.company_id.in_(permitted_company_ids))
    if company_id:
        query = query.filter(Project.company_id == company_id)

    projects = query.order_by(Project.created_at.desc()).all()

    finance_items = []
    total_quoted = 0.0
    total_received = 0.0

    for p in projects:
        pf = db.query(ProjectFinance).filter(ProjectFinance.project_id == p.id).first()
        if not pf:
            pf = ProjectFinance(
                project_id=p.id,
                currency="₹",
                quoted_amount=0.0,
                status="Quoted"
            )
            db.add(pf)
            db.commit()
            db.refresh(pf)

        formatted = _format_finance_out(pf, p)
        finance_items.append(formatted)
        total_quoted += formatted.quoted_amount
        total_received += formatted.total_received

    total_remaining = max(0.0, total_quoted - total_received)
    collection_percentage = round((total_received / total_quoted * 100), 1) if total_quoted > 0 else 0.0

    summary = FinanceSummaryStats(
        total_projects_count=len(projects),
        total_quoted_amount=round(total_quoted, 2),
        total_received_amount=round(total_received, 2),
        total_remaining_amount=round(total_remaining, 2),
        collection_percentage=collection_percentage,
        currency="₹"
    )

    return ProjectFinanceDashboardOut(summary=summary, finances=finance_items)


@router.get("/{project_id}", response_model=ProjectFinanceOut)
def get_project_finance(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager"]))
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pf = db.query(ProjectFinance).filter(ProjectFinance.project_id == project_id).first()
    if not pf:
        pf = ProjectFinance(
            project_id=project_id,
            currency="₹",
            quoted_amount=0.0,
            status="Quoted"
        )
        db.add(pf)
        db.commit()
        db.refresh(pf)

    return _format_finance_out(pf, project)


@router.put("/{project_id}", response_model=ProjectFinanceOut)
def update_project_finance(
    project_id: int,
    payload: ProjectFinanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager"]))
):
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pf = db.query(ProjectFinance).filter(ProjectFinance.project_id == project_id).first()
    if not pf:
        pf = ProjectFinance(project_id=project_id, currency="₹", quoted_amount=0.0, status="Quoted")
        db.add(pf)
        db.flush()

    if payload.quoted_amount is not None:
        if payload.quoted_amount < 0:
            raise HTTPException(status_code=400, detail="Quoted amount cannot be negative")
        pf.quoted_amount = round(payload.quoted_amount, 2)

    if payload.currency is not None and payload.currency.strip():
        pf.currency = payload.currency.strip()

    if payload.notes is not None:
        pf.notes = payload.notes.strip()

    total_received = sum(p.amount for p in pf.payments)
    pf.status = _calculate_finance_status(pf.quoted_amount, total_received, payload.status or pf.status)
    pf.updated_at = datetime.utcnow()

    # Audit log
    db.add(ActivityLog(
        user_id=current_user.id,
        action="update_project_finance",
        entity_type="project_finance",
        entity_id=pf.id,
        details=f"Updated finance for project '{project.title}': Quoted={pf.quoted_amount}, Status={pf.status}"
    ))

    db.commit()
    db.refresh(pf)
    return _format_finance_out(pf, project)


@router.post("/{project_id}/payments", response_model=ProjectFinanceOut)
def record_payment(
    project_id: int,
    payload: ProjectPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director", "Project Manager"]))
):
    """
    Record received payment against project finance ledger.
    Prevents negative payments and duplicate submissions.
    """
    if payload.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero."
        )

    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pf = db.query(ProjectFinance).filter(ProjectFinance.project_id == project_id).first()
    if not pf:
        pf = ProjectFinance(project_id=project_id, currency="₹", quoted_amount=0.0, status="Quoted")
        db.add(pf)
        db.flush()

    # Prevent accidental duplicate payment records within 60 seconds
    recent_duplicate = db.query(ProjectPayment).filter(
        ProjectPayment.project_id == project_id,
        ProjectPayment.amount == payload.amount,
        ProjectPayment.created_at >= datetime.utcnow() - timedelta(seconds=60)
    ).first()
    if recent_duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate payment detected: An identical payment was just recorded in the last 60 seconds."
        )

    if payload.reference_number and payload.reference_number.strip():
        ref_dup = db.query(ProjectPayment).filter(
            ProjectPayment.project_id == project_id,
            ProjectPayment.reference_number == payload.reference_number.strip()
        ).first()
        if ref_dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment with reference number '{payload.reference_number}' already exists for this project."
            )

    new_payment = ProjectPayment(
        finance_id=pf.id,
        project_id=project_id,
        amount=round(payload.amount, 2),
        payment_date=payload.payment_date or datetime.utcnow(),
        payment_method=payload.payment_method or "Bank Transfer",
        reference_number=payload.reference_number.strip() if payload.reference_number else None,
        notes=payload.notes.strip() if payload.notes else None,
        recorded_by_id=current_user.id
    )
    db.add(new_payment)
    db.flush()

    # Recalculate status with updated payment ledger
    current_received = sum(p.amount for p in pf.payments) + new_payment.amount
    pf.status = _calculate_finance_status(pf.quoted_amount, current_received)
    pf.updated_at = datetime.utcnow()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="record_payment",
        entity_type="project_payment",
        entity_id=new_payment.id,
        details=f"Recorded payment of {new_payment.amount} for project '{project.title}'"
    ))

    db.commit()
    db.refresh(pf)
    return _format_finance_out(pf, project)


@router.delete("/payments/{payment_id}", response_model=ProjectFinanceOut)
def void_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["Developer", "Director"]))
):
    payment = db.query(ProjectPayment).filter(ProjectPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    project = db.query(Project).filter(Project.id == payment.project_id).first()
    pf = db.query(ProjectFinance).filter(ProjectFinance.id == payment.finance_id).first()

    amount_removed = payment.amount
    project_id = payment.project_id

    db.delete(payment)
    db.flush()

    if pf:
        updated_received = sum(p.amount for p in pf.payments if p.id != payment_id)
        pf.status = _calculate_finance_status(pf.quoted_amount, updated_received)
        pf.updated_at = datetime.utcnow()

    db.add(ActivityLog(
        user_id=current_user.id,
        action="void_payment",
        entity_type="project_payment",
        entity_id=payment_id,
        details=f"Voided payment of {amount_removed} from project id {project_id}"
    ))

    db.commit()
    db.refresh(pf)
    return _format_finance_out(pf, project)

