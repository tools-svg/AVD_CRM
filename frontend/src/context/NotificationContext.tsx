import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  X,
  ExternalLink
} from 'lucide-react';
import { NotificationItem } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  link?: string;
}

export interface ShowNotificationOptions {
  title: string;
  message: string;
  type?: NotificationType;
  persist?: boolean;
  link?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  showNotification: (options: ShowNotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Global event-driven toast dispatcher usable anywhere (even outside React hooks / components)
export const showAppToast = (options: ShowNotificationOptions) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('avd-toast', { detail: options }));
  }
};

export const toast = {
  success: (title: string, message: string, link?: string) => {
    showAppToast({ title, message, type: 'success', link });
  },
  error: (title: string, message: string) => {
    showAppToast({ title, message, type: 'error' });
  },
  info: (title: string, message: string, link?: string) => {
    showAppToast({ title, message, type: 'info', link });
  },
  warning: (title: string, message: string) => {
    showAppToast({ title, message, type: 'warning' });
  },
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());
  const knownNotifIdsRef = useRef<Set<number>>(new Set());
  const isFirstFetchRef = useRef<boolean>(true);

  const fetchNotifs = async () => {
    if (!user) return;
    try {
      const list = await api.getNotifications();
      setNotifications(list);

      if (isFirstFetchRef.current) {
        // Seed known ids on first fetch
        list.forEach(n => knownNotifIdsRef.current.add(n.id));
        isFirstFetchRef.current = false;
      } else {
        // Any newly arrived unread notification from backend automatically pops up!
        list.forEach(n => {
          if (!knownNotifIdsRef.current.has(n.id)) {
            knownNotifIdsRef.current.add(n.id);
            if (!n.is_read) {
              const toastType: NotificationType = 
                n.type === 'error' ? 'error' :
                n.type === 'warning' ? 'warning' :
                n.type === 'assignment' || n.type === 'mention' ? 'info' : 'success';

              showNotification({
                title: n.title,
                message: n.message,
                type: toastType,
                link: n.link,
                persist: false
              });
            }
          }
        });
      }
    } catch (e) {
      // Silent catch for periodic polling
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, [user]);

  // Listen for global custom events to trigger toasts from anywhere in the application
  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const customEvent = e as CustomEvent<ShowNotificationOptions>;
      if (customEvent.detail) {
        showNotification(customEvent.detail);
      }
    };
    window.addEventListener('avd-toast', handleCustomToast);
    return () => window.removeEventListener('avd-toast', handleCustomToast);
  }, [user]);

  const markAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showNotification = (options: ShowNotificationOptions) => {
    const { title, message, type = 'info', persist = false, link } = options;
    const now = Date.now();
    const hash = `${type}:${title}:${message}`;

    // Deduplication check: ignore identical notifications within 4 seconds
    const lastSent = recentToastsRef.current.get(hash);
    if (lastSent && (now - lastSent < 4000)) {
      return;
    }
    recentToastsRef.current.set(hash, now);

    // Clean up cache
    if (recentToastsRef.current.size > 50) {
      for (const [key, timestamp] of recentToastsRef.current.entries()) {
        if (now - timestamp > 30000) {
          recentToastsRef.current.delete(key);
        }
      }
    }

    const toastId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastAlert = {
      id: toastId,
      title,
      message,
      type,
      timestamp: now,
      link
    };

    setToasts(prev => [newToast, ...prev].slice(0, 6));

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      dismissToast(toastId);
    }, 5000);

    // Persist to backend database notification area if requested & user logged in
    if (persist && user) {
      api.createNotification({
        title,
        message,
        type,
        link,
        user_id: user.id
      }).then(saved => {
        setNotifications(prev => [saved, ...prev.filter(n => n.id !== saved.id)]);
      }).catch(err => {
        // silent
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifs,
        showNotification
      }}
    >
      {children}

      {/* Floating In-App Toast Container - Top-Right with High Z-Index */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-full pointer-events-none">
        {toasts.map(toastItem => {
          let bg = 'bg-white';
          let border = 'border-[#E1DCDC]';
          let icon = <Info className="w-5 h-5 text-[#2563EB]" />;
          let titleColor = 'text-[#111827]';
          let glow = 'shadow-lg';

          if (toastItem.type === 'success') {
            bg = 'bg-[#F0FDF4]';
            border = 'border-[#86EFAC]';
            icon = <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />;
            titleColor = 'text-[#15803D]';
            glow = 'shadow-md shadow-green-100';
          } else if (toastItem.type === 'warning') {
            bg = 'bg-[#FFFBEB]';
            border = 'border-[#FDE68A]';
            icon = <AlertTriangle className="w-5 h-5 text-[#D97706]" />;
            titleColor = 'text-[#B45309]';
            glow = 'shadow-md shadow-amber-100';
          } else if (toastItem.type === 'error') {
            bg = 'bg-[#FEF2F2]';
            border = 'border-[#FCA5A5]';
            icon = <AlertCircle className="w-5 h-5 text-[#DC2626]" />;
            titleColor = 'text-[#B91C1C]';
            glow = 'shadow-md shadow-red-100';
          }

          return (
            <div
              key={toastItem.id}
              onClick={() => {
                if (toastItem.link) {
                  navigate(toastItem.link);
                  dismissToast(toastItem.id);
                }
              }}
              className={`pointer-events-auto p-4 rounded-[14px] ${glow} border ${bg} ${border} flex items-start space-x-3 transition-all animate-in slide-in-from-top-3 duration-200 ${
                toastItem.link ? 'cursor-pointer hover:scale-[1.01]' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-bold leading-tight ${titleColor}`}>
                    {toastItem.title}
                  </h4>
                  {toastItem.link && (
                    <ExternalLink className="w-3 h-3 text-[#6B7280] ml-1 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[12px] text-[#374151] mt-1 leading-snug">
                  {toastItem.message}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toastItem.id);
                }}
                className="text-[#9CA3AF] hover:text-[#111827] p-1 rounded-md hover:bg-black/5 transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
