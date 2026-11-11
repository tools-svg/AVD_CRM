import React, { useState } from 'react';
import { X, Check, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';
import { ImageInput } from '../common/ImageInput';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const updated = await api.updateMe({
        full_name: fullName,
        avatar_url: avatarUrl,
        password: password.trim() ? password.trim() : undefined,
      });

      // Update localStorage cached user
      const cached = localStorage.getItem('avd_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          localStorage.setItem('avd_user', JSON.stringify({ ...parsed, full_name: updated.full_name, avatar_url: updated.avatar_url }));
        } catch {}
      }

      setStatusMsg({ type: 'success', text: 'Profile updated successfully!' });
      toast.success('Profile Updated', 'Profile updated successfully!');
      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to propagate updated avatar everywhere
      }, 700);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
      toast.error('Update Failed', err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E1DCDC] flex items-center justify-between bg-[#F5F3F4]">
          <div className="flex items-center space-x-2">
            <UserIcon className="w-4 h-4 text-[#0A0A0A]" />
            <h3 className="text-sm font-bold text-[#0A0A0A]">Edit My Profile</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#0A0A0A] hover:bg-[#E8E4E4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {statusMsg && (
            <div
              className={`p-2.5 rounded-[8px] text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-[#D9EEE5] text-[#2F614E] border border-[#2F614E]/20'
                  : 'bg-[#F5DEDE] text-[#A93232] border border-[#A93232]/20'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
              Username
            </label>
            <input
              type="text"
              disabled
              value={user?.username || ''}
              className="w-full bg-[#F5F3F4]/60 border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#888888] cursor-not-allowed"
            />
          </div>

          {/* Avatar Image Selection (Upload + Online URL) */}
          <ImageInput
            label="Profile Avatar"
            value={avatarUrl}
            onChange={setAvatarUrl}
            isAvatar={true}
          />

          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
              New Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep existing password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>

          <div className="pt-3 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-medium text-[#666666] hover:bg-[#F5F3F4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

