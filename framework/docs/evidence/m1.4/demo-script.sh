#!/bin/bash
# Demonstration script for milestone 1.4.
#
# 1. Start the sample server: ./run_sample.sh
# 2. In another terminal execute:
#      curl http://localhost:8080/health
#      curl -H "Authorization: Bearer secrettoken" http://localhost:8080/api/users
#      curl -X POST http://localhost:8080/api/users \
#           -H "Authorization: Bearer secrettoken" \
#           -H "Content-Type: application/json" \
#           -d '{"name":"Grace","email":"grace@example.com"}'
#      curl -H "Authorization: Bearer secrettoken" http://localhost:8080/api/users/1
#      curl http://localhost:8080/api/users/1   # Expect 401 (auth required)
# 3. Stop the server with Ctrl+C.
