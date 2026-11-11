import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Save, 
  Sliders, 
  Eye, 
  History, 
  Check, 
  Clock, 
  Camera, 
  Layers, 
  Layout, 
  Palette, 
  Type,
  AlertCircle,
  Users,
  Building2,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useUIConfig } from '../../context/UIConfigContext';
import { toast } from '../../context/NotificationContext';
import { 
  RoleName, 
  UIChangeHistoryRecord, 
  UIVersionSnapshotRecord, 
  User, 
  Role, 
  Company,
  UserSessionRecord
} from '../../types';
import { api } from '../../services/api';
import { ImageInput } from '../common/ImageInput';

const CUSTOMIZATION_ROLES: RoleName[] = [
  'Developer',
  'Director',
  'Project Manager',
  'Manager',
  'Employee',
  'End User'
];

export const DeveloperUIEditorModal: React.FC = () => {
  const { 
    isEditorOpen, 
    setIsEditorOpen, 
    customizationRole, 
    setCustomizationRole, 
    uiConfig, 
    updateConfig, 
    refreshConfig 
  } = useUIConfig();

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<'users' | 'companies' | 'ui_customizer' | 'history' | 'snapshots' | 'sessions'>('users');

  // UI Customizer Sub-Tab
  const [uiSubTab, setUiSubTab] = useState<'text' | 'design' | 'components'>('text');

  const [undoHistory, setUndoHistory] = useState<UIChangeHistoryRecord[]>([]);
  const [snapshots, setSnapshots] = useState<UIVersionSnapshotRecord[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // User Login Activity & Session History State (Requirement 3)
  const [sessionsList, setSessionsList] = useState<UserSessionRecord[]>([]);
  const [sessionTotalCount, setSessionTotalCount] = useState<number>(0);
  const [sessionSearch, setSessionSearch] = useState<string>('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [sessionDateFrom, setSessionDateFrom] = useState<string>('');
  const [sessionDateTo, setSessionDateTo] = useState<string>('');
  const [sessionPage, setSessionPage] = useState<number>(1);
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(false);

  // Administrative User CRUD States (Section 14.1)
  const [usersList, setUsersList] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [companiesList, setCompaniesList] = useState<Company[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role_id: 5, // default Employee
    avatar_url: '',
    company_ids: [] as number[],
    is_active: true,
  });

  // Administrative Company CRUD States (Section 14.2)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    code: '',
    logo_url: '',
    description: '',
  });

  // Deletion Confirmation Modal States (Requirement 1 & 2)
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  // Local draft states for visual editor (Section 14.3)
  const [draftTheme, setDraftTheme] = useState<any>({});
  const [draftNavbar, setDraftNavbar] = useState<any>({});
  const [draftStats, setDraftStats] = useState<any>({});
  const [draftProjects, setDraftProjects] = useState<any>({});

  const loadAdministrativeData = async () => {
    try {
      const [uList, rList, cList] = await Promise.all([
        api.getUsers(),
        api.getRoles(),
        api.getCompanies(),
      ]);
      setUsersList(uList);
      setRolesList(rList);
      setCompaniesList(cList);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    }
  };

  const loadHistory = async () => {
    try {
      const records = await api.getUndoHistory(customizationRole);
      setUndoHistory(records);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSnapshots = async () => {
    try {
      const snaps = await api.getSnapshots(customizationRole);
      setSnapshots(snaps);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const data = await api.getUserSessions({
        search: sessionSearch.trim() || undefined,
        status: sessionStatusFilter !== 'all' ? sessionStatusFilter : undefined,
        date_from: sessionDateFrom || undefined,
        date_to: sessionDateTo || undefined,
        page: sessionPage,
        page_size: 15,
      });
      setSessionsList(data.sessions);
      setSessionTotalCount(data.total_count);
    } catch (err) {
      console.error('Failed to load user session history:', err);
    } finally {
      setIsSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditorOpen) {
      if (activeTab === 'sessions') {
        loadSessions();
      } else {
        loadAdministrativeData();
        loadHistory();
        loadSnapshots();
      }
    }
  }, [isEditorOpen, customizationRole, activeTab, sessionPage, sessionStatusFilter, sessionDateFrom, sessionDateTo]);

  // Debounced search for sessions
  useEffect(() => {
    if (isEditorOpen && activeTab === 'sessions') {
      const timer = setTimeout(() => {
        setSessionPage(1);
        loadSessions();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [sessionSearch]);

  useEffect(() => {
    if (uiConfig) {
      setDraftTheme(uiConfig.global_theme || {});
      setDraftNavbar(uiConfig.navbar || {});
      setDraftStats(uiConfig.statistics || {});
      setDraftProjects(uiConfig.project_list || {});
    }
  }, [uiConfig, customizationRole]);

  if (!isEditorOpen) return null;

  // --- USER CRUD HANDLERS (Section 14.1) ---
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role_id: rolesList.find(r => r.name === 'Employee')?.id || 5,
      avatar_url: '',
      company_ids: companiesList[0] ? [companiesList[0].id] : [],
      is_active: true,
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      password: '', // Blank unless resetting
      role_id: u.role_id,
      avatar_url: u.avatar_url || '',
      company_ids: u.company_ids || [],
      is_active: u.is_active,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Edit User
        const payload: any = {
          email: userFormData.email,
          full_name: userFormData.full_name,
          role_id: userFormData.role_id,
          avatar_url: userFormData.avatar_url,
          company_ids: userFormData.company_ids,
          is_active: userFormData.is_active,
        };
        if (userFormData.password.trim()) {
          payload.password = userFormData.password.trim();
        }
        await api.updateUser(editingUser.id, payload);
        toast.success('Member Saved', `User '${editingUser.full_name || editingUser.username}' updated successfully!`);
      } else {
        // Create User
        if (!userFormData.password.trim()) {
          toast.warning('Password Required', 'Password is required for new member creation.');
          return;
        }
        await api.createUser(userFormData);
        toast.success('Member Created', `Member '${userFormData.full_name}' created successfully!`);
      }
      setIsUserModalOpen(false);
      loadAdministrativeData();
    } catch (err: any) {
      toast.error('User Operation Failed', err.message || 'Operation failed');
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      const res = await api.deleteUser(u.id, false);
      toast.info('Status Updated', res.message);
      loadAdministrativeData();
    } catch (err: any) {
      toast.error('Update Failed', err.message || 'Failed to update user status');
    }
  };

  const handleDeleteUserPermanently = (u: User) => {
    setUserToDelete(u);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await api.deleteUser(userToDelete.id, true);
      toast.success('Employee Deleted', res.message || `Employee '${userToDelete.full_name}' deleted successfully!`);
      setUserToDelete(null);
      loadAdministrativeData();
    } catch (err: any) {
      toast.error('Deletion Failed', err.message || 'Failed to delete employee');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // --- COMPANY CRUD HANDLERS (Section 14.2) ---
  const handleOpenCreateCompany = () => {
    setEditingCompany(null);
    setCompanyFormData({
      name: '',
      code: '',
      logo_url: '/logos/1.png',
      description: '',
    });
    setIsCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (c: Company) => {
    setEditingCompany(c);
    setCompanyFormData({
      name: c.name,
      code: c.code,
      logo_url: c.logo_url || '',
      description: c.description || '',
    });
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await api.updateCompany(editingCompany.id, companyFormData);
        toast.success('Company Saved', `Company '${companyFormData.name}' updated successfully!`);
      } else {
        await api.createCompany(companyFormData);
        toast.success('Company Created', `Company '${companyFormData.name}' created successfully!`);
      }
      setIsCompanyModalOpen(false);
      loadAdministrativeData();
    } catch (err: any) {
      toast.error('Company Operation Failed', err.message || 'Operation failed');
    }
  };

  const handleDeleteCompany = (c: Company) => {
    setCompanyToDelete(c);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    setIsDeletingCompany(true);
    try {
      await api.deleteCompany(companyToDelete.id);
      toast.success('Company Deactivated', `Company '${companyToDelete.name}' deactivated successfully.`);
      setCompanyToDelete(null);
      loadAdministrativeData();
    } catch (err: any) {
      toast.error('Deactivation Failed', err.message || 'Failed to deactivate company');
    } finally {
      setIsDeletingCompany(false);
    }
  };

  // --- UI CUSTOMIZER HANDLERS (Section 14.3) ---
  const handleSaveComponent = async (componentKey: string, configData: any) => {
    try {
      await updateConfig(componentKey, configData);
      toast.success('Live UI Updated', `Saved & applied '${componentKey}' live! Recorded for 24-hr undo.`);
      loadHistory();
    } catch (e: any) {
      toast.error('Save Failed', e.message);
    }
  };

  const handleUndo = async (historyId: number) => {
    try {
      await api.undoUIChange(historyId);
      toast.info('Reverted', 'Configuration reverted successfully!');
      await refreshConfig();
      loadHistory();
    } catch (e: any) {
      toast.error('Undo Failed', e.message);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!snapshotName.trim()) return;
    try {
      await api.createSnapshot(snapshotName, customizationRole, JSON.stringify(uiConfig));
      setSnapshotName('');
      toast.success('Snapshot Saved', 'Snapshot saved successfully!');
      loadSnapshots();
    } catch (e: any) {
      toast.error('Snapshot Failed', e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="bg-[#FFFFFF] rounded-[18px] shadow-2xl border border-[#E1DCDC] w-full max-w-5xl h-[86vh] max-h-[86vh] min-h-[580px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#E1DCDC] bg-[#0A0A0A] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sliders className="w-5 h-5 text-[#5269A8]" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Developer Administration & UI Engine</h2>
              <p className="text-[11px] text-white/70">
                Full Member CRUD, Company Governance, Role-Specific UI Customization, 24h Undo & Audit
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Target Role Selector (Section 14.3) */}
            <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1 rounded-[10px]">
              <span className="text-[11px] text-white/80">Active Role Scope:</span>
              <select
                value={customizationRole}
                onChange={e => setCustomizationRole(e.target.value as RoleName)}
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
              >
                {CUSTOMIZATION_ROLES.map(r => (
                  <option key={r} value={r} className="bg-[#0A0A0A] text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsEditorOpen(false)}
              className="p-1 rounded-[8px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className="bg-[#D9EEE5] text-[#43866B] px-6 py-2.5 text-xs font-semibold flex items-center space-x-2 border-b border-[#43866B]/20 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Main Tab Navigation Bar */}
        <div className="bg-[#F5F3F4] border-b border-[#E1DCDC] px-6 flex items-center space-x-2 overflow-x-auto">
          {[
            { id: 'users', label: 'User Management (CRUD)', icon: Users },
            { id: 'companies', label: 'Company Management (CRUD)', icon: Building2 },
            { id: 'ui_customizer', label: 'Visual UI & Text Editor', icon: Palette },
            { id: 'history', label: '24-Hour Undo Engine', icon: History },
            { id: 'snapshots', label: 'Version Snapshots', icon: Camera },
            { id: 'sessions', label: 'Login & Session Activity', icon: ShieldCheck },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-3 px-3.5 text-xs font-medium border-b-2 flex items-center space-x-1.5 transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-[#0A0A0A] text-[#0A0A0A] font-bold'
                    : 'border-transparent text-[#888888] hover:text-[#333333]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body Container - Consistent Fixed Height with Internal Scrolling (Requirement 7) */}
        <div className="flex-1 min-h-0 p-6 overflow-y-auto space-y-5">
          {/* ======================================================== */}
          {/* TAB 1: USER MANAGEMENT CRUD (SECTION 14.1)               */}
          {/* ======================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E1DCDC]">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Member Directory & Permissions
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Manage accounts, assign roles across all 6 roles, sub-companies, and reset credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateUser}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] transition-colors flex items-center space-x-1.5 self-start sm:self-auto shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Member</span>
                </button>
              </div>

              {/* Members Table */}
              <div className="bg-[#FFFFFF] border border-[#E1DCDC] rounded-[12px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F3F4] border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                    <tr>
                      <th className="py-2.5 px-4">Member</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Sub-Company</th>
                      <th className="py-2.5 px-3">Account Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F3F4]">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-[#F9F9F9] transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center space-x-2.5">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.full_name} className="w-7 h-7 rounded-full object-cover border border-[#E1DCDC]" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-bold">
                                {u.full_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-[#0A0A0A] block">{u.full_name}</span>
                              <span className="text-[10px] text-[#888888]">@{u.username} • {u.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#DCE4FA] text-[#5269A8]">
                            {u.role_name}
                          </span>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {u.company_ids?.length > 0 ? (
                              u.company_ids.map(cid => {
                                const comp = companiesList.find(c => c.id === cid);
                                return (
                                  <span key={cid} className="px-1.5 py-0.2 rounded bg-[#F5F3F4] border border-[#E1DCDC] text-[10px] text-[#666666]">
                                    {comp?.code || `C-${cid}`}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[10px] text-[#888888]">All / Unassigned</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_active ? 'bg-[#D9EEE5] text-[#43866B]' : 'bg-[#F5DEDE] text-[#B65F65]'
                          }`}>
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1 rounded-[6px] text-[#666666] hover:bg-[#F5F3F4] hover:text-[#0A0A0A]"
                              title="Edit Member Information"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              className="px-2 py-0.5 rounded-[6px] text-[10px] font-semibold border border-[#E1DCDC] hover:bg-[#F5F3F4] text-[#333333]"
                              title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUserPermanently(u)}
                              className="p-1 rounded-[6px] text-[#888888] hover:text-[#A93232] hover:bg-[#F5DEDE]/40"
                              title="Delete Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: COMPANY MANAGEMENT CRUD (SECTION 14.2)            */}
          {/* ======================================================== */}
          {activeTab === 'companies' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E1DCDC]">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Sub-Company Portfolio
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Manage operating entities, branding logos, codes, descriptions, and active statuses.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateCompany}
                  className="px-3.5 py-1.5 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] transition-colors flex items-center space-x-1.5 self-start sm:self-auto shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Company</span>
                </button>
              </div>

              {/* Companies Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companiesList.map(c => (
                  <div key={c.id} className="bg-[#FFFFFF] border border-[#E1DCDC] rounded-[12px] p-4 flex flex-col justify-between space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {c.logo_url && (
                          <img
                            src={c.logo_url}
                            alt={c.name}
                            className="w-10 h-10 rounded-[6px] object-contain bg-[#F5F3F4] p-1 border border-[#E1DCDC]"
                          />
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-[#0A0A0A]">{c.name}</h4>
                            <span className="text-[10px] font-bold text-[#5269A8] bg-[#DCE4FA] px-1.5 py-0.2 rounded">
                              {c.code}
                            </span>
                          </div>
                          <span className={`inline-block mt-0.5 text-[10px] font-semibold ${
                            c.is_active ? 'text-[#43866B]' : 'text-[#A93232]'
                          }`}>
                            {c.is_active ? '● Operational' : '○ Inactive'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCompany(c)}
                          className="p-1.5 rounded-[6px] text-[#666666] hover:bg-[#F5F3F4] hover:text-[#0A0A0A]"
                          title="Edit Company"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCompany(c)}
                          className="p-1.5 rounded-[6px] text-[#888888] hover:text-[#A93232] hover:bg-[#F5DEDE]/40"
                          title="Deactivate Company"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#666666] line-clamp-2 leading-relaxed">
                      {c.description || 'No corporate profile provided.'}
                    </p>

                    <div className="pt-2 border-t border-[#F5F3F4] flex items-center justify-between text-[11px] text-[#888888]">
                      <span>Established: {new Date(c.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
                      <span className="font-semibold text-[#0A0A0A]">AVD Sub-Company</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: VISUAL UI & TEXT CUSTOMIZER (SECTION 14.3)        */}
          {/* ======================================================== */}
          {activeTab === 'ui_customizer' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1DCDC] pb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Editing UI for:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCE4FA] text-[#5269A8]">
                    {customizationRole}
                  </span>
                </div>

                {/* Sub-tabs for UI Customizer */}
                <div className="flex items-center space-x-1 bg-[#F5F3F4] p-1 rounded-[8px] border border-[#E1DCDC]">
                  <button
                    type="button"
                    onClick={() => setUiSubTab('text')}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-all ${
                      uiSubTab === 'text' ? 'bg-white shadow-2xs text-[#0A0A0A]' : 'text-[#888888]'
                    }`}
                  >
                    Text & Headings
                  </button>
                  <button
                    type="button"
                    onClick={() => setUiSubTab('design')}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-all ${
                      uiSubTab === 'design' ? 'bg-white shadow-2xs text-[#0A0A0A]' : 'text-[#888888]'
                    }`}
                  >
                    Design & Radii
                  </button>
                  <button
                    type="button"
                    onClick={() => setUiSubTab('components')}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-all ${
                      uiSubTab === 'components' ? 'bg-white shadow-2xs text-[#0A0A0A]' : 'text-[#888888]'
                    }`}
                  >
                    Component Layout
                  </button>
                </div>
              </div>

              {/* Subtab 1: Text Customization (Titles, headings, buttons, empty states) */}
              {uiSubTab === 'text' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#F5F3F4] p-4 rounded-[12px] border border-[#E1DCDC] space-y-3">
                      <span className="text-[11px] font-bold uppercase text-[#888888] tracking-wider block">
                        Page Titles & Descriptions
                      </span>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#333333] mb-1">
                          Navbar Brand Title Text
                        </label>
                        <input
                          type="text"
                          value={draftNavbar.titleText || 'AVD Management'}
                          onChange={e => setDraftNavbar({ ...draftNavbar, titleText: e.target.value })}
                          className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#333333] mb-1">
                          Search Bar Placeholder
                        </label>
                        <input
                          type="text"
                          value={draftNavbar.searchPlaceholder || 'Search projects, modules, employees...'}
                          onChange={e => setDraftNavbar({ ...draftNavbar, searchPlaceholder: e.target.value })}
                          className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                        />
                      </div>
                    </div>

                    <div className="bg-[#F5F3F4] p-4 rounded-[12px] border border-[#E1DCDC] space-y-3">
                      <span className="text-[11px] font-bold uppercase text-[#888888] tracking-wider block">
                        Statistics Cards Headings
                      </span>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#333333] mb-1">
                          Card 1 Label (Total)
                        </label>
                        <input
                          type="text"
                          value={draftStats.card1Label || 'Total Projects'}
                          onChange={e => setDraftStats({ ...draftStats, card1Label: e.target.value })}
                          className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#333333] mb-1">
                          Card 2 Label (Completed)
                        </label>
                        <input
                          type="text"
                          value={draftStats.card2Label || 'Completed'}
                          onChange={e => setDraftStats({ ...draftStats, card2Label: e.target.value })}
                          className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#333333] mb-1">
                          Card 3 Label (Ongoing)
                        </label>
                        <input
                          type="text"
                          value={draftStats.card3Label || 'Ongoing'}
                          onChange={e => setDraftStats({ ...draftStats, card3Label: e.target.value })}
                          className="w-full bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveComponent('navbar', draftNavbar);
                        handleSaveComponent('statistics', draftStats);
                      }}
                      className="px-4 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] flex items-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Text Changes & Apply Live</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Subtab 2: Design & Apple Curve Radii Customization */}
              {uiSubTab === 'design' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Main Background Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={draftTheme.backgroundColor || '#EBE5E5'}
                          onChange={e => setDraftTheme({ ...draftTheme, backgroundColor: e.target.value })}
                          className="w-8 h-8 rounded border border-[#E1DCDC] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={draftTheme.backgroundColor || '#EBE5E5'}
                          onChange={e => setDraftTheme({ ...draftTheme, backgroundColor: e.target.value })}
                          className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Card Background Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={draftTheme.cardBackgroundColor || '#E8E4E4'}
                          onChange={e => setDraftTheme({ ...draftTheme, cardBackgroundColor: e.target.value })}
                          className="w-8 h-8 rounded border border-[#E1DCDC] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={draftTheme.cardBackgroundColor || '#E8E4E4'}
                          onChange={e => setDraftTheme({ ...draftTheme, cardBackgroundColor: e.target.value })}
                          className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Primary Button Color
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={draftTheme.primaryButtonColor || '#0A0A0A'}
                          onChange={e => setDraftTheme({ ...draftTheme, primaryButtonColor: e.target.value })}
                          className="w-8 h-8 rounded border border-[#E1DCDC] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={draftTheme.primaryButtonColor || '#0A0A0A'}
                          onChange={e => setDraftTheme({ ...draftTheme, primaryButtonColor: e.target.value })}
                          className="flex-1 bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Card Border Radius (Apple Curve)
                      </label>
                      <input
                        type="text"
                        value={draftTheme.cardBorderRadius || '14px'}
                        onChange={e => setDraftTheme({ ...draftTheme, cardBorderRadius: e.target.value })}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Button Border Radius (Apple Curve)
                      </label>
                      <input
                        type="text"
                        value={draftTheme.buttonBorderRadius || '10px'}
                        onChange={e => setDraftTheme({ ...draftTheme, buttonBorderRadius: e.target.value })}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                        Logo Container Border Radius
                      </label>
                      <input
                        type="text"
                        value={draftTheme.logoBorderRadius || '2%'}
                        onChange={e => setDraftTheme({ ...draftTheme, logoBorderRadius: e.target.value })}
                        className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveComponent('global_theme', draftTheme)}
                      className="px-4 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] flex items-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Design & Apply Live</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Subtab 3: Component Layout & Visibility */}
              {uiSubTab === 'components' && (
                <div className="space-y-4">
                  <div className="space-y-3 bg-[#F5F3F4] p-4 rounded-[12px] border border-[#E1DCDC]">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftStats.visible ?? true}
                        onChange={e => setDraftStats({ ...draftStats, visible: e.target.checked })}
                        className="rounded text-[#0A0A0A] w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-[#333333]">
                        Show Top Overview Statistics Cards
                      </span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftNavbar.showSlideshow ?? true}
                        onChange={e => setDraftNavbar({ ...draftNavbar, showSlideshow: e.target.checked })}
                        className="rounded text-[#0A0A0A] w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-[#333333]">
                        Show Logo Slideshow in Global Navbar
                      </span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draftProjects.showGantt ?? true}
                        onChange={e => setDraftProjects({ ...draftProjects, showGantt: e.target.checked })}
                        className="rounded text-[#0A0A0A] w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-[#333333]">
                        Enable Interactive Gantt Timeline View
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveComponent('statistics', draftStats);
                        handleSaveComponent('navbar', draftNavbar);
                        handleSaveComponent('project_list', draftProjects);
                      }}
                      className="px-4 py-2 rounded-[10px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] flex items-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Layout & Apply Live</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: 24-HOUR UNDO AUDIT ENGINE                         */}
          {/* ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1DCDC] pb-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    24-Hour Rollback Window
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Every individual UI configuration change can be reverted within 24 hours of execution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="px-2.5 py-1 text-xs text-[#5269A8] hover:underline flex items-center space-x-1 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refresh History</span>
                </button>
              </div>

              {undoHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#888888]">
                  No changes recorded within the active 24-hour window for {customizationRole}.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {undoHistory.map(h => (
                    <div
                      key={h.id}
                      className="p-3.5 rounded-[12px] bg-[#F5F3F4] border border-[#E1DCDC] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#0A0A0A]">{h.component_key}</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#E1DCDC] text-[#666666]">
                            {h.role}
                          </span>
                          {h.is_reverted && (
                            <span className="text-[10px] font-bold text-[#A93232] bg-[#F5DEDE] px-2 py-0.5 rounded">
                              Reverted
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#888888] block mt-1">
                          Changed by {h.changed_by_name} • {new Date(h.changed_at).toLocaleString()}
                        </span>
                      </div>

                      {h.is_undoable && !h.is_reverted ? (
                        <button
                          type="button"
                          onClick={() => handleUndo(h.id)}
                          className="px-3 py-1.5 rounded-[8px] bg-[#0A0A0A] hover:bg-[#333333] text-white text-xs font-semibold flex items-center space-x-1 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Revert (Undo)</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#888888] italic">
                          {h.is_reverted ? 'Reverted' : '24h Window Expired'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: NAMED VERSION SNAPSHOTS                           */}
          {/* ======================================================== */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E1DCDC] pb-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                    Version Snapshots & Milestones
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Save complete named configuration snapshots across themes, layouts, and styles.
                  </p>
                </div>
              </div>

              {/* Create Snapshot Bar */}
              <div className="flex items-center space-x-2 bg-[#F5F3F4] p-3 rounded-[12px] border border-[#E1DCDC]">
                <input
                  type="text"
                  placeholder="Snapshot Name (e.g. Q4 Executive Boardroom Dark Theme)..."
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                  className="flex-1 bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                />
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  disabled={!snapshotName.trim()}
                  className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] disabled:bg-[#E8E4E4] disabled:text-[#888888] flex items-center space-x-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Take Snapshot</span>
                </button>
              </div>

              {/* Saved Snapshots List */}
              <div className="space-y-2 pt-2">
                {snapshots.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#888888]">
                    No named version snapshots saved yet for {customizationRole}.
                  </div>
                ) : (
                  snapshots.map(s => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-[12px] bg-[#F5F3F4] border border-[#E1DCDC] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#0A0A0A]">{s.snapshot_name}</span>
                          <span className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-[#E1DCDC] text-[#666666]">
                            {s.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#888888] block mt-1">
                          Captured by {s.created_by_name} on {new Date(s.created_at).toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const parsed = JSON.parse(s.full_config_json);
                            for (const [key, cfg] of Object.entries(parsed)) {
                              await updateConfig(key, cfg);
                            }
                            setStatusMessage(`Snapshot '${s.snapshot_name}' restored live!`);
                            setTimeout(() => setStatusMessage(null), 3000);
                          } catch (err: any) {
                            alert(`Failed to restore snapshot: ${err.message}`);
                          }
                        }}
                        className="px-3 py-1 rounded-[8px] bg-[#5269A8] hover:bg-[#43568a] text-white text-xs font-semibold"
                      >
                        Restore Live
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: USER LOGIN & SESSION HISTORY (REQUIREMENT 3)       */}
          {/* ======================================================== */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E1DCDC]">
                <div>
                  <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#43866B]" />
                    <span>User Login & Session Activity History</span>
                  </h3>
                  <p className="text-[11px] text-[#888888]">
                    Immutable audit ledger of employee authentication events, active browser sessions, and timeouts.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={loadSessions}
                    className="px-3 py-1.5 rounded-[8px] bg-[#F5F3F4] hover:bg-[#E8E4E4] text-xs font-semibold text-[#333333] border border-[#E1DCDC] flex items-center space-x-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="bg-[#F5F3F4] p-3 rounded-[12px] border border-[#E1DCDC] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  {/* Search Input */}
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    placeholder="Filter employee name or username..."
                    className="bg-white border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333] w-56 focus:outline-none focus:border-[#0A0A0A]"
                  />

                  {/* Status Dropdown */}
                  <select
                    value={sessionStatusFilter}
                    onChange={e => {
                      setSessionStatusFilter(e.target.value);
                      setSessionPage(1);
                    }}
                    className="bg-white border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333] focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Session States</option>
                    <option value="active">Active Now</option>
                    <option value="logged_out">Logged Out</option>
                    <option value="expired">Expired (Timeout)</option>
                    <option value="interrupted">Interrupted</option>
                  </select>

                  {/* Date Filters */}
                  <div className="flex items-center space-x-1.5 text-xs text-[#666666]">
                    <span>From:</span>
                    <input
                      type="date"
                      value={sessionDateFrom}
                      onChange={e => {
                        setSessionDateFrom(e.target.value);
                        setSessionPage(1);
                      }}
                      className="bg-white border border-[#E1DCDC] rounded-[8px] px-2 py-1 text-xs text-[#333333]"
                    />
                    <span>To:</span>
                    <input
                      type="date"
                      value={sessionDateTo}
                      onChange={e => {
                        setSessionDateTo(e.target.value);
                        setSessionPage(1);
                      }}
                      className="bg-white border border-[#E1DCDC] rounded-[8px] px-2 py-1 text-xs text-[#333333]"
                    />
                  </div>
                </div>

                {(sessionSearch || sessionStatusFilter !== 'all' || sessionDateFrom || sessionDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSessionSearch('');
                      setSessionStatusFilter('all');
                      setSessionDateFrom('');
                      setSessionDateTo('');
                      setSessionPage(1);
                    }}
                    className="text-xs text-[#A93232] hover:underline font-semibold"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Session History Table */}
              <div className="bg-[#FFFFFF] border border-[#E1DCDC] rounded-[12px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5F3F4] border-b border-[#E1DCDC] text-[10px] uppercase font-bold text-[#888888]">
                    <tr>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Sign-In Time</th>
                      <th className="py-2.5 px-3">Sign-Out Time</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Device / IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F3F4]">
                    {isSessionsLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[#888888]">
                          Loading session history...
                        </td>
                      </tr>
                    ) : sessionsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[#888888]">
                          No login session records found matching the active criteria.
                        </td>
                      </tr>
                    ) : (
                      sessionsList.map(sess => {
                        let statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E8E4E4] text-[#666666]">
                            {sess.status}
                          </span>
                        );

                        if (sess.status === 'active') {
                          statusBadge = (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                              <span>Active</span>
                            </span>
                          );
                        } else if (sess.status === 'logged_out') {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                              Logged Out
                            </span>
                          );
                        } else if (sess.status === 'expired') {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3C7] text-[#D97706]">
                              Expired
                            </span>
                          );
                        } else if (sess.status === 'interrupted') {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEE2E2] text-[#DC2626]">
                              Interrupted
                            </span>
                          );
                        }

                        // Format duration
                        const durMin = Math.floor(sess.duration_seconds / 60);
                        let durationLabel = `${sess.duration_seconds}s`;
                        if (durMin >= 60) {
                          const h = Math.floor(durMin / 60);
                          const m = durMin % 60;
                          durationLabel = `${h}h ${m}m`;
                        } else if (durMin > 0) {
                          durationLabel = `${durMin}m`;
                        }
                        if (sess.status === 'active') {
                          durationLabel = `Active (${durationLabel})`;
                        }

                        return (
                          <tr key={sess.id} className="hover:bg-[#F9F9F9] transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-[#0A0A0A]">
                              <div>{sess.employee_name || sess.username}</div>
                              <span className="text-[10px] text-[#888888] font-mono">@{sess.username}</span>
                            </td>
                            <td className="py-2.5 px-3 text-[#5269A8] font-medium">
                              {sess.role_name}
                            </td>
                            <td className="py-2.5 px-3 text-[#333333] whitespace-nowrap">
                              {new Date(sess.login_time).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-2.5 px-3 text-[#666666] whitespace-nowrap">
                              {sess.logout_time
                                ? new Date(sess.logout_time).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : (sess.status === 'active' ? <span className="text-[#16A34A] font-semibold">— (In Progress)</span> : '—')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#333333]">
                              {durationLabel}
                            </td>
                            <td className="py-2.5 px-3">
                              {statusBadge}
                            </td>
                            <td className="py-2.5 px-4 text-right text-[10px] text-[#888888] font-mono">
                              <div>{sess.ip_address || '127.0.0.1'}</div>
                              <div className="truncate max-w-[120px] text-[#AAAAAA]">{sess.user_agent ? sess.user_agent.split(' ')[0] : 'Browser'}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between text-xs text-[#888888] pt-1">
                <span>
                  Showing {sessionsList.length > 0 ? (sessionPage - 1) * 15 + 1 : 0} to {Math.min(sessionPage * 15, sessionTotalCount)} of {sessionTotalCount} total audit records
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled={sessionPage <= 1}
                    onClick={() => setSessionPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1 rounded-[6px] border border-[#E1DCDC] bg-white text-xs disabled:opacity-40 hover:bg-[#F5F3F4]"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-[#0A0A0A]">Page {sessionPage}</span>
                  <button
                    type="button"
                    disabled={sessionPage * 15 >= sessionTotalCount}
                    onClick={() => setSessionPage(prev => prev + 1)}
                    className="px-3 py-1 rounded-[6px] border border-[#E1DCDC] bg-white text-xs disabled:opacity-40 hover:bg-[#F5F3F4]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MEMBER MODAL (Section 14.1) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                {editingUser ? `Edit Member: ${editingUser.full_name}` : 'Create New Member'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-[#888888] hover:text-[#0A0A0A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userFormData.full_name}
                    onChange={e => setUserFormData({ ...userFormData, full_name: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={userFormData.username}
                    onChange={e => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333] disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                    {editingUser ? 'Reset Password (optional)' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingUser ? 'Leave blank to retain' : 'Enter initial password'}
                    value={userFormData.password}
                    onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#888888] mb-1">User Role *</label>
                  <select
                    value={userFormData.role_id}
                    onChange={e => setUserFormData({ ...userFormData, role_id: Number(e.target.value) })}
                    className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-2.5 py-1.5 text-xs text-[#333333]"
                  >
                    {rolesList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <ImageInput
                    label="Avatar Image (Upload or URL)"
                    value={userFormData.avatar_url}
                    onChange={url => setUserFormData({ ...userFormData, avatar_url: url })}
                    isAvatar={true}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">
                  Sub-Company Assignments
                </label>
                <div className="flex flex-wrap gap-2 bg-[#F5F3F4] p-2.5 rounded-[8px] border border-[#E1DCDC]">
                  {companiesList.map(c => {
                    const checked = userFormData.company_ids.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center space-x-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setUserFormData({ ...userFormData, company_ids: [...userFormData.company_ids, c.id] });
                            } else {
                              setUserFormData({ ...userFormData, company_ids: userFormData.company_ids.filter(id => id !== c.id) });
                            }
                          }}
                          className="rounded text-[#0A0A0A]"
                        />
                        <span className="font-medium text-[#333333]">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[#E1DCDC] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333]"
                >
                  {editingUser ? 'Save Member' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT COMPANY MODAL (Section 14.2) */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-[#E1DCDC] bg-[#F5F3F4] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0A0A0A] uppercase tracking-wider">
                {editingCompany ? `Edit Company: ${editingCompany.name}` : 'Create Sub-Company'}
              </h3>
              <button onClick={() => setIsCompanyModalOpen(false)} className="p-1 text-[#888888] hover:text-[#0A0A0A]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={companyFormData.name}
                  onChange={e => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                  placeholder="e.g. AVD Quantum Labs"
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Company Code *</label>
                <input
                  type="text"
                  required
                  value={companyFormData.code}
                  onChange={e => setCompanyFormData({ ...companyFormData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. AVD-QLAB"
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] px-3 py-1.5 text-xs text-[#333333] font-mono"
                />
              </div>

              <div>
                <ImageInput
                  label="Company Logo (Upload or URL) *"
                  value={companyFormData.logo_url}
                  onChange={url => setCompanyFormData({ ...companyFormData, logo_url: url })}
                  isAvatar={false}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#888888] mb-1">Corporate Description</label>
                <textarea
                  rows={3}
                  value={companyFormData.description}
                  onChange={e => setCompanyFormData({ ...companyFormData, description: e.target.value })}
                  placeholder="Outline enterprise scope, charter and focus..."
                  className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-[8px] p-2.5 text-xs text-[#333333] resize-none"
                />
              </div>

              <div className="pt-2 border-t border-[#E1DCDC] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[8px] bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333]"
                >
                  {editingCompany ? 'Save Company' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE EMPLOYEE MODAL (Requirement 1 & 2) */}
      {userToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#FEF2F2] flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#DC2626]">
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Delete Employee Confirmation
                </h3>
              </div>
              <button 
                onClick={() => setUserToDelete(null)} 
                disabled={isDeletingUser}
                className="p-1 text-[#888888] hover:text-[#0A0A0A] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-[#F5F3F4] rounded-[10px] border border-[#E1DCDC] flex items-center space-x-3">
                {userToDelete.avatar_url ? (
                  <img src={userToDelete.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-[#E1DCDC]" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-sm font-bold">
                    {userToDelete.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[#0A0A0A] truncate">{userToDelete.full_name}</div>
                  <div className="text-[11px] text-[#666666]">@{userToDelete.username} • {userToDelete.email}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#DCE4FA] text-[#5269A8]">
                    {userToDelete.role_name}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-[#FFFBEB] rounded-[10px] border border-[#FDE68A] text-[#B45309] space-y-1 text-[11px] leading-relaxed">
                <p className="font-semibold">⚠️ This action will permanently remove this employee.</p>
                <p>
                  All project lead assignments will be transferred to an active administrator, module assignments will be unassigned, and mentions will be safely archived.
                </p>
              </div>

              <div className="pt-2 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={() => setUserToDelete(null)}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={confirmDeleteUser}
                  className="px-4 py-1.5 rounded-[8px] bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C] transition-colors shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingUser ? 'Deleting Employee...' : 'Delete Employee'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DEACTIVATE COMPANY MODAL */}
      {companyToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[16px] shadow-2xl border border-[#E1DCDC] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#E1DCDC] bg-[#FFFBEB] flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[#D97706]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Deactivate Company Confirmation
                </h3>
              </div>
              <button 
                onClick={() => setCompanyToDelete(null)} 
                disabled={isDeletingCompany}
                className="p-1 text-[#888888] hover:text-[#0A0A0A] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[#333333]">
                Are you sure you want to deactivate <strong>{companyToDelete.name}</strong> ({companyToDelete.code})?
              </p>
              <p className="text-[11px] text-[#666666]">
                Existing projects and business records will remain preserved in audit logs.
              </p>

              <div className="pt-2 border-t border-[#E1DCDC] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={isDeletingCompany}
                  onClick={() => setCompanyToDelete(null)}
                  className="px-3.5 py-1.5 rounded-[8px] border border-[#E1DCDC] text-xs font-semibold text-[#666666] hover:bg-[#F5F3F4]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingCompany}
                  onClick={confirmDeleteCompany}
                  className="px-4 py-1.5 rounded-[8px] bg-[#D97706] text-white text-xs font-bold hover:bg-[#B45309]"
                >
                  {isDeletingCompany ? 'Deactivating...' : 'Deactivate Company'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
