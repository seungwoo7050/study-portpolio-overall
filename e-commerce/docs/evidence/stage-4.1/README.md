# Stage 4.1: Security - Implementation Evidence

## Overview
This document provides evidence of the security features implemented in Stage 4.1.

## Implemented Features

### 1. PII Encryption at Rest ✅
**Location**: `src/main/java/com/sagaline/common/security/PiiEncryptionConverter.java`

**Implementation**:
- AES-256 encryption using Jasypt
- Automatic encryption/decryption at JPA layer
- Applied to sensitive fields:
  - `User.phoneNumber`

**Configuration**:
- Encryption key configured via environment variable `ENCRYPTION_SECRET`
- Algorithm: PBEWithHMACSHA512AndAES_256

**Validation**:
```bash
# Test PII encryption
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123","name":"Test","phoneNumber":"010-1234-5678"}'

# Check database - phoneNumber should be encrypted
psql -U postgres -d sagaline -c "SELECT phone_number FROM users WHERE email='test@example.com';"
```

### 2. JWT Refresh Tokens ✅
**Location**:
- `src/main/java/com/sagaline/user/domain/RefreshToken.java`
- `src/main/java/com/sagaline/user/service/RefreshTokenService.java`

**Implementation**:
- Separate refresh tokens with longer expiration (7 days vs 15 minutes for access tokens)
- Token rotation on refresh
- Automatic cleanup of expired tokens (daily scheduled task)
- Single device strategy (revokes old tokens on new login)

**Endpoints**:
- `POST /api/auth/login` - Returns both access and refresh tokens
- `POST /api/auth/refresh` - Exchange refresh token for new access token

**Validation**:
```bash
# Login and get tokens
RESPONSE=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}')

ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.accessToken')
REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.refreshToken')

# Wait for access token to expire or refresh immediately
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

### 3. Kakao OAuth 2.0 ✅
**Location**:
- `src/main/java/com/sagaline/common/security/OAuth2LoginSuccessHandler.java`
- `src/main/resources/application.yml`

**Implementation**:
- OAuth 2.0 client configuration for Kakao
- Automatic user creation on first OAuth login
- Email verification bypassed for OAuth users (verified by Kakao)
- Returns JWT tokens after successful OAuth flow

**Configuration**:
```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          kakao:
            client-id: ${KAKAO_CLIENT_ID}
            client-secret: ${KAKAO_CLIENT_SECRET}
            redirect-uri: "{baseUrl}/login/oauth2/code/kakao"
```

**Validation**:
1. Register app at https://developers.kakao.com/
2. Set environment variables: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
3. Access: `http://localhost:8080/oauth2/authorization/kakao`
4. Complete Kakao login flow
5. Redirected with access_token and refresh_token

### 4. Security Headers ✅
**Location**: `src/main/java/com/sagaline/common/config/SecurityHeadersConfig.java`

**Implemented Headers**:
- `Content-Security-Policy`: Prevents XSS attacks
- `X-Content-Type-Options: nosniff`: Prevents MIME sniffing
- `X-Frame-Options: DENY`: Prevents clickjacking
- `X-XSS-Protection`: Browser XSS protection
- `Referrer-Policy`: Controls referrer information
- `Permissions-Policy`: Controls browser features

**Validation**:
```bash
curl -I http://localhost:8080/api/health | grep -E "X-|Content-Security-Policy"
```

### 5. SQL Injection Prevention ✅
**Implementation**:
- All database access through JPA/Hibernate
- Parameterized queries only
- No raw SQL with string concatenation

**Validation**:
```bash
# Attempt SQL injection
curl "http://localhost:8080/api/products?category='; DROP TABLE products;--"
# Should be safely escaped
```

### 6. Rate Limiting ✅
**Location**: `src/main/java/com/sagaline/common/ratelimit/RateLimitService.java`

**Implementation**:
- Redis-based rate limiting
- 100 requests per minute per IP
- Fail-open strategy (allows requests if Redis unavailable)

**Validation**:
```bash
# Test rate limiting
for i in {1..101}; do
  curl -w "%{http_code}\n" http://localhost:8080/api/products
done
# Should see 429 (Too Many Requests) after 100 requests
```

### 7. Security Scanning ✅
**Location**: `scripts/security-scan.sh`

**Tools**:
- OWASP Dependency Check (Maven plugin)
- Trivy (container scanning - optional)

**Configuration**:
- Fails build on CVSS score ≥ 7
- Generates HTML and JSON reports

**Run**:
```bash
./scripts/security-scan.sh
```

## Security Test Results

### Password Hashing
- Algorithm: BCrypt
- Rounds: 10 (default)
- Passwords never stored in plain text

### HTTPS/TLS
- Configured for production via `Strict-Transport-Security` header (commented out in dev)
- Recommended: Use reverse proxy (nginx) for TLS termination

### Session Management
- Stateless JWT-based authentication
- No server-side sessions
- Token expiration enforced

## Known Limitations

1. **Kakao OAuth**: Requires valid client credentials to test (mock in dev)
2. **HTTPS**: Not enforced in development (use reverse proxy in production)
3. **CSRF**: Disabled for REST API (stateless JWT approach)

## Security Checklist

- [x] PII encryption at rest
- [x] JWT refresh tokens
- [x] OAuth 2.0 (Kakao) integration
- [x] Security headers (XSS, clickjacking, etc.)
- [x] SQL injection prevention (JPA)
- [x] Rate limiting
- [x] Password hashing (BCrypt)
- [x] Security scanning setup
- [x] No secrets in code (environment variables)

## Recommendations for Production

1. Enable HSTS header (`Strict-Transport-Security`)
2. Use hardware security module (HSM) for encryption keys
3. Implement Web Application Firewall (WAF)
4. Enable audit logging for security events
5. Set up intrusion detection system (IDS)
6. Regular security penetration testing
7. Keep dependencies updated

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Spring Security Documentation: https://docs.spring.io/spring-security/reference/
- Kakao OAuth 2.0: https://developers.kakao.com/docs/latest/en/kakaologin/rest-api
