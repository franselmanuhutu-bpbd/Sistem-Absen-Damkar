-- ==============================================================================
-- Schema Absensi DAMKAR Mimika for Supabase PostgreSQL
-- Run this script in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Table: users
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    employee_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: teams
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1
);

-- 3. Table: employees
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    no INTEGER NOT NULL,
    nama TEXT NOT NULL,
    nip TEXT DEFAULT '',
    pangkat TEXT DEFAULT '',
    jabatan TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: team_assignments
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 5. Table: team_commanders
CREATE TABLE IF NOT EXISTS public.team_commanders (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 6. Table: sub_unit_assignments (Kasubid)
CREATE TABLE IF NOT EXISTS public.sub_unit_assignments (
    id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- 7. Table: attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    team_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    updated_by TEXT,
    CONSTRAINT uq_attendance_emp_date UNIQUE (employee_id, date)
);

-- 8. Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    employee_name TEXT,
    detail TEXT,
    date TEXT,
    old_status TEXT,
    new_status TEXT
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_employees_no ON public.employees(no);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_team_assignments_emp ON public.team_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_team ON public.team_assignments(team_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_start ON public.team_assignments(start_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_team_commanders_team ON public.team_commanders(team_id);
CREATE INDEX IF NOT EXISTS idx_sub_unit_pos ON public.sub_unit_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_commanders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_unit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by FastAPI with SUPABASE_SECRET_KEY)
CREATE POLICY "service_role_users_all" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_teams_all" ON public.teams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_employees_all" ON public.employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_assignments_all" ON public.team_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_commanders_all" ON public.team_commanders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_sub_units_all" ON public.sub_unit_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_attendance_all" ON public.attendance FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_audit_logs_all" ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Grant privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
