import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ZoomIn, 
  ZoomOut, 
  ChevronRight, 
  ChevronDown
} from 'lucide-react';
import { GanttData, GanttModule, ProjectItem } from '../../types';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';

interface GanttProps {
  companyId?: number;
  projectId?: number;
  employeeId?: number;
  projects: ProjectItem[];
  busyProjectId: number | null;
  onUpdateProject: (project: ProjectItem, changes: Record<string, unknown>) => Promise<void> | void;
  onModuleUpdated: () => Promise<void> | void;
  onOpenProject: (projectId: number) => void;
}

type TimeView = 'Daily' | 'Weekly' | 'Monthly';

export const InteractiveGantt: React.FC<GanttProps> = ({
  companyId,
  projectId,
  employeeId,
  projects,
  busyProjectId,
  onUpdateProject,
  onModuleUpdated,
  onOpenProject,
}) => {
  const [data, setData] = useState<GanttData>({ projects: [], modules: [], dependencies: [] });
  const [timeView, setTimeView] = useState<TimeView>('Weekly');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dragging state
  const [draggingModuleId, setDraggingModuleId] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialDates, setInitialDates] = useState<{ start: Date; end: Date } | null>(null);
  const [projectDrag, setProjectDrag] = useState<{
    id: number;
    startX: number;
    start: Date;
    end: Date;
    mode: 'move' | 'resize-start' | 'resize-end';
  } | null>(null);
  const [projectDateDrafts, setProjectDateDrafts] = useState<Record<number, { start_date: string; deadline: string }>>({});
  const [projectProgressDrafts, setProjectProgressDrafts] = useState<Record<number, string>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  const loadGanttData = async () => {
    setLoading(true);
    try {
      const res = await api.getGanttData(companyId, projectId, employeeId);
      setData(res);
      // Auto-expand all projects initially
      const expandMap: Record<number, boolean> = {};
      res.projects.forEach(p => { expandMap[p.id] = true; });
      setExpandedProjects(expandMap);
    } catch (e) {
      console.error('Failed to load Gantt data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGanttData();
  }, [companyId, projectId, employeeId]);

  const toggleProjectExpand = (projId: number) => {
    setExpandedProjects(prev => ({ ...prev, [projId]: !prev[projId] }));
  };

  const now = new Date();
  const visibleProjects = projects.filter(project => {
    const start = project.start_date ? new Date(project.start_date) : now;
    const end = project.deadline ? new Date(project.deadline) : start;
    const afterStart = !dateFrom || end >= new Date(`${dateFrom}T00:00:00`);
    const beforeEnd = !dateTo || start <= new Date(`${dateTo}T23:59:59`);
    return afterStart && beforeEnd;
  });
  const visibleProjectIds = new Set(visibleProjects.map(project => project.id));
  const visibleModules = data.modules.filter(module => visibleProjectIds.has(module.project_id));

  // Keep the full set of projects in view while expanding the timeline around their dates.
  const projectDates = visibleProjects.flatMap(project => [
    project.start_date ? new Date(project.start_date) : now,
    project.deadline ? new Date(project.deadline) : now,
  ]).concat(visibleModules.flatMap(module => [
    new Date(module.start_date),
    new Date(module.deadline),
  ])).filter(date => !Number.isNaN(date.getTime()));
  const firstProjectDate = projectDates.length ? Math.min(...projectDates.map(date => date.getTime())) : now.getTime();
  const lastProjectDate = projectDates.length ? Math.max(...projectDates.map(date => date.getTime())) : now.getTime();
  const baseStart = new Date(Math.min(firstProjectDate, now.getTime()));
  baseStart.setDate(baseStart.getDate() - 7);
  baseStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(Math.max(lastProjectDate, now.getTime()));
  rangeEnd.setDate(rangeEnd.getDate() + 30);
  rangeEnd.setHours(0, 0, 0, 0);
  const totalDays = Math.max(60, Math.ceil((rangeEnd.getTime() - baseStart.getTime()) / 86400000));
  const dayWidth = (timeView === 'Daily' ? 48 : timeView === 'Weekly' ? 28 : 16) * zoomLevel;

  const timelineDays: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(baseStart);
    d.setDate(baseStart.getDate() + i);
    timelineDays.push(d);
  }

  const startDateMin = timelineDays[0];

  // Helper to compute pixel X offset for a given date
  const getXForDate = (date: Date): number => {
    const diffMs = date.getTime() - startDateMin.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, diffDays * dayWidth);
  };

  const todayX = getXForDate(now);

  const getProjectDates = (project: ProjectItem) => {
    const draft = projectDateDrafts[project.id];
    const start = draft?.start_date || project.start_date || now.toISOString();
    const end = draft?.deadline || project.deadline || start;
    return { start: new Date(start), end: new Date(end) };
  };
  const commitProjectProgress = (project: ProjectItem) => {
    const value = Number(projectProgressDrafts[project.id] ?? project.progress);
    setProjectProgressDrafts(previous => {
      const next = { ...previous };
      delete next[project.id];
      return next;
    });
    if (value !== project.progress) onUpdateProject(project, { progress: value });
  };
  const moduleRowCenters = new Map<number, number>();
  let rowsHeight = 0;
  visibleProjects.forEach(project => {
    rowsHeight += 52;
    if (expandedProjects[project.id]) {
      visibleModules.filter(module => module.project_id === project.id).forEach(module => {
        moduleRowCenters.set(module.id, rowsHeight + 24);
        rowsHeight += 48;
      });
    }
  });

  // Drag and drop handlers for module timeline
  const handleMouseDown = (e: React.MouseEvent, mod: GanttModule) => {
    e.stopPropagation();
    setDraggingModuleId(mod.id);
    setDragStartX(e.clientX);
    setInitialDates({
      start: new Date(mod.start_date),
      end: new Date(mod.deadline)
    });
  };

  const handleProjectMouseDown = (
    event: React.MouseEvent,
    project: ProjectItem,
    mode: 'move' | 'resize-start' | 'resize-end'
  ) => {
    if (busyProjectId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    const dates = getProjectDates(project);
    setProjectDrag({
      id: project.id,
      startX: event.clientX,
      start: dates.start,
      end: dates.end,
      mode,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (projectDrag) {
      const deltaDays = Math.round((e.clientX - projectDrag.startX) / dayWidth);
      if (deltaDays !== 0) {
        const start = new Date(projectDrag.start);
        const end = new Date(projectDrag.end);
        if (projectDrag.mode === 'move') {
          start.setDate(start.getDate() + deltaDays);
          end.setDate(end.getDate() + deltaDays);
        } else if (projectDrag.mode === 'resize-start') {
          start.setDate(start.getDate() + deltaDays);
          if (start >= end) start.setTime(end.getTime() - 86400000);
        } else {
          end.setDate(end.getDate() + deltaDays);
          if (end <= start) end.setTime(start.getTime() + 86400000);
        }
        setProjectDateDrafts(previous => ({
          ...previous,
          [projectDrag.id]: { start_date: start.toISOString(), deadline: end.toISOString() },
        }));
      }
      return;
    }

    if (!draggingModuleId || !initialDates) return;
    const deltaX = e.clientX - dragStartX;
    const deltaDays = Math.round(deltaX / dayWidth);

    if (deltaDays !== 0) {
      const newStart = new Date(initialDates.start.getTime() + deltaDays * 86400000);
      const newEnd = new Date(initialDates.end.getTime() + deltaDays * 86400000);

      setData(prev => ({
        ...prev,
        modules: prev.modules.map(m => 
          m.id === draggingModuleId 
            ? { ...m, start_date: newStart.toISOString(), deadline: newEnd.toISOString() }
            : m
        )
      }));
    }
  };

  const handleMouseUp = async () => {
    if (projectDrag) {
      const currentProject = projects.find(project => project.id === projectDrag.id);
      const dateDraft = projectDateDrafts[projectDrag.id];
      setProjectDrag(null);
      if (currentProject && dateDraft) {
        await onUpdateProject(currentProject, dateDraft);
        setProjectDateDrafts(previous => {
          const next = { ...previous };
          delete next[projectDrag.id];
          return next;
        });
      }
    }

    if (draggingModuleId) {
      const currentMod = data.modules.find(m => m.id === draggingModuleId);
      setDraggingModuleId(null);
      setInitialDates(null);
      if (!currentMod) return;
      try {
        await api.updateGanttTimeline(currentMod.id, {
          start_date: currentMod.start_date,
          deadline: currentMod.deadline,
        });
        await onModuleUpdated();
      } catch (e) {
        console.error('Failed to persist Gantt dates:', e);
        loadGanttData();
      }
    }
  };

  return (
    <div 
      className="bg-[#FFFFFF] rounded-2xl border border-[#E1DCDC] shadow-sm overflow-hidden flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Gantt Header & Controls */}
      <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-4 h-4 text-[#0A0A0A]" />
            <h3 className="text-sm font-bold text-[#333333]">Interactive Gantt Timeline</h3>
          </div>

          {/* Time View Selector */}
          <div className="bg-[#FFFFFF] rounded-lg p-0.5 border border-[#E1DCDC] flex items-center">
            {(['Daily', 'Weekly', 'Monthly'] as TimeView[]).map(v => (
              <button
                key={v}
                onClick={() => setTimeView(v)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  timeView === v ? 'bg-[#0A0A0A] text-white shadow-xs' : 'text-[#888888] hover:text-[#333333]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.15))}
              className="p-1 rounded-md bg-[#FFFFFF] border border-[#E1DCDC] text-[#333333] hover:bg-[#E8E4E4] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.15))}
              className="p-1 rounded-md bg-[#FFFFFF] border border-[#E1DCDC] text-[#333333] hover:bg-[#E8E4E4] transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#666666]">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
              className="rounded-lg border border-[#E1DCDC] bg-white px-2 py-1.5 text-xs text-[#333333]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#666666]">
            To
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={event => setDateTo(event.target.value)}
              className="rounded-lg border border-[#E1DCDC] bg-white px-2 py-1.5 text-xs text-[#333333]"
            />
          </label>
        </div>
      </div>

      {/* Gantt Split View: Left Task Table, Right Interactive Timeline (Section 7.2: High Text Readability & Row Height) */}
      <div className="flex max-h-[70vh] overflow-y-auto relative">
        {/* Left Column: Task & Module Hierarchy (380px width for readability) */}
        <div className="w-96 min-w-[360px] max-w-[400px] border-r border-[#E1DCDC] bg-[#FFFFFF] z-10 shadow-xs flex flex-col">
          {/* Table Header */}
          <div className="sticky top-0 z-20 h-[52px] border-b border-[#E1DCDC] px-4 flex items-center justify-between text-xs font-bold text-[#111827] uppercase bg-[#E8E4E4]">
            <span>Work Item & Module</span>
            <span>Assignee / Progress</span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-[#F0EEEE]">
            {visibleProjects.map(proj => {
              const isExpanded = !!expandedProjects[proj.id];
              const pModules = visibleModules.filter(m => m.project_id === proj.id);
              const statusColor = STATUS_CONFIG[proj.status] || STATUS_CONFIG['In Progress'];

              return (
                <React.Fragment key={proj.id}>
                  {/* Project Row */}
                  <div 
                    onClick={() => toggleProjectExpand(proj.id)}
                    className="h-[52px] px-3 flex items-center justify-between bg-[#F5F3F4] hover:bg-[#EBE5E5] cursor-pointer transition-colors border-b border-[#E1DCDC]/50"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#333333] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#333333] flex-shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          onOpenProject(proj.id);
                        }}
                        className="min-w-0 text-left font-bold text-xs sm:text-sm text-[#0A0A0A] hover:underline"
                        title={`Open ${proj.title}`}
                      >
                        <span className="block truncate">{proj.title}</span>
                        <span className="block truncate text-[10px] font-medium text-[#777777]">
                          {proj.lead_name || 'Unassigned'}
                        </span>
                      </button>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: statusColor.bg, color: statusColor.text }}>
                        {proj.status}
                      </span>
                      <label className="flex items-center gap-1" onClick={event => event.stopPropagation()}>
                        <input
                          aria-label={`Progress for ${proj.title}`}
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={projectProgressDrafts[proj.id] ?? String(Math.round(proj.progress || 0))}
                          disabled={busyProjectId !== null}
                          onChange={event => setProjectProgressDrafts(previous => ({ ...previous, [proj.id]: event.target.value }))}
                          onPointerUp={() => commitProjectProgress(proj)}
                          onKeyUp={() => commitProjectProgress(proj)}
                          className="w-16 accent-[#2F614E]"
                        />
                        <span className="w-7 text-right text-[10px] font-bold text-[#2F614E]">
                          {projectProgressDrafts[proj.id] ?? Math.round(proj.progress)}%
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Modules Rows */}
                  {isExpanded && pModules.map(mod => (
                    <div key={mod.id} className="h-12 pl-7 pr-3 flex items-center justify-between hover:bg-[#F9F9F9] transition-colors border-b border-[#F0EEEE]">
                      <div className="flex items-center space-x-2.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-[#5269A8] flex-shrink-0" />
                        <span className="text-xs text-[#1F2937] font-semibold truncate" title={mod.name}>
                          {mod.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {mod.assigned_to_avatar ? (
                          <img src={mod.assigned_to_avatar} alt={mod.assigned_to_name} className="w-5 h-5 rounded-full object-cover border border-[#E1DCDC]" />
                        ) : (
                          <span className="text-xs font-medium text-[#4B5563] truncate max-w-[90px]">
                            {mod.assigned_to_name?.split(' ')[0] || 'Team'}
                          </span>
                        )}
                        <span className="text-xs text-[#111827] font-bold w-10 text-right">
                          {mod.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}

            {visibleProjects.length === 0 && (
              <div className="p-8 text-center text-xs font-medium text-[#666666]">
                {loading ? 'Loading project timelines…' : 'No project timelines match the current filters.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scrollable Timeline Canvas */}
        <div ref={containerRef} className="flex-1 overflow-x-auto relative select-none bg-[#FFFFFF]">
          <div style={{ width: timelineDays.length * dayWidth }} className="relative min-h-[300px]">
            {/* Timeline Days Header */}
            <div className="h-[52px] border-b border-[#E1DCDC] flex bg-[#E8E4E4] sticky top-0 z-10">
              {timelineDays.map((d, idx) => {
                const isToday = d.toDateString() === now.toDateString();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: dayWidth }}
                    className={`border-r border-[#D1D5DB] text-center flex flex-col justify-center text-xs ${
                      isToday 
                        ? 'bg-[#DBEAFE] font-bold text-[#1D4ED8]' 
                        : isWeekend 
                          ? 'bg-[#E5E1E1] text-[#6B7280]' 
                          : 'text-[#1F2937] font-medium'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-[#4B5563]">
                      {timeView === 'Daily' || d.getDay() === 1 ? d.toLocaleDateString([], { weekday: 'narrow' }) : ''}
                    </span>
                    <span className="text-xs font-semibold">
                      {timeView === 'Monthly' ? (d.getDate() === 1 ? d.toLocaleDateString([], { month: 'short' }) : '') : timeView === 'Weekly' ? (d.getDay() === 1 ? d.getDate() : '') : d.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Vertical Grid Lines & Today Marker */}
            <div className="absolute inset-0 top-13 pointer-events-none flex">
              {timelineDays.map((d, idx) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={idx}
                    style={{ width: dayWidth }}
                    className={`border-r border-[#E1DCDC]/40 h-full ${isWeekend ? 'bg-[#F0EEEE]/25' : ''}`}
                  />
                );
              })}
            </div>

            {/* Blue Today Marker Line */}
            {todayX >= 0 && todayX <= timelineDays.length * dayWidth && (
              <div 
                style={{ left: todayX }} 
                className="absolute top-0 bottom-0 w-0.5 bg-[#2563EB] z-20 pointer-events-none flex flex-col items-center"
              >
                <div className="bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm -mt-2">
                  Today
                </div>
              </div>
            )}

            {/* Timeline Task Bars */}
            <div className="py-0 relative z-10">
              {data.dependencies.length > 0 && (
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
                  width={timelineDays.length * dayWidth}
                  height={rowsHeight}
                  aria-hidden="true"
                >
                  <defs>
                    <marker id="gantt-dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#777777" />
                    </marker>
                  </defs>
                  {data.dependencies.map(dependency => {
                    const fromY = moduleRowCenters.get(dependency.predecessor_id);
                    const toY = moduleRowCenters.get(dependency.successor_id);
                    const predecessor = visibleModules.find(module => module.id === dependency.predecessor_id);
                    const successor = visibleModules.find(module => module.id === dependency.successor_id);
                    if (fromY === undefined || toY === undefined || !predecessor || !successor) return null;
                    const fromX = getXForDate(new Date(predecessor.deadline));
                    const toX = getXForDate(new Date(successor.start_date));
                    const bendX = Math.max(fromX + 12, (fromX + toX) / 2);
                    return (
                      <path
                        key={dependency.id}
                        d={`M ${fromX} ${fromY} H ${bendX} V ${toY} H ${toX}`}
                        fill="none"
                        stroke="#777777"
                        strokeWidth="1.5"
                        markerEnd="url(#gantt-dependency-arrow)"
                      />
                    );
                  })}
                </svg>
              )}
              {visibleProjects.map(proj => {
                const isExpanded = !!expandedProjects[proj.id];
                const pModules = visibleModules.filter(m => m.project_id === proj.id);
                const dates = getProjectDates(proj);
                const projStartX = getXForDate(dates.start);
                const projEndX = getXForDate(dates.end);
                const projBarWidth = Math.max(dayWidth, projEndX - projStartX);

                return (
                  <React.Fragment key={proj.id}>
                    {/* Project Milestone Summary Bar */}
                    <div className="h-[52px] flex items-center relative border-b border-transparent">
                      <div
                        onMouseDown={event => handleProjectMouseDown(event, proj, 'move')}
                        className={`group absolute flex h-8 cursor-move items-center justify-between overflow-hidden rounded-[8px] border px-3 text-xs font-bold shadow-xs select-none ${
                          projectDrag?.id === proj.id ? 'z-30 ring-2 ring-[#0A0A0A] shadow-md' : 'hover:shadow-sm'
                        }`}
                        style={{
                          left: projStartX,
                          width: projBarWidth,
                          backgroundColor: STATUS_CONFIG[proj.status]?.bg || '#E8E4E4',
                          borderColor: STATUS_CONFIG[proj.status]?.text || '#333333',
                          color: STATUS_CONFIG[proj.status]?.text || '#333333',
                        }}
                        title={`${proj.title}: drag to move; drag either edge to resize`}
                      >
                        <div
                          style={{ width: `${Math.min(100, Math.max(0, proj.progress))}%` }}
                          className="absolute inset-y-0 left-0 bg-black/10 pointer-events-none"
                        />
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onOpenProject(proj.id);
                          }}
                          onMouseDown={event => event.stopPropagation()}
                          className="relative z-10 truncate text-left hover:underline"
                        >
                          {proj.title}
                        </button>
                        <span
                          className="relative z-10 ml-2 flex-shrink-0 rounded bg-white/70 px-1 text-[9px] font-bold"
                          style={{
                            backgroundColor: PRIORITY_CONFIG[proj.priority]?.bg,
                            color: PRIORITY_CONFIG[proj.priority]?.text,
                          }}
                        >
                          {proj.priority} · {proj.progress}%
                        </span>
                        <button
                          type="button"
                          aria-label={`Resize start date for ${proj.title}`}
                          onMouseDown={event => handleProjectMouseDown(event, proj, 'resize-start')}
                          className="absolute inset-y-0 left-0 z-20 w-2 cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100"
                        />
                        <button
                          type="button"
                          aria-label={`Resize due date for ${proj.title}`}
                          onMouseDown={event => handleProjectMouseDown(event, proj, 'resize-end')}
                          className="absolute inset-y-0 right-0 z-20 w-2 cursor-ew-resize bg-black/10 opacity-0 group-hover:opacity-100"
                        />
                      </div>
                    </div>

                    {/* Module Bars with Drag Support */}
                    {isExpanded && pModules.map(mod => {
                      const modStartX = getXForDate(new Date(mod.start_date));
                      const modEndX = getXForDate(new Date(mod.deadline));
                      const barWidth = Math.max(dayWidth * 0.8, modEndX - modStartX);
                      const statusColor = STATUS_CONFIG[mod.status] || STATUS_CONFIG['In Progress'];
                      const isDragging = draggingModuleId === mod.id;

                      return (
                        <div key={mod.id} className="h-12 flex items-center relative border-b border-transparent">
                          <div
                            onMouseDown={e => handleMouseDown(e, mod)}
                            style={{ 
                              left: modStartX, 
                              width: barWidth,
                              backgroundColor: statusColor.bg,
                              borderColor: statusColor.text,
                            }}
                            className={`absolute h-8 rounded-[8px] border-2 px-2.5 flex items-center justify-between text-xs cursor-move shadow-xs transition-shadow select-none group ${
                              isDragging ? 'ring-2 ring-[#0A0A0A] shadow-md z-30' : 'hover:shadow-sm'
                            }`}
                            title={`Drag to reschedule: ${mod.name} (${new Date(mod.start_date).toLocaleDateString()} - ${new Date(mod.deadline).toLocaleDateString()})`}
                          >
                            {/* Inner progress fill bar */}
                            <div 
                              style={{ width: `${mod.progress}%` }} 
                              className="absolute left-0 top-0 bottom-0 bg-black/10 rounded-l-[6px] pointer-events-none" 
                            />

                            <span 
                              style={{ color: statusColor.text }} 
                              className="truncate font-bold text-xs relative z-10"
                            >
                              {mod.name}
                            </span>

                            <div className="flex items-center space-x-1 relative z-10 ml-2">
                              <span 
                                style={{ color: statusColor.text }} 
                                className="text-xs font-bold"
                              >
                                {mod.progress}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

