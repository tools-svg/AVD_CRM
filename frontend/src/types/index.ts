export type RoleName = 
  | 'Developer' 
  | 'Director' 
  | 'Project Manager' 
  | 'Manager' 
  | 'Employee' 
  | 'End User';

export type WorkStatus = 
  | 'Not Started' 
  | 'In Progress' 
  | 'Review' 
  | 'On Hold' 
  | 'Closed' 
  | 'Cancelled';

export type WorkPriority = 
  | 'Low' 
  | 'Medium' 
  | 'High' 
  | 'Urgent';

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role_id: number;
  role_name: RoleName;
  is_active: boolean;
  company_ids: number[];
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  logo_url?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface ModuleUpdateRecord {
  id: number;
  module_id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string;
  description_text: string;
  created_at: string;
}

export interface AttachmentRecord {
  id: number;
  module_id: number;
  update_id?: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  uploaded_by_id: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface ModuleItem {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  status: WorkStatus;
  priority: WorkPriority;
  progress: number;
  start_date?: string;
  deadline?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  assigned_employee_ids?: number[];
  assigned_employee_names?: string[];
  sort_order: number;
  updates_count: number;
  attachments_count: number;
  created_at: string;
}

export interface ProjectItem {
  id: number;
  title: string;
  description?: string;
  company_id: number;
  creator_id: number;
  lead_id?: number;
  status: WorkStatus;
  priority: WorkPriority;
  progress: number;
  start_date?: string;
  deadline?: string;
  is_draft: boolean;
  creator_name?: string;
  lead_name?: string;
  company_name?: string;
  assigned_employee_ids?: number[];
  assigned_employees?: { id: number; full_name: string; email: string; avatar_url?: string; role_name?: string }[];
  modules: ModuleItem[];
  created_at: string;
  updated_at: string;
  is_shared?: boolean;
  share_token?: string;
}

export interface StickyNote {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  content: string;
  color: string;
  tab_order: number;
  mentioned_users: { id: number; username: string; full_name: string; avatar_url?: string }[];
  created_at: string;
  updated_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  sender_id?: number;
  sender_name?: string;
  sender_avatar?: string;
  title: string;
  message: string;
  link?: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface GanttProject {
  id: number;
  title: string;
  company_name: string;
  start_date: string;
  deadline: string;
  progress: number;
  status: WorkStatus;
  priority: WorkPriority;
  lead_name?: string;
  lead_avatar?: string;
}

export interface GanttModule {
  id: number;
  project_id: number;
  name: string;
  start_date: string;
  deadline: string;
  progress: number;
  status: WorkStatus;
  priority: WorkPriority;
  assigned_to_id?: number;
  assigned_to_name: string;
  assigned_to_avatar?: string;
  dependencies: number[];
}

export interface GanttDependency {
  id: number;
  predecessor_id: number;
  successor_id: number;
  dependency_type: string;
}

export interface GanttData {
  projects: GanttProject[];
  modules: GanttModule[];
  dependencies: GanttDependency[];
}

export interface CompanyStats {
  company_id: number;
  company_name: string;
  company_code: string;
  total_projects: number;
  completed_projects: number;
  ongoing_projects: number;
}

export interface DashboardStats {
  total_projects: number;
  completed_projects: number;
  ongoing_projects: number;
  scope_description: string;
  company_stats?: CompanyStats[];
}

export interface SearchResultItem {
  type: 'project' | 'module' | 'employee';
  id: number;
  project_id: number;
  title: string;
  subtitle?: string;
  status?: string;
  priority?: string;
  snippet?: string;
}

export interface UIChangeHistoryRecord {
  id: number;
  config_id: number;
  role: RoleName;
  component_key: string;
  previous_config_json: string;
  new_config_json: string;
  changed_by_name: string;
  changed_at: string;
  is_reverted: boolean;
  is_undoable: boolean;
}

export interface UIVersionSnapshotRecord {
  id: number;
  snapshot_name: string;
  role: string;
  full_config_json: string;
  created_by_name: string;
  created_at: string;
}

export interface ElementCustomization {
  text?: string;
  fontSize?: string;
  fontWeight?: string;
  textColor?: string;
  backgroundColor?: string;
  border?: string;
  borderRadius?: string;
  width?: string;
  height?: string;
  visibility?: 'visible' | 'hidden';
  padding?: string;
  margin?: string;
}

export type PaymentStatus = 
  | 'Quoted'
  | '50% Received'
  | 'Partially Received'
  | 'Fully Received'
  | 'On Hold'
  | 'Overdue'
  | 'Cancelled'
  | string;

export interface ProjectPaymentRecord {
  id: number;
  finance_id: number;
  project_id: number;
  amount: number;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  payment_date: string;
  recorded_by_id: number;
  recorded_by_name?: string;
  created_at: string;
}

export interface ProjectFinanceRecord {
  id: number;
  project_id: number;
  project_title?: string;
  company_id?: number;
  company_name?: string;
  currency: string;
  quoted_amount: number;
  total_received: number;
  remaining_amount: number;
  status: PaymentStatus;
  notes?: string;
  payment_count: number;
  payments: ProjectPaymentRecord[];
  created_at: string;
  updated_at: string;
}

export interface FinanceSummaryStats {
  total_projects_count: number;
  total_quoted_amount: number;
  total_received_amount: number;
  total_remaining_amount: number;
  collection_percentage: number;
  currency: string;
}

export interface ProjectFinanceDashboard {
  summary: FinanceSummaryStats;
  finances: ProjectFinanceRecord[];
}

export interface UserSessionRecord {
  id: number;
  session_id: string;
  user_id: number;
  username: string;
  employee_name?: string;
  role_name: string;
  ip_address?: string;
  user_agent?: string;
  login_time: string;
  last_heartbeat: string;
  logout_time?: string;
  duration_seconds: number;
  status: 'active' | 'logged_out' | 'expired' | 'interrupted';
  created_at: string;
}

export interface UserSessionPage {
  total_count: number;
  page: number;
  page_size: number;
  sessions: UserSessionRecord[];
}


