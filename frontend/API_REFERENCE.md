# Complete API Endpoints Reference

## Authentication Endpoints

### POST `/api/auth/login`
**Login with email and password**
```bash
curl -X POST http://localhost:8790/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Pass123!"}'
```

### POST `/api/auth/register`
**Register new user account**
```bash
curl -X POST http://localhost:8790/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "Pass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### GET `/api/users/me`
**Get current user profile**
```bash
curl -X GET http://localhost:8790/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### PUT `/api/users/me`
**Update user profile**
```bash
curl -X PUT http://localhost:8790/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "phoneNumber": "+1234567890"
  }'
```

---

## Wallet Endpoints

### POST `/api/wallet/binance/connect`
**Connect Binance wallet**
```bash
curl -X POST http://localhost:8790/api/wallet/binance/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "your_api_key",
    "secretKey": "your_secret",
    "environment": "testnet"
  }'
```

### GET `/api/wallet/binance/connection-status`
**Check wallet connection status**
```bash
curl -X GET http://localhost:8790/api/wallet/binance/connection-status \
  -H "Authorization: Bearer $TOKEN"
```

### POST `/api/wallet/binance/disconnect`
**Disconnect Binance wallet**
```bash
curl -X POST http://localhost:8790/api/wallet/binance/disconnect \
  -H "Authorization: Bearer $TOKEN"
```

### GET `/api/wallet/binance/balance`
**Get wallet balance**
```bash
curl -X GET http://localhost:8790/api/wallet/binance/balance \
  -H "Authorization: Bearer $TOKEN"
```

---

## Trading Bot Endpoints

### POST `/api/trading/start`
**Start trading bot**
```bash
curl -X POST http://localhost:8790/api/trading/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "multi_timeframe_trend",
    "coin": "BTC/USDT",
    "capital": 50
  }'
```
- `strategy`: "multi_timeframe_trend" or "rsi_mean_reversion"
- `coin`: Trading pair (e.g., "BTC/USDT", "ETH/USDT")
- `capital`: Percentage of total capital (1-100)

### POST `/api/trading/stop`
**Stop trading bot**
```bash
curl -X POST http://localhost:8790/api/trading/stop \
  -H "Authorization: Bearer $TOKEN"
```

### GET `/api/trading/bot`
**Get current bot status**
```bash
curl -X GET http://localhost:8790/api/trading/bot \
  -H "Authorization: Bearer $TOKEN"
```

### GET `/api/trading/status`
**Get bot runtime status**
```bash
curl -X GET http://localhost:8790/api/trading/status \
  -H "Authorization: Bearer $TOKEN"
```

### GET `/api/trading/history?limit=10`
**Get bot execution history**
```bash
curl -X GET http://localhost:8790/api/trading/history?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Trading Data Endpoints

### GET `/api/trading/orders/pending`
**Get pending orders**
```bash
curl -X GET http://localhost:8790/api/trading/orders/pending \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "order_id": "ORD-abc123",
      "symbol": "BTC/USDT",
      "side": "BUY",
      "order_type": "LIMIT",
      "price": 65000.0,
      "quantity": 0.1,
      "status": "PENDING",
      "created_at": "2026-02-02T14:30:00Z"
    }
  ]
}
```

### GET `/api/trading/positions/open`
**Get open positions**
```bash
curl -X GET http://localhost:8790/api/trading/positions/open \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "symbol": "BTC/USDT",
      "entry_price": 65000.0,
      "current_price": 66500.0,
      "quantity": 0.1,
      "unrealized_pnl": 150.0,
      "opened_at": "2026-02-02T14:30:00Z"
    }
  ]
}
```

### GET `/api/trading/trades/history?limit=50`
**Get completed trades**
```bash
curl -X GET http://localhost:8790/api/trading/trades/history?limit=50 \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "symbol": "BTC/USDT",
      "buy_price": 65000.0,
      "sell_price": 66500.0,
      "quantity": 0.1,
      "pnl": 150.0,
      "result": "PROFIT",
      "opened_at": "2026-02-02T14:30:00Z",
      "closed_at": "2026-02-02T16:45:00Z"
    }
  ]
}
```

---

## Quick Start Guide

### 1. Register & Login
```bash
# Register
curl -X POST http://localhost:8790/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
TOKEN=$(curl -s -X POST http://localhost:8790/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

### 2. Connect Wallet
```bash
curl -X POST http://localhost:8790/api/wallet/binance/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "test_key",
    "secretKey": "test_secret",
    "environment": "testnet"
  }'
```

### 3. Start Trading Bot
```bash
curl -X POST http://localhost:8790/api/trading/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "multi_timeframe_trend",
    "coin": "BTC/USDT",
    "capital": 50
  }'
```

### 4. Monitor Trading
```bash
# Check bot status
curl -X GET http://localhost:8790/api/trading/bot \
  -H "Authorization: Bearer $TOKEN"

# Check pending orders
curl -X GET http://localhost:8790/api/trading/orders/pending \
  -H "Authorization: Bearer $TOKEN"

# Check open positions
curl -X GET http://localhost:8790/api/trading/positions/open \
  -H "Authorization: Bearer $TOKEN"

# Check trade history
curl -X GET http://localhost:8790/api/trading/trades/history?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Stop Bot
```bash
curl -X POST http://localhost:8790/api/trading/stop \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Integration

All endpoints are accessible through the frontend components:

### Bot Control (Bot.tsx)
- Start/Stop bot
- View bot status
- Configure strategy and capital

### Trading Panel (main-panel.tsx)
- View pending orders
- Monitor open positions
- Track trade history
- See active bots

### API Client (trading-api.ts)
```typescript
import { tradingApi } from '@/lib/api/trading-api';

// Get bot status
const status = await tradingApi.getBotStatus();

// Get pending orders
const orders = await tradingApi.getPendingOrders();

// Get open positions
const positions = await tradingApi.getOpenPositions();

// Get trade history
const trades = await tradingApi.getTradesHistory(50);
```

---

## Environment URLs

### Development
- Frontend: http://localhost:3001
- API Gateway: http://localhost:8790
- Auth Service: http://localhost:8791
- Wallet Service: http://localhost:8000
- Trading Service: http://localhost:8001

### Production
- Frontend: https://alphintra.com
- API Gateway: https://api.alphintra.com
- All services behind gateway

---

## Response Formats

### Success Response
```json
{
  "status": "success",
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

---

## Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Rate Limiting

- Auth endpoints: 5 requests per minute
- Trading endpoints: 30 requests per minute
- Wallet endpoints: 20 requests per minute

Exceeding limits returns `429 Too Many Requests`

---

## Additional Resources

- [Login Endpoints](LOGIN_ENDPOINTS.md) - Detailed login flow
- [Trading Integration](TRADING_INTEGRATION.md) - Trading page integration
- [Testing Guide](../trading-service/TESTING_GUIDE.md) - Complete testing guide
- [API Examples](../trading-service/API_EXAMPLES.md) - More API examples
