# Sample Application Walkthrough

1. **Startup**
   - `./run_sample.sh` launches the integrated application on port 8080.
   - Logging middleware prints each request/response cycle, confirming middleware order.

2. **Health Check**
   - `curl http://localhost:8080/health`
   - Response: `{"status":"up"}`
   - Demonstrates the HTTP server, router, and response formatting pipeline.

3. **Authentication-Protected Routes**
   - `curl http://localhost:8080/api/users/1`
   - Response: `401 Unauthorized`
   - Shows route-level middleware enforcement using the decorator pipeline.

4. **Create a User**
   - `curl -X POST http://localhost:8080/api/users \
       -H "Authorization: Bearer secrettoken" \
       -H "Content-Type: application/json" \
       -d '{"name":"Ada","email":"ada@example.com"}'`
   - Response: `201 Created` with persisted record.
   - Exercises request parsing, JSON decoding, dependency injection, and the connection pool.

5. **List Users**
   - `curl http://localhost:8080/api/users`
   - Response includes the new user with a stable identifier.
   - Confirms connection reuse and shared state in the in-memory database.

6. **Inspect Pool Metrics**
   - During requests, log statements reveal pool creation and reuse counts.
   - No leak warnings appear when connections are properly returned.

7. **Shutdown**
   - Press `Ctrl+C` to trigger the graceful shutdown handler, which stops the listener loop and joins the worker pool.
