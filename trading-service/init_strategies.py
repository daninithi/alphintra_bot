#!/usr/bin/env python3
"""
Initialize strategies database
Creates tables and inserts default strategies
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "alphintra")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
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

def init_strategies_db():
    """Initialize strategies database schema and data"""
    
    print("🚀 Initializing Strategies Database...")
    print(f"📍 Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME}")
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Read and execute SQL file
        print("📄 Reading SQL schema file...")
        with open('init_strategies_db.sql', 'r') as f:
            sql_script = f.read()
        
        print("🔨 Creating tables and inserting default strategies...")
        cur.execute(sql_script)
        conn.commit()
        
        print("✅ Database schema created successfully!")
        
        # Verify strategies were inserted
        cur.execute("SELECT COUNT(*) FROM strategies WHERE type = 'default'")
        count = cur.fetchone()[0]
        print(f"✅ {count} default strategies inserted")
        
        # Display strategies
        cur.execute("""
            SELECT strategy_id, name, type 
            FROM strategies 
            ORDER BY type, name
        """)
        
        print("\n📊 Available Strategies:")
        print("-" * 60)
        for row in cur.fetchall():
            strategy_id, name, strategy_type = row
            print(f"  • {name} ({strategy_id}) - {strategy_type}")
        print("-" * 60)
        
        # Check if there are any users to grant strategies to
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        
        if user_count > 0:
            print(f"\n👥 Found {user_count} users")
            print("🎁 Granting default strategies to all users...")
            
            cur.execute("""
                INSERT INTO user_strategies (user_id, strategy_id, access_type)
                SELECT DISTINCT u.id, s.strategy_id, 'default'
                FROM users u
                CROSS JOIN strategies s
                WHERE s.type = 'default'
                ON CONFLICT (user_id, strategy_id) DO NOTHING
            """)
            conn.commit()
            
            granted_count = cur.rowcount
            print(f"✅ Granted {granted_count} strategy access permissions")
        else:
            print("\n⚠️  No users found. Default strategies will be granted during user registration.")
        
        cur.close()
        conn.close()
        
        print("\n✨ Strategies database initialized successfully!")
        print("\n📝 Next Steps:")
        print("  1. Start the trading service: python api_server.py")
        print("  2. Strategies will be available at: GET /trading/strategies")
        print("  3. Users will see default, created, and purchased strategies")
        
    except Exception as e:
        print(f"\n❌ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    init_strategies_db()
