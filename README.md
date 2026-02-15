# Alphintra

A comprehensive trading platform with multiple microservices.

## Prerequisites

- Java 11 or higher (for Spring Boot services)
- Python 3.8+ (for wallet-service and trading-service)
- PostgreSQL database
- Maven (or use the included mvnw wrappers)

## Database Setup

1. Install and start PostgreSQL.
2. Create the necessary databases by running the SQL script:
   ```bash
   psql -U postgres -f init-databases.sql
   ```

## Running the Services

Open separate terminals for each service and run the following commands:

### 1. Discovery Server
```bash
cd discovery-server
./mvnw spring-boot:run
```

### 2. API Gateway
```bash
cd api-gateway
./mvnw spring-boot:run
```

### 3. Auth Service
```bash
cd auth-service
./mvnw spring-boot:run
```

### 4. Wallet Service
```bash
cd wallet-service
source venv/bin/activate
export DATABASE_URL="postgresql://alphintra:alphintra123@localhost:5432/alphintra_wallet"
uvicorn main:app --reload --port 8000
```

### 5. Trading Service
```bash
cd trading-service
source venv/bin/activate
python api_server.py
```

## Frontend

To run the frontend (Next.js application):
```bash
cd frontend
npm install
npm run dev
```

## Additional Notes

- Ensure all services are running before starting the frontend.
- The discovery server should be started first as other services register with it.
- Check the individual service directories for more detailed documentation.