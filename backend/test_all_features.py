import os
import sys
import unittest
from datetime import datetime, timedelta

# Ensure backend directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.session import Base, get_db
from app.models.all_models import (
    Role,
    Company,
    User,
    UserCompanyAssignment,
    Project,
    Module,
    StickyNote,
    StickyNoteMention,
    Notification,
    ProjectEmployeeAssignment,
    ActivityLog
)
from app.services.project_service import calculate_and_update_project_progress
from app.core.security import create_access_token, get_password_hash

# Use a test SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_suite.db"
test_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

class TestPlatformFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)
        db = TestingSessionLocal()

        # Seed roles
        cls.dev_role = Role(name="Developer")
        cls.dir_role = Role(name="Director")
        cls.pm_role = Role(name="Project Manager")
        cls.mgr_role = Role(name="Manager")
        cls.emp_role = Role(name="Employee")
        db.add_all([cls.dev_role, cls.dir_role, cls.pm_role, cls.mgr_role, cls.emp_role])
        db.commit()
        cls.emp_role_id = cls.emp_role.id

        # Seed companies
        c1 = Company(name="AVD Tech Systems", code="AVD-TECH", logo_url="/logos/1.png")
        c2 = Company(name="AVD Capital & Holdings", code="AVD-CAP", logo_url="/logos/2.png")
        db.add_all([c1, c2])
        db.commit()

        cls.c1_id = c1.id
        cls.c2_id = c2.id

        # Seed users
        dev_u = User(
            username="developer",
            email="dev@avd.com",
            hashed_password=get_password_hash("dev123"),
            full_name="Alex Dev",
            role_id=cls.dev_role.id
        )
        dir_u = User(
            username="director",
            email="dir@avd.com",
            hashed_password=get_password_hash("dir123"),
            full_name="Elena Vance",
            role_id=cls.dir_role.id
        )
        pm_u = User(
            username="pm",
            email="pm@avd.com",
            hashed_password=get_password_hash("pm123"),
            full_name="Marcus Vance",
            role_id=cls.pm_role.id
        )
        mgr_u = User(
            username="manager",
            email="mgr@avd.com",
            hashed_password=get_password_hash("mgr123"),
            full_name="Sarah Lin",
            role_id=cls.mgr_role.id
        )
        emp_u1 = User(
            username="employee",
            email="emp@avd.com",
            hashed_password=get_password_hash("emp123"),
            full_name="Julian Thorne",
            role_id=cls.emp_role.id
        )
        emp_u2 = User(
            username="claire",
            email="claire@avd.com",
            hashed_password=get_password_hash("claire123"),
            full_name="Claire Fontaine",
            role_id=cls.emp_role.id
        )
        db.add_all([dev_u, dir_u, pm_u, mgr_u, emp_u1, emp_u2])
        db.commit()

        cls.dev_id = dev_u.id
        cls.dir_id = dir_u.id
        cls.pm_id = pm_u.id
        cls.mgr_id = mgr_u.id
        cls.emp1_id = emp_u1.id
        cls.emp2_id = emp_u2.id

        # Assign companies
        db.add(UserCompanyAssignment(user_id=dev_u.id, company_id=c1.id))
        db.add(UserCompanyAssignment(user_id=dev_u.id, company_id=c2.id))
        db.add(UserCompanyAssignment(user_id=dir_u.id, company_id=c1.id))
        db.add(UserCompanyAssignment(user_id=dir_u.id, company_id=c2.id))
        db.add(UserCompanyAssignment(user_id=pm_u.id, company_id=c1.id))
        db.add(UserCompanyAssignment(user_id=mgr_u.id, company_id=c1.id))
        db.add(UserCompanyAssignment(user_id=emp_u1.id, company_id=c1.id))
        db.add(UserCompanyAssignment(user_id=emp_u2.id, company_id=c2.id))
        db.commit()

        # Auth headers (pass user.id as subject!)
        cls.dev_token = create_access_token(dev_u.id, "Developer")
        cls.dev_headers = {"Authorization": f"Bearer {cls.dev_token}"}

        cls.dir_token = create_access_token(dir_u.id, "Director")
        cls.dir_headers = {"Authorization": f"Bearer {cls.dir_token}"}

        cls.pm_token = create_access_token(pm_u.id, "Project Manager")
        cls.pm_headers = {"Authorization": f"Bearer {cls.pm_token}"}

        cls.mgr_token = create_access_token(mgr_u.id, "Manager")
        cls.mgr_headers = {"Authorization": f"Bearer {cls.mgr_token}"}

        cls.emp_token = create_access_token(emp_u1.id, "Employee")
        cls.emp_headers = {"Authorization": f"Bearer {cls.emp_token}"}

        db.close()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        if os.path.exists("./test_suite.db"):
            try:
                os.remove("./test_suite.db")
            except Exception:
                pass

    # ---------------------------------------------------------
    # TEST 1: Section 17 – Project Progress Formula
    # ---------------------------------------------------------
    def test_section_17_progress_calculation(self):
        db = TestingSessionLocal()
        p = Project(
            title="Telemetry Audit Alpha",
            company_id=self.c1_id,
            creator_id=self.dir_id,
            status="In Progress",
            priority="Urgent",
            is_draft=False
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        # 0 modules -> 0.0%
        prog = calculate_and_update_project_progress(p.id, db)
        self.assertEqual(prog, 0.0)

        # Add 5 modules: 1 Closed, 4 non-closed
        m1 = Module(project_id=p.id, name="M1", status="Closed")
        m2 = Module(project_id=p.id, name="M2", status="In Progress")
        m3 = Module(project_id=p.id, name="M3", status="Review")
        m4 = Module(project_id=p.id, name="M4", status="On Hold")
        m5 = Module(project_id=p.id, name="M5", status="Cancelled")
        db.add_all([m1, m2, m3, m4, m5])
        db.commit()

        # 1 / 5 = 20.0%
        prog = calculate_and_update_project_progress(p.id, db)
        self.assertEqual(prog, 20.0)

        # Close another module: 2 / 5 = 40.0%
        m2.status = "Closed"
        db.commit()
        prog = calculate_and_update_project_progress(p.id, db)
        self.assertEqual(prog, 40.0)

        # Close all 5: 5 / 5 = 100.0%
        m3.status = "Closed"
        m4.status = "Closed"
        m5.status = "Closed"
        db.commit()
        prog = calculate_and_update_project_progress(p.id, db)
        self.assertEqual(prog, 100.0)
        db.close()

    # ---------------------------------------------------------
    # TEST 2: Section 12 – Mandatory Employee Assignment
    # ---------------------------------------------------------
    def test_section_12_mandatory_employee_assignment(self):
        # Publishing a project without employees must fail (HTTP 400)
        res = client.post(
            "/api/projects",
            headers=self.dir_headers,
            json={
                "title": "Unassigned Project Test",
                "description": "Should fail",
                "company_id": self.c1_id,
                "priority": "Medium",
                "status": "Not Started",
                "assigned_employee_ids": [],
                "is_draft": False
            }
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Employee assignment is mandatory", res.json()["detail"])

        # Publishing with an assigned employee succeeds
        res_ok = client.post(
            "/api/projects",
            headers=self.dir_headers,
            json={
                "title": "Assigned Project Test",
                "description": "Should succeed",
                "company_id": self.c1_id,
                "priority": "High",
                "status": "Not Started",
                "assigned_employee_ids": [self.emp1_id],
                "is_draft": False
            }
        )
        self.assertEqual(res_ok.status_code, 200)
        created_p = res_ok.json()
        self.assertIn(self.emp1_id, created_p["assigned_employee_ids"])

        # Automatic Module Assignment Inheritance:
        res_mod = client.post(
            "/api/modules",
            headers=self.dir_headers,
            json={
                "project_id": created_p["id"],
                "name": "Auto Inherited Stream",
                "status": "Not Started",
                "priority": "Medium"
            }
        )
        self.assertEqual(res_mod.status_code, 200)
        self.assertEqual(res_mod.json()["assigned_to_id"], self.emp1_id)

    # ---------------------------------------------------------
    # TEST 3: Section 11 – Save as Draft Workflow
    # ---------------------------------------------------------
    def test_section_11_save_as_draft_workflow(self):
        # Saving draft with incomplete info succeeds without employee requirement
        res = client.post(
            "/api/projects",
            headers=self.dir_headers,
            json={
                "title": "Confidential Draft Blueprint",
                "description": "Incomplete notes",
                "company_id": self.c1_id,
                "is_draft": True
            }
        )
        self.assertEqual(res.status_code, 200)
        draft_id = res.json()["id"]

        # 1. Draft must NOT appear in main project list
        res_list = client.get("/api/projects", headers=self.dir_headers)
        active_ids = [p["id"] for p in res_list.json()]
        self.assertNotIn(draft_id, active_ids)

        # 2. Draft appears in /api/projects/drafts
        res_drafts = client.get("/api/projects/drafts", headers=self.dir_headers)
        draft_ids = [d["id"] for d in res_drafts.json()]
        self.assertIn(draft_id, draft_ids)

        # 3. Publish draft: Updating with is_draft=False and assigned employees publishes without duplicate
        res_publish = client.put(
            f"/api/projects/{draft_id}",
            headers=self.dir_headers,
            json={
                "is_draft": False,
                "assigned_employee_ids": [self.emp1_id]
            }
        )
        self.assertEqual(res_publish.status_code, 200)
        self.assertFalse(res_publish.json()["is_draft"])

        # Now appears in main project list
        res_list_after = client.get("/api/projects", headers=self.dir_headers)
        after_ids = [p["id"] for p in res_list_after.json()]
        self.assertIn(draft_id, after_ids)

    # ---------------------------------------------------------
    # TEST 4: Section 13 – GitHub-Style Deletion Confirmation
    # ---------------------------------------------------------
    def test_section_13_github_style_deletion(self):
        db = TestingSessionLocal()
        p = Project(
            title="Quantum Encryption Gateway",
            company_id=self.c1_id,
            creator_id=self.dir_id,
            is_draft=False
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        p_id = p.id
        db.close()

        # Project Manager is strictly forbidden from deleting
        res_pm = client.delete(
            f"/api/projects/{p_id}?confirm_name=Quantum Encryption Gateway",
            headers=self.pm_headers
        )
        self.assertEqual(res_pm.status_code, 403)

        # Director deleting without exact typed confirmation fails (HTTP 400)
        res_bad_confirm = client.delete(
            f"/api/projects/{p_id}?confirm_name=Wrong Name",
            headers=self.dir_headers
        )
        self.assertEqual(res_bad_confirm.status_code, 400)

        # Director deleting with exact matching confirmation succeeds
        res_ok = client.delete(
            f"/api/projects/{p_id}?confirm_name=Quantum Encryption Gateway",
            headers=self.dir_headers
        )
        self.assertEqual(res_ok.status_code, 200)

        # Project is soft-deleted
        res_check = client.get(f"/api/projects/{p_id}", headers=self.dir_headers)
        self.assertEqual(res_check.status_code, 404)

    # ---------------------------------------------------------
    # TEST 5: Section 4 – Sticky Notes Team Mention (@Entire Team)
    # ---------------------------------------------------------
    def test_section_4_team_mention(self):
        # Manager in AVD Tech Systems mentions @Entire Team
        res = client.post(
            "/api/sticky-notes",
            headers=self.mgr_headers,
            json={
                "title": "Architecture Sprint Note",
                "content": "Please review new RFC @Entire Team",
                "mention_all_team": True,
                "color": "#F4E9D2"
            }
        )
        self.assertEqual(res.status_code, 200)

        # Eligible employee Julian (emp1_id) in AVD Tech Systems receives notification
        res_notifs = client.get("/api/notifications", headers=self.emp_headers)
        self.assertEqual(res_notifs.status_code, 200)
        notif_messages = [n["message"] for n in res_notifs.json()]
        self.assertTrue(any("Architecture Sprint Note" in m or "Sarah Lin" in m for m in notif_messages))

    # ---------------------------------------------------------
    # TEST 6: Section 7 – Project Priority Sorting Order
    # ---------------------------------------------------------
    def test_section_7_priority_sorting(self):
        db = TestingSessionLocal()
        db.query(Project).filter(Project.company_id == self.c2_id).delete()
        db.commit()

        p_closed = Project(title="Closed P", company_id=self.c2_id, creator_id=self.dir_id, priority="Urgent", status="Closed", is_draft=False)
        p_urgent = Project(title="Urgent P", company_id=self.c2_id, creator_id=self.dir_id, priority="Urgent", status="In Progress", is_draft=False)
        p_low = Project(title="Low P", company_id=self.c2_id, creator_id=self.dir_id, priority="Low", status="In Progress", is_draft=False)
        p_cancelled = Project(title="Cancelled P", company_id=self.c2_id, creator_id=self.dir_id, priority="High", status="Cancelled", is_draft=False)
        p_high = Project(title="High P", company_id=self.c2_id, creator_id=self.dir_id, priority="High", status="In Progress", is_draft=False)

        db.add_all([p_closed, p_urgent, p_low, p_cancelled, p_high])
        db.commit()
        db.close()

        res = client.get(f"/api/projects?company_id={self.c2_id}", headers=self.dir_headers)
        self.assertEqual(res.status_code, 200)
        titles = [p["title"] for p in res.json()]

        # Active projects first in order: Urgent -> High -> Low
        # Closed and Cancelled always at the bottom!
        self.assertEqual(titles[0], "Urgent P")
        self.assertEqual(titles[1], "High P")
        self.assertEqual(titles[2], "Low P")
        self.assertIn(titles[3], ["Closed P", "Cancelled P"])
        self.assertIn(titles[4], ["Closed P", "Cancelled P"])

    # ---------------------------------------------------------
    # TEST 7: Section 9 – Global Search API
    # ---------------------------------------------------------
    def test_section_9_search_api(self):
        res = client.get("/api/search?q=Urgent", headers=self.dir_headers)
        self.assertEqual(res.status_code, 200)
        results = res.json()
        self.assertTrue(len(results) > 0)
        self.assertTrue(any(r["type"] == "project" for r in results))

    # ---------------------------------------------------------
    # TEST 8: Section 14 – Developer Dashboard CRUD
    # ---------------------------------------------------------
    def test_section_14_developer_crud(self):
        # 1. Developer creates a new user
        res_u = client.post(
            "/api/users",
            headers=self.dev_headers,
            json={
                "username": "newengineer",
                "email": "engineer@avd.com",
                "full_name": "Test Engineer",
                "password": "securepassword123",
                "role_id": self.emp_role_id,
                "company_ids": [self.c1_id],
                "is_active": True
            }
        )
        self.assertEqual(res_u.status_code, 200)
        uid = res_u.json()["id"]

        # 2. Developer updates user info and resets password
        res_up = client.put(
            f"/api/users/{uid}",
            headers=self.dev_headers,
            json={
                "full_name": "Test Engineer Senior",
                "password": "newpassword456"
            }
        )
        self.assertEqual(res_up.status_code, 200)
        self.assertEqual(res_up.json()["full_name"], "Test Engineer Senior")

        # 3. Developer deactivates user
        res_deact = client.delete(f"/api/users/{uid}?hard=false", headers=self.dev_headers)
        self.assertEqual(res_deact.status_code, 200)
        self.assertFalse(res_deact.json()["is_active"])

        # 4. Developer creates a company
        res_c = client.post(
            "/api/companies",
            headers=self.dev_headers,
            json={
                "name": "AVD Quantum Computing",
                "code": "AVD-QC",
                "logo_url": "/logos/4.png",
                "description": "Quantum supremacy research"
            }
        )
        self.assertEqual(res_c.status_code, 200)
        cid = res_c.json()["id"]

        # 5. Developer edits company
        res_cup = client.put(
            f"/api/companies/{cid}",
            headers=self.dev_headers,
            json={"description": "Updated Quantum Focus"}
        )
        self.assertEqual(res_cup.status_code, 200)
        self.assertEqual(res_cup.json()["description"], "Updated Quantum Focus")

    # ---------------------------------------------------------
    # TEST 9: Image Upload & Member Profile Update (Section 3)
    # ---------------------------------------------------------
    def test_section_3_image_upload_and_profile_update(self):
        import io
        # 1. Upload valid PNG image
        fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4")
        res_upload = client.post(
            "/api/upload/image",
            headers=self.dev_headers,
            files={"file": ("test_avatar.png", fake_png, "image/png")}
        )
        self.assertEqual(res_upload.status_code, 200)
        upload_data = res_upload.json()
        self.assertTrue(upload_data["url"].startswith("/uploads/"))
        self.assertTrue(upload_data["url"].endswith(".png"))

        # 2. Reject disallowed extension
        fake_txt = io.BytesIO(b"not an image")
        res_invalid = client.post(
            "/api/upload/image",
            headers=self.dev_headers,
            files={"file": ("bad_file.exe", fake_txt, "application/octet-stream")}
        )
        self.assertEqual(res_invalid.status_code, 400)

        # 3. Update logged-in user profile with new avatar URL
        res_me = client.put(
            "/api/auth/me",
            headers=self.dev_headers,
            json={"full_name": "Alex Dev Senior", "avatar_url": upload_data["url"]}
        )
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()["full_name"], "Alex Dev Senior")
        self.assertEqual(res_me.json()["avatar_url"], upload_data["url"])

    # ---------------------------------------------------------
    # TEST 10: Automatic Module Employee Inheritance (Section 8)
    # ---------------------------------------------------------
    def test_section_8_module_employee_inheritance(self):
        # 1. Create a project with multiple assigned employees
        res_p = client.post(
            "/api/projects",
            headers=self.dir_headers,
            json={
                "title": "Inheritance Multi-Employee Project",
                "company_id": self.c1_id,
                "lead_id": self.emp1_id,
                "assigned_employee_ids": [self.emp1_id, self.emp2_id],
                "priority": "High"
            }
        )
        self.assertEqual(res_p.status_code, 200)
        pid = res_p.json()["id"]

        # 2. Add module to project without providing employee IDs
        res_m = client.post(
            "/api/modules",
            headers=self.dir_headers,
            json={
                "project_id": pid,
                "name": "Consensus Core Submodule",
                "description": "Inherits parent project team"
            }
        )
        self.assertEqual(res_m.status_code, 200)
        mod = res_m.json()
        # Verify both employees were inherited
        self.assertIn(self.emp1_id, mod["assigned_employee_ids"])
        self.assertIn(self.emp2_id, mod["assigned_employee_ids"])

        # 3. Validation: If parent project has NO assigned employees, reject module creation
        db = TestingSessionLocal()
        from app.models.all_models import ProjectEmployeeAssignment
        p_no_emps = Project(title="Empty Project", company_id=self.c1_id, creator_id=self.dir_id, is_draft=False)
        db.add(p_no_emps)
        db.commit()
        empty_pid = p_no_emps.id
        db.close()

        res_reject = client.post(
            "/api/modules",
            headers=self.dir_headers,
            json={
                "project_id": empty_pid,
                "name": "Orphan Module"
            }
        )
        self.assertEqual(res_reject.status_code, 400)
        self.assertIn("no assigned employees", res_reject.json()["detail"].lower())

if __name__ == "__main__":
    unittest.main()
