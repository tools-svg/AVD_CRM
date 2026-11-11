import React, { useState } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { ProjectItem } from '../../types';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';

interface ProjectDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectItem;
  onDeleted: () => void;
}

export const ProjectDeleteModal: React.FC<ProjectDeleteModalProps> = ({
  isOpen,
  onClose,
  project,
  onDeleted,
}) => {
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatch = typedName.trim() === project.title.trim();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await api.deleteProject(project.id, typedName.trim());
      toast.success('Project Deleted', `Project '${project.title}' deleted successfully.`);
      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete project');
      toast.error('Deletion Failed', err.message || 'Failed to delete project');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] rounded-[18px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#F5DEDE]/40 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#A93232]">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold">Delete Project Confirmation</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#888888] hover:text-[#333333] hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-[10px] bg-[#F5DEDE] border border-[#B65F65]/30 text-[#B65F65] text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <div className="text-xs text-[#555555] space-y-2 leading-relaxed">
            <p>
              This action <strong className="text-[#A93232]">cannot be undone</strong>. This will permanently soft-delete the project, archive all linked modules ({project.modules?.length || 0} modules), and revoke active public share tokens.
            </p>
            <div className="p-3 bg-[#F5F3F4] rounded-[10px] border border-[#E1DCDC]">
              <span className="text-[10px] font-bold text-[#888888] uppercase block">
                Target Project:
              </span>
              <p className="font-semibold text-xs text-[#0A0A0A] select-all mt-0.5">
                {project.title}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1.5">
              Please type <span className="font-mono font-bold text-[#A93232] select-all">{project.title}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Type the exact project title..."
              className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3.5 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#A93232] focus:bg-white font-medium"
              autoFocus
            />
          </div>

          <div className="pt-2 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[10px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || isDeleting}
              className={`px-4 py-2 rounded-[10px] text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs ${
                isMatch && !isDeleting
                  ? 'bg-[#A93232] text-white hover:bg-[#8B2525] cursor-pointer'
                  : 'bg-[#E8E4E4] text-[#888888] cursor-not-allowed border border-[#E1DCDC]'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

