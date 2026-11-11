from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, EmailStr

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    username: str
    password: str

# Role Schemas
class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    class Config:
        from_attributes = True

# Company Schemas
class CompanyBase(BaseModel):
    name: str
    code: str
    logo_url: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    logo_url: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CompanyStatsOut(BaseModel):
    company_id: int
    company_name: str
    company_code: str
    total_projects: int
    completed_projects: int
    ongoing_projects: int

class CompanyOut(CompanyBase):
    id: int
    created_at: datetime
    stats: Optional[CompanyStatsOut] = None
    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    role_id: int
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    company_ids: Optional[List[int]] = []

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    company_ids: Optional[List[int]] = None

class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    role_id: int
    role_name: Optional[str] = None
    is_active: bool
    company_ids: List[int] = []
    created_at: datetime
    class Config:
        from_attributes = True

# Module & Preview Schemas
class UpdateOut(BaseModel):
    id: int
    module_id: int
    user_id: int
    user_name: str
    user_avatar: Optional[str] = None
    description_text: str
    created_at: datetime
    class Config:
        from_attributes = True

class AttachmentOut(BaseModel):
    id: int
    module_id: int
    update_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: int
    file_type: Optional[str] = None
    uploaded_by_id: int
    uploaded_by_name: str
    created_at: datetime
    class Config:
        from_attributes = True

class ModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "Not Started"
    priority: str = "Medium"
    progress: float = 0.0
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    assigned_to_id: Optional[int] = None
    sort_order: int = 0

class ModuleCreate(ModuleBase):
    project_id: Optional[int] = None

class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    progress: Optional[float] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    assigned_to_id: Optional[int] = None
    sort_order: Optional[int] = None

class ModuleOut(ModuleBase):
    id: int
    project_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    assigned_to_avatar: Optional[str] = None
    assigned_employee_ids: Optional[List[int]] = []
    assigned_employee_names: Optional[List[str]] = []
    updates_count: int = 0
    attachments_count: int = 0
    created_at: datetime
    class Config:
        from_attributes = True

# Project Schemas
class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = None
    company_id: int
    lead_id: Optional[int] = None
    status: str = "Not Started"
    priority: str = "Medium"
    progress: float = 0.0
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    is_draft: bool = False

class ProjectCreate(ProjectBase):
    assigned_employee_ids: Optional[List[int]] = []
    modules: Optional[List[ModuleBase]] = []

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    company_id: Optional[int] = None
    lead_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    progress: Optional[float] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    is_draft: Optional[bool] = None
    assigned_employee_ids: Optional[List[int]] = None

class ProjectOut(ProjectBase):
    id: int
    creator_id: int
    creator_name: Optional[str] = None
    lead_name: Optional[str] = None
    company_name: Optional[str] = None
    assigned_employee_ids: List[int] = []
    assigned_employees: List[Dict[str, Any]] = []
    modules: List[ModuleOut] = []
    created_at: datetime
    updated_at: datetime
    is_shared: bool = False
    share_token: Optional[str] = None
    class Config:
        from_attributes = True

# Sticky Note Schemas
class StickyNoteCreate(BaseModel):
    title: str = "Untitled Note"
    content: str = ""
    color: str = "#F4E9D2"
    tab_order: int = 0
    mentioned_user_ids: Optional[List[int]] = []
    mention_all_team: bool = False

class StickyNoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    tab_order: Optional[int] = None
    mentioned_user_ids: Optional[List[int]] = None
    mention_all_team: bool = False

class StickyNoteOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    title: str
    content: str
    color: str
    tab_order: int
    mentioned_users: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Notification Schemas
class NotificationOut(BaseModel):
    id: int
    user_id: int
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    title: str
    message: str
    link: Optional[str] = None
    type: str
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

# Search Schemas
class SearchResultItem(BaseModel):
    type: str # 'project', 'module', 'employee'
    id: int
    project_id: int
    title: str
    subtitle: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    snippet: Optional[str] = None

