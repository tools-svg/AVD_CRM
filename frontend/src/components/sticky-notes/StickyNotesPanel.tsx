import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, AtSign, Trash2, Check, Palette, Users, FolderPlus } from 'lucide-react';
import { StickyNote, User } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { STICKY_COLORS } from '../../config/theme';

export const StickyNotesPanel: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateProject = user?.role_name !== 'Employee';
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load notes and users
  const loadNotes = async () => {
    try {
      const list = await api.getStickyNotes();
      setNotes(list);
      if (list.length > 0 && activeTab >= list.length) {
        setActiveTab(0);
      }
    } catch (e) {
      console.error('Failed to load sticky notes:', e);
    }
  };

  const loadUsers = async () => {
    try {
      const uList = await api.getUsers();
      setUsersList(uList);
    } catch (e) {
      console.error('Failed to load users for mentions:', e);
    }
  };

  useEffect(() => {
    loadNotes();
    loadUsers();
  }, []);

  const currentNote = notes[activeTab] || null;

  const handleAddNote = async () => {
    try {
      const newNote = await api.createStickyNote({
        title: `Note ${notes.length + 1}`,
        content: '',
        color: STICKY_COLORS[notes.length % STICKY_COLORS.length],
        tab_order: notes.length,
      });
      setNotes(prev => [...prev, newNote]);
      setActiveTab(notes.length);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCurrentNote = async (updates: Partial<StickyNote>) => {
    if (!currentNote) return;
    setIsSaving(true);
    try {
      const updated = await api.updateStickyNote(currentNote.id, updates);
      setNotes(prev => prev.map((n, idx) => idx === activeTab ? updated : n));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrentNote = async () => {
    if (!currentNote) return;
    if (currentNote.user_id !== user?.id) {
      alert('Only the author can delete this note');
      return;
    }
    if (!confirm(`Delete note '${currentNote.title}'?`)) return;

    try {
      await api.deleteStickyNote(currentNote.id);
      const remaining = notes.filter((_, idx) => idx !== activeTab);
      setNotes(remaining);
      setActiveTab(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMentionTeam = () => {
    if (!currentNote) return;
    handleUpdateCurrentNote({
      content: currentNote.content + ` @Entire Team `,
      mention_all_team: true,
    } as any);
    setShowMentionMenu(false);
  };

  const handleMentionUser = (mentionedUser: User) => {
    if (!currentNote) return;
    const existingMentionIds = currentNote.mentioned_users.map(u => u.id);
    if (!existingMentionIds.includes(mentionedUser.id)) {
      const newMentionIds = [...existingMentionIds, mentionedUser.id];
      handleUpdateCurrentNote({
        content: currentNote.content + ` @${mentionedUser.full_name} `,
        mentioned_user_ids: newMentionIds,
      } as any);
    } else {
      handleUpdateCurrentNote({
        content: currentNote.content + ` @${mentionedUser.full_name} `,
      });
    }
    setShowMentionMenu(false);
  };

  return (
    <div className="bg-[#FFFFFF] rounded-[14px] border border-[#E1DCDC] shadow-xs flex flex-col h-full min-h-[440px] overflow-hidden">
      {/* SECTION 6.1: Create Project Button in Sticky Notes Header */}
      {canCreateProject && (
        <div className="p-3 bg-[#FFFFFF] border-b border-[#E1DCDC]">
          <button
            type="button"
            onClick={() => navigate('/projects/create')}
            className="w-full py-2 px-3.5 rounded-[10px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      )}

      {/* Sticky Header with Browser-style Tabs */}
      <div className="bg-[#F5F3F4] border-b border-[#E1DCDC] px-3 pt-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-1 overflow-x-auto max-w-[calc(100%-40px)] no-scrollbar">
          {notes.map((note, idx) => (
            <button
              key={note.id}
              onClick={() => setActiveTab(idx)}
              style={{ backgroundColor: activeTab === idx ? note.color : 'transparent' }}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-medium max-w-[110px] truncate transition-all border-t border-l border-r ${
                activeTab === idx
                  ? 'border-[#E1DCDC] shadow-xs text-[#333333] font-semibold'
                  : 'border-transparent text-[#888888] hover:text-[#333333]'
              }`}
              title={note.title}
            >
              {note.title || `Note ${idx + 1}`}
            </button>
          ))}
        </div>

        <button
          onClick={handleAddNote}
          className="p-1 rounded-md bg-[#FFFFFF] hover:bg-[#E8E4E4] text-[#0A0A0A] border border-[#E1DCDC] transition-all"
          title="Add new note"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Sticky Note Content Area */}
      {currentNote ? (
        <div 
          className="flex-1 flex flex-col p-4 transition-colors duration-200"
          style={{ backgroundColor: currentNote.color || '#F4E9D2' }}
        >
          {/* Note Title & Action Bar */}
          <div className="flex items-center justify-between mb-3 border-b border-black/10 pb-2">
            <input
              type="text"
              value={currentNote.title}
              onChange={e => {
                const val = e.target.value;
                setNotes(prev => prev.map((n, idx) => idx === activeTab ? { ...n, title: val } : n));
              }}
              onBlur={() => handleUpdateCurrentNote({ title: currentNote.title })}
              placeholder="Note Title..."
              className="bg-transparent font-semibold text-sm text-[#333333] focus:outline-none w-3/5"
            />

            <div className="flex items-center space-x-1.5">
              {/* Mention Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMentionMenu(!showMentionMenu)}
                  className="p-1.5 rounded-md hover:bg-black/5 text-[#333333] transition-colors"
                  title="Mention someone"
                >
                  <AtSign className="w-3.5 h-3.5" />
                </button>

                {showMentionMenu && (
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-[#E1DCDC] py-1.5 z-20 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#888888]">
                      Team Mention
                    </div>
                    {/* SECTION 4.2: @Entire Team Option */}
                    <button
                      type="button"
                      onClick={handleMentionTeam}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-[#DCE4FA] text-[#5269A8] font-bold flex items-center space-x-2 border-b border-[#E1DCDC] transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#5269A8] text-white flex items-center justify-center">
                        <Users className="w-3 h-3" />
                      </div>
                      <span className="truncate">@Entire Team</span>
                    </button>

                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#888888] mt-1">
                      Individual Members
                    </div>
                    {usersList.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleMentionUser(u)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#F5F3F4] flex items-center space-x-2 transition-colors"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px]">
                          {u.full_name.charAt(0)}
                        </span>
                        <span className="truncate">{u.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color Picker */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-1.5 rounded-md hover:bg-black/5 text-[#333333] transition-colors"
                  title="Change note color"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>

                {showColorPicker && (
                  <div className="absolute right-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-[#E1DCDC] flex space-x-1.5 z-20">
                    {STICKY_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          handleUpdateCurrentNote({ color: c });
                          setShowColorPicker(false);
                        }}
                        style={{ backgroundColor: c }}
                        className="w-5 h-5 rounded-full border border-black/20 hover:scale-110 transition-transform"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Note */}
              <button
                onClick={handleDeleteCurrentNote}
                className="p-1.5 rounded-md hover:bg-black/5 text-[#B65F65] transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Text Area */}
          <textarea
            value={currentNote.content}
            onChange={e => {
              const val = e.target.value;
              setNotes(prev => prev.map((n, idx) => idx === activeTab ? { ...n, content: val } : n));
            }}
            onBlur={() => handleUpdateCurrentNote({ content: currentNote.content })}
            placeholder="Type your personal note or memo here... Use @ to mention team members."
            className="flex-1 w-full bg-transparent resize-none text-xs text-[#333333] leading-relaxed focus:outline-none"
          />

          {/* Mentions / Author Footer */}
          <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] text-[#666666]">
            <div className="flex items-center space-x-1 truncate max-w-[75%]">
              {currentNote.content.includes('@Entire Team') && (
                <span className="font-bold text-[#5269A8] bg-[#DCE4FA] px-1.5 py-0.5 rounded text-[10px] flex items-center space-x-0.5">
                  <Users className="w-2.5 h-2.5 inline mr-0.5" />
                  @Entire Team
                </span>
              )}
              {currentNote.mentioned_users?.length > 0 && (
                <>
                  <span className="text-[10px] text-[#888888]">Shared with:</span>
                  {currentNote.mentioned_users.map(u => (
                    <span key={u.id} className="font-medium text-[#0A0A0A] bg-black/5 px-1.5 py-0.5 rounded text-[10px]">
                      @{u.full_name}
                    </span>
                  ))}
                </>
              )}
            </div>
            <span className="text-[10px] text-[#888888]">
              {isSaving ? 'Saving...' : 'Saved'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#888888]">
          <p className="text-xs mb-3">No sticky notes created yet</p>
          <button
            onClick={handleAddNote}
            className="px-3 py-1.5 rounded-lg bg-[#0A0A0A] text-white text-xs font-medium hover:bg-[#333333] transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Note</span>
          </button>
        </div>
      )}
    </div>
  );
};

