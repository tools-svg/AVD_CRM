import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ZoomIn, 
  ZoomOut, 
  ChevronRight, 
  ChevronDown, 
  Filter, 
  X, 
  User as UserIcon,
  Clock,
  ArrowRight
} from 'lucide-react';
import { GanttData, GanttModule, GanttProject, User } from '../../types';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';

interface GanttProps {
  companyId?: number;
  projectId?: number;
}

type TimeView = 'Daily' | 'Weekly' | 'Monthly';

export const InteractiveGantt: React.FC<GanttProps> = ({ companyId, projectId }) => {
  const [data, setData] = useState<GanttData>({ projects: [], modules: [], dependencies: [] });
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('Weekly');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Dragging state
  const [draggingModuleId, setDraggingModuleId] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialDates, setInitialDates] = useState<{ start: Date; end: Date } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadGanttData = async () => {
    setLoading(true);
    try {
      const res = await api.getGanttData(companyId, projectId, selectedEmployeeId || undefined);
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

  const loadEmployees = async () => {
    try {
      const users = await api.getUsers(companyId);
      setEmployees(users);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadGanttData();
  }, [companyId, projectId, selectedEmployeeId]);

  useEffect(() => {
    loadEmployees();
  }, [companyId]);

  const toggleProjectExpand = (projId: number) => {
    setExpandedProjects(prev => ({ ...prev, [projId]: !prev[projId] }));
  };

  // Determine timeline date bounds
  const now = new Date();
  const baseStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalDays = timeView === 'Daily' ? 30 : timeView === 'Weekly' ? 60 : 120;
  const dayWidth = (timeView === 'Daily' ? 48 : timeView === 'Weekly' ? 28 : 16) * zoomLevel;

  const timelineDays: Date[] = [];
  for (let i = -7; i < totalDays; i++) {
    const d = new Date(baseStart);
    d.setDate(baseStart.getDate() + i);
    timelineDays.push(d);
  }

  const startDateMin = timelineDays[0];
  const endDateMax = timelineDays[timelineDays.length - 1];

  // Helper to compute pixel X offset for a given date
  const getXForDate = (date: Date): number => {
    const diffMs = date.getTime() - startDateMin.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, diffDays * dayWidth);
  };

  const todayX = getXForDate(now);

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

  const handleMouseMove = (e: React.MouseEvent) => {
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
    if (!draggingModuleId) return;
    const currentMod = data.modules.find(m => m.id === draggingModuleId);
    setDraggingModuleId(null);
    setInitialDates(null);

    if (currentMod) {
      try {
        await api.updateGanttTimeline(currentMod.id, {
          start_date: currentMod.start_date,
          deadline: currentMod.deadline,
        });
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

        {/* Employee Filtering Dropdown */}
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-[#888888]" />
          <div className="relative">
            <select
              value={selectedEmployeeId || ''}
              onChange={e => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
              className="bg-[#FFFFFF] border border-[#E1DCDC] rounded-lg text-xs py-1.5 pl-2.5 pr-7 text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium appearance-none cursor-pointer"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role_name})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#888888] absolute right-2 top-2.5 pointer-events-none" />
          </div>

          {selectedEmployeeId && (
            <button
              onClick={() => setSelectedEmployeeId(null)}
              className="p-1.5 rounded-lg bg-[#E8E4E4] text-[#666666] hover:bg-[#E1DCDC] text-xs flex items-center space-x-1"
              title="Clear Filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Gantt Split View: Left Task Table, Right Interactive Timeline (Section 7.2: High Text Readability & Row Height) */}
      <div className="flex overflow-hidden relative">
        {/* Left Column: Task & Module Hierarchy (380px width for readability) */}
        <div className="w-96 min-w-[360px] max-w-[400px] border-r border-[#E1DCDC] bg-[#FFFFFF] z-10 shadow-xs flex flex-col">
          {/* Table Header */}
          <div className="h-13 border-b border-[#E1DCDC] px-4 flex items-center justify-between text-xs font-bold text-[#111827] uppercase bg-[#E8E4E4]">
            <span>Work Item & Module</span>
            <span>Assignee / Progress</span>
          </div>

          {/* Table Rows */}
          <div className="overflow-y-auto divide-y divide-[#F0EEEE]">
            {data.projects.map(proj => {
              const isExpanded = !!expandedProjects[proj.id];
              const pModules = data.modules.filter(m => m.project_id === proj.id);

              return (
                <React.Fragment key={proj.id}>
                  {/* Project Row */}
                  <div 
                    onClick={() => toggleProjectExpand(proj.id)}
                    className="h-13 px-3 flex items-center justify-between bg-[#F5F3F4] hover:bg-[#EBE5E5] cursor-pointer transition-colors border-b border-[#E1DCDC]/50"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#333333] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#333333] flex-shrink-0" />
                      )}
                      <span className="font-bold text-xs sm:text-sm text-[#0A0A0A] truncate">
                        {proj.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-xs font-bold text-[#2F614E] bg-[#D9EEE5] px-2 py-0.5 rounded-full">
                        {proj.progress}%
                      </span>
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

            {data.projects.length === 0 && (
              <div className="p-8 text-center text-xs font-medium text-[#666666]">
                No projects or modules match current filter.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scrollable Timeline Canvas */}
        <div ref={containerRef} className="flex-1 overflow-x-auto relative select-none bg-[#FFFFFF]">
          <div style={{ width: timelineDays.length * dayWidth }} className="relative min-h-[300px]">
            {/* Timeline Days Header */}
            <div className="h-13 border-b border-[#E1DCDC] flex bg-[#E8E4E4] sticky top-0 z-10">
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
                    <span className="text-[10px] uppercase font-bold text-[#4B5563]">{d.toLocaleDateString([], { weekday: 'narrow' })}</span>
                    <span className="text-xs font-semibold">{d.getDate()}</span>
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
              {data.projects.map(proj => {
                const isExpanded = !!expandedProjects[proj.id];
                const pModules = data.modules.filter(m => m.project_id === proj.id);

                const projStartX = getXForDate(new Date(proj.start_date));
                const projEndX = getXForDate(new Date(proj.deadline));
                const projBarWidth = Math.max(dayWidth, projEndX - projStartX);

                return (
                  <React.Fragment key={proj.id}>
                    {/* Project Milestone Summary Bar */}
                    <div className="h-13 flex items-center relative border-b border-transparent">
                      <div
                        style={{ left: projStartX, width: projBarWidth }}
                        className="absolute h-8 rounded-[8px] bg-[#0A0A0A] text-white px-3 flex items-center justify-between text-xs font-bold shadow-xs overflow-hidden"
                      >
                        <span className="truncate mr-2">{proj.title}</span>
                        <span className="text-xs text-white/90 font-semibold">{proj.progress}%</span>
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

