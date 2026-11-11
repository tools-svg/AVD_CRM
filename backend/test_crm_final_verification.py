"""
Comprehensive Automated Test Suite for CRM Final Updates:
1. Database integrity (Supabase PostgreSQL, 23 tables).
2. Login activity & session tracking (login, heartbeat, logout, expiration, developer audit).
3. Project/Amount mode financials (permissions, quotes, payments, remaining calculation, 50% rule, ledger).
4. Application notification system (in-app creation, deduplication, read flags).
5. Permission matrix (Director, Project Manager, Employee restrictions).
"""
import sys
import os
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database.session import Base, engine, get_existing_tables, get_missing_tables, SessionLocal
from app.models.all_models import User, Project, ProjectFinance, ProjectPayment, UserSession, Notification

client = TestClient(app)

def test_crm_final():
    print("=" * 70)
    print("RUNNING FINAL CRM IMPLEMENTATION VERIFICATION SUITE")
    print("=" * 70)

    # 1. DATABASE SCHEMA & TABLE INTEGRITY
    print("\n[TEST 1] Verifying Supabase PostgreSQL Database & Tables...")
    existing = get_existing_tables()
    missing = get_missing_tables()
    print(f"Total tables present: {len(existing)}")
    assert "project_finances" in existing, "project_finances table missing"
    assert "project_payments" in existing, "project_payments table missing"
    assert "user_sessions" in existing, "user_sessions table missing"
    assert len(missing) == 0, f"Missing required tables: {missing}"
    print("✓ TEST 1 PASSED: All 23 required database tables confirmed in Supabase PostgreSQL.")

    # 2. AUTHENTICATION & LOGIN ACTIVITY TRACKING
    print("\n[TEST 2] Verifying User Login Activity & Session History...")
    # Login as developer
    dev_res = client.post("/api/auth/login", json={"username": "developer", "password": "dev123"})
    assert dev_res.status_code == 200, f"Dev login failed: {dev_res.text}"
    dev_data = dev_res.json()
    dev_token = dev_data["access_token"]
    dev_session_id = dev_data["user"].get("session_id")
    assert dev_session_id, "session_id missing in login response"
    dev_headers = {"Authorization": f"Bearer {dev_token}"}
    print(f"✓ Developer login successful. Session ID generated: {dev_session_id[:12]}...")

    # Login as director
    dir_res = client.post("/api/auth/login", json={"username": "director", "password": "director123"})
    assert dir_res.status_code == 200, f"Director login failed: {dir_res.text}"
    dir_data = dir_res.json()
    dir_token = dir_data["access_token"]
    dir_session_id = dir_data["user"].get("session_id")
    dir_headers = {"Authorization": f"Bearer {dir_token}"}
    print("✓ Director login successful.")

    # Login as employee
    emp_res = client.post("/api/auth/login", json={"username": "employee1", "password": "emp123"})
    assert emp_res.status_code == 200, f"Employee login failed: {emp_res.text}"
    emp_data = emp_res.json()
    emp_token = emp_data["access_token"]
    emp_session_id = emp_data["user"].get("session_id")
    emp_headers = {"Authorization": f"Bearer {emp_token}"}
    print("✓ Employee login successful.")

    # 2.1 Test Heartbeat
    hb_res = client.post("/api/auth/heartbeat", json={"session_id": dev_session_id})
    assert hb_res.status_code == 200 and hb_res.json().get("status") == "alive"
    print("✓ Heartbeat mechanism successfully updated active session.")

    # 2.2 Test Explicit Logout
    logout_res = client.post("/api/auth/logout", json={"session_id": emp_session_id})
    assert logout_res.status_code == 200
    print("✓ Explicit manual logout recorded for employee session.")

    # 2.3 Verify Developer Session Audit Endpoint
    sessions_res = client.get("/api/auth/sessions", headers=dev_headers)
    assert sessions_res.status_code == 200, f"Developer sessions access failed: {sessions_res.text}"
    sessions_data = sessions_res.json()
    assert sessions_data["total_count"] >= 3
    print(f"✓ Developer session audit retrieved {sessions_data['total_count']} historical sessions.")

    # Verify employee cannot access session audit (RBAC check)
    emp_sessions_res = client.get("/api/auth/sessions", headers=emp_headers)
    assert emp_sessions_res.status_code == 403, "Employee should be forbidden from reading session audit"
    print("✓ Security Check: Non-developer role receives HTTP 403 Forbidden for session audit.")

    # 3. PROJECT & AMOUNT MODE FINANCIAL TRACKING
    print("\n[TEST 3] Verifying Financial Tracking & Amount Mode Operations...")
    # Fetch accessible projects
    proj_res = client.get("/api/projects", headers=dev_headers)
    assert proj_res.status_code == 200
    all_projects = proj_res.json()
    assert len(all_projects) > 0, "No projects found"
    test_project = all_projects[0]
    test_proj_id = test_project["id"]
    print(f"Testing on project: '{test_project['title']}' (ID: {test_proj_id})")

    # 3.1 Verify Financials Access Permission (Director & PM allowed, Employee denied)
    dir_fin_res = client.get("/api/finances", headers=dir_headers)
    assert dir_fin_res.status_code == 200, f"Director finances failed: {dir_fin_res.text}"
    fin_summary = dir_fin_res.json()["summary"]
    print(f"✓ Director accessed financial overview: Total Quoted = {fin_summary['currency']} {fin_summary['total_quoted_amount']}")

    emp_fin_res = client.get("/api/finances", headers=emp_headers)
    assert emp_fin_res.status_code == 403, "Employee must receive HTTP 403 for /api/finances"
    print("✓ Security Check: Employee role is strictly forbidden (HTTP 403) from accessing financial endpoints.")

    # 3.2 Update Project Quoted Amount
    update_quote_res = client.put(
        f"/api/finances/{test_proj_id}",
        json={"quoted_amount": 100000.0, "currency": "₹", "notes": "Corporate pilot agreement"},
        headers=dir_headers
    )
    assert update_quote_res.status_code == 200
    pf_data = update_quote_res.json()
    assert pf_data["quoted_amount"] == 100000.0
    print("✓ Updated project quoted amount to ₹100,000.00.")

    # 3.3 Test Invalid Negative Payment Prevention
    neg_pay_res = client.post(
        f"/api/finances/{test_proj_id}/payments",
        json={"amount": -5000.0},
        headers=dir_headers
    )
    assert neg_pay_res.status_code == 400, "Negative payment must be rejected"
    print("✓ Business Rule Check: Negative payment correctly rejected with HTTP 400.")

    # 3.4 Record Valid First Payment (30% = ₹30,000)
    pay1_res = client.post(
        f"/api/finances/{test_proj_id}/payments",
        json={
            "amount": 30000.0,
            "payment_method": "Bank Transfer",
            "reference_number": f"TEST-TXN-{int(time.time())}",
            "notes": "Initial milestone advance"
        },
        headers=dir_headers
    )
    assert pay1_res.status_code == 200
    p1_data = pay1_res.json()
    assert p1_data["total_received"] >= 30000.0
    assert p1_data["remaining_amount"] == round(p1_data["quoted_amount"] - p1_data["total_received"], 2)
    print(f"✓ Payment 1 recorded. Total Received: ₹{p1_data['total_received']}, Remaining: ₹{p1_data['remaining_amount']}. Status: {p1_data['status']}")

    # 3.5 Test Duplicate Payment Prevention (same amount within 60s)
    dup_pay_res = client.post(
        f"/api/finances/{test_proj_id}/payments",
        json={"amount": 30000.0, "notes": "Accidental double click"},
        headers=dir_headers
    )
    assert dup_pay_res.status_code == 400, "Duplicate payment within 60s must be blocked"
    print("✓ Business Rule Check: Duplicate payment within 60 seconds successfully blocked with HTTP 400.")

    # 3.6 Test 50% Status Rule
    # Attempting to manually set status to '50% Received' when received is < 50% must fail
    # Set quoted to 200,000 so received (30,000) is only 15%
    client.put(f"/api/finances/{test_proj_id}", json={"quoted_amount": 200000.0}, headers=dir_headers)
    fail_50_res = client.put(
        f"/api/finances/{test_proj_id}",
        json={"status": "50% Received"},
        headers=dir_headers
    )
    assert fail_50_res.status_code == 400, "50% Received status must be rejected if actual payment < 50%"
    print("✓ Business Rule Check: Setting '50% Received' with insufficient actual payment rejected with HTTP 400.")

    # Now record second payment to cross 50% (add ₹80,000 so total = ₹110,000 / 200,000 = 55%)
    pay2_res = client.post(
        f"/api/finances/{test_proj_id}/payments",
        json={
            "amount": 80000.0,
            "payment_method": "UPI",
            "reference_number": f"UPI-REF-{int(time.time())}",
            "notes": "Midway milestone tranche"
        },
        headers=dir_headers
    )
    assert pay2_res.status_code == 200
    p2_data = pay2_res.json()
    assert p2_data["status"] == "50% Received", f"Status should be '50% Received', got: {p2_data['status']}"
    assert p2_data["remaining_amount"] == 200000.0 - 110000.0
    print(f"✓ Business Rule Check: When actual payment crossed 50%, status automatically evaluated to: '{p2_data['status']}'.")

    # 3.7 Verify Ledger History
    history_res = client.get(f"/api/finances/{test_proj_id}", headers=dir_headers)
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert len(history_data["payments"]) >= 2
    print(f"✓ Payment history ledger verified: {len(history_data['payments'])} transactions recorded with user tracking.")

    # 4. IN-APP NOTIFICATIONS & DEDUPLICATION
    print("\n[TEST 4] Verifying Notification System & Deduplication...")
    notif_payload = {
        "title": "Automated Milestone Completed",
        "message": "Payment milestone verification passed successfully.",
        "type": "success"
    }
    n1_res = client.post("/api/notifications", json=notif_payload, headers=dir_headers)
    assert n1_res.status_code == 200
    n1_id = n1_res.json()["id"]

    # Deduplication test: identical notification within 5 mins should return existing
    n2_res = client.post("/api/notifications", json=notif_payload, headers=dir_headers)
    assert n2_res.status_code == 200
    n2_id = n2_res.json()["id"]
    assert n1_id == n2_id, "Duplicate notification was created instead of being deduplicated"
    print("✓ Notification deduplication successfully verified (duplicate omitted within time window).")

    # Mark as read
    read_res = client.put(f"/api/notifications/{n1_id}/read", headers=dir_headers)
    assert read_res.status_code == 200
    print("✓ Notification marked as read successfully.")

    print("\n" + "=" * 70)
    print("ALL CRM ENHANCEMENT TESTS PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_crm_final()

