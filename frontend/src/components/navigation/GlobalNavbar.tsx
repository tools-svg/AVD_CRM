import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, 
  ChevronDown, 
  LogOut, 
  Sliders, 
  Sparkles, 
  Check, 
  Layers, 
  User as UserIcon,
  Users,
  Edit3,
  ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useUIConfig } from '../../context/UIConfigContext';
import { ModuleUpdateRecord, RoleName } from '../../types';
import { api } from '../../services/api';
import { MemberProfileModal } from '../modals/MemberProfileModal';

const LOGO_SLIDES = [
  '/logos/1.png',
  '/logos/2.png',
  '/logos/3.png',
  '/logos/4.png',
];

const CUSTOMIZATION_ROLES: RoleName[] = [
  'Developer',
  'Director',
  'Project Manager',
  'Manager',
  'Employee',
  'End User'
];

export const GlobalNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications } = useNotifications();
  const { uiConfig, customizationRole, setCustomizationRole, setIsEditorOpen, isDirectEditingMode, setIsDirectEditingMode } = useUIConfig();

  const [activeSlide, setActiveSlide] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showApprovalMenu, setShowApprovalMenu] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ModuleUpdateRecord[]>([]);
  const [reviewingUpdateId, setReviewingUpdateId] = useState<number | null>(null);
  const [approvalError, setApprovalError] = useState('');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [projectView, setProjectView] = useState<'dashboard' | 'kanban' | 'gantt'>(() => {
    const savedView = window.localStorage.getItem('avd-crm-project-view');
    return savedView === 'kanban' || savedView === 'gantt' ? savedView : 'dashboard';
  });

  // In-app navigation history stack for Logo Back Navigation (Section 12)
  const historyStackRef = useRef<string[]>([]);
  useEffect(() => {
    const current = location.pathname;
    const stack = historyStackRef.current;
    if (stack.length === 0 || stack[stack.length - 1] !== current) {
      stack.push(current);
    }
  }, [location.pathname]);

  // Logo slideshow auto-rotation (3.5s interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % LOGO_SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadPendingApprovals = async () => {
      if (!user) {
        setPendingApprovals([]);
        return;
      }
      try {
        const updates = await api.getPendingModuleUpdates();
        if (active) setPendingApprovals(updates);
      } catch (error) {
        console.error('Failed to load pending update approvals:', error);
      }
    };

    loadPendingApprovals();
    const interval = window.setInterval(loadPendingApprovals, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const handleReviewUpdate = async (updateId: number, action: 'accept' | 'reject') => {
    if (reviewingUpdateId !== null) return;
    setReviewingUpdateId(updateId);
    setApprovalError('');
    try {
      await api.reviewModuleUpdate(updateId, action);
      setPendingApprovals(current => current.filter(update => update.id !== updateId));
      await refreshNotifications();
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Unable to review this update.');
    } finally {
      setReviewingUpdateId(null);
    }
  };

  const handleLogoClick = () => {
    // Section 12.2: When user is on Home page, clicking logo keeps them on Home page
    if (location.pathname === '/home' || location.pathname === '/') {
      return;
    }

    const stack = historyStackRef.current;
    // Pop current page from stack
    if (stack.length > 0 && stack[stack.length - 1] === location.pathname) {
      stack.pop();
    }

    // Return to previous in-app page, or fallback to Home safely (Section 12.4)
    const prevPage = stack.length > 0 ? stack[stack.length - 1] : null;
    if (prevPage && prevPage !== location.pathname) {
      navigate(prevPage);
    } else {
      navigate('/home');
    }
  };


  const isDeveloper = user?.role_name === 'Developer';
  const isProjectHome = location.pathname === '/home' || location.pathname === '/';

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E1DCDC] shadow-xs px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Left: Logo Slideshow (Section 2.1: 2% border-radius on container, Section 12: Global Back Navigation) */}
      <div className="flex items-center space-x-4 sm:space-x-6">
        {uiConfig.navbar?.showSlideshow !== false ? (
          <div 
            onClick={handleLogoClick}
            className="relative w-36 h-10 cursor-pointer flex items-center overflow-hidden select-none group hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            style={{ borderRadius: uiConfig.global_theme?.logoBorderRadius || '2%' }}
            title={location.pathname === '/home' || location.pathname === '/' ? 'AVD Platform (Home)' : 'Back to previous page'}
          >
            {LOGO_SLIDES.map((src, idx) => (
              <img
                key={src}
                src={src}
                alt={`AVD Logo variation ${idx + 1}`}
                className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-in-out ${
                  idx === activeSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))}
          </div>
        ) : (
          <div 
            onClick={handleLogoClick}
            className="h-10 cursor-pointer flex items-center select-none"
            style={{ borderRadius: uiConfig.global_theme?.logoBorderRadius || '2%' }}
            title="AVD Platform (Home)"
          >
            <img src="/logos/1.png" alt="AVD Logo" className="h-8 object-contain" />
          </div>
        )}

        {uiConfig.navbar?.titleText && (
          <span className="text-xs font-bold text-[#0A0A0A] hidden xl:inline-block tracking-tight bg-[#F5F3F4] px-2.5 py-1 rounded-[6px] border border-[#E1DCDC]">
            {uiConfig.navbar.titleText}
          </span>
        )}

      </div>

      {/* Right Navigation Controls */}
      <div className="flex items-center space-x-3">
        {isProjectHome && (
          <label className="relative flex-shrink-0">
            <span className="sr-only">Project view</span>
            <select
              value={projectView}
              onChange={event => {
                const nextView = event.target.value as 'dashboard' | 'kanban' | 'gantt';
                setProjectView(nextView);
                window.localStorage.setItem('avd-crm-project-view', nextView);
                window.dispatchEvent(new CustomEvent('avd-crm-project-view-change', { detail: nextView }));
              }}
              aria-label="Select project view"
              className="max-w-[130px] appearance-none rounded-[10px] border border-[#E1DCDC] bg-[#F5F3F4] py-1.5 pl-2.5 pr-7 text-xs font-semibold text-[#333333] outline-none focus:border-[#0A0A0A] lg:max-w-none"
            >
              <option value="dashboard">Dashboard View</option>
              <option value="kanban">Kanban View</option>
              <option value="gantt">Gantt View</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#777777]" />
          </label>
        )}
        {/* Developer Interface Customization Dropdown */}
        {isDeveloper && (
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleSelector(!showRoleSelector);
                setShowProfileMenu(false);
                setShowNotifMenu(false);
              }}
              className="flex items-center space-x-2 bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] px-3 py-1.5 rounded-[10px] border border-[#E1DCDC] text-xs font-medium transition-all"
              title="Select interface role to customize"
            >
              <Sliders className="w-3.5 h-3.5 text-[#5269A8]" />
              <span className="hidden sm:inline">UI: <strong className="font-semibold text-[#0A0A0A]">{customizationRole}</strong></span>
              <ChevronDown className="w-3 h-3 text-[#888888]" />
            </button>

            {showRoleSelector && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-[12px] shadow-xl border border-[#E1DCDC] py-2 z-50">
                <div className="px-3 py-1.5 border-b border-[#E1DCDC] flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                    Customize Interface
                  </span>
                  <button
                    onClick={() => {
                      setIsEditorOpen(true);
                      setShowRoleSelector(false);
                    }}
                    className="flex items-center text-xs text-[#0A0A0A] hover:underline font-semibold"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-[#5269A8]" />
                    Visual Editor
                  </button>
                </div>
                <div className="py-1">
                  {CUSTOMIZATION_ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        setCustomizationRole(role);
                        setShowRoleSelector(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#F5F3F4] transition-colors"
                    >
                      <span className={customizationRole === role ? 'font-semibold text-[#0A0A0A]' : 'text-[#666666]'}>
                        {role} {role === 'End User' && '(Public)'}
                      </span>
                      {customizationRole === role && <Check className="w-3.5 h-3.5 text-[#43866B]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowApprovalMenu(!showApprovalMenu);
                setShowNotifMenu(false);
                setShowProfileMenu(false);
                setShowRoleSelector(false);
              }}
              className="relative flex items-center gap-1.5 rounded-[10px] border border-[#E1DCDC] bg-[#F5F3F4] px-3 py-2 text-xs font-semibold text-[#333333] hover:bg-[#E8E4E4]"
              title="Review pending project updates"
            >
              <ClipboardCheck className="h-4 w-4 text-[#5269A8]" />
              <span className="hidden sm:inline">Approvals</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A93232] px-1 text-[10px] font-bold text-white">
                {pendingApprovals.length}
              </span>
            </button>
            {showApprovalMenu && (
              <div className="absolute right-0 mt-2 w-[min(92vw,440px)] rounded-[14px] border border-[#E1DCDC] bg-white py-2 shadow-2xl">
                <div className="border-b border-[#E1DCDC] px-4 py-2.5">
                  <span className="text-xs font-bold text-[#333333]">Pending Project Updates</span>
                  <span className="ml-2 rounded-full bg-[#F4E9D2] px-2 py-0.5 text-[10px] font-bold text-[#A78645]">
                    {pendingApprovals.length}
                  </span>
                </div>
                {approvalError && <p role="alert" className="px-4 pt-2 text-xs text-[#A93232]">{approvalError}</p>}
                <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                  {pendingApprovals.map(update => (
                    <article key={update.id} className="rounded-[10px] border border-[#E1DCDC] p-3">
                      <div className="flex items-start justify-between gap-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="font-bold text-[#333333]">{update.user_name}</p>
                          <p className="truncate text-[#666666]">{update.project_name} · {update.module_name}</p>
                        </div>
                        <time className="whitespace-nowrap text-[10px] text-[#888888]">
                          {new Date(update.created_at).toLocaleString()}
                        </time>
                      </div>
                      <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-[8px] bg-[#F8F7F7] p-2 text-xs leading-relaxed text-[#333333]">
                        {update.description_text}
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={reviewingUpdateId !== null}
                          onClick={() => handleReviewUpdate(update.id, 'reject')}
                          className="rounded-[8px] border border-[#B65F65]/30 bg-[#F5DEDE] px-3 py-1.5 text-[11px] font-bold text-[#A93232] disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={reviewingUpdateId !== null}
                          onClick={() => handleReviewUpdate(update.id, 'accept')}
                          className="rounded-[8px] bg-[#2F614E] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          Accept
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications Bell (Section 10: Rich In-App Dropdown) */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              setShowProfileMenu(false);
              setShowRoleSelector(false);
            }}
            className="relative p-2 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#A93232] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white rounded-[14px] shadow-2xl border border-[#E1DCDC] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-[#E1DCDC] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#333333]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A93232] text-white">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-[11px] text-[#5269A8] hover:underline font-semibold"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#F5F3F4]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#888888]">No notifications yet</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) navigate(n.link);
                        setShowNotifMenu(false);
                      }}
                      className={`p-3.5 text-xs cursor-pointer hover:bg-[#F5F3F4] transition-colors flex items-start space-x-3 ${
                        !n.is_read ? 'bg-[#F4E9D2]/25 font-medium' : ''
                      }`}
                    >
                      {/* Avatar / Sender */}
                      <div className="w-7 h-7 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                        {n.sender_name?.charAt(0) || 'A'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-[#0A0A0A] truncate">{n.title}</span>
                          <span className="text-[10px] text-[#888888] whitespace-nowrap ml-2">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#555555] line-clamp-2 leading-relaxed">{n.message}</p>
                        {n.sender_name && (
                          <span className="text-[10px] text-[#888888] mt-1 block">
                            By {n.sender_name} • {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Developer Pen Icon for Direct UI Editing (Section 2.1) */}
        {isDeveloper && (
          <button
            onClick={() => setIsDirectEditingMode(prev => !prev)}
            className={`p-2 rounded-[10px] border transition-all flex items-center justify-center ${
              isDirectEditingMode
                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] shadow-xs ring-2 ring-[#5269A8]/40'
                : 'bg-[#F5F3F4] hover:bg-[#E8E4E4] text-[#333333] border-[#E1DCDC]'
            }`}
            title={isDirectEditingMode ? 'Exit Direct UI Editing Mode' : 'Direct UI Editing Mode'}
          >
            <Edit3 className={`w-4 h-4 ${isDirectEditingMode ? 'text-white' : 'text-[#5269A8]'}`} />
          </button>
        )}

        {/* User Profile & Role Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifMenu(false);
              setShowRoleSelector(false);
            }}
            className="flex items-center space-x-2.5 p-1 pl-2 pr-2.5 rounded-[10px] bg-[#F5F3F4] hover:bg-[#E8E4E4] border border-[#E1DCDC] transition-all"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-7 h-7 rounded-full object-cover border border-white"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-xs font-semibold">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#333333] leading-none mb-0.5">
                {user?.full_name}
              </span>
              <span className="text-[10px] text-[#888888] leading-none">
                {user?.role_name}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-[12px] shadow-xl border border-[#E1DCDC] py-1 z-50">
              <div className="px-4 py-3 border-b border-[#E1DCDC]">
                <p className="text-xs font-semibold text-[#333333]">{user?.full_name}</p>
                <p className="text-[11px] text-[#888888] truncate">{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#DCE4FA] text-[#5269A8]">
                  {user?.role_name}
                </span>
              </div>

              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-xs text-[#333333] hover:bg-[#F5F3F4] flex items-center space-x-2"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#5269A8]" />
                <span>Edit My Profile</span>
              </button>

              {isDeveloper && (
                <button
                  onClick={() => {
                    setIsEditorOpen(true);
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[#333333] hover:bg-[#F5F3F4] flex items-center space-x-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#5269A8]" />
                  <span>UI Visual Customizer</span>
                </button>
              )}

              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="w-full text-left px-4 py-2 text-xs text-[#B65F65] hover:bg-[#F5DEDE]/30 flex items-center space-x-2 border-t border-[#E1DCDC]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <MemberProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </header>
  );
};
