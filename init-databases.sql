-- Create databases
CREATE DATABASE alphintra_auth;
CREATE DATABASE alphintra_wallet;
CREATE DATABASE alphintra_trading;
CREATE DATABASE alphintra_ticketing;

-- Create user
CREATE USER alphintra WITH PASSWORD 'alphintra123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE alphintra_auth TO alphintra;
GRANT ALL PRIVILEGES ON DATABASE alphintra_wallet TO alphintra;
GRANT ALL PRIVILEGES ON DATABASE alphintra_trading TO alphintra;
GRANT ALL PRIVILEGES ON DATABASE alphintra_ticketing TO alphintra;

-- Connect to each database and grant schema privileges
\c alphintra_auth;
GRANT ALL ON SCHEMA public TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alphintra;

\c alphintra_wallet;
GRANT ALL ON SCHEMA public TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alphintra;

\c alphintra_trading;
GRANT ALL ON SCHEMA public TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alphintra;

\c alphintra_ticketing;
GRANT ALL ON SCHEMA public TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO alphintra;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO alphintra;
