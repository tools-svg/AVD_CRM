import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company, RoleName } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  activeRole: RoleName | null;
  companies: Company[];
  selectedCompanyId: number | null;
  setSelectedCompanyId: (id: number | null) => void;
  login: (token: string, user: User, sessionId?: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('avd_token'));
  const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('avd_session_id'));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserData = async () => {
    try {
      if (token) {
        const u = await api.getMe();
        setUser(u);
        const comps = await api.getCompanies();
        setCompanies(comps);
        if (comps.length > 0) {
          if (u.role_name === 'Manager') {
            const userComp = comps.find(c => u.company_ids.includes(c.id));
            setSelectedCompanyId(userComp ? userComp.id : comps[0].id);
          } else {
            setSelectedCompanyId(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore session:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [token]);

  // Session Heartbeat (Requirement 3.4)
  useEffect(() => {
    if (!token || !sessionId) return;

    // Send immediate heartbeat on session restore
    api.sendHeartbeat(sessionId).catch(() => {});

    // Periodic heartbeat every 45s
    const heartbeatTimer = setInterval(() => {
      api.sendHeartbeat(sessionId).catch(err => {
        console.warn('Session heartbeat check failed:', err);
      });
    }, 45000);

    return () => clearInterval(heartbeatTimer);
  }, [token, sessionId]);

  const login = (newToken: string, newUser: User, newSessionId?: string) => {
    localStorage.setItem('avd_token', newToken);
    setToken(newToken);
    setUser(newUser);
    if (newSessionId) {
      localStorage.setItem('avd_session_id', newSessionId);
      setSessionId(newSessionId);
    }
  };

  const logout = async () => {
    if (sessionId) {
      try {
        await api.logoutSession(sessionId);
      } catch (err) {
        console.warn('Logout notification to backend failed:', err);
      }
    }
    localStorage.removeItem('avd_token');
    localStorage.removeItem('avd_session_id');
    setToken(null);
    setSessionId(null);
    setUser(null);
    setCompanies([]);
    setSelectedCompanyId(null);
  };

  const refreshUser = async () => {
    await fetchUserData();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionId,
        activeRole: user ? (user.role_name as RoleName) : null,
        companies,
        selectedCompanyId,
        setSelectedCompanyId,
        login,
        logout,
        refreshUser,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

