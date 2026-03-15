-- Fix permissions for existing tables
\c alphintra_auth;

-- Change ownership of all tables to myapp
ALTER TABLE IF EXISTS users OWNER TO myapp;

-- Grant all privileges just to be sure
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO myapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO myapp;

-- Update existing users to have deleted = false if NULL
UPDATE users SET deleted = false WHERE deleted IS NULL;
