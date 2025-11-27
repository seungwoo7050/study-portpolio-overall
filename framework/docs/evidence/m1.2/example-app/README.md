# Example Application Walkthrough

1. Start the server: `python src/milestone-1.2/main.py`
2. Health check: `curl http://localhost:8081/health`
3. List users: `curl http://localhost:8081/users`
4. Create user without auth -> receives 401
5. Create user with auth -> receives 201 and stored payload
6. Fetch user by id -> verifies path parameter extraction
