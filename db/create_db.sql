-- =============================================================================
-- Event Registration System Database Schema
-- Supabase/PostgreSQL Implementation
-- All timestamps stored in UTC
-- =============================================================================

-- Drop existing tables in reverse dependency order (uncomment if recreating)
DROP TABLE IF EXISTS points CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS event_organizers CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS internals CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS internal_groups CASCADE;

-- =============================================================================
-- CONFIGURATION & FUNCTIONS
-- =============================================================================

-- Create or replace the updated_at trigger function (UTC timestamps)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Internal Groups (Independent table)
CREATE TABLE IF NOT EXISTS internal_groups (
    group_id SERIAL PRIMARY KEY,
    group_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies (Independent table)
CREATE TABLE IF NOT EXISTS companies (
    company_id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    org_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students (Clerk user references)
CREATE TABLE IF NOT EXISTS students (
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub' PRIMARY KEY,
    study_program TEXT NOT NULL,
    degree TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK (semester > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internal users (Clerk user references)
CREATE TABLE IF NOT EXISTS internals (
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub' PRIMARY KEY,
    internal_email TEXT NOT NULL UNIQUE,
    internal_group_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_internals_group
        FOREIGN KEY (internal_group_id)
        REFERENCES internal_groups(group_id)
        ON DELETE RESTRICT
);

-- Events
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    teaser TEXT,
    description TEXT,
    event_start TIMESTAMPTZ NOT NULL,
    registration_opens TIMESTAMPTZ NOT NULL,
    participants_limit INTEGER NOT NULL CHECK (participants_limit > 0),
    location TEXT NOT NULL,
    food TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'Norsk',
    age_restrictions TEXT,
    external_url TEXT,
    company_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT fk_events_company
        FOREIGN KEY (company_id)
        REFERENCES companies(company_id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_registration_before_event
        CHECK (registration_opens < event_start)
);

-- =============================================================================
-- JUNCTION & RELATIONSHIP TABLES
-- =============================================================================

-- Event Organizers (Many-to-Many: Events <-> Internal Users)
CREATE TABLE IF NOT EXISTS event_organizers (
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'assistant',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (event_id, user_id),

    CONSTRAINT fk_event_organizers_event
        FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_event_organizers_user
        FOREIGN KEY (user_id)
        REFERENCES internals(user_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_organizer_role
        CHECK (role IN ('main', 'assistant'))
);

-- Registrations (Any Clerk user -> Events) - No FK to user tables
CREATE TABLE IF NOT EXISTS registrations (
    registration_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    status TEXT NOT NULL DEFAULT 'registered',
    registration_time TIMESTAMPTZ DEFAULT NOW(),
    attendance_status TEXT DEFAULT NULL,
    attendance_time TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (event_id, user_id),

    CONSTRAINT fk_registrations_event
        FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_registration_status
        CHECK (status IN ('registered', 'waitlist')),
    CONSTRAINT chk_attendance_status
        CHECK (attendance_status IS NULL OR
               attendance_status IN ('attended', 'no_show', 'late'))
);

-- Points (Penalty system for any Clerk user) - No FK to user tables
CREATE TABLE IF NOT EXISTS points (
    point_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    reason TEXT NOT NULL,
    severity INTEGER NOT NULL CHECK (severity > 0 AND severity <= 10),
    awarded_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Event indexes
CREATE INDEX IF NOT EXISTS idx_events_start ON events(event_start);
CREATE INDEX IF NOT EXISTS idx_events_registration_opens ON events(registration_opens);
CREATE INDEX IF NOT EXISTS idx_events_company ON events(company_id);

-- Registration indexes
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);

-- Points indexes
CREATE INDEX IF NOT EXISTS idx_points_user ON points(user_id);
CREATE INDEX IF NOT EXISTS idx_points_awarded_time ON points(awarded_time);

-- Internal users index
CREATE INDEX IF NOT EXISTS idx_internals_group ON internals(internal_group_id);

-- =============================================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================================================

-- Drop existing triggers (in case of recreation)
DROP TRIGGER IF EXISTS update_internal_groups_updated_at ON internal_groups;
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
DROP TRIGGER IF EXISTS update_internals_updated_at ON internals;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;

-- Create triggers
CREATE TRIGGER update_internal_groups_updated_at
    BEFORE UPDATE ON internal_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internals_updated_at
    BEFORE UPDATE ON internals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at
    BEFORE UPDATE ON registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert IFI-Navet company
INSERT INTO companies (company_name)
VALUES ('IFI-Navet');

-- =============================================================================
-- SCRIPT COMPLETE
-- =============================================================================
