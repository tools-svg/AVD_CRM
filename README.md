# AVD Group – Multi-Company Project, Ticket & Workforce Management Platform

A production-ready, full-stack multi-company project governance application engineered to the **Planex Reference Design System** with comprehensive support for six user roles, dynamic sub-companies, interactive Gantt charts, dual module preview system, personal sticky notes with mentions, in-app notifications, public end-user project sharing, and a Developer UI customization engine with a 24-hour undo rollback system.

---

## 🚀 Key Feature Highlights

1. **Planex Reference Theme**:
   - Exact aesthetic palette: `#EBE5E5` background, `#E8E4E4` cards, `#F5F3F4` surfaces, `#0A0A0A` primary buttons, `#E1DCDC` borders.
   - Soft pastel status badges (`Not Started`, `In Progress`, `Review`, `On Hold`, `Closed`, `Cancelled`).
   - Priority badges (`Low`, `Medium`, `High`, `Urgent`).
   - Inter typography, 12-16px rounded cards, 8-10px rounded buttons.

2. **Six Distinct User Roles**:
   - **Developer**: Full administrative access, account CRUD, sub-company CRUD, visual UI editor, 24-hour rollback engine.
   - **Director**: Cross-company oversight, full project/ticket CRUD, Gantt filters, public token generation & revocation.
   - **Project Manager**: Same as Director, **except project/ticket deletion is prohibited**.
   - **Manager**: Restricted strictly to their assigned sub-company.
   - **Employee**: Assigned projects, modules, personal sticky notes with `@mentions`, and updates.
   - **End User**: External stakeholder accessing permitted milestones via cryptographically signed share link (no login, no Gantt, no private notes).

3. **Global Navigation & Brand Slideshow**:
   - Compact 4-logo crossfade slideshow with smooth transitions (`/logos/1.png` through `/logos/4.png`).
   - Back navigation with Home fallback.
   - Notifications bell with live unread counter.
   - Developer-only role selector dropdown for UI customization.
   - Floating Back-to-Top button.

4. **Project Statistics Section**:
   - Dynamic cards: **Total Projects**, **Completed** (Closed), and **Ongoing** (In Progress, Review, On Hold; Not Started and Cancelled excluded).
   - Role-scoped calculations (Director/PM/Dev = org-wide; Manager = company; Employee = assigned).
   - Tickets tracked separately.

5. **Project & Ticket List**:
   - Columns: Name, Status, Priority, Progress %, Deadline, Last Updated, View.
   - Initially shows 3 rows with smooth Expand / Collapse toggle.
   - Quick switch between Strategic Projects and Tactical Tickets.

6. **Interactive Gantt Timeline**:
   - Daily, Weekly, and Monthly zoom controls.
   - Distinct Today marker line.
   - Drag-and-drop task rescheduling persisted to database.
   - Sequential dependencies with finish-to-start constraints.
   - Employee dropdown filtering with one-click clear.

7. **Dual Preview System**:
   - 💬 **Comment Icon**: Loads historical descriptions and updates in chronological order.
   - 📌 **Pin Icon**: Loads image attachments and diagrams.
   - **"Open" Button**: Expands preview to large modal:
     - Description viewer: WhatsApp-style bubble chat stream.
     - Image viewer: Carousel with Left/Right arrow controls, "X of Y" count, keyboard navigation.

8. **Module Update Popup**:
   - Text report area + multiple file upload.
   - Filename pills with deletion prior to submission.
   - Updates feed directly into the module description history and pin previews.
   - **Complete Project** workflow validating outstanding modules before closing.

9. **Personal Sticky Notes & Mentions**:
   - Browser-style tabs with `+` new note.
   - Color picker with pastel sticky colors.
   - `@mention` team members with real-time in-app notification triggers.
   - Private to creator and mentioned users.

10. **Developer UI Customizer & 24-Hour Undo**:
    - Live visual editor for colors, border radius, navbar slideshow, statistics, and table rows across any role.
    - Changes apply immediately live.
    - 24-hour rollback window: every change can be individually reverted within 24 hours.
    - Named version snapshots.

---

## 🛠 Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, React Router v6, Lucide React icons, date-fns.
- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2, Passlib/Bcrypt, Python-Jose (JWT), aiofiles.
- **Database**: PostgreSQL / SQLite (configured via `DATABASE_URL`).
- **DevOps**: Docker, Docker Compose, Nginx.

---

## 🏃 Quick Start Guide

### Option 1: Docker Compose (Instant Deployment)
```bash
docker-compose up --build -d
```
- App UI: `http://localhost:5173`
- API Docs: `http://localhost:8000/api/docs`

### Option 2: Local Execution

#### 1. Start the Backend:
```bash
cd backend
python run.py       # Seeds initial roles, sub-companies, test users & sample data
python server.py    # Runs FastAPI server on http://127.0.0.1:8000
```

#### 2. Start the Frontend:
```bash
cd frontend
npm install
npm run dev         # Launches Vite on http://localhost:5173
```

---

## 🔑 Pre-Seeded Test Credentials

| Role | Username | Notes |
|---|---|---|---|
| **Developer** | `developer`| Full admin, UI editor, 24h undo |
| **Director** | `director`| Cross-company oversight, public sharing |
| **Project Manager**| `pm`| Oversight, **deletion prohibited** |
| **Manager** | `manager`| Assigned to *AVD Tech Systems* only |
| **Employee** | `employee`| Assigned work, notes, updates |

---

## 📚 Complete Documentation Suite
- [Architecture & Overview](docs/DEVELOPMENT.md)
- [Database Schema & Models](docs/DATABASE.md)
- [Six User Roles Matrix](docs/USER_ROLES.md)
- [UI Customizer & 24h Undo](docs/UI_CUSTOMIZATION.md)
- [Interactive Gantt Guide](docs/GANTT_GUIDE.md)
- [Dual Preview System](docs/PREVIEW_SYSTEM.md)
- [Production Deployment](docs/DEPLOYMENT.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

