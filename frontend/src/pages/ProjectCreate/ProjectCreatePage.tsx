import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  FileText,
  Clock,
  Edit2
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

  // Employee assignments (Section 12: Mandatory)
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState<number | ''>('');

  // Modules list (Section 16.2)
  const [modules, setModules] = useState<ModuleDraft[]>([]);
  const [tempModName, setTempModName] = useState('');
  const [tempModDesc, setTempModDesc] = useState('');

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

  const handleAddModule = () => {
    if (!tempModName.trim()) return;
    // Section 12: New modules automatically inherit project's assigned employee(s) by default!
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
  };

  const handleRemoveModule = (index: number) => {
    setModules(prev => prev.filter((_, i) => i !== index));
  };

  const handleModuleAssigneeChange = (index: number, empId?: number) => {
    setModules(prev => prev.map((m, i) => i === index ? { ...m, assigned_to_id: empId } : m));
  };

  const handleDiscard = () => {
    if (confirm('Discard unsaved changes and return to dashboard?')) {
      navigate('/home');
    }
  };

  // Reopening a saved draft (Section 11)
  const handleOpenDraft = (draft: ProjectItem) => {
    setCurrentDraftId(draft.id);
    setTitle(draft.title || '');
    setDescription(draft.description || '');
    setCompanyId(draft.company_id || (companies[0]?.id || 1));
    if (draft.start_date) setStartDate(draft.start_date.split('T')[0]);
    if (draft.deadline) setDeadline(draft.deadline.split('T')[0]);
    setPriority(draft.priority || 'Medium');

    const draftEmpIds = draft.assigned_employee_ids || [];
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
    setError(null);
    setEmployeeError(null);
  };

  const handleDeleteDraft = async (draftId: number) => {
    try {
      await api.deleteDraft(draftId);
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
        setTitle('');
        setDescription('');
        setModules([]);
        setAssignedEmployeeIds([]);
      }
      toast.info('Draft Discarded', 'Draft discarded successfully.');
      loadDrafts();
    } catch (e: any) {
      toast.error('Failed to Discard Draft', e.message);
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    setError(null);
    setEmployeeError(null);

    // Validation for publication (Active Project)
    if (!isDraft) {
      if (!title.trim()) {
        setError('Project Nomenclature & Title is mandatory.');
        return;
      }
      // SECTION 12: Employee assignment is mandatory!
      if (assignedEmployeeIds.length === 0) {
        setEmployeeError('Please assign at least one employee before publishing the project.');
        setError('Employee assignment is mandatory.');
        return;
      }
      if (new Date(deadline) < new Date(startDate)) {
        setError('Target Deliverable deadline cannot be earlier than Commencement Date.');
        return;
      }
    } else {
      // For saving draft, title is at least needed for identification
      if (!title.trim()) {
        setError('Please enter at least a project title to save as draft.');
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
      status: 'Not Started',
      progress: 0.0,
      start_date: new Date(startDate).toISOString(),
      deadline: new Date(deadline).toISOString(),
      is_draft: isDraft,
      assigned_employee_ids: assignedEmployeeIds,
      modules: modules.map(m => ({
        name: m.name,
        description: m.description,
        assigned_to_id: m.assigned_to_id || primaryLead,
        status: m.status || 'Not Started',
        priority: m.priority || 'Medium',
        progress: m.progress || 0.0,
      })),
    };

    try {
      if (currentDraftId) {
        // Update existing draft record so it does NOT duplicate (Section 11)
        const updated = await api.updateProject(currentDraftId, payload);
        if (isDraft) {
          toast.success('Draft Saved', 'Draft project updated successfully.');
          loadDrafts();
        } else {
          toast.success('Project Published', `Project '${updated.title}' published successfully!`);
          navigate(`/projects/${updated.id}`);
        }
      } else {
        // Create new project or draft
        const created = await api.createProject(payload);
        if (isDraft) {
          setCurrentDraftId(created.id);
          toast.success('Draft Saved', 'Incomplete draft saved. It will not appear in the active project list.');
          loadDrafts();
        } else {
          toast.success('Project Published', `Project '${created.title}' published successfully!`);
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
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col">
      <GlobalNavbar />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* Top Header & Breadcrumb (Back navigation handled via top logo per Section 12) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#888888]">Initiative Studio</span>
            <span className="text-xs text-[#888888]">/</span>
            <span className="text-xs font-semibold text-[#0A0A0A]">
              {currentDraftId ? `Editing Draft: ${title || 'Untitled'}` : 'Create Strategic Project'}
            </span>
          </div>

          {/* Drafts Button (Section 11) */}
          <button
            type="button"
            onClick={() => setIsDraftsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-[10px] bg-white border border-[#E1DCDC] hover:bg-[#F5F3F4] text-xs font-semibold text-[#333333] flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
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
          <div className="p-3.5 rounded-[12px] bg-[#F5DEDE] border border-[#B65F65]/30 text-[#B65F65] text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 16: Two-Column Structured Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* LEFT 2 COLUMNS: Project Information + Mandatory Employee Assignment + Modules */}
          <div className="lg:col-span-2 space-y-5">
            {/* SECTION 16.1: First Section - Two Column Card: Project Info & Employee Assignment */}
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
                      className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] focus:bg-white leading-relaxed resize-none"
                    />
                  </div>
                </div>

                {/* Column 2 – Employee Assignment (Mandatory per Section 12 & 16.1) */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-[#5269A8]" />
                      <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                        Employee Assignment *
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-[#A93232] bg-[#F5D5D5] px-2 py-0.5 rounded-full">
                      Mandatory
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

                  {/* Assigned Employee List */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {assignedEmployeeIds.length === 0 ? (
                      <div className="p-4 rounded-[10px] bg-[#F5F3F4]/50 border border-dashed border-[#E1DCDC] text-center text-xs text-[#888888]">
                        No employees assigned yet. Please assign at least one member.
                      </div>
                    ) : (
                      assignedEmployeeIds.map(uid => {
                        const emp = usersList.find(u => u.id === uid);
                        if (!emp) return null;
                        return (
                          <div
                            key={uid}
                            className="p-2.5 rounded-[10px] bg-[#F5F3F4] border border-[#E1DCDC] flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                {emp.full_name.charAt(0)}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-[#0A0A0A] block truncate">
                                  {emp.full_name}
                                </span>
                                <span className="text-[10px] text-[#888888]">
                                  {emp.role_name} • {emp.email}
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

            {/* SECTION 16.2: Second Section - Module Creation */}
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Module Creation & Streams
                  </h3>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    Newly created modules automatically inherit project assignments by default.
                  </p>
                </div>
                <span className="text-xs font-bold text-[#5269A8] bg-[#DCE4FA] px-2.5 py-0.5 rounded-full">
                  {modules.length} Modules Linked
                </span>
              </div>

              {/* Module Input Row: Name, Description, and [Add Stream] button in one horizontal row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-[#F5F3F4] p-3 rounded-[10px] border border-[#E1DCDC]">
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={tempModName}
                    onChange={e => setTempModName(e.target.value)}
                    placeholder="Module Name (e.g. Distributed Consensus Engine)"
                    className="w-full h-[36px] bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={tempModDesc}
                    onChange={e => setTempModDesc(e.target.value)}
                    placeholder="Brief stream description..."
                    className="w-full h-[36px] bg-white border border-[#E1DCDC] rounded-[8px] px-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddModule}
                    disabled={!tempModName.trim()}
                    className="w-full h-[36px] rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center space-x-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Stream</span>
                  </button>
                </div>
              </div>

              {/* Modules List */}
              {modules.length > 0 && (
                <div className="space-y-2 pt-1">
                  {modules.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-[10px] bg-[#F5F3F4] border border-[#E1DCDC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#0A0A0A] truncate">{m.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8E8E8] text-[#666666]">
                            {m.status}
                          </span>
                        </div>
                        {m.description && (
                          <p className="text-[11px] text-[#666666] mt-0.5 line-clamp-1">{m.description}</p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveModule(idx)}
                          className="text-[#888888] hover:text-[#B65F65] p-1.5 rounded hover:bg-black/5 transition-colors"
                          title="Remove module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE SETTINGS PANEL (Section 16.3) */}
          <div className="space-y-5">
            <div className="bg-[#FFFFFF] rounded-[14px] p-5 border border-[#E1DCDC] shadow-xs space-y-5">
              <span className="text-[11px] font-bold uppercase text-[#888888] tracking-wider block border-b border-[#E1DCDC] pb-2">
                Project Settings & Governance
              </span>

              {/* First Row – Company (Section 16.3: Logo + Name + Selection) */}
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

              {/* Second Row – Dates (Section 16.3: Placed Horizontally) */}
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

              {/* Third Row – Priority (Section 16.3: 4-Point Horizontal Priority Selector) */}
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
            </div>
          </div>
        </div>

        {/* SECTION 16.4: Bottom Submission Bar */}
        <div className="bg-[#FFFFFF] rounded-[14px] p-4 border border-[#E1DCDC] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-[#888888] flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#43866B]" />
            <span>
              {currentDraftId ? 'Editing saved draft record' : 'Ready for publication or draft save'}
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 rounded-[10px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4] transition-colors"
            >
              Discard
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-xs font-semibold text-[#333333] transition-colors flex items-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5 text-[#666666]" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="px-6 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-bold hover:bg-[#333333] transition-colors shadow-xs flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Publishing...' : 'Create Project'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* SECTION 11: Drafts Management Modal */}
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
                className="p-1 rounded-[8px] text-[#888888] hover:text-[#333333] hover:bg-[#E8E4E4] transition-colors"
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
                        className="px-3 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit / Continue</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#B65F65] hover:bg-black/5"
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
