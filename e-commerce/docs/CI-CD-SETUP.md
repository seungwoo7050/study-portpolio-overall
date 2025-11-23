# CI/CD Pipeline Setup

**Status**: ✅ Complete
**Last Updated**: 2025-11-15

## Overview

Sagaline uses GitHub Actions for continuous integration and continuous deployment. The pipeline ensures code quality, security, and reliability before merging changes.

## Pipeline Components

### 1. GitHub Actions Workflow

**Location**: `.github/workflows/ci.yml`

**Triggers**:
- Push to `main`, `develop`, or `claude/**` branches
- Pull requests to `main` or `develop`

**Stages**:
1. **Checkout** - Clone repository
2. **Setup** - Configure JDK 17, Node.js 20
3. **Build** - Compile code with Maven
4. **Test** - Run unit and integration tests
5. **Coverage** - Generate and check code coverage (≥80%)
6. **Security Scan** - Trivy vulnerability scanning
7. **Binary Check** - Ensure no large binary files
8. **API Validation** - Validate OpenAPI specification

### 2. Quality Gates

All checks must pass before merge:

#### Build Quality
- ✅ Maven compilation succeeds
- ✅ No compiler warnings (clean build)
- ✅ All dependencies resolved

#### Test Quality
- ✅ All tests pass (unit + integration)
- ✅ Code coverage ≥ 80% (Jacoco)
- ✅ Test reports generated

#### Security Quality
- ✅ No critical vulnerabilities (Trivy)
- ✅ No high-severity vulnerabilities
- ✅ Dependency vulnerabilities scanned

#### Code Quality
- ✅ No large binary files (>100KB)
- ✅ OpenAPI specification valid
- ✅ Conventional commit format (recommended)

### 3. Services

The CI pipeline runs with:
- **PostgreSQL 15-alpine** - Test database
- Health checks ensure service readiness

### 4. Artifacts

Generated artifacts (uploaded on completion):
- Test results (`target/surefire-reports/`)
- Coverage reports (`target/site/jacoco/`)
- Security scan results (`trivy-results.sarif`)

## OpenAPI Validation

### Specification

**Location**: `docs/api/openapi.yaml`

**Format**: OpenAPI 3.0.3

**Content**:
- API metadata (title, version, description)
- Server configurations (dev, prod)
- Health check endpoint definition
- Reusable components (schemas, responses, parameters)
- Security schemes (JWT, OAuth2 Kakao)

### Validation Rules

**Tool**: Spectral CLI

**Configuration**: `.spectral.yaml`

**Rules**:
- Info section completeness (contact, license, description)
- Operation documentation (summary, description, operationId, tags)
- Parameter validation
- Response definitions
- Schema compliance

**Custom Rules**:
- No empty descriptions
- Common error responses recommended

## Pre-commit Hooks

### Installation

```bash
./scripts/install-hooks.sh
```

### Checks

The pre-commit hook runs locally before each commit:

1. **Binary Files** - Prevents accidental commits of large files
2. **Sensitive Information** - Detects passwords, API keys, secrets
3. **Code Compilation** - Ensures code compiles (Maven)
4. **TODO Markers** - Warns about new TODO/FIXME comments
5. **Commit Message** - Validates conventional commit format

### Bypass (Emergency Only)

```bash
git commit --no-verify
```

**Use only when**:
- Emergency hotfix
- CI will catch issues
- You understand the implications

## Code Coverage

### Tool: Jacoco

**Configuration**: `pom.xml`

**Minimum Required**: 80% line coverage

**Reports**:
- Console summary during build
- HTML report: `target/site/jacoco/index.html`
- XML report: `target/site/jacoco/jacoco.xml` (for Codecov)

**Enforcement**:
- Build fails if coverage < 80%
- Configured in `jacoco-maven-plugin`

### Viewing Coverage Locally

```bash
# Run tests and generate report
mvn clean test jacoco:report

# Open HTML report
open target/site/jacoco/index.html
```

## Security Scanning

### Tool: Trivy

**Scan Type**: Filesystem scan

**Scope**: Entire repository

**Severity**: CRITICAL and HIGH

**Output**: SARIF format (GitHub Security integration)

**Reports**:
- GitHub Security tab (automatic upload)
- Workflow artifacts (`trivy-results.sarif`)

### Manual Security Scan

```bash
# Install Trivy
brew install trivy  # macOS
# or
sudo apt-get install trivy  # Ubuntu

# Run scan
trivy fs . --severity CRITICAL,HIGH
```

## CI Workflow Details

### Execution Flow

```
┌─────────────────────────────────────────────────┐
│          Trigger (Push/PR)                      │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│          Checkout Code                          │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Setup Environment (JDK 17, Node 20)         │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Build (mvn clean install -DskipTests)       │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Run Tests (mvn test)                        │
│     - PostgreSQL service available              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Generate Coverage (jacoco:report)           │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Check Coverage (jacoco:check ≥80%)          │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Upload to Codecov                           │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Archive Test Results                        │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Archive Coverage Report                     │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Security Scan (Trivy)                       │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Upload Security Results to GitHub           │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Check for Binary Files                      │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│     Validate OpenAPI Specification              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│          ✅ All Checks Pass                     │
└─────────────────────────────────────────────────┘
```