# Gantt Schemas
class GanttDependencyCreate(BaseModel):
    predecessor_id: int
    successor_id: int
    dependency_type: str = "finish_to_start"

class GanttDependencyOut(BaseModel):
    id: int
    predecessor_id: int
    successor_id: int
    dependency_type: str
    class Config:
        from_attributes = True

class GanttTaskItem(BaseModel):
    id: str # p-12 or m-45
    name: str
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    type: str # 'project' or 'module'
    start_date: datetime
    end_date: datetime
    progress: float
    status: str
    priority: str
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    assignee_avatar: Optional[str] = None
    dependencies: List[int] = []

# Statistics Schemas (Section 6 & 8: Projects only, no tickets)
class DashboardStatsOut(BaseModel):
    total_projects: int
    completed_projects: int
    ongoing_projects: int
    scope_description: str
    company_stats: List[CompanyStatsOut] = []

# UI Configuration & 24h Undo Schemas
class UIConfigUpdate(BaseModel):
    role: str
    component_key: str
    config_json: str

class UIConfigOut(BaseModel):
    id: int
    role: str
    component_key: str
    config_json: str
    is_active: bool
    updated_at: datetime
    class Config:
        from_attributes = True

class UIChangeHistoryOut(BaseModel):
    id: int
    config_id: int
    role: str
    component_key: str
    previous_config_json: str
    new_config_json: str
    changed_by_name: str
    changed_at: datetime
    is_reverted: bool
    is_undoable: bool
    class Config:
        from_attributes = True

class UIVersionSnapshotCreate(BaseModel):
    snapshot_name: str
    role: str
    full_config_json: str

class UIVersionSnapshotOut(BaseModel):
    id: int
    snapshot_name: str
    role: str
    full_config_json: str
    created_by_name: str
    created_at: datetime
    class Config:
        from_attributes = True

# Project Finance & Payment Schemas
class ProjectPaymentBase(BaseModel):
    amount: float
    payment_method: Optional[str] = "Bank Transfer"
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[datetime] = None

class ProjectPaymentCreate(ProjectPaymentBase):
    pass

class ProjectPaymentOut(ProjectPaymentBase):
    id: int
    finance_id: int
    project_id: int
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ProjectFinanceBase(BaseModel):
    currency: Optional[str] = "₹"
    quoted_amount: float = 0.0
    status: Optional[str] = "Quoted"
    notes: Optional[str] = None

class ProjectFinanceUpdate(BaseModel):
    currency: Optional[str] = None
    quoted_amount: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ProjectFinanceOut(BaseModel):
    id: int
    project_id: int
    project_title: Optional[str] = None
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    currency: str
    quoted_amount: float
    total_received: float
    remaining_amount: float
    status: str
    notes: Optional[str] = None
    payment_count: int
    payments: List[ProjectPaymentOut] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class FinanceSummaryStats(BaseModel):
    total_projects_count: int
    total_quoted_amount: float
    total_received_amount: float
    total_remaining_amount: float
    collection_percentage: float
    currency: str = "₹"

class ProjectFinanceDashboardOut(BaseModel):
    summary: FinanceSummaryStats
    finances: List[ProjectFinanceOut]

# User Session & Activity Schemas
class SessionHeartbeatRequest(BaseModel):
    session_id: str

class SessionLogoutRequest(BaseModel):
    session_id: str

class UserSessionOut(BaseModel):
    id: int
    session_id: str
    user_id: int
    username: str
    employee_name: Optional[str] = None
    role_name: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    login_time: datetime
    last_heartbeat: datetime
    logout_time: Optional[datetime] = None
    duration_seconds: int
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class UserSessionPageOut(BaseModel):
    total_count: int
    page: int
    page_size: int
    sessions: List[UserSessionOut]

# Notification Create Schema
class NotificationCreate(BaseModel):
    user_id: Optional[int] = None
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None

