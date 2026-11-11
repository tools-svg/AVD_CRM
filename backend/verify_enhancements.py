import urllib.request
import json
import uuid
import sys

API = 'http://localhost:8000/api'

def run():
    print("Starting Comprehensive Verification...")

    # 1. Login as Developer
    req = urllib.request.Request(
        f'{API}/auth/login',
        data=json.dumps({'username': 'developer', 'password': 'dev123'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    resp = json.loads(urllib.request.urlopen(req).read().decode())
    token = resp['access_token']
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    print("[1] Developer Login: SUCCESS")

    # 2. Test Direct UI Editing Persistence & 24h Undo
    edit_payload = {
        'role': 'Developer',
        'component_key': 'direct_edits',
        'config_json': json.dumps({'th_deadline': {'text': 'Deadline', 'textColor': '#2563EB', 'fontWeight': '700'}})
    }
    req = urllib.request.Request(
        f'{API}/ui-config/save',
        data=json.dumps(edit_payload).encode(),
        headers=headers,
        method='PUT'
    )
    save_resp = json.loads(urllib.request.urlopen(req).read().decode())
    print("[2] Direct UI Edit Save:", save_resp['message'])

    # Verify retrieved in config
    req = urllib.request.Request(f'{API}/ui-config/Developer', headers=headers)
    cfg_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert 'direct_edits' in cfg_resp['configurations'], "direct_edits not in configurations"
    assert cfg_resp['configurations']['direct_edits']['th_deadline']['text'] == 'Deadline'
    print("[2.1] Direct UI Edit Retrieval Verified!")

    # Check 24-hr undo history
    req = urllib.request.Request(f'{API}/ui-config/undo/history?role=Developer', headers=headers)
    undo_resp = json.loads(urllib.request.urlopen(req).read().decode())
    latest_undo = undo_resp[0]
    assert latest_undo['component_key'] == 'direct_edits'
    assert latest_undo['is_undoable'] is True
    print(f"[2.2] 24-Hour Undo Tracking Verified! History ID: {latest_undo['id']}")

    # 3. Test Image Upload
    boundary = uuid.uuid4().hex
    file_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4'
    part_head = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_logo.png"\r\nContent-Type: image/png\r\n\r\n'.encode()
    part_tail = f'\r\n--{boundary}--\r\n'.encode()
    body = part_head + file_bytes + part_tail

    req = urllib.request.Request(
        f'{API}/upload/image',
        data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    upload_resp = json.loads(urllib.request.urlopen(req).read().decode())
    uploaded_url = upload_resp['url']
    print(f"[3] Image Upload: SUCCESS -> {uploaded_url}")

    # Verify image served over HTTP
    img_check = urllib.request.urlopen(f'http://localhost:8000{uploaded_url}')
    assert img_check.status == 200
    print("[3.1] Image Static Serving: 200 OK!")

    # 4. Update Profile with new Avatar
    req = urllib.request.Request(
        f'{API}/auth/me',
        data=json.dumps({'avatar_url': uploaded_url, 'full_name': 'Alex Developer'}).encode(),
        headers=headers,
        method='PUT'
    )
    profile_resp = json.loads(urllib.request.urlopen(req).read().decode())
    assert profile_resp['avatar_url'] == uploaded_url
    print(f"[4] Profile Avatar Update: SUCCESS -> {profile_resp['avatar_url']}")

    # 5. Test Module Employee Inheritance
    req = urllib.request.Request(f'{API}/users', headers=headers)
    users = json.loads(urllib.request.urlopen(req).read().decode())
    emp_ids = [u['id'] for u in users if u['role_name'] == 'Employee']

    req = urllib.request.Request(f'{API}/companies', headers=headers)
    companies = json.loads(urllib.request.urlopen(req).read().decode())
    cid = companies[0]['id']

    # Create project with multiple employees
    proj_title = f"Inheritance Project {uuid.uuid4().hex[:6]}"
    target_emps = emp_ids[:2]
    proj_data = {
        'title': proj_title,
        'company_id': cid,
        'assigned_employee_ids': target_emps,
        'priority': 'Urgent'
    }
    req = urllib.request.Request(f'{API}/projects', data=json.dumps(proj_data).encode(), headers=headers, method='POST')
    proj = json.loads(urllib.request.urlopen(req).read().decode())
    pid = proj['id']
    print(f"[5.1] Project Created with Employees: {target_emps}")

    # Add module WITHOUT any employee IDs
    mod_data = {
        'project_id': pid,
        'name': 'Automatic Inheritance Engine',
        'description': 'Should automatically inherit all parent project employees'
    }
    req = urllib.request.Request(f'{API}/modules', data=json.dumps(mod_data).encode(), headers=headers, method='POST')
    mod = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"[5.2] Module Created! Inherited Employee IDs: {mod.get('assigned_employee_ids')}")
    assert set(target_emps).issubset(set(mod['assigned_employee_ids'])), f"Expected {target_emps} in {mod['assigned_employee_ids']}"
    print("[5.3] Multiple Employee Inheritance: FULLY VERIFIED!")

    # 6. Test Empty Project Module Rejection
    # Create project without employees (draft or empty)
    proj_empty_data = {
        'title': f"Empty Project {uuid.uuid4().hex[:6]}",
        'company_id': cid,
        'is_draft': True,
        'priority': 'Low'
    }
    req = urllib.request.Request(f'{API}/projects', data=json.dumps(proj_empty_data).encode(), headers=headers, method='POST')
    empty_p = json.loads(urllib.request.urlopen(req).read().decode())

    try:
        req = urllib.request.Request(
            f'{API}/modules',
            data=json.dumps({'project_id': empty_p['id'], 'name': 'Orphan Module'}).encode(),
            headers=headers,
            method='POST'
        )
        urllib.request.urlopen(req)
        print("ERROR: Should have rejected module creation on unassigned project")
        sys.exit(1)
    except urllib.error.HTTPError as err:
        assert err.code == 400
        err_body = json.loads(err.read().decode())
        print(f"[6] Validation of project without employees: CORRECTLY REJECTED ({err_body['detail']})")

    print("\n==========================================")
    print("ALL ENHANCEMENT VERIFICATION TESTS PASSED!")
    print("==========================================")

if __name__ == '__main__':
    run()

