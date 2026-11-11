# DEVELOPER UI CUSTOMIZATION & 24-HOUR UNDO SYSTEM

## 1. Visual Customizer Architecture
The Developer UI Customization engine enables immediate visual styling, member management, company management, and layout adjustments without modifying codebase files.

### Tabs in the Developer Modal:
1. **User Management**:
   - Live list of users across all 6 roles.
   - Filter by role and search by name/email.
   - User creation modal with temporary password generation, company assignment, and role selection.
   - User editing: update full name, role, email, and direct password reset.
   - Account status toggle: activate / deactivate.
   - Hard deletion with safety verification checking whether the user is assigned to active projects.
2. **Company Management**:
   - View all registered sub-companies, codes, and logos.
   - Add new sub-company with name, company code, logo URL, and description.
   - Edit existing company details.
   - Deactivate company with active project guard (checks if active projects remain before deactivation).
3. **UI Customizer**:
   - Role Selector Dropdown (Developer, Director, Project Manager, Manager, Employee, End User).
   - Global Theme adjustments (background color, card background, primary button color, border radius).
   - Header title & slideshow speed controls.
   - Section visibility toggles and custom stat card labels.
4. **24-Hour Undo Audit**:
   - Full audit trail of UI modifications.
   - Rolling 24-hour rollback window allows reverting any individual configuration change.
   - After 24 hours, change becomes locked and permanent.
5. **Version Snapshots**:
   - Save and restore named design snapshots (e.g., "Apple Clean v2").

## 2. Apple-Style Design System (`RADIUS_TOKENS`)
The application uses unified Apple-style design tokens to ensure consistent, balanced curves across all surfaces:
- **Card**: `14px` (`rounded-card`)
- **Modal**: `18px` (`rounded-modal`)
- **Button**: `10px` (`rounded-btn`)
- **Input Field**: `10px` (`rounded-input`)
- **Popover / Dropdown**: `12px` (`rounded-popover`)
- **Preview Panel**: `14px` (`rounded-preview`)
- **Main Company Logo**: `2%` border radius (`rounded-[2%]`)

## 3. Spacing System
- Reduced outer padding and horizontal whitespace.
- Container width pinned to `max-w-[1600px]`.
- Statistics, company headers, and project rows share strict vertical alignments.
- 75% / 25% responsive layout preserved for desktop viewing.
