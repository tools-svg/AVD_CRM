import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database.session import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True) # Developer, Director, Project Manager, Manager, Employee, End User
    description = Column(String(255), nullable=True)

    users = relationship("User", back_populates="role")

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    code = Column(String(20), unique=True, nullable=False)
    logo_url = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user_assignments = relationship("UserCompanyAssignment", back_populates="company", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="company", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    role = relationship("Role", back_populates="users")
    company_assignments = relationship("UserCompanyAssignment", back_populates="user", cascade="all, delete-orphan")
    created_projects = relationship("Project", foreign_keys="Project.creator_id", back_populates="creator")
    assigned_modules = relationship("Module", foreign_keys="Module.assigned_to_id", back_populates="assigned_to")
    sticky_notes = relationship("StickyNote", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", foreign_keys="Notification.user_id", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

class UserCompanyAssignment(Base):
    __tablename__ = "user_company_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="company_assignments")
    company = relationship("Company", back_populates="user_assignments")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="Not Started", index=True) # Not Started, In Progress, Review, On Hold, Closed, Cancelled
    priority = Column(String(20), default="Medium", index=True) # Low, Medium, High, Urgent
    progress = Column(Float, default=0.0) # 0 to 100
    start_date = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    is_draft = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    company = relationship("Company", back_populates="projects")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_projects")
    lead = relationship("User", foreign_keys=[lead_id])
    modules = relationship("Module", back_populates="project", cascade="all, delete-orphan")
    shares = relationship("ProjectShare", back_populates="project", cascade="all, delete-orphan")
    employee_assignments = relationship("ProjectEmployeeAssignment", back_populates="project", cascade="all, delete-orphan")
    finance = relationship("ProjectFinance", back_populates="project", uselist=False, cascade="all, delete-orphan")
    payments = relationship("ProjectPayment", back_populates="project", cascade="all, delete-orphan")

class ProjectEmployeeAssignment(Base):
    __tablename__ = "project_employee_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="employee_assignments")
    user = relationship("User")

class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="Not Started")
    priority = Column(String(20), default="Medium")
    progress = Column(Float, default=0.0)
    start_date = Column(DateTime, nullable=True)
    deadline = Column(DateTime, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    sort_order = Column(Integer, default=0)
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="modules")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_modules")
    employee_assignments = relationship("ModuleEmployeeAssignment", back_populates="module", cascade="all, delete-orphan")
    updates = relationship("Update", back_populates="module", cascade="all, delete-orphan", order_by="Update.created_at.desc()")
    comments = relationship("Comment", back_populates="module", cascade="all, delete-orphan", order_by="Comment.created_at.desc()")
    attachments = relationship("Attachment", back_populates="module", cascade="all, delete-orphan")
    predecessor_deps = relationship("GanttDependency", foreign_keys="GanttDependency.successor_id", back_populates="successor", cascade="all, delete-orphan")
    successor_deps = relationship("GanttDependency", foreign_keys="GanttDependency.predecessor_id", back_populates="predecessor", cascade="all, delete-orphan")

class ModuleEmployeeAssignment(Base):
    __tablename__ = "module_employee_assignments"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    module = relationship("Module", back_populates="employee_assignments")
    user = relationship("User")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    module = relationship("Module", back_populates="comments")
    user = relationship("User")

class Update(Base):
    """
    Historical descriptions and text updates for modules.
    Used for the Comment-Icon description history preview!
    """
    __tablename__ = "updates"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    module = relationship("Module", back_populates="updates")
    user = relationship("User")
    attachments = relationship("Attachment", back_populates="update")

