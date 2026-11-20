from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.modules import router as modules_router
from app.api.projects import router as projects_router
from app.core.security import create_access_token
from app.database.session import Base, get_db
from app.models.all_models import Company, Module, Project, ProjectEmployeeAssignment, Role, User
from app.services.project_service import calculate_and_update_project_progress


def create_database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


def create_project(db: Session) -> Project:
    role = Role(name="Director")
    company = Company(name="Test Company", code="TEST")
    user = User(
        username="test-director",
        email="director@test.invalid",
        hashed_password="unused",
        full_name="Test Director",
        role=role,
    )
    db.add_all([role, company, user])
    db.flush()
    project = Project(
        title="Module rollup test",
        company_id=company.id,
        creator_id=user.id,
        status="Not Started",
    )
    db.add(project)
    db.flush()
    return project


def test_progress_averages_active_modules_and_rolls_up_status():
    engine = create_database()
    with Session(engine) as db:
        project = create_project(db)
        modules = [
            Module(project_id=project.id, name="A", progress=100, status="Closed"),
            Module(project_id=project.id, name="B", progress=0, status="Not Started"),
            Module(project_id=project.id, name="C", progress=50, status="In Progress"),
            Module(project_id=project.id, name="Archived", progress=0, status="Not Started", is_deleted=True),
        ]
        db.add_all(modules)
        db.commit()

        assert calculate_and_update_project_progress(project.id, db) == 50
        assert project.status == "In Progress"

        modules[1].is_deleted = True
        db.commit()
        assert calculate_and_update_project_progress(project.id, db) == 75

        modules[0].status = "Not Started"
        modules[2].status = "Not Started"
        db.commit()
        calculate_and_update_project_progress(project.id, db)
        assert project.status == "Not Started"

        modules[0].status = "On Hold"
        modules[2].status = "On Hold"
        db.commit()
        calculate_and_update_project_progress(project.id, db)
        assert project.status == "On Hold"

        modules[2].status = "In Progress"
        db.commit()
        calculate_and_update_project_progress(project.id, db)
        assert project.status == "In Progress"

        project.status_override = "Review"
        db.commit()
        calculate_and_update_project_progress(project.id, db)
        assert project.status == "Review"

        project.status_override = "Cancelled"
        db.commit()
        calculate_and_update_project_progress(project.id, db)
        assert project.status == "Cancelled"

        project.status_override = None
        for module in [modules[0], modules[2]]:
            module.status = "Closed"
            module.progress = 100
        db.commit()
        assert calculate_and_update_project_progress(project.id, db) == 100
        assert project.status == "Closed"

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_module_deletion_requires_an_allowed_role_and_soft_deletes_only_target():
    engine = create_database()
    with Session(engine) as db:
        role_names = ["Developer", "Employee", "Director", "Project Manager", "Manager"]
        roles = {name: Role(name=name) for name in role_names}
        company = Company(name="Delete Test Company", code="DEL")
        db.add_all([*roles.values(), company])
        db.flush()
        users = {
            name: User(
                username=f"user-{name.lower().replace(' ', '-')}",
                email=f"{name.lower().replace(' ', '-')}@test.invalid",
                hashed_password="unused",
                full_name=name,
                role=roles[name],
            )
            for name in role_names
        }
        db.add_all(users.values())
        db.flush()
        project = Project(
            title="Delete authorization test",
            company_id=company.id,
            creator_id=users["Director"].id,
        )
        db.add(project)
        db.flush()
        db.add(ProjectEmployeeAssignment(
            project_id=project.id,
            user_id=users["Employee"].id,
        ))
        modules = [
            Module(project_id=project.id, name=f"Module {index}")
            for index in range(len(role_names))
        ]
        db.add_all(modules)
        db.commit()
        project_id = project.id
        module_ids = [module.id for module in modules]
        user_ids = {name: user.id for name, user in users.items()}

    app = FastAPI()

    def override_get_db():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(modules_router, prefix="/api/v1")
    app.include_router(projects_router, prefix="/api/v1")

    with TestClient(app) as client:
        for role, module_id in zip(role_names[:2], module_ids[:2]):
            token = create_access_token(user_ids[role], role)
            response = client.delete(
                f"/api/v1/modules/{module_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 403

        for role in role_names[:2]:
            token = create_access_token(user_ids[role], role)
            response = client.put(
                f"/api/v1/projects/{project_id}",
                headers={"Authorization": f"Bearer {token}"},
                json={"modules": []},
            )
            assert response.status_code == 403

        for role, module_id in zip(role_names[2:], module_ids[2:]):
            token = create_access_token(user_ids[role], role)
            response = client.delete(
                f"/api/v1/modules/{module_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200

    with Session(engine) as db:
        deleted_ids = {
            module.id for module in db.query(Module).filter(Module.is_deleted == True).all()
        }
        assert deleted_ids == set(module_ids[2:])

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
