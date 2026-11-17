from sqlalchemy.orm import Session
from app.models.all_models import Project, Module

def calculate_and_update_project_progress(project_id: int, db: Session) -> float:
    """
    Recalculates project completion percentage according to Section 17:
    Project Completion Percentage = (Number of closed modules / Total number of non-deleted modules) * 100
    - Only 'Closed' modules count as completed.
    - 'In Progress', 'Review', 'On Hold', 'Cancelled', 'Not Started' do NOT count as completed.
    - If 0 modules, returns 0.0.
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
    else:
        closed_modules = sum(1 for m in active_modules if getattr(m, 'status', None) == "Closed")
        new_progress = round((closed_modules / total_modules) * 100, 1)

    project.progress = new_progress

    # Automatically synchronize project status with module progress:
    # 1. If all active modules are Closed (and there is at least one module), mark project as Closed
    if total_modules > 0 and closed_modules == total_modules:
        project.status = "Closed"
    # 2. If any module is In Progress, Review, or Closed, advance project from Not Started to In Progress
    elif project.status == "Not Started" and (new_progress > 0 or any(getattr(m, 'status', None) in ["In Progress", "Review", "Closed"] for m in active_modules)):
        project.status = "In Progress"

    db.commit()
    db.refresh(project)
    return new_progress

