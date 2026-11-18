import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  FolderPlus, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Calendar, 
  AlertCircle, 
  Building2, 
  Users, 
  CheckCircle,
  CheckCircle2, 
  FileText, 
  Clock, 
  Edit2,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';
import { GlobalNavbar } from '../../components/navigation/GlobalNavbar';
import { BackToTop } from '../../components/navigation/BackToTop';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/NotificationContext';
import { Company, User, WorkPriority, ProjectItem } from '../../types';
import { api } from '../../services/api';

interface ModuleDraft {
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

export const ProjectCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, companies, selectedCompanyId } = useAuth();

  // If editing an existing draft
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState<number>(selectedCompanyId || (companies[0]?.id || 1));
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<WorkPriority>('Medium');

  // Employee assignments (Mandatory)
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState<number | ''>('');

  // Modules list (Fixed horizontal row breakdown)
  const [modules, setModules] = useState<ModuleDraft[]>([]);
  const [tempModName, setTempModName] = useState('');
  const [tempModDesc, setTempModDesc] = useState('');
  const modulesScrollRef = useRef<HTMLDivElement>(null);

  // Selected module for detail modal / configuration
  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number | null>(null);
  const [editingModule, setEditingModule] = useState<ModuleDraft | null>(null);

  // Users & Drafts lists
  const [usersList, setUsersList] = useState<User[]>([]);
  const [draftsList, setDraftsList] = useState<ProjectItem[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  useEffect(() => {
    api.getUsers().then(setUsersList).catch(console.error);
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const drafts = await api.getDrafts();
      setDraftsList(drafts);
    } catch (e) {
      console.error('Failed to load drafts:', e);
    }
  };

  const handleAddEmployee = () => {
    if (!selectedEmpToAdd) return;
    const uid = Number(selectedEmpToAdd);
    if (!assignedEmployeeIds.includes(uid)) {
      setAssignedEmployeeIds(prev => [...prev, uid]);
      setEmployeeError(null);
      const emp = usersList.find(u => u.id === uid);
      toast.success('Member Assigned', `${emp?.full_name || 'Employee'} assigned to project draft.`);
    }
    setSelectedEmpToAdd('');
  };

  const handleRemoveEmployee = (uid: number) => {
    const emp = usersList.find(u => u.id === uid);
    setAssignedEmployeeIds(prev => prev.filter(id => id !== uid));
    toast.info('Member Removed', `${emp?.full_name || 'Employee'} removed from project draft.`);
  };

  // Scroll controls for horizontal modules
  const scrollModules = (direction: 'left' | 'right') => {
    if (modulesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      modulesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleAddModule = () => {
    if (!tempModName.trim()) return;
    const inheritedAssignee = assignedEmployeeIds.length > 0 ? assignedEmployeeIds[0] : undefined;

    setModules(prev => [
      ...prev,
      {
        name: tempModName.trim(),
        description: tempModDesc.trim(),
        assigned_to_id: inheritedAssignee,
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

  const handleOpenModule = (idx: number) => {
    const mod = modules[idx];
    if (!mod) return;
    setSelectedModuleIdx(idx);
    setEditingModule({ ...mod });
  };

  const handleCloseModuleModal = () => {
    setSelectedModuleIdx(null);
    setEditingModule(null);
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

  const handleRemoveModule = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const mod = modules[index];
    setModules(prev => prev.filter((_, i) => i !== index));
    if (mod) {
      toast.info('Module Removed', `Module '${mod.name}' removed from breakdown.`);
    }
    if (selectedModuleIdx === index) {
      handleCloseModuleModal();
    }
  };

  const handleDiscard = () => {
    if (confirm('Discard unsaved changes and return to dashboard?')) {
      navigate('/home');
    }
  };

  // Reopening a saved draft
  const handleOpenDraft = (draft: ProjectItem) => {
    setCurrentDraftId(draft.id);
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    setCompanyId(draft.company_id || (companies[0]?.id || 1));
    if (draft.start_date) setStartDate(draft.start_date.split('T')[0]);
    if (draft.deadline) setDeadline(draft.deadline.split('T')[0]);
    setPriority((draft.priority as WorkPriority) || 'Medium');

    const draftEmpIds = (draft.assigned_employees || []).map(e => e.id);
    if (draft.lead_id && !draftEmpIds.includes(draft.lead_id)) {
      draftEmpIds.unshift(draft.lead_id);
    }
    setAssignedEmployeeIds(draftEmpIds);

    const draftMods: ModuleDraft[] = (draft.modules || []).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description || '',
      assigned_to_id: m.assigned_to_id,
      status: m.status || 'Not Started',
      priority: m.priority || 'Medium',
      progress: m.progress || 0.0,
    }));
    setModules(draftMods);

    setIsDraftsModalOpen(false);
    toast.info('Draft Loaded', `Continuing draft '${draft.title}'`);
  };

  const handleDeleteDraft = async (draftId: number) => {
    if (!confirm('Are you sure you want to delete this draft permanently?')) return;
    try {
      await api.deleteProject(draftId, '');
      toast.success('Draft Deleted', 'Draft project was removed.');
      loadDrafts();
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
        setTitle('');
        setDescription('');
        setModules([]);
        setAssignedEmployeeIds([]);
      }
    } catch (e: any) {
      toast.error('Deletion Failed', e.message);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    setError(null);
    setEmployeeError(null);

    // Drafts do not require strict employee/title validation, but publishing DOES!
    if (!isDraft) {
      if (!title.trim()) {
        setError('Project Title is mandatory.');
        return;
      }

      if (assignedEmployeeIds.length === 0) {
        setEmployeeError('Please assign at least one employee before creating the project.');
        setError('Employee assignment is mandatory for active project launch.');
        return;
      }

      if (startDate && deadline && new Date(deadline) < new Date(startDate)) {
        setError('Target deadline date cannot be earlier than Commencement Date.');
        return;
      }
    } else {
      if (!title.trim()) {
        setError('Please provide at least a provisional Title to save as draft.');
        return;
      }
    }

    setIsSubmitting(true);

    const primaryLead = assignedEmployeeIds.length > 0 ? assignedEmployeeIds[0] : user?.id;

    const payload = {
      title: title.trim(),
      description: description.trim(),
      company_id: companyId,
      lead_id: primaryLead,
      priority,
      status: isDraft ? 'Draft' : 'Not Started',
      start_date: startDate ? new Date(startDate).toISOString() : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      is_draft: isDraft,
      assigned_employee_ids: assignedEmployeeIds,
      modules: modules.map(m => ({
        name: m.name,
        description: m.description,
        assigned_to_id: m.assigned_to_id || primaryLead,
        status: m.status,
        priority: m.priority,
        progress: m.progress,
      })),
    };

    try {
      if (currentDraftId) {
        // Updating existing draft
        await api.updateProject(currentDraftId, payload);
        if (isDraft) {
          toast.success('Draft Updated', 'Draft changes saved successfully.');
          loadDrafts();
        } else {
          toast.success('Project Published', `Project '${title}' is now actively tracking!`);
          navigate(`/projects/${currentDraftId}`);
        }
      } else {
        // Creating new record
        const created = await api.createProject(payload);
        if (isDraft) {
          toast.success('Draft Saved', 'Draft stored in your workspace. You can continue later.');
          setCurrentDraftId(created.id);
          loadDrafts();
        } else {
          toast.success('Project Created', `Project '${created.title}' created successfully!`);
          navigate(`/projects/${created.id}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save project');
      toast.error('Submission Failed', err.message || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCompany = companies.find(c => c.id === companyId) || companies[0];
  const isManager = user?.role_name === 'Manager';

  // Priority slider point index (0 to 3)
  const currentPriorityIdx = PRIORITY_POINTS.findIndex(p => p.label === priority);

  return (
    <div className="h-screen bg-[#EBE5E5] flex flex-col overflow-hidden">
      <GlobalNavbar />

      <main className="flex-1 overflow-y-auto w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-3 space-y-4">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#888888]">Initiative Studio</span>
            <span className="text-xs text-[#888888]">/</span>
            <span className="text-xs font-semibold text-[#0A0A0A]">
              {currentDraftId ? `Editing Draft: ${title || 'Untitled'}` : 'Create Strategic Project'}
            </span>
          </div>

          {/* Drafts Button */}
          <button
            type="button"
            onClick={() => setIsDraftsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-[10px] bg-white border border-[#E1DCDC] hover:bg-[#F5F3F4] text-xs font-semibold text-[#333333] flex items-center space-x-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-[#5269A8]" />
            <span>Saved Drafts</span>
            {draftsList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#DCE4FA] text-[#5269A8] text-[10px] font-bold">
                {draftsList.length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-[12px] bg-[#F5DEDE] border border-[#B65F65]/30 text-[#B65F65] text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Structured Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* LEFT 2 COLUMNS: Project Information + Employee Allocation + Modules */}
          <div className="lg:col-span-2 space-y-4">
            {/* Card 1: Project Information & Mandatory Employee Assignment */}
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Column 1 – Project Information */}
                <div className="space-y-3 md:border-r md:border-[#E1DCDC] md:pr-5">
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
                      rows={4}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Outline architectural requirements, charter objectives, deliverables and timeline constraints..."
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] focus:bg-white leading-relaxed resize-none"
                    />
                  </div>
                </div>

                {/* Column 2 – Employee Assignment */}
                <div className="space-y-3">
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
                      className="px-3.5 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] disabled:cursor-not-allowed flex items-center space-x-1 flex-shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>

                  {/* Assigned Employee Tags/Chips List */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
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
                              className="text-[#888888] hover:text-[#B65F65] p-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
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

            {/* Card 2: Module Creation & Work Breakdown Structure (Fixed Layout with Scrollable Row) */}
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1DCDC] pb-3">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Module Work Breakdown Structure
                  </h3>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    Click any module to configure details. Scroll horizontally to view all modules without expanding the page.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {modules.length > 5 && (
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => scrollModules('left')}
                        className="p-1.5 rounded-[6px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-[#333333] transition-colors cursor-pointer"
                        title="Scroll Left"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollModules('right')}
                        className="p-1.5 rounded-[6px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-[#333333] transition-colors cursor-pointer"
                        title="Scroll Right"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span className="text-xs font-bold text-[#5269A8] bg-[#DCE4FA] px-2.5 py-1 rounded-full whitespace-nowrap">
                    {modules.length} Modules Linked
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
                    placeholder="Module Name (e.g. Distributed Consensus Engine)"
                    className="w-full h-[36px] bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium"
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
                    placeholder="Module Description (e.g. Core architectural workflows)..."
                    className="w-full h-[36px] bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] font-medium"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddModule}
                    disabled={!tempModName.trim()}
                    className="w-full h-[36px] rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stream</span>
                  </button>
                </div>
              </div>

              {/* MODULES DISPLAY: FIXED-LAYOUT ROW, CLICK TO OPEN, DELETE CROSS */}
              {modules.length === 0 ? (
                <div className="p-6 rounded-[10px] bg-[#F5F3F4]/50 border border-dashed border-[#E1DCDC] text-center text-xs text-[#888888]">
                  No modules linked yet. Enter module name and description above to add work streams.
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
                        key={idx}
                        onClick={() => handleOpenModule(idx)}
                        className="flex-none w-[calc((100%-48px)/5)] min-w-[195px] h-[54px] px-3.5 py-2 rounded-[12px] bg-[#F5F3F4] hover:bg-[#ECE8E8] border border-[#E1DCDC] hover:border-[#0A0A0A] transition-all flex items-center justify-between space-x-2 shadow-2xs group cursor-pointer"
                        title="Click to configure module specifications"
                      >
                        {/* Module Indicator & Details */}
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              m.status === 'Closed'
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
                              {m.name || 'Untitled Stream'}
                            </span>
                            <span className="block text-[10px] text-[#888888] truncate">
                              {m.description ? m.description : (m.status || 'Draft module')}
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
                            title="Remove module"
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

          {/* RIGHT SIDE SETTINGS PANEL (With All 3 Action Buttons at Bottom) */}
          <div className="space-y-4">
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-4 flex flex-col">
              <span className="text-[11px] font-bold uppercase text-[#888888] tracking-wider block border-b border-[#E1DCDC] pb-2">
                Project Settings & Governance
              </span>

              {/* Sub-Company Domain */}
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1.5">
                  Sub-Company Domain
                </label>
                <div className="flex items-center space-x-2.5 bg-[#F5F3F4] p-2.5 rounded-[10px] border border-[#E1DCDC]">
                  {currentCompany?.logo_url && (
                    <img
                      src={currentCompany.logo_url}
                      alt={currentCompany.name}
                      className="w-7 h-7 rounded-[4px] object-contain bg-white p-0.5 border border-[#E1DCDC]"
                    />
                  )}
                  <select
                    disabled={isManager}
                    value={companyId}
                    onChange={e => setCompanyId(Number(e.target.value))}
                    className="flex-1 bg-transparent text-xs font-bold text-[#0A0A0A] focus:outline-none cursor-pointer"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                {isManager && (
                  <p className="text-[10px] text-[#888888] mt-1">
                    🔒 Restricted to assigned company scope.
                  </p>
                )}
              </div>

              {/* Execution Timeline (Dates placed horizontally) */}
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

              {/* Priority Selector (4-Point Horizontal Line) */}
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
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected
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
                            className={`text-[11px] mt-2 font-semibold transition-colors ${
                              isSelected ? 'font-bold' : 'text-[#888888] group-hover:text-[#333333]'
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

              {/* ALL 3 BUTTONS AT THE BOTTOM OF THE RIGHT PANEL */}
              <div className="border-t border-[#E1DCDC] pt-4 space-y-2.5 mt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(false)}
                  className="w-full py-2.5 px-3 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-bold hover:bg-[#333333] transition-colors shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{isSubmitting ? 'Publishing...' : 'Create Project'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="w-full py-2.5 px-2 rounded-[10px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4] transition-colors text-center cursor-pointer truncate"
                  >
                    Discard
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(true)}
                    className="w-full py-2.5 px-2 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-xs font-semibold text-[#333333] transition-colors flex items-center justify-center space-x-1 disabled:opacity-50 cursor-pointer truncate"
                  >
                    <Save className="w-3.5 h-3.5 text-[#666666] flex-shrink-0" />
                    <span className="truncate">Save as Draft</span>
                  </button>
                </div>

                {currentDraftId && (
                  <p className="text-[10px] text-[#43866B] font-semibold text-center pt-1">
                    ● Currently editing saved draft #{currentDraftId}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Module Detail & Configuration Modal for Drafts */}
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
                    Module Specifications
                  </h3>
                  <p className="text-[11px] text-[#888888] truncate max-w-sm">
                    {editingModule.name || 'Configure Module Stream'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModuleModal}
                className="p-1 rounded-[8px] text-[#888888] hover:text-[#0A0A0A] hover:bg-[#E8E4E4] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
                  rows={4}
                  value={editingModule.description}
                  onChange={e => setEditingModule({ ...editingModule, description: e.target.value })}
                  placeholder="Detail module deliverables, technical criteria, and acceptance requirements..."
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] leading-relaxed focus:outline-none focus:border-[#0A0A0A] focus:bg-white resize-none"
                />
              </div>

              {/* Two Column: Assignee and Status */}
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
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Closed">Closed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Cancelled">Cancelled</option>
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
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (selectedModuleIdx !== null) {
                    handleRemoveModule(selectedModuleIdx);
                  }
                }}
                className="px-3 py-1.5 rounded-[8px] border border-[#B65F65]/30 text-[#B65F65] hover:bg-[#F5DEDE] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Stream</span>
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

      {/* Drafts Management Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#5269A8]" />
                <h3 className="text-xs font-bold text-[#0A0A0A]">Your Saved Drafts</h3>
              </div>
              <button
                onClick={() => setIsDraftsModalOpen(false)}
                className="p-1 rounded-[8px] text-[#888888] hover:text-[#333333] hover:bg-[#E8E4E4] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2.5">
              {draftsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#888888]">
                  No saved drafts found. You can save incomplete projects as draft anytime.
                </div>
              ) : (
                draftsList.map(draft => (
                  <div
                    key={draft.id}
                    className="p-3.5 rounded-[12px] bg-[#F5F3F4] border border-[#E1DCDC] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#0A0A0A] truncate">{draft.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F4E9D2] text-[#A78645]">
                          Draft
                        </span>
                      </div>
                      <div className="text-[11px] text-[#888888] mt-1 space-x-2">
                        <span>Company: <strong>{draft.company_name}</strong></span>
                        <span>•</span>
                        <span>Saved: {new Date(draft.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenDraft(draft)}
                        className="px-3 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit / Continue</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#B65F65] hover:bg-black/5 cursor-pointer"
                        title="Delete draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <BackToTop />
    </div>
  );
};
