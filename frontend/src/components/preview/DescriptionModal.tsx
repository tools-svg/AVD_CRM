import React from 'react';
import { X, MessageSquare, Clock } from 'lucide-react';
import { ModuleUpdateRecord } from '../../types';

interface DescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  updates: ModuleUpdateRecord[];
}

export const DescriptionModal: React.FC<DescriptionModalProps> = ({
  isOpen,
  onClose,
  moduleName,
  updates,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E1DCDC] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E1DCDC] text-[#5269A8]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#333333]">Description History</h3>
              <p className="text-xs text-[#888888] truncate max-w-md">{moduleName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#888888] hover:text-[#333333] hover:bg-[#E8E4E4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat / Message Bubbles Area (WhatsApp Style with Neutral Planex Palette) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F5F3F4]/50">
          {updates.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#888888]">
              No historical descriptions recorded for this module yet.
            </div>
          ) : (
            updates.map((u, idx) => {
              const isLatest = idx === updates.length - 1;
              return (
                <div key={u.id} className="flex flex-col space-y-1 max-w-[85%]">
                  {/* Author Header */}
                  <div className="flex items-center space-x-2 px-1">
                    <span className="text-[11px] font-semibold text-[#0A0A0A]">
                      {u.user_name}
                    </span>
                    <span className="text-[10px] text-[#888888] flex items-center">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      {new Date(u.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] font-bold text-[#43866B] bg-[#D9EEE5] px-1.5 py-0.2 rounded-full">
                        Latest
                      </span>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border shadow-xs ${
                    isLatest 
                      ? 'bg-[#FFFFFF] border-[#E1DCDC] text-[#333333]' 
                      : 'bg-[#E8E4E4]/60 border-[#E1DCDC]/60 text-[#444444]'
                  }`}>
                    <p className="whitespace-pre-wrap">{u.description_text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E1DCDC] bg-[#FFFFFF] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-medium hover:bg-[#333333] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

