-- ==============================================================================
-- AVD GROUP CRM - SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Compatible with Supabase SQL Editor and PostgreSQL 14+
-- Generated for full compatibility with SQLAlchemy 2.0 ORM & FastAPI Backend
-- ==============================================================================

-- Enable UUID extension if needed in future
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ROLES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ==============================================================================
-- 2. COMPANIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    logo_url VARCHAR(255),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);

-- ==============================================================================
-- 3. USERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255),
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ==============================================================================
-- 4. USER COMPANY ASSIGNMENTS (Many-to-Many)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_company_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_company UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_uca_user_id ON user_company_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uca_company_id ON user_company_assignments(company_id);

-- ==============================================================================
-- 5. PROJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    start_date TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_title ON projects(title);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects(creator_id);
CREATE INDEX IF NOT EXISTS idx_projects_lead_id ON projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON projects(is_deleted);

-- ==============================================================================
-- 6. PROJECT EMPLOYEE ASSIGNMENTS (Many-to-Many)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS project_employee_assignments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_employee UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pea_project_id ON project_employee_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pea_user_id ON project_employee_assignments(user_id);

-- ==============================================================================
-- 7. MODULES TABLE (Tasks / Milestones)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    start_date TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_project_id ON modules(project_id);
CREATE INDEX IF NOT EXISTS idx_modules_assigned_to_id ON modules(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);
CREATE INDEX IF NOT EXISTS idx_modules_is_deleted ON modules(is_deleted);

