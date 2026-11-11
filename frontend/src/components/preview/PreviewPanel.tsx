import React, { useState } from 'react';
import { 
  Maximize2, 
  MessageSquare, 
  Paperclip, 
  Image as ImageIcon, 
  Clock, 
  FileText,
  User as UserIcon,
  FolderKanban
} from 'lucide-react';
import { ModuleItem, ModuleUpdateRecord, AttachmentRecord, ProjectItem } from '../../types';
import { DescriptionModal } from './DescriptionModal';
import { ImageCarouselModal } from './ImageCarouselModal';

export type PreviewMode = 'default' | 'description' | 'images';

interface PreviewPanelProps {
  project?: ProjectItem | null;
  selectedModule?: ModuleItem | null;
  previewMode: PreviewMode;
  updates: ModuleUpdateRecord[];
  images: AttachmentRecord[];
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  project,
  selectedModule,
  previewMode,
  updates,
  images,
}) => {
  const [isDescModalOpen, setIsDescModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const handleOpenModal = () => {
    if (previewMode === 'description') {
      setIsDescModalOpen(true);
    } else if (previewMode === 'images') {
      setIsImageModalOpen(true);
    }
  };

  return (
    <div className="bg-[#FFFFFF] rounded-2xl border border-[#E1DCDC] shadow-sm flex flex-col h-full min-h-[440px] overflow-hidden">
      {/* Preview Panel Top Header */}
      <div className="px-4 py-3 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {previewMode === 'description' ? (
            <MessageSquare className="w-4 h-4 text-[#5269A8]" />
          ) : previewMode === 'images' ? (
            <ImageIcon className="w-4 h-4 text-[#B65F65]" />
          ) : (
            <FolderKanban className="w-4 h-4 text-[#0A0A0A]" />
          )}
          <span className="text-xs font-bold text-[#333333]">
            {previewMode === 'description'
              ? 'Description History'
              : previewMode === 'images'
              ? 'Image Attachments'
              : 'Project Overview'}
          </span>
        </div>

        {/* "Open" Button to Expand to Large Modal */}
        {previewMode !== 'default' && (
          <button
            onClick={handleOpenModal}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] transition-colors shadow-xs"
            title="Open large preview modal"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Open</span>
          </button>
        )}
      </div>

      {/* Panel Content Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Mode 1: Description History Preview (Comment Icon clicked) */}
        {previewMode === 'description' && selectedModule && (
          <div className="space-y-3">
            <div className="pb-2 border-b border-[#E1DCDC]">
              <h4 className="text-xs font-bold text-[#333333]">{selectedModule.name}</h4>
              <p className="text-[11px] text-[#888888]">{updates.length} historical update(s)</p>
            </div>

            {updates.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#888888]">
                No updates or historical descriptions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {updates.map((u, i) => {
                  const isLatest = i === updates.length - 1;
                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-xl border text-xs ${
                        isLatest
                          ? 'bg-[#F5F3F4] border-[#E1DCDC] shadow-xs'
                          : 'bg-white border-[#E1DCDC]/60 text-[#666666]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-[#0A0A0A] text-[11px]">{u.user_name}</span>
                        <span className="text-[10px] text-[#888888]">
                          {new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="leading-relaxed line-clamp-4">{u.description_text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Image Attachments Preview (Pin Icon clicked) */}
        {previewMode === 'images' && selectedModule && (
          <div className="space-y-3">
            <div className="pb-2 border-b border-[#E1DCDC]">
              <h4 className="text-xs font-bold text-[#333333]">{selectedModule.name}</h4>
              <p className="text-[11px] text-[#888888]">{images.length} image attachment(s)</p>
            </div>

            {images.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#888888]">
                No images attached to this module.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => setIsImageModalOpen(true)}
                    className="relative rounded-lg overflow-hidden border border-[#E1DCDC] group cursor-pointer aspect-video bg-[#F5F3F4] flex items-center justify-center"
                  >
                    <img
                      src={img.file_path}
                      alt={img.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold">
                      View
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode 3: Default Project Summary */}
        {previewMode === 'default' && project && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-[#888888] tracking-wider">Company</span>
              <p className="text-xs font-semibold text-[#333333]">{project.company_name}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-[#888888] tracking-wider">Project Objective</span>
              <p className="text-xs text-[#444444] leading-relaxed mt-1">
                {project.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E1DCDC]">
              <div>
                <span className="text-[10px] text-[#888888]">Lead</span>
                <p className="text-xs font-semibold text-[#333333]">{project.lead_name || 'Unassigned'}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#888888]">Progress</span>
                <p className="text-xs font-semibold text-[#43866B]">{project.progress}%</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F3F4] border border-[#E1DCDC] text-[11px] text-[#666666]">
              💡 <em>Tip: Click the <strong>Comment icon</strong> on any module row to view historical description updates, or the <strong>Pin icon</strong> to preview attached diagrams and images.</em>
            </div>
          </div>
        )}
      </div>

      {/* Large Modals */}
      {selectedModule && (
        <>
          <DescriptionModal
            isOpen={isDescModalOpen}
            onClose={() => setIsDescModalOpen(false)}
            moduleName={selectedModule.name}
            updates={updates}
          />
          <ImageCarouselModal
            isOpen={isImageModalOpen}
            onClose={() => setIsImageModalOpen(false)}
            moduleName={selectedModule.name}
            images={images}
          />
        </>
      )}
    </div>
  );
};

