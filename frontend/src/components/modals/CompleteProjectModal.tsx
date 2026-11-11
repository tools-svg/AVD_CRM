import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { ProjectItem } from '../../types';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';

interface CompleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectItem;
  onSuccess: () => void;
}

export const CompleteProjectModal: React.FC<CompleteProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [force, setForce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const unfinishedModules = project.modules.filter(m => m.status !== 'Closed');

  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await api.completeProject(project.id, force);
      toast.success('Project Completed', `Project '${project.title}' marked as Closed!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to complete project');
      toast.error('Completion Failed', e.message || 'Failed to complete project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-[#43866B]" />
            <h3 className="text-sm font-bold text-[#333333]">Complete Project</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#888888] hover:bg-[#E8E4E4]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#333333] leading-relaxed">
            Are you sure you want to mark <strong>{project.title}</strong> as <strong>Closed</strong>?
          </p>

          {unfinishedModules.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#F4E9D2]/50 border border-[#A78645]/30 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-[#A78645]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Notice: {unfinishedModules.length} unfinished module(s) remain</span>
              </div>
              <ul className="text-[11px] text-[#666666] list-disc list-inside space-y-0.5">
                {unfinishedModules.slice(0, 3).map(m => (
                  <li key={m.id} className="truncate">{m.name} ({m.status})</li>
                ))}
                {unfinishedModules.length > 3 && (
                  <li>...and {unfinishedModules.length - 3} more</li>
                )}
              </ul>

              <label className="flex items-center space-x-2 mt-2 pt-2 border-t border-[#A78645]/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={e => setForce(e.target.checked)}
                  className="rounded text-[#0A0A0A] focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-[#333333] font-medium">
                  Confirm closing project despite unfinished modules
                </span>
              </label>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-[#F5DEDE] text-[#B65F65] text-xs">
              {errorMessage}
            </div>
          )}

          <div className="pt-3 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#E1DCDC] text-xs font-medium text-[#666666] hover:bg-[#F5F3F4]"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={isSubmitting || (unfinishedModules.length > 0 && !force)}
              className="px-5 py-2 rounded-lg bg-[#43866B] text-white text-xs font-semibold hover:bg-[#346d56] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Closing...' : 'Confirm Completion'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

