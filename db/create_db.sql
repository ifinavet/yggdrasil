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
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS resources CASCADE;


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

-- Companies (Independent table)
CREATE TABLE IF NOT EXISTS companies (
    company_id SERIAL PRIMARY KEY,
    company_name TEXT NOT NULL,
    org_number TEXT,
    description TEXT,
    company_image uuid,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT companies_company_image_fkey FOREIGN KEY (company_image) REFERENCES storage.objects(id)
);

CREATE OR REPLACE VIEW company_images AS
SELECT
    c.company_id,
    o.name
FROM
    public.companies c
INNER JOIN
    storage.objects o ON c.company_image = o.id;

ALTER VIEW company_images SET (security_invoker = on);

-- Resources
CREATE TABLE IF NOT EXISTS resources (
    resource_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    tag TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
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
    published BOOLEAN NOT NULL DEFAULT FALSE,
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
    CONSTRAINT chk_organizer_role
        CHECK (role IN ('main', 'assistant'))
);

-- Registrations (Any Clerk user -> Events) - No FK to user tables
CREATE TABLE IF NOT EXISTS registrations (
    registration_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    note TEXT DEFAULT NULL,
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
        CHECK (status IN ('registered','transfer', 'waitlist')),
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

-- Resources indexes
CREATE INDEX IF NOT EXISTS idx_resources_title ON resources(title);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON resources(created_at);

-- =============================================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================================================

-- Drop existing triggers (in case of recreation)

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;

-- Create triggers


CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON resources
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

-- Insert sample event
INSERT INTO events (
    title,
    teaser,
    description,
    event_start,
    registration_opens,
    participants_limit,
    location,
    food,
    language,
    age_restrictions,
    external_url,
    company_id,
    published
) VALUES (
    'Teknologiforelesning: Introduksjon til Maskinlæring',
    'Bli med på en spennende introduksjon til maskinlæringskonsepter og anvendelser i moderne programvareutvikling.',
    'Denne omfattende teknologiforelesningen vil dekke grunnleggende prinsipper for maskinlæring, inkludert overvåket og uovervåket læring, nevrale nettverk, og praktiske anvendelser innen webutvikling. Perfekt for studenter som ønsker å utvide sin kunnskap innen AI og datavitenskap. Vi vil også diskutere karrieremuligheter innen feltet og gi praktiske eksempler.',
    '2025-02-15 18:00:00+00',
    '2025-01-20 09:00:00+00',
    50,
    'IFI-bygget, Rom 423',
    'Pizza og brus blir servert',
    'Norsk',
    'Åpent for alle studenter',
    'https://www.ifi.uio.no/arrangementer/ml-teknologiforelesning',
    1,
    true
);

-- Insert internal sample event
INSERT INTO events (
    title,
    teaser,
    description,
    event_start,
    registration_opens,
    participants_limit,
    location,
    food,
    language,
    age_restrictions,
    external_url,
    company_id,
    published
) VALUES (
    'IFI-Navet inviterer til et fantastisk semester!',
    'Velkommen til IFI-Navet!',
    '<h2>Vi øsnker å invitere alle IFI studenter til en hyggelig kveld med pizza og sushi og en rekke spennende aktiviteter for å bli kjent med oss!</h2>',
    '2025-02-08 17:00:00+00',
    '2025-01-15 08:00:00+00',
    40,
    'IFI-bygget, Styrerom 101',
    'Pizza og sushi',
    'Norsk',
    'Kun for IFI studenter',
    NULL,
    1,
    false
);

-- =============================================================================
-- SCRIPT COMPLETE
-- =============================================================================
