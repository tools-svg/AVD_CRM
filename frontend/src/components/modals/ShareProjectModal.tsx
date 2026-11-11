import React, { useState } from 'react';
import { X, Share2, Copy, Check, Ban, ExternalLink } from 'lucide-react';
import { ProjectItem } from '../../types';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectItem;
  onUpdated: () => void;
}

export const ShareProjectModal: React.FC<ShareProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdated,
}) => {
  const [token, setToken] = useState<string | null>(project.share_token || null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const publicUrl = token ? `${window.location.origin}/public/project/${token}` : '';

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      const res = await api.shareProject(project.id);
      setToken(res.token);
      toast.success('Share Link Generated', 'A cryptographically signed public link has been created.');
      onUpdated();
    } catch (e: any) {
      toast.error('Share Failed', e.message || 'Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await api.revokeShare(project.id);
      setToken(null);
      toast.info('Access Revoked', 'Public sharing link has been revoked successfully.');
      onUpdated();
    } catch (e: any) {
      toast.error('Revocation Failed', e.message || 'Failed to revoke access');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Copied to Clipboard', 'Public link copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#FFFFFF] rounded-2xl shadow-2xl border border-[#E1DCDC] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-[#0A0A0A]" />
            <h3 className="text-sm font-bold text-[#333333]">Public Project Sharing</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#888888] hover:bg-[#E8E4E4]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-[#666666] leading-relaxed">
            Generate a secure, cryptographically signed public link for <strong>{project.title}</strong>. 
            External end users can view permitted milestones and progress without login. Internal notes, Gantt charts, and team information remain private.
          </p>

          {token ? (
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold text-[#888888] uppercase">
                Active Public URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-lg px-3 py-2 text-xs text-[#333333] font-mono select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] flex items-center space-x-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#5269A8] hover:underline flex items-center font-medium"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Public View
                </a>

                <button
                  onClick={handleRevoke}
                  disabled={loading}
                  className="text-xs text-[#B65F65] hover:bg-[#F5DEDE] px-3 py-1.5 rounded-lg border border-[#F5DEDE] transition-colors flex items-center space-x-1"
                >
                  <Ban className="w-3 h-3" />
                  <span>Revoke Link</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <button
                onClick={handleGenerateLink}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] transition-colors shadow-xs"
              >
                {loading ? 'Generating...' : 'Generate Secure Public Link'}
              </button>
            </div>
          )}

          <div className="pt-3 border-t border-[#E1DCDC] flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#E1DCDC] text-xs font-medium text-[#666666] hover:bg-[#F5F3F4]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