### Environment Variables

**Available in CI**:
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_USERNAME`: postgres
- `DATABASE_PASSWORD`: postgres

**Spring Profile**: Set via `SPRING_PROFILES_ACTIVE` (defaults to test)

## Troubleshooting

### Build Fails

**Symptom**: Maven compilation fails

**Solutions**:
1. Check Java version: `java -version` (requires 17+)
2. Clear Maven cache: `rm -rf ~/.m2/repository`
3. Run locally: `mvn clean install`

### Tests Fail

**Symptom**: Test execution fails

**Solutions**:
1. Check PostgreSQL is running (locally: `docker-compose up postgres`)
2. Verify database connection settings
3. Run specific test: `mvn test -Dtest=YourTestClass`
4. Check test logs: `target/surefire-reports/`

### Coverage Below 80%

**Symptom**: Jacoco check fails

**Solutions**:
1. Add more unit tests
2. Test edge cases
3. Remove dead code
4. Check coverage report: `target/site/jacoco/index.html`

### Security Scan Fails

**Symptom**: Trivy finds vulnerabilities

**Solutions**:
1. Update dependencies: `mvn versions:display-dependency-updates`
2. Check for security advisories
3. Update `pom.xml` versions
4. Rerun: `mvn clean install`

### Binary Files Detected

**Symptom**: Binary check fails

**Solutions**:
1. Remove large files from commit
2. Add to `.gitignore`
3. Use Git LFS for legitimate large files
4. Place documentation images in `docs/`

### OpenAPI Validation Fails

**Symptom**: Spectral linting errors

**Solutions**:
1. Check YAML syntax
2. Validate against OpenAPI 3.0 schema
3. Run locally: `spectral lint docs/api/openapi.yaml`
4. Fix reported issues

## Best Practices

### Commit Workflow

1. **Make changes**
2. **Run tests locally**: `mvn test`
3. **Check coverage**: `mvn jacoco:report`
4. **Stage changes**: `git add .`
5. **Pre-commit runs automatically**
6. **Commit**: `git commit -m "feat: add feature"`
7. **Push**: `git push`
8. **CI runs on GitHub**
9. **Monitor results**

### Pull Request Workflow

1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Develop and commit**
3. **Push branch**: `git push -u origin feature/my-feature`
4. **Create PR on GitHub**
5. **Wait for CI checks**
6. **Address any failures**
7. **Request review**
8. **Merge when green**

### Branch Protection (Recommended)

For `main` and `develop` branches:
- ✅ Require status checks (CI) to pass
- ✅ Require branches to be up to date
- ✅ Require code review (1+ approvals)
- ✅ Restrict force pushes
- ✅ Require signed commits (optional)

## Performance

### Average CI Runtime

- **Build**: ~2 minutes
- **Tests**: ~1 minute (grows with test suite)
- **Coverage**: ~30 seconds
- **Security Scan**: ~1 minute
- **Total**: ~5 minutes (current state)

**Expected growth**:
- Stage 1: ~8 minutes
- Stage 5: ~15 minutes (microservices)
- Stage 9: ~20 minutes (full stack)

### Optimization Tips

1. **Maven caching**: Already enabled
2. **Parallel tests**: Configure in `surefire` plugin
3. **Selective tests**: Use Maven profiles
4. **Artifact caching**: Enabled for dependencies

## Future Enhancements

Planned additions to CI/CD:

### Stage 2 (Observability)
- Performance benchmarks
- Grafana dashboard screenshots
- Prometheus metrics validation

### Stage 3 (Scale)
- Elasticsearch integration tests
- Redis caching tests
- Kafka event publishing tests

### Stage 4 (Security)
- OWASP Dependency Check
- SAST (Static Application Security Testing)
- License compliance checking

### Stage 5 (Microservices)
- Contract testing (Pact)
- Multi-service integration tests
- Service mesh validation

### Stage 6-9 (Cloud)
- Docker image building
- Container registry push
- Kubernetes manifest validation
- Helm chart linting
- Multi-region deployment tests

## Monitoring CI Health

### GitHub Actions Dashboard

**Location**: `https://github.com/[org]/sagaline/actions`

**Metrics to Watch**:
- Success rate (target: >95%)
- Average duration (track trends)
- Flaky tests (fix immediately)
- Security scan findings

### CI Status Badge

Add to README.md:

```markdown
![CI](https://github.com/[org]/sagaline/workflows/CI/badge.svg)
```

## Support

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Maven Surefire](https://maven.apache.org/surefire/maven-surefire-plugin/)
- [Jacoco](https://www.jacoco.org/jacoco/trunk/doc/)
- [Trivy](https://aquasecurity.github.io/trivy/)
- [Spectral](https://stoplight.io/open-source/spectral)

### Common Issues
- See "Troubleshooting" section above
- Check GitHub Actions logs
- Review Jacoco coverage report
- Examine Trivy security findings

---

**Note**: This CI/CD setup evolves with the project. Expect enhancements at each stage (1-9).
