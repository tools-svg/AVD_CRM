import { 
  ProjectItem, 
  Company, 
  User, 
  Role,
  DashboardStats, 
  GanttData, 
  StickyNote, 
  NotificationItem, 
  ModuleUpdateRecord, 
  AttachmentRecord, 
  UIChangeHistoryRecord,
  UIVersionSnapshotRecord,
  SearchResultItem,
  ProjectFinanceDashboard,
  ProjectFinanceRecord,
  UserSessionPage
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('avd_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'An unexpected error occurred');
  }
  return res.json();
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse<{ access_token: string; token_type: string; user: User }>(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<User>(res);
  },

  // Companies
  async getCompanies() {
    const res = await fetch(`${API_BASE}/companies`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<Company[]>(res);
  },

  async createCompany(data: Partial<Company>) {
    const res = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<Company>(res);
  },

  async updateCompany(id: number, data: Partial<Company>) {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<Company>(res);
  },

  async deleteCompany(id: number) {
    const res = await fetch(`${API_BASE}/companies/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  // Users
  async getUsers(companyId?: number, roleName?: string) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId.toString());
    if (roleName) params.append('role_name', roleName);
    const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<User[]>(res);
  },

  async createUser(data: any) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async updateUser(id: number, data: any) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  async deleteUser(id: number, hard: boolean = false) {
    const res = await fetch(`${API_BASE}/users/${id}?hard=${hard}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string; is_active?: boolean; is_deleted?: boolean }>(res);
  },

  async getRoles() {
    const res = await fetch(`${API_BASE}/users/roles`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<Role[]>(res);
  },

  // Statistics
  async getStatistics(companyId?: number) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId.toString());
    const res = await fetch(`${API_BASE}/statistics?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<DashboardStats>(res);
  },

  // Projects
  async getProjects(companyId?: number, statusFilter?: string) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId.toString());
    if (statusFilter) params.append('status_filter', statusFilter);
    const res = await fetch(`${API_BASE}/projects?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectItem[]>(res);
  },

  async getProject(id: number) {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectItem>(res);
  },

  async addEmployeeToProject(projectId: number, userId: number) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/employees/${userId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectItem>(res);
  },

  async removeEmployeeFromProject(projectId: number, userId: number) {
    const res = await fetch(`${API_BASE}/projects/${projectId}/employees/${userId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string; project: ProjectItem }>(res);
  },

  async createProject(data: any) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectItem>(res);
  },

  async updateProject(id: number, data: any) {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectItem>(res);
  },

  async deleteProject(id: number, confirmName?: string) {
    const url = confirmName 
      ? `${API_BASE}/projects/${id}?confirm_name=${encodeURIComponent(confirmName)}`
      : `${API_BASE}/projects/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  async getDrafts() {
    const res = await fetch(`${API_BASE}/projects/drafts`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectItem[]>(res);
  },

  async deleteDraft(draftId: number) {
    const res = await fetch(`${API_BASE}/projects/drafts/${draftId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  async completeProject(id: number, force: boolean = false) {
    const res = await fetch(`${API_BASE}/projects/${id}/complete?force=${force}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectItem>(res);
  },

  async shareProject(id: number) {
    const res = await fetch(`${API_BASE}/projects/${id}/share`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ token: string; share_url: string }>(res);
  },

  async revokeShare(id: number) {
    const res = await fetch(`${API_BASE}/projects/${id}/share`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  // Global Search
  async search(q: string) {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<SearchResultItem[]>(res);
  },

  // Modules
  async createModule(data: any) {
    const res = await fetch(`${API_BASE}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async updateModule(id: number, data: any) {
    const res = await fetch(`${API_BASE}/modules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(res);
  },

  async deleteModule(id: number) {
    const res = await fetch(`${API_BASE}/modules/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  async postModuleUpdate(moduleId: number, formData: FormData) {
    const res = await fetch(`${API_BASE}/modules/${moduleId}/updates`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse<{ message: string; update_id: number; attachments_count: number }>(res);
  },

  async getModuleUpdates(moduleId: number) {
    const res = await fetch(`${API_BASE}/modules/${moduleId}/updates`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ModuleUpdateRecord[]>(res);
  },

  async getModuleImages(moduleId: number) {
    const res = await fetch(`${API_BASE}/modules/${moduleId}/images`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<AttachmentRecord[]>(res);
  },

  // Sticky Notes
  async getStickyNotes() {
    const res = await fetch(`${API_BASE}/sticky-notes`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<StickyNote[]>(res);
  },

  async createStickyNote(data: Partial<StickyNote> & { mentioned_user_ids?: number[] }) {
    const res = await fetch(`${API_BASE}/sticky-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<StickyNote>(res);
  },

  async updateStickyNote(id: number, data: Partial<StickyNote> & { mentioned_user_ids?: number[] }) {
    const res = await fetch(`${API_BASE}/sticky-notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<StickyNote>(res);
  },

  async deleteStickyNote(id: number) {
    const res = await fetch(`${API_BASE}/sticky-notes/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  // Notifications
  async getNotifications() {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<NotificationItem[]>(res);
  },

  async markNotificationRead(id: number) {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  async markAllNotificationsRead() {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PUT',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  // Gantt Chart
  async getGanttData(companyId?: number, projectId?: number, employeeId?: number) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId.toString());
    if (projectId) params.append('project_id', projectId.toString());
    if (employeeId) params.append('employee_id', employeeId.toString());
    const res = await fetch(`${API_BASE}/gantt/data?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<GanttData>(res);
  },

  async updateGanttTimeline(moduleId: number, data: { start_date?: string; deadline?: string; progress?: number }) {
    const res = await fetch(`${API_BASE}/gantt/modules/${moduleId}/timeline`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<{ message: string }>(res);
  },

  async createGanttDependency(predecessor_id: number, successor_id: number) {
    const res = await fetch(`${API_BASE}/gantt/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ predecessor_id, successor_id }),
    });
    return handleResponse<any>(res);
  },

  async deleteGanttDependency(depId: number) {
    const res = await fetch(`${API_BASE}/gantt/dependencies/${depId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string }>(res);
  },

  // Public End-User Project
  async getPublicProject(token: string) {
    const res = await fetch(`${API_BASE}/public/project/${token}`);
    return handleResponse<any>(res);
  },

  // UI Configuration & 24h Undo
  async getUIConfig(role: string) {
    const res = await fetch(`${API_BASE}/ui-config/${role}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ role: string; configurations: Record<string, any> }>(res);
  },

  async saveUIConfig(role: string, componentKey: string, configJson: string) {
    const res = await fetch(`${API_BASE}/ui-config/save`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ role, component_key: componentKey, config_json: configJson }),
    });
    return handleResponse<{ message: string; history_id: number }>(res);
  },

  async getUndoHistory(role?: string) {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    const res = await fetch(`${API_BASE}/ui-config/undo/history?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<UIChangeHistoryRecord[]>(res);
  },

  async undoUIChange(historyId: number) {
    const res = await fetch(`${API_BASE}/ui-config/undo/${historyId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ message: string; restored_config: any }>(res);
  },

  async getSnapshots(role?: string) {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    const res = await fetch(`${API_BASE}/ui-config/snapshots/list?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<UIVersionSnapshotRecord[]>(res);
  },

  async createSnapshot(snapshotName: string, role: string, fullConfigJson: string) {
    const res = await fetch(`${API_BASE}/ui-config/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ snapshot_name: snapshotName, role, full_config_json: fullConfigJson }),
    });
    return handleResponse<UIVersionSnapshotRecord>(res);
  },

  // Image Upload (Section 3)
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    return handleResponse<{ url: string; filename: string; size: number; content_type: string }>(res);
  },

  // Profile Update (Section 3.3)
  async updateMe(data: { full_name?: string; avatar_url?: string; password?: string }) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<User>(res);
  },

  // Project Finance & Payment Tracking (Requirement 2)
  async getFinances(companyId?: number) {
    const params = new URLSearchParams();
    if (companyId) params.append('company_id', companyId.toString());
    const res = await fetch(`${API_BASE}/finances?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectFinanceDashboard>(res);
  },

  async getProjectFinance(projectId: number) {
    const res = await fetch(`${API_BASE}/finances/${projectId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectFinanceRecord>(res);
  },

  async updateProjectFinance(projectId: number, data: Partial<ProjectFinanceRecord>) {
    const res = await fetch(`${API_BASE}/finances/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectFinanceRecord>(res);
  },

  async recordPayment(projectId: number, data: { amount: number; payment_date?: string; payment_method?: string; reference_number?: string; notes?: string }) {
    const res = await fetch(`${API_BASE}/finances/${projectId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<ProjectFinanceRecord>(res);
  },

  async voidPayment(paymentId: number) {
    const res = await fetch(`${API_BASE}/finances/payments/${paymentId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProjectFinanceRecord>(res);
  },

  // User Session Audit & Heartbeat (Requirement 3)
  async sendHeartbeat(sessionId: string) {
    const res = await fetch(`${API_BASE}/auth/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return handleResponse<{ status: string }>(res);
  },

  async logoutSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return handleResponse<{ message: string }>(res);
  },

  async getUserSessions(params?: { search?: string; status?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }) {
    const sp = new URLSearchParams();
    if (params?.search) sp.append('search', params.search);
    if (params?.status) sp.append('status', params.status);
    if (params?.date_from) sp.append('date_from', params.date_from);
    if (params?.date_to) sp.append('date_to', params.date_to);
    if (params?.page) sp.append('page', params.page.toString());
    if (params?.page_size) sp.append('page_size', params.page_size.toString());

    const res = await fetch(`${API_BASE}/auth/sessions?${sp.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<UserSessionPage>(res);
  },

  // In-App Notification Dispatch (Requirement 4)
  async createNotification(data: { title: string; message: string; type?: string; link?: string; user_id?: number }) {
    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return handleResponse<NotificationItem>(res);
  },
};
