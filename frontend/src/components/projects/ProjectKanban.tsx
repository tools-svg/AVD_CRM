import React from 'react';
import { CalendarDays, Building2, UserRound } from 'lucide-react';
import { ProjectItem, WorkPriority, WorkStatus } from '../../types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../config/theme';

const STATUSES: WorkStatus[] = [
  'Not Started',
  'In Progress',
  'Review',
  'On Hold',
  'Closed',
  'Cancelled',
];

const PRIORITIES: WorkPriority[] = ['Urgent', 'High', 'Medium', 'Low'];

interface ProjectKanbanProps {
  projects: ProjectItem[];
  busyProjectId: number | null;
  onUpdateProject: (project: ProjectItem, changes: Record<string, unknown>) => void;
  onOpenProject: (projectId: number) => void;
}

const toDateInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export const ProjectKanban: React.FC<ProjectKanbanProps> = ({
  projects,
  busyProjectId,
  onUpdateProject,
  onOpenProject,
}) => {
  const [draggedProjectId, setDraggedProjectId] = React.useState<number | null>(null);
  const [progressDrafts, setProgressDrafts] = React.useState<Record<number, string>>({});
  const commitProgress = (project: ProjectItem) => {
    const value = Number(progressDrafts[project.id] ?? project.progress);
    setProgressDrafts(previous => {
      const next = { ...previous };
      delete next[project.id];
      return next;
    });
    if (value !== project.progress) onUpdateProject(project, { progress: value });
  };

  return (
    <div className="space-y-2 overflow-x-auto pb-2">
      {projects.length === 0 && (
        <p className="rounded-[10px] border border-dashed border-[#D5CECE] bg-white p-4 text-center text-xs text-[#777777]">
          No projects match the current search and filters.
        </p>
      )}
      <div className="grid min-w-[1080px] grid-cols-6 gap-3">
        {STATUSES.map(status => {
          const statusConfig = STATUS_CONFIG[status];
          const statusProjects = projects.filter(project => project.status === status);

          return (
            <section
              key={status}
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                if (busyProjectId !== null) return;
                const id = draggedProjectId || Number(event.dataTransfer.getData('text/project-id'));
                const project = projects.find(item => item.id === id);
                setDraggedProjectId(null);
                if (project && project.status !== status) onUpdateProject(project, { status });
              }}
              className="min-h-64 rounded-[12px] border border-[#E1DCDC] bg-[#F5F3F4]/70"
            >
              <header className="sticky top-0 flex items-center justify-between rounded-t-[12px] border-b border-[#E1DCDC] bg-[#F5F3F4] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: statusConfig.text }} />
                  <h3 className="truncate text-xs font-bold text-[#333333]">{status}</h3>
                </div>
                <span className="rounded-full border border-[#E1DCDC] bg-white px-2 py-0.5 text-[10px] font-bold text-[#666666]">
                  {statusProjects.length}
                </span>
              </header>

              <div className="space-y-2 p-2">
                {statusProjects.map(project => {
                  const priorityConfig = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.Medium;
                  const assignees = project.assigned_employees || [];
                  const selectedAssignee = project.lead_id || assignees[0]?.id || '';
                  const busy = busyProjectId === project.id;
                  const saving = busyProjectId !== null;
                  const progressValue = progressDrafts[project.id] ?? String(Math.round(project.progress || 0));

                  return (
                    <article
                      key={project.id}
                      draggable={!saving}
                      onDragStart={event => {
                        setDraggedProjectId(project.id);
                        event.dataTransfer.setData('text/project-id', String(project.id));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedProjectId(null)}
                      onClick={() => onOpenProject(project.id)}
                      className={`cursor-pointer rounded-[10px] border border-[#E1DCDC] bg-white p-3 shadow-2xs transition-shadow hover:shadow-sm ${
                        draggedProjectId === project.id ? 'opacity-50' : ''
                      }`}
                      aria-label={`Open ${project.title}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 flex-1 text-xs font-bold leading-5 text-[#0A0A0A]">{project.title}</h4>
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: priorityConfig.bg, color: priorityConfig.text }}
                        >
                          {project.priority}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 truncate text-[10px] text-[#777777]">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{project.company_name || 'Company'}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="min-w-0" onClick={event => event.stopPropagation()}>
                          <span className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase text-[#888888]">
                            <UserRound className="h-3 w-3" /> Assignee
                          </span>
                          <select
                            aria-label={`Assignee for ${project.title}`}
                            value={selectedAssignee}
                            disabled={saving || assignees.length === 0}
                            onChange={event => onUpdateProject(project, { lead_id: event.target.value ? Number(event.target.value) : null })}
                            className="w-full rounded-md border border-[#E1DCDC] bg-white px-1.5 py-1 text-[10px] text-[#333333] disabled:opacity-60"
                          >
                            {assignees.length === 0 && <option value="">Unassigned</option>}
                            {assignees.map(employee => (
                              <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-0" onClick={event => event.stopPropagation()}>
                          <span className="mb-1 block text-[9px] font-bold uppercase text-[#888888]">Priority</span>
                          <select
                            aria-label={`Priority for ${project.title}`}
                            value={project.priority}
                            disabled={saving}
                            onChange={event => onUpdateProject(project, { priority: event.target.value })}
                            className="w-full rounded-md border border-[#E1DCDC] bg-white px-1.5 py-1 text-[10px] text-[#333333] disabled:opacity-60"
                          >
                            {PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}
                          </select>
                        </label>
                      </div>

                      <label className="mt-2 block" onClick={event => event.stopPropagation()}>
                        <span className="flex items-center justify-between text-[10px] font-semibold text-[#666666]">
                          <span>Progress</span><span>{progressValue}%</span>
                        </span>
                        <input
                          aria-label={`Progress for ${project.title}`}
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={progressValue}
                          disabled={saving}
                          onChange={event => setProgressDrafts(previous => ({ ...previous, [project.id]: event.target.value }))}
                          onPointerUp={() => commitProgress(project)}
                          onKeyUp={() => commitProgress(project)}
                          className="mt-1 h-1.5 w-full accent-[#333333] disabled:opacity-60"
                        />
                      </label>

                      <div className="mt-2 grid grid-cols-2 gap-2" onClick={event => event.stopPropagation()}>
                        <label className="min-w-0">
                          <span className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase text-[#888888]">
                            <CalendarDays className="h-3 w-3" /> Start
                          </span>
                          <input
                            aria-label={`Start date for ${project.title}`}
                            type="date"
                            value={toDateInput(project.start_date)}
                            disabled={saving}
                            onChange={event => onUpdateProject(project, { start_date: event.target.value || null })}
                            className="w-full min-w-0 rounded-md border border-[#E1DCDC] px-1 py-1 text-[9px] text-[#333333] disabled:opacity-60"
                          />
                        </label>
                        <label className="min-w-0">
                          <span className="mb-1 block text-[9px] font-bold uppercase text-[#888888]">Due</span>
                          <input
                            aria-label={`Due date for ${project.title}`}
                            type="date"
                            value={toDateInput(project.deadline)}
                            disabled={saving}
                            onChange={event => onUpdateProject(project, { deadline: event.target.value || null })}
                            className="w-full min-w-0 rounded-md border border-[#E1DCDC] px-1 py-1 text-[9px] text-[#333333] disabled:opacity-60"
                          />
                        </label>
                      </div>
                      <select
                        aria-label={`Status for ${project.title}`}
                        value={project.status}
                        disabled={saving}
                        onClick={event => event.stopPropagation()}
                        onChange={event => onUpdateProject(project, { status: event.target.value })}
                        className="mt-2 w-full rounded-md border border-[#E1DCDC] bg-white px-1.5 py-1 text-[10px] font-semibold text-[#333333] disabled:opacity-60"
                      >
                        {STATUSES.map(option => <option key={option}>{option}</option>)}
                      </select>
                      {busy && <p className="mt-2 text-[10px] font-medium text-[#5269A8]">Saving changes…</p>}
                    </article>
                  );
                })}

                {statusProjects.length === 0 && (
                  <div className="rounded-[8px] border border-dashed border-[#D5CECE] px-2 py-5 text-center text-[10px] text-[#888888]">
                    Drop a project here
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