class Attachment(Base):
    """
    Module image and file attachments.
    Used for the Pin-Icon image preview!
    """
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    update_id = Column(Integer, ForeignKey("updates.id"), nullable=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    file_type = Column(String(100), nullable=True) # image/png, image/jpeg, etc.
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    module = relationship("Module", back_populates="attachments")
    update = relationship("Update", back_populates="attachments")
    uploaded_by = relationship("User")

class StickyNote(Base):
    __tablename__ = "sticky_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(100), default="Untitled Note")
    content = Column(Text, default="")
    color = Column(String(30), default="#F4E9D2") # yellow/peach/green/blue/purple
    tab_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sticky_notes")
    mentions = relationship("StickyNoteMention", back_populates="sticky_note", cascade="all, delete-orphan")

class StickyNoteMention(Base):
    __tablename__ = "sticky_note_mentions"

    id = Column(Integer, primary_key=True, index=True)
    sticky_note_id = Column(Integer, ForeignKey("sticky_notes.id"), nullable=False, index=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sticky_note = relationship("StickyNote", back_populates="mentions")
    mentioned_user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    type = Column(String(50), default="mention") # mention, module_update, assignment, status_change, deadline
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender = relationship("User", foreign_keys=[sender_id])

class ProjectShare(Base):
    """
    Public project sharing links generated by Director.
    Valid until explicitly revoked.
    """
    __tablename__ = "project_shares"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="shares")
    created_by = relationship("User")

class GanttDependency(Base):
    __tablename__ = "gantt_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    predecessor_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    successor_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    dependency_type = Column(String(20), default="finish_to_start")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    predecessor = relationship("Module", foreign_keys=[predecessor_id], back_populates="successor_deps")
    successor = relationship("Module", foreign_keys=[successor_id], back_populates="predecessor_deps")

class UIConfiguration(Base):
    """
    Stores Developer customizable UI configuration per role and component.
    """
    __tablename__ = "ui_configurations"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50), nullable=False, index=True) # Developer, Director, Project Manager, Manager, Employee, End User
    component_key = Column(String(100), nullable=False, index=True) # e.g. 'global_theme', 'navbar', 'statistics', 'project_list', etc.
    config_json = Column(Text, nullable=False) # JSON string of customized styles, labels, visibility, dimensions
    is_active = Column(Boolean, default=True)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class UIChangeHistory(Base):
    """
    Supports 24-hour individual undo system and audit history.
    """
    __tablename__ = "ui_change_history"

    id = Column(Integer, primary_key=True, index=True)
    config_id = Column(Integer, ForeignKey("ui_configurations.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    component_key = Column(String(100), nullable=False)
    previous_config_json = Column(Text, nullable=False)
    new_config_json = Column(Text, nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, default=datetime.datetime.utcnow)
    reverted_at = Column(DateTime, nullable=True)
    is_reverted = Column(Boolean, default=False)

class UIVersionSnapshot(Base):
    __tablename__ = "ui_version_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    full_config_json = Column(Text, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False) # project, ui_config, user, company
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ProjectFinance(Base):
    """
    Project-level financial baseline (Quoted amount, currency, notes, collection status).
    Protected by role checks (Director, Project Manager, Developer only).
    """
    __tablename__ = "project_finances"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), unique=True, nullable=False, index=True)
    currency = Column(String(10), default="₹") # e.g. ₹, $, USD, EUR, GBP
    quoted_amount = Column(Float, default=0.0, nullable=False)
    status = Column(String(50), default="Quoted", index=True) # Quoted, 50% Received, Partially Received, Fully Received, On Hold, Overdue, Cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="finance")
    payments = relationship("ProjectPayment", back_populates="finance", cascade="all, delete-orphan", order_by="ProjectPayment.payment_date.desc()")

class ProjectPayment(Base):
    """
    Historical payment ledger. Immutable audit record of received amounts.
    """
    __tablename__ = "project_payments"

    id = Column(Integer, primary_key=True, index=True)
    finance_id = Column(Integer, ForeignKey("project_finances.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    payment_method = Column(String(50), default="Bank Transfer") # Bank Transfer, Credit Card, Cash, Cheque, UPI, Other
    reference_number = Column(String(100), nullable=True) # Transaction ID or receipt number
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    finance = relationship("ProjectFinance", back_populates="payments")
    project = relationship("Project", back_populates="payments")
    recorded_by = relationship("User")

class UserSession(Base):
    """
    Audit log of user authentication events, active sessions, and heartbeats.
    """
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    username = Column(String(50), nullable=False, index=True)
    role_name = Column(String(50), nullable=False)
    ip_address = Column(Text, nullable=True)
    user_agent = Column(String(255), nullable=True)
    login_time = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    last_heartbeat = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    logout_time = Column(DateTime, nullable=True)
    status = Column(String(30), default="active", index=True) # active, logged_out, expired, interrupted
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sessions")
