import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Edit3, 
  Share2, 
  MessageSquare, 
  Paperclip, 
  Calendar, 
  User as UserIcon, 
  CheckCircle2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { GlobalNavbar } from '../../components/navigation/GlobalNavbar';
import { BackToTop } from '../../components/navigation/BackToTop';
import { PreviewPanel, PreviewMode } from '../../components/preview/PreviewPanel';
import { InteractiveGantt } from '../../components/gantt/InteractiveGantt';
import { ModuleUpdateModal } from '../../components/modals/ModuleUpdateModal';
import { ShareProjectModal } from '../../components/modals/ShareProjectModal';
import { CompleteProjectModal } from '../../components/modals/CompleteProjectModal';
import { DeveloperUIEditorModal } from '../../components/modals/DeveloperUIEditorModal';
import { ProjectDeleteModal } from '../../components/modals/ProjectDeleteModal';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/NotificationContext';
import { ProjectItem, ModuleItem, ModuleUpdateRecord, AttachmentRecord, User } from '../../types';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';

export const ProjectDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [selectedModule, setSelectedModule] = useState<ModuleItem | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('default');
  const [updates, setUpdates] = useState<ModuleUpdateRecord[]>([]);
  const [images, setImages] = useState<AttachmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [activeUpdateModule, setActiveUpdateModule] = useState<ModuleItem | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Employee Assignment & Removal States (Requirement 1 & 2)
  const [empToRemove, setEmpToRemove] = useState<any | null>(null);
  const [isRemovingEmp, setIsRemovingEmp] = useState(false);
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [empToAddId, setEmpToAddId] = useState<number | ''>('');
  const [isAddingEmp, setIsAddingEmp] = useState(false);

  // New module quick add draft (Section 8: Inherits project assigned employee automatically)
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [usersList, setUsersList] = useState<User[]>([]);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getProject(Number(id));
      setProject(data);
    } catch (e: any) {
      toast.error('Error Loading Project', e.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
    api.getUsers().then(setUsersList).catch(() => {});
  }, [id]);

  // Handle Comment Icon Click (Fetches and switches to Description History Preview)
  const handleCommentIconClick = async (e: React.MouseEvent, mod: ModuleItem) => {
    e.stopPropagation();
    setSelectedModule(mod);
    setPreviewMode('description');
    try {
      const descList = await api.getModuleUpdates(mod.id);
      setUpdates(descList);
    } catch (err: any) {
      toast.error('Failed to Load History', err.message);
    }
  };

  // Handle Pin Icon Click (Fetches and switches to Image Preview)
  const handlePinIconClick = async (e: React.MouseEvent, mod: ModuleItem) => {
    e.stopPropagation();
    setSelectedModule(mod);
    setPreviewMode('images');
    try {
      const imgList = await api.getModuleImages(mod.id);
      setImages(imgList);
    } catch (err: any) {
      toast.error('Failed to Load Images', err.message);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim() || !project) return;
    try {
      await api.createModule({
        project_id: project.id,
        name: newModuleName,
        description: newModuleDesc,
        status: 'Not Started',
        priority: 'Medium',
        progress: 0.0,
      });
      toast.success('Module Created', `Work module '${newModuleName}' added successfully!`);
      setNewModuleName('');
      setNewModuleDesc('');
      setIsAddModuleModalOpen(false);
      loadProject();
    } catch (err: any) {
      toast.error('Module Creation Failed', err.message || 'Failed to add module');
    }
  };

  const handleRemoveEmployeeFromProject = async () => {
    if (!project || !empToRemove) return;
    setIsRemovingEmp(true);
    try {
      const res = await api.removeEmployeeFromProject(project.id, empToRemove.id);
      toast.success('Employee Removed', res.message || `Removed ${empToRemove.full_name} from project.`);
      setEmpToRemove(null);
      loadProject();
    } catch (err: any) {
      toast.error('Removal Failed', err.message || 'Failed to remove employee from project');
    } finally {
      setIsRemovingEmp(false);
    }
  };

  const handleAddEmployeeToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !empToAddId) return;
    setIsAddingEmp(true);
    try {
      const updated = await api.addEmployeeToProject(project.id, Number(empToAddId));
      toast.success('Employee Assigned', 'Employee assigned to project successfully!');
      setIsAddEmpModalOpen(false);
      setEmpToAddId('');
      setProject(updated);
    } catch (err: any) {
      toast.error('Assignment Failed', err.message || 'Failed to assign employee to project');
    } finally {
      setIsAddingEmp(false);
    }
  };

  const canEdit = user?.role_name !== 'Employee';
  const canShare = ['Developer', 'Director'].includes(user?.role_name || '');
  const canDelete = ['Developer', 'Director'].includes(user?.role_name || '');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex items-center justify-center">
        <p className="text-xs text-[#888888]">Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex flex-col items-center justify-center">
        <p className="text-sm font-semibold text-[#333333] mb-3">Project not found or access denied.</p>
        <button
          onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-lg bg-[#0A0A0A] text-white text-xs"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const statusColor = STATUS_CONFIG[project.status] || STATUS_CONFIG['In Progress'];
  const priorityColor = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG['Medium'];

  return (
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col">
      <GlobalNavbar />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 space-y-4">
        {/* Project Heading Card */}
        <section className="bg-[#FFFFFF] rounded-[14px] p-6 border border-[#E1DCDC] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-[#0A0A0A]">{project.title}</h1>
              <span
                style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              >
                {project.status}
              </span>
              <span
                style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              >
                {project.priority}
              </span>
            </div>

            <p className="text-xs text-[#666666] max-w-2xl leading-relaxed">
              {project.description || 'No detailed charter provided.'}
            </p>

            <div className="flex items-center space-x-4 text-xs text-[#888888] pt-1">
              <span>Sub-company: <strong className="text-[#333333]">{project.company_name}</strong></span>
              <span>•</span>
              <span>Lead: <strong className="text-[#333333]">{project.lead_name || 'Unassigned'}</strong></span>
              <span>•</span>
              <span>Progress: <strong className="text-[#43866B]">{project.progress}%</strong></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canShare && (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="px-3 py-1.5 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] text-xs font-semibold border border-[#E1DCDC] flex items-center space-x-1.5 transition-colors"
                title="Public Share Link"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Public</span>
              </button>
            )}

            <button
              onClick={() => setIsAddModuleModalOpen(true)}
              className="px-3 py-1.5 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] text-xs font-semibold border border-[#E1DCDC] flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Module</span>
            </button>

            {canEdit && (
              <button
                onClick={() => navigate(`/projects/${project.id}/update`)}
                className="px-3 py-1.5 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Project</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3 py-1.5 rounded-[10px] bg-[#F5DEDE] hover:bg-[#ebcece] text-[#A93232] text-xs font-semibold border border-[#B65F65]/30 flex items-center space-x-1.5 transition-colors"
                title="Delete Project (Requires exact name confirmation)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </section>

        {/* SECTION: Assigned Team & Employee Management (Requirement 1 & 2) */}
        <section className="bg-[#FFFFFF] rounded-[14px] p-4 border border-[#E1DCDC] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0A0A0A] uppercase tracking-wider flex-shrink-0">
              <UserIcon className="w-4 h-4 text-[#5269A8]" />
              <span>Assigned Team ({project.assigned_employees?.length || 0}):</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {project.assigned_employees && project.assigned_employees.length > 0 ? (
                project.assigned_employees.map(emp => (
                  <div
                    key={emp.id}
                    className="flex items-center space-x-2 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] pl-2 pr-1.5 py-1 text-xs transition-colors hover:border-[#888888]"
                  >
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover border border-[#E1DCDC]" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-bold">
                        {emp.full_name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span className="font-semibold text-[#0A0A0A]">{emp.full_name}</span>
                    <span className="text-[10px] text-[#666666]">({emp.role_name})</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEmpToRemove(emp)}
                        className="p-1 text-[#888888] hover:text-[#DC2626] rounded hover:bg-black/5 transition-colors ml-0.5"
                        title={`Remove ${emp.full_name} from this project`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-[#888888] italic">No employees assigned yet</span>
              )}
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsAddEmpModalOpen(true)}
              className="px-3 py-1.5 rounded-[8px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-xs font-semibold text-[#0A0A0A] flex items-center space-x-1.5 self-start md:self-auto transition-colors flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Employee</span>
            </button>
          )}
        </section>

        {/* SECTION 9: Layout 75% Module List / 25% Preview Panel */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left 75%: Module List & Gantt Chart */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#E1DCDC] shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#333333]">
                  Project Modules ({project.modules.length})
                </h3>
                <span className="text-xs text-[#888888]">
                  Click 💬 for description history or 📌 for images
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F3F4]/50 border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                    <tr>
                      <th className="py-2.5 px-4">Module Name</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Assignee</th>
                      <th className="py-2.5 px-3">Deadline</th>
                      <th className="py-2.5 px-3 text-center">History (💬)</th>
                      <th className="py-2.5 px-3 text-center">Images (📌)</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F3F4]">
                    {project.modules.map(mod => {
                      const modStatusColor = STATUS_CONFIG[mod.status] || STATUS_CONFIG['In Progress'];
                      const modPriorityColor = PRIORITY_CONFIG[mod.priority] || PRIORITY_CONFIG['Medium'];
                      const isSelected = selectedModule?.id === mod.id;

                      return (
                        <tr
                          key={mod.id}
                          className={`hover:bg-[#F9F9F9] transition-colors ${
                            isSelected ? 'bg-[#DCE4FA]/20' : ''
                          }`}
                        >
                          {/* Module Name */}
                          <td className="py-3 px-4 font-semibold text-[#333333] max-w-xs">
                            <div className="truncate font-semibold text-xs">{mod.name}</div>
                            <div className="text-[10px] text-[#888888] truncate max-w-xs">
                              {mod.description || 'No initial description'}
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-3">
                            <span
                              style={{ backgroundColor: modPriorityColor.bg, color: modPriorityColor.text }}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            >
                              {mod.priority}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <span
                              style={{ backgroundColor: modStatusColor.bg, color: modStatusColor.text }}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                            >
                              {mod.status}
                            </span>
                          </td>

                          {/* Assignee */}
                          <td className="py-3 px-3 text-[#333333] whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              {mod.assigned_to_avatar ? (
                                <img src={mod.assigned_to_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-[#E8E4E4] text-[#666666] flex items-center justify-center text-[10px] font-bold">
                                  {mod.assigned_to_name?.charAt(0) || 'U'}
                                </span>
                              )}
                              <span className="text-xs truncate max-w-[100px]">{mod.assigned_to_name || 'Unassigned'}</span>
                            </div>
                          </td>

                          {/* Deadline */}
                          <td className="py-3 px-3 text-[#666666] whitespace-nowrap text-[11px]">
                            {mod.deadline
                              ? new Date(mod.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : 'No deadline'}
                          </td>

                          {/* SECTION 9.1: Comment Icon – Description History Preview */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={e => handleCommentIconClick(e, mod)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSelected && previewMode === 'description'
                                  ? 'bg-[#5269A8] text-white border-[#5269A8]'
                                  : 'bg-[#F5F3F4] text-[#5269A8] hover:bg-[#DCE4FA] border-[#E1DCDC]'
                              }`}
                              title="View Description History in Preview Panel"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </td>

                          {/* SECTION 9.2: Pin Icon – Image Attachments Preview */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={e => handlePinIconClick(e, mod)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSelected && previewMode === 'images'
                                  ? 'bg-[#B65F65] text-white border-[#B65F65]'
                                  : 'bg-[#F5F3F4] text-[#B65F65] hover:bg-[#F5DEDE] border-[#E1DCDC]'
                              }`}
                              title="View Image Attachments in Preview Panel"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                          </td>

                          {/* Update Button */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setActiveUpdateModule(mod)}
                              className="px-2.5 py-1 rounded-lg bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold transition-colors"
                            >
                              Post Update
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {project.modules.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-xs text-[#888888]">
                          No modules created yet. Click "+ Add Module" to create work packages.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 9.5: Project Gantt Chart */}
            <InteractiveGantt projectId={project.id} />
          </div>

          {/* Right 25%: Preview Panel with Open Button */}
          <div className="lg:col-span-1">
            <PreviewPanel
              project={project}
              selectedModule={selectedModule}
              previewMode={previewMode}
              updates={updates}
              images={images}
            />
          </div>
        </section>

        {/* Quick Add Module Modal */}
        {isAddModuleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 border border-[#E1DCDC] shadow-2xl w-full max-w-md space-y-4">
              <h3 className="text-sm font-bold text-[#333333]">Add Work Module</h3>
              <form onSubmit={handleCreateModule} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
                    Module Title *
                  </label>
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={e => setNewModuleName(e.target.value)}
                    placeholder="e.g. Implement Verification Layer"
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-lg px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
                    Initial Description
                  </label>
                  <textarea
                    rows={3}
                    value={newModuleDesc}
                    onChange={e => setNewModuleDesc(e.target.value)}
                    placeholder="Brief description of requirements..."
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] p-3 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModuleModalOpen(false)}
                    className="px-3 py-1.5 rounded-[10px] border border-[#E1DCDC] text-xs text-[#666666]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333]"
                  >
                    Add Module
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* GitHub-Style Project Deletion Modal (Section 13) */}
        {isDeleteModalOpen && project && (
          <ProjectDeleteModal
            isOpen={true}
            onClose={() => setIsDeleteModalOpen(false)}
            project={project}
            onDeleted={() => navigate('/home')}
          />
        )}

        {/* Module Update Popup */}
        {activeUpdateModule && (
          <ModuleUpdateModal
            isOpen={true}
            onClose={() => setActiveUpdateModule(null)}
            module={activeUpdateModule}
            onUpdateSubmitted={() => {
              loadProject();
              if (selectedModule?.id === activeUpdateModule.id) {
                if (previewMode === 'description') {
                  api.getModuleUpdates(activeUpdateModule.id).then(setUpdates);
                } else if (previewMode === 'images') {
                  api.getModuleImages(activeUpdateModule.id).then(setImages);
                }
              }
            }}
          />
        )}

        {/* Public Share Modal */}
        <ShareProjectModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          project={project}
          onUpdated={loadProject}
        />

        {/* Complete Project Modal */}
        <CompleteProjectModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          project={project}
          onSuccess={loadProject}
        />

        {/* CONFIRM REMOVE EMPLOYEE FROM PROJECT MODAL (Requirement 1 & 2) */}
        {empToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#FEF2F2] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#DC2626]">
                  <Trash2 className="w-4 h-4 flex-shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Remove Employee from Project
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isRemovingEmp}
                  onClick={() => setEmpToRemove(null)}
                  className="p-1 text-[#888888] hover:text-[#0A0A0A] rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p className="text-[#333333] leading-relaxed">
                  Are you sure you want to remove <strong>{empToRemove.full_name}</strong> from <strong>{project.title}</strong>?
                </p>
                <div className="p-3 bg-[#FFFBEB] rounded-[10px] border border-[#FDE68A] text-[#B45309] text-[11px] leading-relaxed">
                  They will be unassigned from work modules in this project. Project historical updates and logs remain preserved.
                </div>

                <div className="pt-2 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    disabled={isRemovingEmp}
                    onClick={() => setEmpToRemove(null)}
                    className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isRemovingEmp}
                    onClick={handleRemoveEmployeeFromProject}
                    className="px-4 py-1.5 rounded-[8px] bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C] flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isRemovingEmp ? 'Removing...' : 'Remove Employee'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGN EMPLOYEE TO PROJECT MODAL */}
        {isAddEmpModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#0A0A0A]">
                  <Plus className="w-4 h-4 text-[#5269A8]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">
                    Assign Employee to Project
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isAddingEmp}
                  onClick={() => setIsAddEmpModalOpen(false)}
                  className="p-1 text-[#888888] hover:text-[#0A0A0A] rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddEmployeeToProject} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1.5">
                    Select Member *
                  </label>
                  <select
                    required
                    value={empToAddId}
                    onChange={e => setEmpToAddId(Number(e.target.value))}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                  >
                    <option value="">-- Choose employee to assign --</option>
                    {usersList
                      .filter(u => u.is_active && !project.assigned_employee_ids?.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} (@{u.username}) — {u.role_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    disabled={isAddingEmp}
                    onClick={() => setIsAddEmpModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingEmp || !empToAddId}
                    className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white text-xs font-bold hover:bg-[#333333] disabled:opacity-50"
                  >
                    {isAddingEmp ? 'Assigning...' : 'Assign to Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <BackToTop />
      <DeveloperUIEditorModal />
    </div>
  );
};

