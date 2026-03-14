#!/usr/bin/env python3
"""
Migration Runner for Trading Service
Executes SQL migration files in order
"""
import psycopg2
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration - Strategies stored in auth database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "alphintra_auth")  # Strategies stored in auth database
DB_USER = os.getenv("DB_USER", "myapp")
DB_PASSWORD = os.getenv("DB_PASSWORD", "alphintra123")
DB_PORT = os.getenv("DB_PORT", "5432")


def get_connection():
    """Create database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )


def create_migrations_table(conn):
    """Create migrations tracking table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                migration_file VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT TRUE
            )
        """)
        conn.commit()
        print("✅ Migrations tracking table ready")


def get_executed_migrations(conn):
    """Get list of already executed migrations"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT migration_file 
            FROM schema_migrations 
            WHERE success = TRUE
            ORDER BY migration_file
        """)
        return [row[0] for row in cur.fetchall()]


def get_pending_migrations(migrations_dir):
    """Get list of SQL migration files that haven't been executed"""
    migration_files = sorted([
        f.name for f in Path(migrations_dir).glob("*.sql")
        if f.is_file()
    ])
    return migration_files


def run_migration(conn, migration_file, migrations_dir):
    """Execute a single migration file"""
    file_path = Path(migrations_dir) / migration_file
    
    print(f"\n🔄 Running migration: {migration_file}")
    
    try:
        with open(file_path, 'r') as f:
            sql_content = f.read()
        
        with conn.cursor() as cur:
            # Execute migration
            cur.execute(sql_content)
            
            # Record successful migration
            cur.execute("""
                INSERT INTO schema_migrations (migration_file, success)
                VALUES (%s, TRUE)
                ON CONFLICT (migration_file) DO NOTHING
            """, (migration_file,))
            
            conn.commit()
        
        print(f"✅ Migration {migration_file} completed successfully")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration {migration_file} failed: {e}")
        
        # Record failed migration
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO schema_migrations (migration_file, success)
                    VALUES (%s, FALSE)
                    ON CONFLICT (migration_file) DO UPDATE
                    SET success = FALSE, executed_at = CURRENT_TIMESTAMP
                """, (migration_file,))
                conn.commit()
        except:
            pass
        
        return False


def main():
    """Main migration runner"""
    print("🚀 Trading Service Migration Runner")
    print(f"📍 Database: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    print("-" * 60)
    
    # Get migrations directory
    migrations_dir = Path(__file__).parent
    
    try:
        # Connect to database
        conn = get_connection()
        print("✅ Connected to database")
        
        # Create migrations tracking table
        create_migrations_table(conn)
        
        # Get executed and pending migrations
        executed = get_executed_migrations(conn)
        all_migrations = get_pending_migrations(migrations_dir)
        pending = [m for m in all_migrations if m not in executed]
        
        print(f"\n📊 Migration Status:")
        print(f"   - Total migrations: {len(all_migrations)}")
        print(f"   - Executed: {len(executed)}")
        print(f"   - Pending: {len(pending)}")
        
        if not pending:
            print("\n✨ All migrations are up to date!")
            return 0
        
        print(f"\n📝 Pending migrations:")
        for migration in pending:
            print(f"   - {migration}")
        
        # Confirm execution
        if len(sys.argv) > 1 and sys.argv[1] == "--yes":
            confirm = "y"
        else:
            confirm = input("\n⚠️  Run pending migrations? (y/n): ").lower()
        
        if confirm != "y":
            print("❌ Migration cancelled")
            return 1
        
        # Run pending migrations
        print("\n" + "=" * 60)
        success_count = 0
        for migration in pending:
            if run_migration(conn, migration, migrations_dir):
                success_count += 1
            else:
                print(f"\n❌ Stopping migration process due to failure")
                break
        
        print("\n" + "=" * 60)
        print(f"\n✨ Migration complete: {success_count}/{len(pending)} succeeded")
        
        conn.close()
        return 0 if success_count == len(pending) else 1
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
