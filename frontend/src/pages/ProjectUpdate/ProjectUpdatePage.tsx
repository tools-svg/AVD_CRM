import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Building2,
  Users,
  FileText,
  Clock,
  Edit2,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Layers,
  ExternalLink
} from 'lucide-react';
import { GlobalNavbar } from '../../components/navigation/GlobalNavbar';
import { BackToTop } from '../../components/navigation/BackToTop';
import { CompleteProjectModal } from '../../components/modals/CompleteProjectModal';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/NotificationContext';
import { Company, User, WorkPriority, ProjectItem, ModuleItem } from '../../types';
import { api } from '../../services/api';

interface ModuleEditable {
  id?: number;
  name: string;
  description: string;
  assigned_to_id?: number;
  status: string;
  priority: string;
  progress: number;
}

const PRIORITY_POINTS: { label: WorkPriority; color: string; activeBg: string }[] = [
  { label: 'Low', color: '#6B8674', activeBg: '#E4E9E5' },
  { label: 'Medium', color: '#A78645', activeBg: '#F4E9D2' },
  { label: 'High', color: '#B65F65', activeBg: '#F2DADA' },
  { label: 'Urgent', color: '#A93232', activeBg: '#F5D5D5' },
];

const PROJECT_STATUS_OPTIONS = [
  'Not Started',
  'In Progress',
  'Review',
  'Closed',
  'On Hold',
  'Cancelled'
];

