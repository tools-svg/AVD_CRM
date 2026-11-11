# DEVELOPMENT ARCHITECTURE & SYSTEM OVERVIEW

## 1. Architectural Philosophy
The AVD Group Multi-Company Platform is designed with strict separation of concerns across presentation, domain workflows, and database persistence.
- **Frontend**: Single Page Application built with React 18, TypeScript, Tailwind CSS, Lucide icons, and React Router v6.
- **Backend**: High-throughput asynchronous REST services powered by Python FastAPI, Pydantic v2 schemas, and SQLAlchemy 2.0 ORM.
- **Database**: PostgreSQL / SQLite relational architecture with strict foreign key integrity, indexation, and audit trails.
- **Project-Only Architecture**: Tactical tickets have been completely removed from the entire architecture; the workflow is 100% project-driven.

## 2. Directory Layout
```text
├── frontend/
│   ├── src/
│   │   ├── app/           # Router, route guards, App entry
│   │   ├── components/    # Navigation, sticky-notes, gantt, preview, modals
│   │   │   ├── modals/    # ProjectDeleteModal, ModuleUpdateModal, DeveloperUIEditorModal
│   │   │   ├── navigation/# GlobalNavbar with debounced global search & notification center
│   │   │   └── sticky-notes/# StickyNotesPanel with @Entire Team mention support
│   │   ├── config/        # Planex design palette, Apple-style RADIUS_TOKENS, status/priority mapping
│   │   ├── context/       # AuthContext, UIConfigContext, NotificationContext
│   │   ├── pages/         # Login, Home, ProjectDetails, ProjectCreate, ProjectUpdate, Public
│   │   ├── services/      # REST client API integration
│   │   └── types/         # Strongly-typed TypeScript interfaces
│   └── public/logos/      # 4 AVD logo variations for slideshow (2% border radius)
├── backend/
│   ├── app/
│   │   ├── api/           # API routers (auth, projects, modules, gantt, users, companies, search, etc.)
│   │   ├── core/          # Settings, security, JWT token handling
│   │   ├── database/      # SQLAlchemy session, engine, automated seed, migration scripts
│   │   ├── models/        # Relational models (Project-only domain)
│   │   ├── permissions/   # Role-based access control and company scoping
│   │   └── schemas/       # Pydantic validation schemas
│   ├── uploads/           # Persisted file and image attachments
│   ├── test_all_features.py # Comprehensive test suite for all platform features
│   └── server.py          # Uvicorn entry point
└── docs/                  # In-depth technical documentation
```

## 3. UI Design System & Tokens
- **Logo Container**: Main company logo container features a **2% border radius**, maintaining clean proportions without image distortion.
- **Apple-Style Rounded Corner System (`RADIUS_TOKENS`)**:
  - Cards: `14px` (`rounded-card`)
  - Modals: `18px` (`rounded-modal`)
  - Buttons: `10px` (`rounded-btn`)
  - Input Fields: `10px` (`rounded-input`)
  - Popovers / Dropdowns: `12px` (`rounded-popover`)
  - Previews: `14px` (`rounded-preview`)
  - Badges: `9999px` (`rounded-full`)
- **Spacing Optimization**: Container width capped cleanly at `max-w-[1600px]`, reducing redundant left/right margins and keeping alignment tight between header, stats, and company rows.
- **Statistics Cards**: Main statistics cards feature a square-style design with balanced dimensions, large numeric typography, and Planex color differentiation:
  - Total Projects: Dark Neutral (`#111827`)
  - Completed Projects: Emerald Green (`#059669`)
  - Ongoing Projects: Royal Blue (`#2563EB`)

## 4. Key Workflows
1. **Authentication & Scoping**:
   - User authenticates via `/api/auth/login`. JWT contains `sub` (user ID) and role.
   - Manager role is locked to assigned company. Employee role sees assigned projects and modules. Director, Project Manager, and Developer have multi-company oversight.
2. **Director Dashboard**:
   - Displays all companies and projects directly in accessible lists.
   - Eliminates 3-row cutoffs and dropdown hiding.
   - Displays company-specific statistics (`Total: X | Completed: Y | Ongoing: Z`) in the *same horizontal row* alongside company name and logo.
   - Active projects are sorted by priority (`Urgent` -> `High` -> `Medium` -> `Low`), with earliest deadline first; `Closed` and `Cancelled` projects are automatically pushed to the bottom.
3. **Project Creation & Module Inheritance**:
   - Two-column responsive layout: Project Info & Mandatory Employee Assignment on Left; Company, Horizontal Dates, and 4-Point Priority Line Selector on Right.
   - At least one employee assignment is mandatory; projects cannot be created without an assigned employee.
   - Modules added during or after project creation inherit project employee assignments by default.
4. **Draft Project Lifecycle**:
   - "Save as Draft" allows incomplete projects to be stored without validation blocks.
   - Draft projects (`is_draft=True`) are strictly excluded from dashboard lists, statistics cards, and Gantt charts.
   - Reopening a draft populates the form and updates the draft in-place without generating duplicates.
5. **Project Deletion Security**:
   - Strictly restricted to **Developer** and **Director** roles. Project Managers, Managers, and Employees are forbidden (HTTP 403).
   - Deletion requires typing the exact project title in a GitHub-style confirmation modal (`ProjectDeleteModal`).
6. **Module Update Modal**:
   - Streamlined into a compact two-row layout:
     - Row 1: Description text input + Choose File attachment button.
     - Row 2: Status dropdown + Progress slider/input + Submit Update button.
7. **Progress Calculation Formula**:
   - Unified standard: `(Closed modules / Total modules) * 100`.
   - Projects with 0 modules report 0% progress. Cancelled and In Progress modules do not count toward completed percentage.
8. **Global Search Engine**:
   - Real backend search (`GET /api/search?q=...`) across projects, modules, and employees.
   - Debounced frontend input with loading spinner, query text highlighting, keyboard navigation, and empty-state handling.
   - Results are strictly filtered by user permissions.
9. **In-App Notification Center**:
   - Header bell dropdown shows live unread count badge.
   - Each notification item displays sender avatar, full name, timestamp, message preview, and navigation link.
   - Single-click "Mark all read" and individual click-to-dismiss capabilities.
10. **Sticky Notes & @Entire Team Mentions**:
    - Sticky notes support individual `@employee` mentions as well as the special `@Entire Team` option.
    - Mentions notify all eligible employees in the same company without sending duplicate notifications.
