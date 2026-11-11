from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.all_models import ProjectShare, Project, Module, Company

router = APIRouter(prefix="/public", tags=["Public Project Sharing"])

@router.get("/project/{token}")
def get_public_project(token: str, db: Session = Depends(get_db)):
    """
    Public read-only project view accessible without login.
    No private employee details, no internal sticky notes, no Gantt chart.
    Valid until explicitly revoked.
    """
    share = db.query(ProjectShare).filter(
        ProjectShare.token == token,
        ProjectShare.is_revoked == False
    ).first()

    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared project link is invalid, expired, or has been revoked by Director"
        )

    project = share.project
    if not project or project.is_deleted:
        raise HTTPException(status_code=404, detail="Project not found or deleted")

    # Safe modules list for end-users (no private personal details)
    sanitized_modules = []
    for m in project.modules:
        if not m.is_deleted:
            sanitized_modules.append({
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "status": m.status,
                "priority": m.priority,
                "progress": m.progress,
                "deadline": m.deadline.isoformat() if m.deadline else None,
                "updates_count": len(m.updates)
            })

    return {
        "project": {
            "title": project.title,
            "description": project.description,
            "status": project.status,
            "priority": project.priority,
            "progress": project.progress,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "deadline": project.deadline.isoformat() if project.deadline else None,
            "company_name": project.company.name if project.company else "AVD Group",
            "company_logo": project.company.logo_url if project.company else "/logos/1.png"
        },
        "modules": sanitized_modules,
        "shared_at": share.created_at.isoformat()
    }

