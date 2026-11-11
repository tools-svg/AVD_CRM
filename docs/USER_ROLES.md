# SIX USER ROLES & PERMISSION MATRIX

## 1. Developer
- **Scope**: Entire platform.
- **Capabilities**:
  - Full CRUD on user accounts across all 6 roles (create users with temporary passwords, edit full names/emails, reset passwords, activate/deactivate, hard delete with project dependency checks).
  - Full CRUD on sub-companies (create company, edit metadata, upload/change logo, deactivate with active project checks).
  - Interface customization visual editor across all 6 roles.
  - 24-hour rollback engine and version snapshot manager.
  - Complete project and audit ledger access.
  - Full deletion privileges on projects with GitHub-style typed title confirmation.

## 2. Director
- **Scope**: Cross-company executive governance across all sub-companies.
- **Capabilities**:
  - View all companies and their projects directly in accessible dashboard lists without dropdown concealing or 3-row limits.
  - View organization-wide statistics and company-specific statistics in the same horizontal row alongside company names and logos.
  - View, create, and edit projects across all companies.
  - Full project deletion privileges using the GitHub-style typed title confirmation modal.
  - Assign managers and employees to projects.
  - Add and manage work modules.
  - Access organization-wide Gantt charts and employee filters.
  - Generate and revoke public project share links.
  - Maintain personal sticky notes with `@Entire Team` mentions and receive notifications.

## 3. Project Manager
- **Scope**: Cross-company oversight across all sub-companies.
- **Capabilities**:
  - Can create and edit projects, manage modules, schedules, Gantt chart, and updates across all companies.
  - View organization-wide statistics and company-specific statistics.
  - **PROJECT DELETION IS STRICTLY PROHIBITED**: At both the API (`DELETE /api/projects/{id}` returns HTTP 403 Forbidden) and UI levels (Delete buttons and controls are hidden from PM).
  - Maintain personal sticky notes and receive notifications.

## 4. Manager
- **Scope**: Restricted strictly to the assigned sub-company.
- **Capabilities**:
  - Cannot access or switch to other sub-companies.
  - View, create, and edit projects within the assigned company only.
  - View statistics solely for their assigned company.
  - Search results are scoped strictly to the assigned company.
  - Assign employees affiliated with that company.
  - Manage company-specific Gantt chart schedules.
  - Post module updates and complete projects.
  - Cannot delete projects.

## 5. Employee
- **Scope**: Assigned work only.
- **Capabilities**:
  - View assigned projects and modules.
  - Project statistics reflect the employee's assigned work without exposing other employees' private records.
  - Global search returns only assigned and permitted records.
  - Cannot create or delete projects.
  - Add modules to assigned projects where permitted.
  - Post text updates and file attachments to assigned modules via the compact two-row update modal.
  - Maintain personal sticky notes with individual `@employee` and `@Entire Team` mentions.
  - View assigned Gantt schedules.

## 6. End User
- **Scope**: External stakeholder without a login account.
- **Capabilities**:
  - Access specific authorized project via Director-generated secure cryptographic link.
  - View company branding, project title, description, progress, and sanitized milestone status.
  - **Prohibited from**: editing, commenting, viewing Gantt charts, viewing internal sticky notes, and accessing private team information.
