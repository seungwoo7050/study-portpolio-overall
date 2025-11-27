# Milestone 1.2 Validation Report

## Build
- Language: Python
- Interpreter: Python 3.11.12
- Startup command: `python src/milestone-1.2/main.py`

## Framework Tests

### Test 1: Health Endpoint
**Request**: `curl http://localhost:8081/health`
**Response**: `HTTP/1.1 200 OK` with body `{"status": "up"}`
**Result**: ✅ Pass

### Test 2: Path Parameters
**Request**: `curl http://localhost:8081/users/1`
**Response**: `HTTP/1.1 200 OK` with body `{"id": "1", "name": "Alice", "email": "alice@example.com"}`
**Result**: ✅ Pass

### Test 3: Middleware Enforcement
**Request**: `curl -X POST http://localhost:8081/users`
**Response**: `HTTP/1.1 401 Unauthorized` when missing Authorization header
**Result**: ✅ Pass

### Test 4: Authorized POST & Body Parsing
**Request**: `curl -X POST http://localhost:8081/users -H 'Authorization: Bearer token' -d '{"name":"Bob","email":"bob@example.com"}'`
**Response**: `HTTP/1.1 201 Created` with stored payload in JSON
**Result**: ✅ Pass

### Test 5: Not Found Handling
**Request**: `curl http://localhost:8081/users/999`
**Response**: `HTTP/1.1 404 Not Found` with `{"error": "user_not_found"}`
**Result**: ✅ Pass

## Key Learnings
- Decorators provide an expressive routing DSL.
- Middleware pipeline enables cross-cutting concerns such as logging and auth.
- A simple DI container dramatically reduces manual wiring even in small apps.
