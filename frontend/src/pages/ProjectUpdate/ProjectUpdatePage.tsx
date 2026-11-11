import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit2, 
  Paperclip, 
  CheckCircle, 
  Clock, 
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { GlobalNavbar } from '../../components/navigation/GlobalNavbar';
import { BackToTop } from '../../components/navigation/BackToTop';
import { StickyNotesPanel } from '../../components/sticky-notes/StickyNotesPanel';
import { ModuleUpdateModal } from '../../components/modals/ModuleUpdateModal';
import { CompleteProjectModal } from '../../components/modals/CompleteProjectModal';
import { DescriptionModal } from '../../components/preview/DescriptionModal';
import { ImageCarouselModal } from '../../components/preview/ImageCarouselModal';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/NotificationContext';
import { ProjectItem, ModuleItem, ModuleUpdateRecord, AttachmentRecord } from '../../types';
import { api } from '../../services/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../config/theme';

export const ProjectUpdatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Active module for posting update
  const [activeUpdateModule, setActiveUpdateModule] = useState<ModuleItem | null>(null);

  // Large preview modals
  const [previewUpdates, setPreviewUpdates] = useState<ModuleUpdateRecord[]>([]);
  const [previewImages, setPreviewImages] = useState<AttachmentRecord[]>([]);
  const [previewModuleName, setPreviewModuleName] = useState('');
  const [isDescModalOpen, setIsDescModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Complete Project confirmation modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  const loadProject = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getProject(Number(id));
      setProject(data);
    } catch (e: any) {
      toast.error('Failed to load project', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleOpenDescModal = async (mod: ModuleItem) => {
    setPreviewModuleName(mod.name);
    try {
      const list = await api.getModuleUpdates(mod.id);
      setPreviewUpdates(list);
      setIsDescModalOpen(true);
    } catch (e: any) {
      toast.error('Failed to load updates', e.message);
    }
  };

  const handleOpenImageModal = async (mod: ModuleItem) => {
    setPreviewModuleName(mod.name);
    try {
      const list = await api.getModuleImages(mod.id);
      setPreviewImages(list);
      setIsImageModalOpen(true);
    } catch (e: any) {
      toast.error('Failed to load images', e.message);
    }
  };

  const canComplete = ['Developer', 'Director', 'Project Manager', 'Manager'].includes(user?.role_name || '');

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#EBE5E5] flex items-center justify-center">
        <p className="text-xs text-[#888888]">Loading project stream...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col">
      <GlobalNavbar />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* Navigation Breadcrumb (Back navigation handled via top logo per Section 12) */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-[#888888]">Project Stream</span>
          <span className="text-xs text-[#888888]">/</span>
          <span className="text-xs font-semibold text-[#333333]">{project.title}</span>
        </div>

        {/* Section 12: 75% Left Work Updates / 25% Right Sticky Notes */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
          {/* Left 75%: Project & Module Updates */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-[#FFFFFF] rounded-[14px] p-6 border border-[#E1DCDC] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
                  Update Control • {project.company_name}
                </span>
                <h1 className="text-lg font-bold text-[#0A0A0A] mt-0.5">{project.title}</h1>
                <p className="text-xs text-[#666666] mt-1 line-clamp-2">
                  {project.description || 'Provide updates and complete milestones below.'}
                </p>
              </div>

              <div className="flex items-center space-x-3 text-right">
                <div>
                  <span className="text-[10px] text-[#888888] block">Aggregate Progress</span>
                  <span className="text-base font-bold text-[#43866B]">{project.progress}%</span>
                </div>
              </div>
            </div>

            {/* Modules Update Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#333333] uppercase tracking-wider px-1">
                Active Modules & Engineering Telemetry
              </h3>

              {project.modules.map(mod => {
                const statusColor = STATUS_CONFIG[mod.status] || STATUS_CONFIG['In Progress'];
                const priorityColor = PRIORITY_CONFIG[mod.priority] || PRIORITY_CONFIG['Medium'];

                return (
                  <div
                    key={mod.id}
                    className="bg-[#FFFFFF] rounded-2xl p-5 border border-[#E1DCDC] shadow-sm hover:border-[#888888] transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-[#333333]">{mod.name}</h4>
                        <span
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        >
                          {mod.status}
                        </span>
                        <span
                          style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        >
                          {mod.priority}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Comment Icon (Description History) */}
                        <button
                          onClick={() => handleOpenDescModal(mod)}
                          className="p-1.5 rounded-lg bg-[#F5F3F4] text-[#5269A8] hover:bg-[#DCE4FA] border border-[#E1DCDC] text-xs font-medium flex items-center space-x-1"
                          title="View Description History"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">{mod.updates_count}</span>
                        </button>

                        {/* Pin Icon (Image Preview) */}
                        <button
                          onClick={() => handleOpenImageModal(mod)}
                          className="p-1.5 rounded-lg bg-[#F5F3F4] text-[#B65F65] hover:bg-[#F5DEDE] border border-[#E1DCDC] text-xs font-medium flex items-center space-x-1"
                          title="View Attached Images"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-semibold">{mod.attachments_count}</span>
                        </button>

                        {/* Pen / Edit Icon (Opens Module Update Popup) */}
                        <button
                          onClick={() => setActiveUpdateModule(mod)}
                          className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-semibold flex items-center space-x-1 shadow-xs"
                          title="Post new update"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Update</span>
                        </button>
                      </div>
                    </div>

                    {/* Latest Description Text */}
                    <div className="p-3 rounded-xl bg-[#F5F3F4] border border-[#E1DCDC] text-xs text-[#333333] leading-relaxed">
                      <span className="text-[10px] font-bold text-[#888888] uppercase block mb-1">
                        Latest Description / State:
                      </span>
                      {mod.description || 'No description recorded yet.'}
                    </div>

                    {/* Module Meta */}
                    <div className="flex items-center justify-between text-[11px] text-[#888888] pt-1">
                      <span>Assigned: <strong className="text-[#333333]">{mod.assigned_to_name || 'Unassigned'}</strong></span>
                      <span>Progress: <strong className="text-[#43866B]">{mod.progress}%</strong></span>
                      <span>Deadline: {mod.deadline ? new Date(mod.deadline).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Section 12: Complete Project Button */}
            {canComplete && project.status !== 'Closed' && (
              <div className="p-4 bg-[#FFFFFF] rounded-2xl border border-[#E1DCDC] shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#333333]">Project Finalization</h4>
                  <p className="text-[11px] text-[#888888]">
                    Verify outstanding deliverables and transition this project to Closed.
                  </p>
                </div>

                <button
                  onClick={() => setIsCompleteModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#43866B] hover:bg-[#346d56] text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Project</span>
                </button>
              </div>
            )}
          </div>

          {/* Right 25%: Personal Sticky Notes */}
          <div className="lg:col-span-1">
            <StickyNotesPanel />
          </div>
        </section>

        {/* Modals */}
        {activeUpdateModule && (
          <ModuleUpdateModal
            isOpen={true}
            onClose={() => setActiveUpdateModule(null)}
            module={activeUpdateModule}
            onUpdateSubmitted={loadProject}
          />
        )}

        <CompleteProjectModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          project={project}
          onSuccess={() => {
            loadProject();
            navigate('/home');
          }}
        />

        <DescriptionModal
          isOpen={isDescModalOpen}
          onClose={() => setIsDescModalOpen(false)}
          moduleName={previewModuleName}
          updates={previewUpdates}
        />

        <ImageCarouselModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          moduleName={previewModuleName}
          images={previewImages}
        />
      </main>

      <BackToTop />
    </div>
  );
};

