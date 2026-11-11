# INTERACTIVE GANTT CHART USER & TECHNICAL GUIDE

## 1. Overview
The Gantt Timeline is designed to match the visual reference in `Projects - Gantt View.jpg` and `crm.docx`:
- Planex pastel badge styling
- Dynamic day/week/month headers
- Distinct today vertical indicator line
- Task progress fill bars
- Drag-and-drop rescheduling

## 2. Views & Controls
- **Time Views**:
  - `Daily`: High granularity (48px day width) for sprint execution.
  - `Weekly`: Balanced view (28px day width) for milestone planning.
  - `Monthly`: Macro quarter overview (16px day width).
- **Zoom Controls**: Zoom in and out buttons scale day column widths dynamically.
- **Today Marker**: Distinct blue line with "Today" pill rendered at current date coordinates.
- **Collapsible Hierarchy**: Projects can be expanded or collapsed to show or hide their associated modules.

## 3. Employee Filtering
The employee dropdown allows filtering the timeline:
- **All Employees**: Displays all company projects and work packages.
- **Individual Employee**: Filters the chart to only display modules assigned to that specific team member, hiding unrelated tasks.
- **Clear Filter (X)**: Restores the full view.

## 4. Drag-and-Drop Rescheduling
- Clicking and dragging any module bar shifts its start date and deadline horizontally across the timeline grid.
- Releasing the mouse commits the updated ISO date bounds via `PUT /api/gantt/modules/{id}/timeline`.
- Module progress rollup recalculates overall project progress automatically.

## 5. Sequential Dependencies
- Predecessor and successor relationships are tracked in `gantt_dependencies`.
- Supports finish-to-start constraints.

