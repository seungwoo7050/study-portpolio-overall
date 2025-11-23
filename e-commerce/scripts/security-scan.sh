#!/bin/bash

# Security Scanning Script for Stage 4.1
# Runs OWASP Dependency Check and generates security reports

set -e

echo "================================"
echo "Security Scan - Stage 4.1"
echo "================================"

# Run OWASP Dependency Check
echo "Running OWASP Dependency Check..."
mvn org.owasp:dependency-check-maven:check

# Check for Docker and run Trivy if available
if command -v docker &> /dev/null; then
    echo "Building Docker image for Trivy scan..."
    docker build -t sagaline:latest .

    if command -v trivy &> /dev/null; then
        echo "Running Trivy container scan..."
        trivy image --severity HIGH,CRITICAL sagaline:latest
    else
        echo "Trivy not installed. Skipping container scan."
        echo "Install Trivy: https://github.com/aquasecurity/trivy"
    fi
else
    echo "Docker not available. Skipping Trivy scan."
fi

echo ""
echo "================================"
echo "Security Scan Complete"
echo "================================"
echo "Reports generated in:"
echo "  - target/dependency-check/dependency-check-report.html"
echo ""
