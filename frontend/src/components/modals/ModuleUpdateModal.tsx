import React, { useState, useRef } from 'react';
import { X, Paperclip, Check, Loader2 } from 'lucide-react';
import { ModuleItem } from '../../types';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';

interface ModuleUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: ModuleItem;
  onUpdateSubmitted: () => void;
}

export const ModuleUpdateModal: React.FC<ModuleUpdateModalProps> = ({
  isOpen,
  onClose,
  module,
  onUpdateSubmitted,
}) => {
  const [descriptionText, setDescriptionText] = useState('');
  const [statusChange, setStatusChange] = useState<string>(module.status);
  const [progressChange, setProgressChange] = useState<number>(module.progress);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const oversized = filesArray.some(f => f.size > 20 * 1024 * 1024);
      if (oversized) {
        setErrorMessage('One or more selected files exceed the 20MB limit');
        return;
      }
      setSelectedFiles(prev => [...prev, ...filesArray]);
      setErrorMessage(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descriptionText.trim()) {
      setErrorMessage('Please enter an update description');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('description_text', descriptionText);
      formData.append('status_change', statusChange);
      formData.append('progress_change', progressChange.toString());

      for (const file of selectedFiles) {
        formData.append('files', file);
      }

      await api.postModuleUpdate(module.id, formData);
      toast.success('Update Submitted', `Telemetry and update posted for module '${module.name}'!`);
      onUpdateSubmitted();
      onClose();
    } catch (err: any) {
      // Do not lose user input when an upload or submission fails (Section 15)
      setErrorMessage(err.message || 'Failed to submit update');
      toast.error('Update Failed', err.message || 'Failed to submit module update');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <span className="text-xs font-bold text-[#0A0A0A]">Module Update</span>
            <span className="text-xs text-[#888888]">•</span>
            <span className="text-xs font-semibold text-[#5269A8] truncate max-w-xs">{module.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] text-[#888888] hover:text-[#333333] hover:bg-[#E8E4E4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SECTION 15: Compact Two-Row Layout */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {errorMessage && (
            <div className="p-2.5 rounded-[10px] bg-[#F5DEDE] text-[#B65F65] text-xs font-medium border border-[#B65F65]/20">
              {errorMessage}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelection}
            multiple
            className="hidden"
          />

          {/* First Row: Description Input Area on left + Choose File button at end of same row */}
          <div className="flex items-start space-x-2">
            <textarea
              rows={1}
              value={descriptionText}
              onChange={e => setDescriptionText(e.target.value)}
              placeholder="Enter module progress note or description update..."
              className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3.5 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A] focus:bg-white resize-y min-h-[38px] max-h-28 leading-relaxed font-medium transition-colors"
              required
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-[38px] px-3.5 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] text-xs font-semibold text-[#333333] flex items-center space-x-1.5 flex-shrink-0 transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#666666]" />
              <span>Choose File</span>
            </button>
          </div>

          {/* Selected Files Preview Chips (if any) */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-0.5">
              {selectedFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E8E4E4] text-[#333333] border border-[#E1DCDC]"
                >
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="hover:text-[#B65F65] ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Second Row: Status Selection + Progress % + Submit Button */}
          <div className="flex items-center space-x-2.5 pt-1">
            {/* Status Dropdown */}
            <div className="w-36 flex-shrink-0">
              <select
                value={statusChange}
                onChange={e => setStatusChange(e.target.value)}
                className="w-full h-[38px] bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-2.5 text-xs font-semibold text-[#333333] focus:outline-none focus:border-[#0A0A0A] cursor-pointer"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Progress % input */}
            <div className="flex-1 flex items-center space-x-2 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[10px] px-3 h-[38px]">
              <span className="text-[11px] font-semibold text-[#888888] whitespace-nowrap">Progress:</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressChange}
                onChange={e => setProgressChange(Number(e.target.value))}
                className="w-full accent-[#0A0A0A] cursor-pointer"
              />
              <span className="text-xs font-bold text-[#0A0A0A] min-w-[32px] text-right">
                {progressChange}%
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[38px] px-5 rounded-[10px] bg-[#0A0A0A] text-white hover:bg-[#333333] text-xs font-bold flex items-center space-x-1.5 flex-shrink-0 shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
