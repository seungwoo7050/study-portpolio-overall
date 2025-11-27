# Milestone 1.4 Integration Report

## Overview
Milestone 1.4 combines the HTTP server, mini-framework, and connection pool into a cohesive sample application. The resulting stack exposes a REST API for managing users backed by an in-memory data store guarded by the pooling layer.

## Validation Summary
- `./build.sh` compiles the source tree to bytecode.
- `./test_all.sh` runs automated smoke tests that exercise the new API endpoints over an actual TCP connection.
- Manual `curl` commands confirmed authentication, routing, and error handling behaviour.

## Test Matrix
| Scenario | Request | Expected | Result |
|----------|---------|----------|--------|
| Health check | `GET /health` | `{"status":"up"}` | ✅
| Create user | `POST /api/users` + auth header | `201 Created` | ✅
| List users | `GET /api/users` | Count ≥ 1 | ✅
| Fetch user (auth) | `GET /api/users/{id}` + auth | `200 OK` with record | ✅
| Fetch user unauthenticated | `GET /api/users/{id}` | `401 Unauthorized` | ✅
| Missing user | `GET /api/users/999` + auth | `404 Not Found` | ✅

## Observations
- Middleware sequencing works: logging executes globally, while authentication wraps protected routes only.
- Connection pool reuses the same in-memory connections across requests; leak detection remains silent under the tested workload.
- Dependency resolution keeps controllers free from manual wiring—routes access the pool via `request.app.resolve`.

## Next Steps
- Persist data using a real database driver to stress the pooling layer further.
- Expand middleware catalogue (metrics, tracing) for richer cross-cutting insights.