-- ==============================================================================
-- 8. MODULE EMPLOYEE ASSIGNMENTS (Multi-Employee Support)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS module_employee_assignments (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_module_employee UNIQUE (module_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mea_module_id ON module_employee_assignments(module_id);
CREATE INDEX IF NOT EXISTS idx_mea_user_id ON module_employee_assignments(user_id);

-- ==============================================================================
-- 9. COMMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_module_id ON comments(module_id);
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- ==============================================================================
-- 10. UPDATES TABLE (Description change history & timeline)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS updates (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_updates_module_id ON updates(module_id);
CREATE INDEX IF NOT EXISTS idx_updates_user_id ON updates(user_id);

-- ==============================================================================
-- 11. ATTACHMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    update_id INTEGER REFERENCES updates(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_type VARCHAR(100),
    uploaded_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_module_id ON attachments(module_id);
CREATE INDEX IF NOT EXISTS idx_attachments_update_id ON attachments(update_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by_id ON attachments(uploaded_by_id);

-- ==============================================================================
-- 12. STICKY NOTES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS sticky_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) DEFAULT 'Untitled Note',
    content TEXT DEFAULT '',
    color VARCHAR(30) DEFAULT '#F4E9D2',
    tab_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_id ON sticky_notes(user_id);

-- ==============================================================================
-- 13. STICKY NOTE MENTIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS sticky_note_mentions (
    id SERIAL PRIMARY KEY,
    sticky_note_id INTEGER NOT NULL REFERENCES sticky_notes(id) ON DELETE CASCADE,
    mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sticky_note_mention UNIQUE (sticky_note_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_snm_sticky_note_id ON sticky_note_mentions(sticky_note_id);
CREATE INDEX IF NOT EXISTS idx_snm_mentioned_user_id ON sticky_note_mentions(mentioned_user_id);

-- ==============================================================================
-- 14. NOTIFICATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    "type" VARCHAR(50) DEFAULT 'mention',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ==============================================================================
-- 15. PROJECT SHARES TABLE (Director Public Links)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS project_shares (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token VARCHAR(128) NOT NULL UNIQUE,
    created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(token);

-- ==============================================================================
-- 16. GANTT DEPENDENCIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS gantt_dependencies (
    id SERIAL PRIMARY KEY,
    predecessor_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    successor_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gantt_dependency UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_gantt_predecessor_id ON gantt_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_gantt_successor_id ON gantt_dependencies(successor_id);

-- ==============================================================================
-- 17. UI CONFIGURATIONS TABLE (Developer Customization)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ui_configurations (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    component_key VARCHAR(100) NOT NULL,
    config_json TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_component UNIQUE (role, component_key)
);

CREATE INDEX IF NOT EXISTS idx_ui_configurations_role ON ui_configurations(role);
CREATE INDEX IF NOT EXISTS idx_ui_configurations_component_key ON ui_configurations(component_key);

-- ==============================================================================
-- 18. UI CHANGE HISTORY TABLE (24-Hour Undo Engine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ui_change_history (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES ui_configurations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    component_key VARCHAR(100) NOT NULL,
    previous_config_json TEXT NOT NULL,
    new_config_json TEXT NOT NULL,
    changed_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMPTZ,
    is_reverted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ui_history_config_id ON ui_change_history(config_id);
CREATE INDEX IF NOT EXISTS idx_ui_history_changed_at ON ui_change_history(changed_at);

-- ==============================================================================
-- 19. UI VERSION SNAPSHOTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ui_version_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    full_config_json TEXT NOT NULL,
    created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ui_snapshots_role ON ui_version_snapshots(role);

-- ==============================================================================
-- 20. ACTIVITY LOGS TABLE (Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- ==============================================================================
-- AUTOMATIC TIMESTAMP UPDATE TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_modules_updated_at ON modules;
CREATE TRIGGER trg_modules_updated_at
BEFORE UPDATE ON modules
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_sticky_notes_updated_at ON sticky_notes;
CREATE TRIGGER trg_sticky_notes_updated_at
BEFORE UPDATE ON sticky_notes
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_ui_configurations_updated_at ON ui_configurations;
CREATE TRIGGER trg_ui_configurations_updated_at
BEFORE UPDATE ON ui_configurations
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Authentication is custom FastAPI JWT, not Supabase Auth.
-- The FastAPI backend connects with the PostgreSQL user from DATABASE_URL
-- (usually `postgres`), which bypasses RLS as a superuser.
-- RLS is enabled so the public PostgREST/anon key cannot read employee data.
-- Policies are created only when Supabase roles exist (anon, authenticated, service_role).

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'roles', 'companies', 'users', 'user_company_assignments',
        'projects', 'project_employee_assignments', 'modules', 'module_employee_assignments',
        'comments', 'updates', 'attachments', 'sticky_notes', 'sticky_note_mentions',
        'notifications', 'project_shares', 'gantt_dependencies', 'ui_configurations',
        'ui_change_history', 'ui_version_snapshots', 'activity_logs'
    ];
    has_supabase_roles boolean;
BEGIN
    has_supabase_roles := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
                      AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
                      AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role');

    IF NOT has_supabase_roles THEN
        RAISE NOTICE 'Skipping RLS setup: Supabase roles are not present in this database.';
        RETURN;
    END IF;

    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Service role full access on %I" ON %I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "Service role full access on %I" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);',
            tbl, tbl
        );
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated deny by default on %I" ON %I;', tbl, tbl);
    END LOOP;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        DROP POLICY IF EXISTS "Public read access on project_shares" ON project_shares;
        CREATE POLICY "Public read access on project_shares" ON project_shares
        FOR SELECT TO anon
        USING (is_revoked = FALSE);

        DROP POLICY IF EXISTS "Public read access on companies" ON companies;
        CREATE POLICY "Public read access on companies" ON companies
        FOR SELECT TO anon
        USING (is_active = TRUE);
    END IF;
END
$$;

-- ==============================================================================
-- INITIAL SEED DATA (Idempotent: Safe to run repeatedly)
-- ==============================================================================

-- 1. Seed Roles
INSERT INTO roles (id, name, description) VALUES
(1, 'Developer', 'Full administrative access and UI customization system'),
(2, 'Director', 'Cross-company oversight, full CRUD, Gantt and public project sharing'),
(3, 'Project Manager', 'Same as Director, except project deletion is prohibited'),
(4, 'Manager', 'Restricted to assigned sub-company projects and team'),
(5, 'Employee', 'Assigned projects, modules, personal notes, comments, and updates'),
(6, 'End User', 'External read-only stakeholder via tokenized link')
ON CONFLICT (name) DO NOTHING;

SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id) FROM roles), 1));

-- 2. Seed Companies
INSERT INTO companies (id, name, code, logo_url, description) VALUES
(1, 'AVD Tech Systems', 'AVD-TECH', '/logos/1.png', 'Core sovereign engineering, cloud meshes and high-throughput pipelines.'),
(2, 'AVD Capital & Holdings', 'AVD-CAP', '/logos/2.png', 'Institutional fiduciary capital, underwriting and cross-currency platforms.'),
(3, 'AVD Life Sciences', 'AVD-BIO', '/logos/3.png', 'Molecular diagnostics, peptide assays and precision therapeutics.')
ON CONFLICT (name) DO NOTHING;

SELECT setval('companies_id_seq', COALESCE((SELECT MAX(id) FROM companies), 1));

-- 3. Seed Initial Developer UI Configuration Defaults
-- Administrator accounts are created by the FastAPI seed on first backend start
-- (see backend/app/database/seed.py). This avoids embedding password hashes here.
INSERT INTO ui_configurations (role, component_key, config_json, is_active) VALUES
('Developer', 'global_theme', '{"theme_mode": "dark", "primary_color": "#D4AF37", "compact_density": false}', TRUE),
('Director', 'global_theme', '{"theme_mode": "dark", "primary_color": "#D4AF37", "compact_density": false}', TRUE),
('Project Manager', 'global_theme', '{"theme_mode": "dark", "primary_color": "#D4AF37", "compact_density": false}', TRUE),
('Manager', 'global_theme', '{"theme_mode": "dark", "primary_color": "#D4AF37", "compact_density": false}', TRUE),
('Employee', 'global_theme', '{"theme_mode": "dark", "primary_color": "#D4AF37", "compact_density": false}', TRUE)
ON CONFLICT (role, component_key) DO NOTHING;

SELECT setval('ui_configurations_id_seq', COALESCE((SELECT MAX(id) FROM ui_configurations), 1));

-- ==============================================================================
-- 21. PROJECT FINANCES TABLE (Financial tracking per project)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS project_finances (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT '₹',
    quoted_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'Quoted',
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_finances_project_id ON project_finances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_finances_status ON project_finances(status);

-- ==============================================================================
-- 22. PROJECT PAYMENTS TABLE (Payment history ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS project_payments (
    id SERIAL PRIMARY KEY,
    finance_id INTEGER NOT NULL REFERENCES project_finances(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    payment_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
    reference_number VARCHAR(100),
    notes TEXT,
    recorded_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_payments_finance_id ON project_payments(finance_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_payment_date ON project_payments(payment_date);

-- ==============================================================================
-- 23. USER SESSIONS TABLE (Login/Logout activity tracking)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    login_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_username ON user_sessions(username);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_time ON user_sessions(login_time);
CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON user_sessions(status);

-- ==============================================================================
-- VERIFICATION QUERY
-- ==============================================================================
SELECT 'AVD Group CRM Supabase schema initialized successfully!' AS status,
       (SELECT COUNT(*) FROM roles) AS roles_count,
       (SELECT COUNT(*) FROM companies) AS companies_count,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables_count;
