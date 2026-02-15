# Strategy System Setup Guide

## 🎯 Overview
This guide will help you set up the database-driven strategy system that allows users to:
- View default strategies (Multi-Timeframe Trend, RSI Mean Reversion, MACD Momentum)
- Create custom strategies (future feature)
- Purchase strategies from marketplace (future feature)

## 📋 Prerequisites

1. **PostgreSQL Database** running
2. **Python 3.8+** installed
3. **Node.js** for frontend
4. **Environment variables** configured

## 🚀 Step-by-Step Setup

### Step 1: Configure Database Connection

The strategies use the main `alphintra` database. Update your `.env` file in `trading-service/`:

```bash
# Add these to your trading-service/.env
DB_HOST=localhost
DB_NAME=alphintra
DB_USER=postgres
DB_PASSWORD=postgres
DB_PORT=5432
```

**Note:** Make sure this database exists and has a `users` table.

### Step 2: Install Python Dependencies

```bash
cd trading-service
pip install psycopg2-binary python-dotenv
```

### Step 3: Initialize the Database

Run the initialization script to create tables and insert default strategies:

```bash
cd trading-service
python init_strategies.py
```

**Expected output:**
```
🚀 Initializing Strategies Database...
📍 Connecting to localhost:5432/alphintra
📄 Reading SQL schema file...
🔨 Creating tables and inserting default strategies...
✅ Database schema created successfully!
✅ 3 default strategies inserted

📊 Available Strategies:
------------------------------------------------------------
  • Multi-Timeframe Trend (multi_timeframe_trend) - default
  • RSI Mean Reversion (rsi_mean_reversion) - default
  • MACD Momentum (macd_momentum) - default
------------------------------------------------------------

👥 Found X users
🎁 Granting default strategies to all users...
✅ Granted strategy access permissions

✨ Strategies database initialized successfully!
```

### Step 4: Verify Database Tables

Connect to PostgreSQL and verify:

```sql
-- Check strategies table
SELECT * FROM strategies;

-- Check user_strategies table
SELECT * FROM user_strategies;

-- Get strategies for a specific user
SELECT * FROM get_user_strategies(1);
```

### Step 5: Start the Trading Service

```bash
cd trading-service
python api_server.py
```

The service should start on `http://localhost:8001`

### Step 6: Test API Endpoints

Test the new strategy endpoints:

```bash
# Get all strategies for authenticated user
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8001/strategies

# Get default strategies (no auth required)
curl http://localhost:8001/strategies/default

# Get marketplace strategies
curl http://localhost:8001/strategies/marketplace
```

### Step 7: Start Frontend

The frontend is already updated to fetch strategies from the API:

```bash
cd frontend
npm run dev
```

### Step 8: Test in Browser

1. Login to your application
2. Navigate to the trading/bot page
3. You should see the strategy dropdown populated from the database
4. Select a strategy and see its description below the dropdown

## 🔍 Troubleshooting

### Issue: "No strategies available"

**Solution:**
- Ensure database is running
- Check that `init_strategies.py` ran successfully
- Verify strategies exist: `SELECT COUNT(*) FROM strategies;`
- Check user has access: `SELECT * FROM user_strategies WHERE user_id = YOUR_USER_ID;`

### Issue: "Connection refused" error

**Solution:**
- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure database `alphintra` exists: `psql -l`

### Issue: "No module named 'strategy_models'"

**Solution:**
```bash
cd trading-service
ls strategy_models.py  # Verify file exists
```

### Issue: Frontend shows "Loading strategies..."

**Solution:**
- Check browser console for errors
- Verify API Gateway is routing `/trading/strategies` to trading service
- Test API endpoint directly: `curl http://localhost:8001/strategies/default`

## 📊 Database Schema

### strategies table
```sql
- id (serial)
- strategy_id (varchar) - unique identifier
- name (varchar) - display name
- description (text)
- type (varchar) - 'default', 'marketplace', 'user_created'
- parameters (jsonb)
- python_class (varchar)
- python_module (varchar)
- price (decimal)
- author_id (integer)
- total_purchases (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### user_strategies table
```sql
- id (serial)
- user_id (integer)
- strategy_id (varchar)
- access_type (varchar) - 'default', 'purchased', 'created'
- purchased_at (timestamp)
- purchase_price (decimal)
- created_at (timestamp)
```

## 🎯 What's Next?

### Current Status: ✅ Complete
- ✅ Database schema created
- ✅ 3 default strategies available
- ✅ API endpoints working
- ✅ Frontend fetching strategies from database

### Future Features: 🚧 To Implement
- [ ] Strategy creation UI
- [ ] Strategy marketplace
- [ ] Strategy backtesting
- [ ] Custom strategy parameters
- [ ] Strategy rating/reviews
- [ ] Strategy performance metrics

## 📝 Quick Commands

```bash
# Initialize database
cd trading-service && python init_strategies.py

# Start trading service
cd trading-service && python api_server.py

# Start frontend
cd frontend && npm run dev

# Check logs
tail -f trading-service/logs/bot.log
```

## 🆘 Need Help?

If you encounter issues:
1. Check database connection
2. Verify all tables exist
3. Check API service logs
4. Test endpoints with curl
5. Check browser console for frontend errors
