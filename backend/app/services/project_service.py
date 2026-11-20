from sqlalchemy.orm import Session
from app.models.all_models import Project, Module

def calculate_and_update_project_progress(project_id: int, db: Session) -> float:
    """
    Recalculates project progress as the mean progress of its active modules.
    Review, On Hold, and Cancelled can be explicitly overridden at project level.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.is_deleted == False).first()
    if not project:
        return 0.0

    active_modules = db.query(Module).filter(
        Module.project_id == project_id,
        Module.is_deleted == False
    ).all()

    active_modules = [m for m in active_modules if m is not None]
    total_modules = len(active_modules)
    if total_modules == 0:
        new_progress = 0.0
        project.status = project.status_override or "Not Started"
    else:
        new_progress = round(
            sum(float(m.progress or 0.0) for m in active_modules) / total_modules,
            2
        )

        if project.status_override in {"Review", "On Hold", "Cancelled"}:
            project.status = project.status_override
        elif all(m.status == "Closed" for m in active_modules):
            project.status = "Closed"
        elif all(m.status == "Not Started" for m in active_modules):
            project.status = "Not Started"
        elif all(m.status == "On Hold" for m in active_modules):
            project.status = "On Hold"
        else:
            project.status = "In Progress"

    project.progress = new_progress

    db.commit()
    db.refresh(project)
    return new_progress