export const ProjectUpdatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, companies } = useAuth();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState<number>(1);
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<WorkPriority>('Medium');
  const [status, setStatus] = useState<string>('Not Started');

  // Employee allocations (Pre-populated, chips/tags with add/remove)
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState<number | ''>('');

  // Module Work Breakdown Structure
  const [modules, setModules] = useState<ModuleEditable[]>([]);
  const [tempModName, setTempModName] = useState('');
  const [tempModDesc, setTempModDesc] = useState('');
  const modulesScrollRef = useRef<HTMLDivElement>(null);

  // Module Detail & Edit Modal state (to open module on click)
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [editingModule, setEditingModule] = useState<ModuleEditable | null>(null);
  const [moduleUpdates, setModuleUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  // Users list
  const [usersList, setUsersList] = useState<User[]>([]);

  // Submission & validation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Complete Project confirmation modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  useEffect(() => {
    loadUsers();
    loadProject();
  }, [id]);

  const loadUsers = async () => {
    try {
      const list = await api.getUsers();
      setUsersList(list);
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getProject(Number(id));

      // Resolve effective status:
      // If the project is closed, or all modules are closed, status is "Closed"
      const allModulesClosed = data.modules && data.modules.length > 0 && data.modules.every(m => m.status === 'Closed');
      const resolvedStatus = (data.status === 'Closed' || allModulesClosed) ? 'Closed' : (data.status || 'Not Started');

      setProject({
        ...data,
        status: resolvedStatus as any
      });

      setTitle(data.title || '');
      setDescription(data.description || '');
      setCompanyId(data.company_id || 1);
      setStatus(resolvedStatus);

      if (data.start_date) {
        setStartDate(data.start_date.split('T')[0]);
      } else {
        setStartDate(new Date().toISOString().split('T')[0]);
      }

      if (data.deadline) {
        setDeadline(data.deadline.split('T')[0]);
      } else {
        setDeadline(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
      }

      setPriority((data.priority as WorkPriority) || 'Medium');

      // Pre-populate employee allocation
      const existingAssigneeIds = [...(data.assigned_employee_ids || [])];
      if (data.lead_id && !existingAssigneeIds.includes(data.lead_id)) {
        existingAssigneeIds.unshift(data.lead_id);
      }
      setAssignedEmployeeIds(existingAssigneeIds);

      // Pre-load all existing modules
      const loadedModules: ModuleEditable[] = (data.modules || []).map(m => ({
        id: m.id,
        name: m.name,
        description: m.description || '',
        assigned_to_id: m.assigned_to_id,
        status: m.status || 'Not Started',
        priority: m.priority || 'Medium',
        progress: m.progress || 0.0,
      }));
      setModules(loadedModules);
    } catch (e: any) {
      toast.error('Failed to load project', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Scroll controls for horizontal modules
  const scrollModules = (direction: 'left' | 'right') => {
    if (modulesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      modulesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Employee Allocation handlers
  const handleAddEmployee = () => {
    if (!selectedEmpToAdd) return;
    const uid = Number(selectedEmpToAdd);
    if (!assignedEmployeeIds.includes(uid)) {
      setAssignedEmployeeIds(prev => [...prev, uid]);
      setEmployeeError(null);
      const emp = usersList.find(u => u.id === uid);
      toast.success('Member Assigned', `${emp?.full_name || 'Employee'} assigned to project.`);
    }
    setSelectedEmpToAdd('');
  };

  const handleRemoveEmployee = (uid: number) => {
    const emp = usersList.find(u => u.id === uid);
    setAssignedEmployeeIds(prev => prev.filter(empId => empId !== uid));
    toast.info('Member Removed', `${emp?.full_name || 'Employee'} removed from project.`);
  };

  // Module Breakdown Structure handlers
  const handleAddModule = () => {
    if (!tempModName.trim()) return;
    const defaultAssignee = assignedEmployeeIds.length > 0 ? assignedEmployeeIds[0] : (user?.id || undefined);

    setModules(prev => [
      ...prev,
      {
        name: tempModName.trim(),
        description: tempModDesc.trim(),
        assigned_to_id: defaultAssignee,
        status: 'Not Started',
        priority: 'Medium',
        progress: 0.0,
      },
    ]);
    setTempModName('');
    setTempModDesc('');

    // Smoothly scroll to the newly appended module
    setTimeout(() => {
      if (modulesScrollRef.current) {
        modulesScrollRef.current.scrollTo({ left: modulesScrollRef.current.scrollWidth, behavior: 'smooth' });
      }
    }, 120);
  };

  // Open module modal handler
  const handleOpenModule = async (idx: number) => {
    const mod = modules[idx];
    if (!mod) return;
    setSelectedModuleIdx(idx);
    setEditingModule({ ...mod });
    setModuleUpdates([]);
    if (mod.id) {
      setLoadingUpdates(true);
      try {
        const upds = await api.getModuleUpdates(mod.id);
        setModuleUpdates(upds);
      } catch (e) {
        console.error('Failed to load module updates:', e);
      } finally {
        setLoadingUpdates(false);
      }
    }
  };

  const handleCloseModuleModal = () => {
    setSelectedModuleIdx(null);
    setEditingModule(null);
    setModuleUpdates([]);
  };

  const handleSaveModuleModal = () => {
    if (selectedModuleIdx === null || !editingModule) return;
    if (!editingModule.name.trim()) {
      toast.error('Validation Error', 'Module name cannot be empty.');
      return;
    }
    setModules(prev => prev.map((m, i) => i === selectedModuleIdx ? {
      ...editingModule,
      name: editingModule.name.trim(),
      description: editingModule.description.trim()
    } : m));
    toast.success('Module Updated', `Changes applied to '${editingModule.name}'.`);
    handleCloseModuleModal();
  };

  // Fully functional delete handler for cross icon
  const handleRemoveModule = async (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const mod = modules[index];
    if (!mod) return;

    if (mod.id) {
      if (!confirm(`Are you sure you want to delete module "${mod.name}"?`)) {
        return;
      }
      try {
        await api.deleteModule(mod.id);
        setModules(prev => prev.filter((_, i) => i !== index));
        toast.success('Module Deleted', `Module '${mod.name}' deleted successfully.`);
        if (selectedModuleIdx === index) {
          handleCloseModuleModal();
        }
      } catch (err: any) {
        // Fallback: still remove from local state so saving project will soft-delete it
        setModules(prev => prev.filter((_, i) => i !== index));
        toast.info('Module Removed', `Module '${mod.name}' removed from breakdown.`);
        if (selectedModuleIdx === index) {
          handleCloseModuleModal();
        }
      }
    } else {
      setModules(prev => prev.filter((_, i) => i !== index));
      toast.info('Module Removed', `Module '${mod.name}' removed from breakdown.`);
      if (selectedModuleIdx === index) {
        handleCloseModuleModal();
      }
    }
  };

  const handleDiscard = () => {
    if (confirm('Discard changes and return to project overview?')) {
      navigate(`/projects/${id}`);
    }
  };

  const handleSaveProject = async () => {
    if (!project) return;
    setError(null);
    setEmployeeError(null);

    if (!title.trim()) {
      setError('Project Nomenclature & Title is mandatory.');
      return;
    }

    if (assignedEmployeeIds.length === 0) {
      setEmployeeError('Please assign at least one employee before saving the project.');
      setError('Employee assignment is mandatory.');
      return;
    }

    if (startDate && deadline && new Date(deadline) < new Date(startDate)) {
      setError('Target Deliverable deadline cannot be earlier than Commencement Date.');
      return;
    }

    setIsSubmitting(true);

    const primaryLead = assignedEmployeeIds.length > 0 ? assignedEmployeeIds[0] : (project.lead_id || user?.id);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      company_id: companyId,
      lead_id: primaryLead,
      priority,
      status, // Synchronize project lifecycle status!
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      assigned_employee_ids: assignedEmployeeIds,
      modules: modules.map((m, idx) => ({
        id: m.id,
        name: m.name.trim(),
        description: m.description,
        assigned_to_id: m.assigned_to_id || primaryLead,
        status: status === 'Closed' ? 'Closed' : (m.status || 'Not Started'),
        priority: m.priority || 'Medium',
        progress: (status === 'Closed' || m.status === 'Closed') ? 100.0 : (m.progress || 0.0),
        sort_order: idx
      })),
    };

    try {
      const updated = await api.updateProject(project.id, payload);
      toast.success('Project Updated', `Project '${updated.title}' updated successfully!`);
      navigate(`/projects/${updated.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update project');
      toast.error('Update Failed', err.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex items-center justify-center">
        <p className="text-xs text-[#888888]">Loading project details...</p>
      </div>
    );
  }

  const currentCompany = companies.find(c => c.id === companyId) || companies[0];
  const isManager = user?.role_name === 'Manager';
  const currentPriorityIdx = Math.max(0, PRIORITY_POINTS.findIndex(p => p.label === priority));

  // Dynamic Status styling
  const getStatusBadgeStyle = (st: string) => {
    switch (st) {
      case 'Closed':
        return 'bg-[#E8F3EE] text-[#43866B] border-[#43866B]/30';
      case 'In Progress':
        return 'bg-[#DCE4FA] text-[#5269A8] border-[#5269A8]/30';
      case 'Review':
        return 'bg-[#F2DADA] text-[#B65F65] border-[#B65F65]/30';
      case 'On Hold':
        return 'bg-[#F4E9D2] text-[#A78645] border-[#A78645]/30';
      default:
        return 'bg-[#F5F3F4] text-[#666666] border-[#E1DCDC]';
    }
  };

  return (
    <div className="h-screen bg-[#EBE5E5] flex flex-col overflow-hidden">
      <GlobalNavbar />

      <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-3 space-y-4">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(`/projects/${project.id}`)}
              className="text-xs text-[#888888] hover:text-[#0A0A0A] flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Projects</span>
            </button>
            <span className="text-xs text-[#888888]">/</span>
            <span className="text-xs text-[#888888] truncate max-w-xs">{project.title}</span>
            <span className="text-xs text-[#888888]">/</span>
            <span className="text-xs font-semibold text-[#0A0A0A]">Update Project</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-[10px] border flex items-center space-x-1.5 ${getStatusBadgeStyle(status)}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>Status: {status}</span>
            </span>
            <span className="text-xs font-semibold text-[#43866B] bg-[#E8F3EE] px-3 py-1.5 rounded-[10px] border border-[#43866B]/20">
              Progress: <strong>{project.progress}%</strong>
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-[12px] bg-[#F5DEDE] border border-[#B65F65]/30 text-[#B65F65] text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Structured Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* LEFT 2 COLUMNS: Project Information + Employee Allocation + Modules */}
          <div className="lg:col-span-2 space-y-5">
            {/* Card 1: Project Information & Mandatory Employee Allocation */}
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Column 1 – Project Information */}
                <div className="space-y-3.5 md:border-r md:border-[#E1DCDC] md:pr-5">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-[#0A0A0A]" />
                    <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                      Project Information
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333333] mb-1">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Quantum-Resistant Sharding Node Cluster"
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3.5 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] focus:bg-white font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333333] mb-1">
                      Project Description
                    </label>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Outline architectural requirements, charter objectives, deliverables and timeline constraints..."
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] focus:bg-white leading-relaxed resize-none overflow-y-auto"
                    />
                  </div>
                </div>

                {/* Column 2 – Employee Allocation (Chips/Tags, Add & Remove) */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-[#5269A8]" />
                      <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                        Employee Allocation *
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-[#5269A8] bg-[#DCE4FA] px-2 py-0.5 rounded-full">
                      {assignedEmployeeIds.length} Assigned
                    </span>
                  </div>

                  {employeeError && (
                    <p className="text-[11px] text-[#B65F65] font-semibold bg-[#F5DEDE] p-2 rounded-[8px]">
                      {employeeError}
                    </p>
                  )}

                  {/* Add Employee Row */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedEmpToAdd}
                      onChange={e => setSelectedEmpToAdd(e.target.value ? Number(e.target.value) : '')}
                      className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium"
                    >
                      <option value="">Select Employee to assign...</option>
                      {usersList
                        .filter(u => !assignedEmployeeIds.includes(u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.role_name})
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddEmployee}
                      disabled={!selectedEmpToAdd}
                      className="px-3.5 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] disabled:cursor-not-allowed flex items-center space-x-1 flex-shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>

                  {/* Assigned Employee Tags/Chips List */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {assignedEmployeeIds.length === 0 ? (
                      <div className="p-4 rounded-[10px] bg-[#F5F3F4]/50 border border-dashed border-[#E1DCDC] text-center text-xs text-[#888888]">
                        No employees assigned yet. Please assign at least one member.
                      </div>
                    ) : (
                      assignedEmployeeIds.map(uid => {
                        const emp = usersList.find(u => u.id === uid);
                        const empName = emp?.full_name || `User #${uid}`;
                        const empRole = emp?.role_name || 'Member';
                        const empEmail = emp?.email || '';

                        return (
                          <div
                            key={uid}
                            className="p-2.5 rounded-[10px] bg-[#F5F3F4] border border-[#E1DCDC] flex items-center justify-between text-xs transition-colors hover:border-[#C5BFBF]"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              {emp?.avatar_url ? (
                                <img
                                  src={emp.avatar_url}
                                  alt={empName}
                                  className="w-6 h-6 rounded-full object-cover border border-[#E1DCDC] flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                  {empName.charAt(0)}
                                </div>
                              )}
                              <div className="truncate">
                                <span className="font-semibold text-[#0A0A0A] block truncate">
                                  {empName}
                                </span>
                                <span className="text-[10px] text-[#888888]">
                                  {empRole}{empEmail ? ` • ${empEmail}` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveEmployee(uid)}
                              className="text-[#888888] hover:text-[#B65F65] p-1 rounded hover:bg-black/5 transition-colors"
                              title="Remove employee"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Module Work Breakdown Structure */}
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1DCDC] pb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Module Work Breakdown Structure
                  </h3>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    Click any module to open and configure details. Scroll horizontally to view all modules.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {modules.length > 5 && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => scrollModules('left')}
                        className="p-1.5 rounded-[6px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-[#333333] transition-colors"
                        title="Scroll Left"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollModules('right')}
                        className="p-1.5 rounded-[6px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-[#333333] transition-colors"
                        title="Scroll Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="text-xs font-bold text-[#5269A8] bg-[#DCE4FA] px-2.5 py-1 rounded-full whitespace-nowrap">
                    {modules.length} Modules
                  </span>
                </div>
              </div>

              {/* Module Input Row: Name, Description, and [Add Stream] button in one horizontal row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-[#F5F3F4] p-2.5 rounded-[10px] border border-[#E1DCDC]">
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={tempModName}
                    onChange={e => setTempModName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddModule();
                      }
                    }}
                    placeholder="Enter module name to add..."
                    className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium"
                  />
                </div>

                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={tempModDesc}
                    onChange={e => setTempModDesc(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddModule();
                      }
                    }}
                    placeholder="Enter module description..."
                    className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddModule}
                    disabled={!tempModName.trim()}
                    className="w-full rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stream</span>
                  </button>
                </div>
              </div>

              {/* MODULES DISPLAY: ROW-WISE LIST, CLICK TO OPEN, FUNCTIONAL CROSS TO DELETE */}
              {modules.length === 0 ? (
                <div className="p-6 rounded-[10px] bg-[#F5F3F4]/50 border border-dashed border-[#E1DCDC] text-center text-xs text-[#888888]">
                  No modules linked yet. Enter module name and description above to add.
                </div>
              ) : (
                <div className="relative">
                  <div
                    ref={modulesScrollRef}
                    className="flex items-center space-x-3 overflow-x-auto pb-2 pt-1 scroll-smooth"
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {modules.map((m, idx) => (
                      <div
                        key={m.id ? `mod-${m.id}` : `new-mod-${idx}`}
                        onClick={() => handleOpenModule(idx)}
                        className="flex-none w-[calc((100%-48px)/5)] min-w-[195px] px-3.5 py-2 rounded-[12px] bg-[#F5F3F4] hover:bg-[#ECE8E8] border border-[#E1DCDC] hover:border-[#0A0A0A] transition-all flex items-center justify-between space-x-2 shadow-2xs group cursor-pointer"
                        title="Click to open module details"
                      >
                        {/* Module Indicator & Details */}
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${m.status === 'Closed'
                              ? 'bg-[#43866B]'
                              : m.status === 'In Progress'
                                ? 'bg-[#5269A8]'
                                : m.status === 'Review'
                                  ? 'bg-[#B65F65]'
                                  : 'bg-[#A78645]'
                              }`}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-[#0A0A0A] truncate">
                              {m.name || 'Untitled Module'}
                            </span>
                            <span className="block text-[10px] text-[#888888] truncate">
                              {m.description ? m.description : (m.status || 'No description')}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Open Indicator & Remove button */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <span className="text-[10px] font-semibold text-[#5269A8] opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded border border-[#E1DCDC]">
                            Open
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveModule(idx, e);
                            }}
                            className="text-[#888888] hover:text-[#B65F65] p-1.5 rounded-full hover:bg-[#F5DEDE] transition-colors flex-shrink-0 cursor-pointer"
                            title="Delete module"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {modules.length > 5 && (
                    <div className="text-[11px] text-[#888888] flex items-center justify-between pt-1.5 px-1">
                      <span>Showing 5 modules across. Scroll right ➔ to view remaining {modules.length - 5} modules</span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => scrollModules('left')}
                          className="text-[#0A0A0A] font-semibold hover:underline cursor-pointer"
                        >
                          ◀ Previous
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => scrollModules('right')}
                          className="text-[#0A0A0A] font-semibold hover:underline cursor-pointer"
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE SETTINGS PANEL (Status & Company in same row, Dates, Priority, and All 3 Buttons at bottom) */}
          <div className="space-y-5">
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-5 flex flex-col">
              <span className="text-[11px] font-bold uppercase text-[#888888] tracking-wider block border-b border-[#E1DCDC] pb-2">
                Project Settings & Governance
              </span>

              {/* Project Lifecycle Status and Company Name IN THE SAME ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Project Lifecycle Status */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#333333]">
                      Lifecycle Status
                    </label>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getStatusBadgeStyle(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-2 text-xs font-bold text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A] cursor-pointer"
                  >
                    {PROJECT_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-Company Domain (Company Name) */}
                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1.5">
                    Company Name
                  </label>
                  <div className="flex items-center space-x-2 bg-[#F5F3F4] px-2.5 rounded-[10px] border border-[#E1DCDC]">
                    {currentCompany?.logo_url && (
                      <img
                        src={currentCompany.logo_url}
                        alt={currentCompany.name}
                        className="w-5 h-5 rounded-[4px] object-contain bg-white p-0.5 border border-[#E1DCDC] flex-shrink-0"
                      />
                    )}
                    <select
                      disabled={isManager}
                      value={companyId}
                      onChange={e => setCompanyId(Number(e.target.value))}
                      className="flex-1 bg-transparent text-xs font-bold text-[#0A0A0A] focus:outline-none cursor-pointer truncate"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isManager && (
                    <p className="text-[10px] text-[#888888] mt-1">
                      🔒 Assigned scope.
                    </p>
                  )}
                </div>
              </div>

              {/* Execution Timeline (Commencement & Target Deadline Dates) */}
              <div>
                <span className="block text-xs font-semibold text-[#333333] mb-1.5">
                  Execution Timeline
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-2.5 py-1.5 text-xs text-[#333333] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[#888888] mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-2.5 py-1.5 text-xs text-[#333333] font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Priority Level Slider / Selector (Low, Medium, High, Urgent) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#333333]">
                    Priority Assignment
                  </label>
                  <span
                    style={{ color: PRIORITY_POINTS[currentPriorityIdx].color }}
                    className="text-xs font-bold"
                  >
                    {priority}
                  </span>
                </div>

                {/* Horizontal Priority Line with 4 distinct points */}
                <div className="relative pt-2 pb-5 px-3">
                  {/* Track Line */}
                  <div className="absolute top-4 left-6 right-6 h-1 bg-[#E1DCDC] rounded-full z-0" />
                  <div
                    className="absolute top-4 left-6 h-1 rounded-full z-0 transition-all duration-300"
                    style={{
                      width: `${(currentPriorityIdx / 3) * 100}%`,
                      backgroundColor: PRIORITY_POINTS[currentPriorityIdx].color,
                    }}
                  />

                  {/* 4 Selectable Points */}
                  <div className="relative z-10 flex justify-between items-center">
                    {PRIORITY_POINTS.map((pt, idx) => {
                      const isSelected = priority === pt.label;
                      return (
                        <button
                          key={pt.label}
                          type="button"
                          onClick={() => setPriority(pt.label)}
                          className="flex flex-col items-center focus:outline-none group cursor-pointer"
                        >
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected
                              ? 'scale-125 ring-3 ring-offset-1 shadow-sm'
                              : 'bg-white border-2 border-[#E1DCDC] hover:scale-110'
                              }`}
                            style={{
                              backgroundColor: isSelected ? pt.color : '#FFFFFF',
                              borderColor: isSelected ? pt.color : '#C5BFBF',
                              ['--tw-ring-color' as any]: pt.color + '40',
                            }}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <span
                            className={`text-[11px] mt-2 font-semibold transition-colors ${isSelected ? 'font-bold' : 'text-[#888888] group-hover:text-[#333333]'
                              }`}
                            style={{ color: isSelected ? pt.color : undefined }}
                          >
                            {pt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ALL 3 BUTTONS AT THE BOTTOM OF RIGHT PANEL */}
              <div className="border-t border-[#E1DCDC] pt-4 space-y-2.5 mt-2">
                {/* Button 1: Complete Project Option */}
                {status !== 'Closed' ? (
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-[10px] bg-[#43866B] hover:bg-[#346d56] text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                    title="Transition project to Closed status"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete Project</span>
                  </button>
                ) : (
                  <div className="w-full py-2 px-3 rounded-[10px] text-[11px] text-[#43866B] font-bold flex items-center justify-center space-x-2 bg-[#E8F3EE] border border-[#43866B]/20">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Project is Closed</span>
                  </div>
                )}

                {/* Buttons 2 & 3: Discard Changes and Save & Update Project */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="w-full py-2.5 px-2 rounded-[10px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4] transition-colors text-center cursor-pointer truncate"
                  >
                    Discard Changes
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveProject}
                    className="w-full py-2.5 px-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-bold hover:bg-[#333333] transition-colors shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer truncate"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{isSubmitting ? 'Saving...' : 'Save & Update'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Module Detail & Configuration Modal (Opened when clicking on any module card) */}
      {editingModule && selectedModuleIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#FFFFFF] rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate">
                <div className="p-1.5 rounded-[8px] bg-white border border-[#E1DCDC] text-[#5269A8]">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Module Configuration
                  </h3>
                  <p className="text-[11px] text-[#888888] truncate max-w-sm">
                    {editingModule.name || 'Configure Module'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeStyle(editingModule.status)}`}>
                  {editingModule.status}
                </span>
                <button
                  type="button"
                  onClick={handleCloseModuleModal}
                  className="p-1 rounded-[8px] text-[#888888] hover:text-[#0A0A0A] hover:bg-[#E8E4E4] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Module Name */}
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Module Name *
                </label>
                <input
                  type="text"
                  value={editingModule.name}
                  onChange={e => setEditingModule({ ...editingModule, name: e.target.value })}
                  placeholder="e.g. Distributed Consensus Engine"
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3.5 py-2 text-xs text-[#333333] font-medium focus:outline-none focus:border-[#0A0A0A] focus:bg-white"
                  required
                />
              </div>

              {/* Module Description */}
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1">
                  Module Description & Scope
                </label>
                <textarea
                  rows={3}
                  value={editingModule.description}
                  onChange={e => setEditingModule({ ...editingModule, description: e.target.value })}
                  placeholder="Detail module deliverables, technical criteria, and acceptance requirements..."
                  className="h-20 w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] leading-relaxed focus:outline-none focus:border-[#0A0A0A] focus:bg-white resize-none overflow-y-auto"
                />
              </div>

              {/* Two Column: Assignee and Lifecycle Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1">
                    Assigned Owner / Employee
                  </label>
                  <select
                    value={editingModule.assigned_to_id || ''}
                    onChange={e => setEditingModule({ ...editingModule, assigned_to_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 py-2 text-xs text-[#333333] font-medium focus:outline-none focus:border-[#0A0A0A] cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role_name}) {assignedEmployeeIds.includes(u.id) ? '★' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1">
                    Module Status
                  </label>
                  <select
                    value={editingModule.status}
                    onChange={e => setEditingModule({ ...editingModule, status: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 py-2 text-xs text-[#333333] font-medium focus:outline-none focus:border-[#0A0A0A] cursor-pointer"
                  >
                    {PROJECT_STATUS_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two Column: Priority and Progress Slider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                <div>
                  <label className="block text-xs font-semibold text-[#333333] mb-1">
                    Priority Level
                  </label>
                  <select
                    value={editingModule.priority}
                    onChange={e => setEditingModule({ ...editingModule, priority: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 py-2 text-xs text-[#333333] font-medium focus:outline-none focus:border-[#0A0A0A] cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#333333]">
                      Module Progress
                    </label>
                    <span className="text-xs font-bold text-[#0A0A0A]">
                      {editingModule.progress}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 py-1.5">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={editingModule.progress}
                      onChange={e => setEditingModule({ ...editingModule, progress: Number(e.target.value) })}
                      className="w-full accent-[#0A0A0A] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Updates History Section if module has an ID and updates exist */}
              {editingModule.id && (
                <div className="pt-2 border-t border-[#E1DCDC]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                      Recent Updates & History
                    </span>
                    <span className="text-[10px] text-[#888888]">
                      {loadingUpdates ? 'Loading...' : `${moduleUpdates.length} updates logged`}
                    </span>
                  </div>

                  {moduleUpdates.length === 0 ? (
                    <p className="text-[11px] text-[#888888] italic bg-[#F5F3F4] p-2.5 rounded-[8px]">
                      No previous updates posted for this module yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {moduleUpdates.map((u: any) => (
                        <div key={u.id} className="p-2.5 rounded-[8px] bg-[#F5F3F4] border border-[#E1DCDC] text-xs">
                          <div className="flex items-center justify-between text-[10px] text-[#888888] mb-1">
                            <span className="font-semibold text-[#0A0A0A]">{u.user_name || 'Team Member'}</span>
                            <span>{u.created_at ? new Date(u.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                          </div>
                          <p className="text-[#333333] text-[11px] leading-relaxed">{u.description_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <button
                type="button"
                onClick={async () => {
                  if (selectedModuleIdx !== null) {
                    await handleRemoveModule(selectedModuleIdx);
                  }
                }}
                className="px-3 py-1.5 rounded-[8px] border border-[#B65F65]/30 text-[#B65F65] hover:bg-[#F5DEDE] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Module</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModuleModal}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#E8E4E4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveModuleModal}
                  className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white text-xs font-bold hover:bg-[#333333] transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Apply Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Project Confirmation Modal */}
      {isCompleteModalOpen && project && (
        <CompleteProjectModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          project={project}
          onSuccess={() => {
            setStatus('Closed');
            setProject(prev => prev ? { ...prev, status: 'Closed' as any, progress: 100 } : null);
            toast.success('Project Completed', `Project '${project.title}' is now Closed!`);
          }}
        />
      )}

      <BackToTop />
    </div>
  );
};
