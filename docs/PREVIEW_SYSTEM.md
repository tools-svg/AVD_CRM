# PREVIEW SYSTEM & MODAL VIEWERS SPECIFICATION

## 1. Dual Preview Architecture
The right 25% preview panel on Project Details and Project Update pages dynamically toggles between two specialized views:

### 💬 Comment Icon – Description History Preview
- **Purpose**: NOT a comment submission button.
- **Action**: Fetches historical descriptions, revisions, and engineering update logs for that module from `updates` table.
- **Display**: Chronological list of updates with author name, avatar, and timestamp.
- **Large Viewer Modal**: Clicking **Open** at the top of the preview panel displays the history in a WhatsApp-style chat layout:
  - Individual message bubbles.
  - Visual separation between historical entries.
  - Latest update badge.
  - Neutral Planex palette (#FFFFFF, #F5F3F4, #E1DCDC) rather than third-party branding.
  - Read-only review.

### 📌 Pin Icon – Image Preview
- **Purpose**: NOT for task pinning or reassignment.
- **Action**: Fetches image attachments and diagrams uploaded for that module from `attachments` table.
- **Display**: Grid thumbnail gallery in the preview panel.
- **Large Viewer Modal**: Clicking **Open** opens the full image viewer:
  - Large viewing area with high-resolution image rendering.
  - Left and right arrow navigation controls (hidden/disabled if single image).
  - Position counter indicator: e.g. "2 of 5".
  - Keyboard arrow key navigation (Left/Right/Escape).
  - Download link for source files.

## 2. Interaction Integrity Rules
- Clicking a comment icon never triggers an image viewer.
- Clicking a pin icon never triggers a description viewer.
- The active module selection drives both preview panel and modal contents.
- Opening and closing modals preserves page state and scroll positions.

