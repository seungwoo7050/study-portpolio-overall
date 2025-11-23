# Stage 4.1: Security (보안)

## 📋 목차
- [개요](#개요)
- [1. PII 암호화](#1-pii-암호화)
- [2. JWT 인증 및 Refresh Token](#2-jwt-인증-및-refresh-token)
- [3. OAuth2 통합](#3-oauth2-통합)
- [4. 보안 헤더](#4-보안-헤더)
- [5. 추가 보안 기능](#5-추가-보안-기능)
- [6. 보안 스캔](#6-보안-스캔)
- [메트릭 및 모니터링](#메트릭-및-모니터링)
- [트러블슈팅](#트러블슈팅)

---

## 개요

Stage 4.1에서는 **보안(Security)** 기능을 구현하여 데이터 보호, 인증/인가, 취약점 방지를 수행합니다.

### 주요 기능
- **PII 암호화**: Jasypt를 이용한 AES-256 암호화로 민감 정보 보호
- **JWT + Refresh Token**: 단기 액세스 토큰 + 장기 리프레시 토큰 전략
- **OAuth2 통합**: Kakao OAuth 2.0 소셜 로그인
- **보안 헤더**: XSS, Clickjacking, MIME Sniffing 방지
- **보안 스캔**: OWASP Dependency Check, Trivy 컨테이너 스캔

### 기술 스택
- **Jasypt**: PII 암호화 (AES-256)
- **jjwt**: JWT 토큰 생성/검증
- **Spring Security**: 인증/인가 프레임워크
- **Spring Security OAuth2 Client**: OAuth2 통합
- **OWASP Dependency Check**: 취약점 스캔
- **Trivy**: 컨테이너 이미지 스캔

---

## 1. PII 암호화

### 1.1 개요
개인 식별 정보(PII)를 데이터베이스에 저장할 때 **암호화**하여 데이터 유출 시에도 안전하게 보호합니다.

### 1.2 암호화 알고리즘
```java
// EncryptionConfig.java:25
config.setAlgorithm("PBEWithHMACSHA512AndAES_256");
config.setKeyObtentionIterations("1000");
config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
config.setIvGeneratorClassName("org.jasypt.iv.RandomIvGenerator");
```

**주요 특징**:
- **알고리즘**: PBEWithHMACSHA512AndAES_256 (PBKDF2 + AES-256)
- **Salt**: RandomSaltGenerator (매 암호화마다 다른 salt)
- **IV**: RandomIvGenerator (초기화 벡터 랜덤 생성)
- **Iterations**: 1000회 키 생성 반복

### 1.3 JPA Converter를 이용한 자동 암호화/복호화
```java
// PiiEncryptionConverter.java:18
@Converter
@Component
public class PiiEncryptionConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return attribute;
        }

        try {
            String encrypted = encryptor.encrypt(attribute);
            log.debug("PII data encrypted for storage");
            return encrypted;
        } catch (Exception e) {
            log.error("Failed to encrypt PII data", e);
            throw new RuntimeException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return dbData;
        }

        try {
            String decrypted = encryptor.decrypt(dbData);
            log.debug("PII data decrypted from storage");
            return decrypted;
        } catch (Exception e) {
            log.error("Failed to decrypt PII data", e);
            return null;
        }
    }
}
```

### 1.4 사용 예시
```java
// User.java:39
@Column(name = "phone_number")
@Convert(converter = PiiEncryptionConverter.class)
private String phoneNumber;
```

**동작 방식**:
1. **저장 시**: `convertToDatabaseColumn()` 호출 → 암호화된 문자열 DB 저장
2. **조회 시**: `convertToEntityAttribute()` 호출 → 복호화된 문자열 반환

### 1.5 설정
```yaml
# application.yml:131
encryption:
  secret: ${ENCRYPTION_SECRET:Sagaline2025SecureEncryptionKey}
```

**보안 권장사항**:
- `ENCRYPTION_SECRET`은 환경 변수로 주입 (코드에 하드코딩 금지)
- 최소 32자 이상의 강력한 암호화 키 사용
- 키 순환(Key Rotation) 정책 수립

---

## 2. JWT 인증 및 Refresh Token

### 2.1 개요
**Access Token**(단기)과 **Refresh Token**(장기)을 분리하여 보안성과 사용성을 균형있게 제공합니다.

### 2.2 토큰 전략
| 토큰 타입 | 만료 시간 | 용도 | 저장 위치 |
|---------|---------|-----|---------|
| Access Token | 15분 | API 요청 인증 | 메모리 (클라이언트) |
| Refresh Token | 7일 | Access Token 재발급 | DB (서버) |

### 2.3 JWT 토큰 생성
```java
// JwtTokenProvider.java:30
public String createToken(String email, Long userId, Set<UserRole> roles) {
    Date now = new Date();
    Date validity = new Date(now.getTime() + validityInMilliseconds);

    return Jwts.builder()
            .subject(email)
            .claim("userId", userId)
            .claim("roles", roles.stream()
                    .map(Enum::name)
                    .collect(Collectors.toList()))
            .issuedAt(now)
            .expiration(validity)
            .signWith(secretKey)
            .compact();
}

// JwtTokenProvider.java:76
public String createRefreshToken(String email, Long userId) {
    Date now = new Date();
    Date validity = new Date(now.getTime() + refreshValidityInMilliseconds);

    return Jwts.builder()
            .subject(email)
            .claim("userId", userId)
            .claim("tokenType", "refresh")  // Refresh token 구분
            .issuedAt(now)
            .expiration(validity)
            .signWith(secretKey)
            .compact();
}
```

**주요 특징**:
- **알고리즘**: HMAC-SHA256 (HS256)
- **Payload**: email (subject), userId, roles
- **서명**: SecretKey로 서명하여 위변조 방지

### 2.4 Refresh Token 관리
```java
// RefreshTokenService.java:24
@Transactional
public RefreshToken createRefreshToken(User user) {
    // 기존 토큰 무효화 (단일 디바이스 전략)
    revokeAllUserTokens(user);

    // 새 Refresh Token 생성
    String tokenString = jwtTokenProvider.createRefreshToken(user.getEmail(), user.getId());
    LocalDateTime expiresAt = LocalDateTime.now()
            .plusSeconds(jwtTokenProvider.getRefreshValidityInMilliseconds() / 1000);

    RefreshToken refreshToken = RefreshToken.builder()
            .token(tokenString)
            .user(user)
            .expiresAt(expiresAt)
            .build();

    RefreshToken saved = refreshTokenRepository.save(refreshToken);
    log.info("Created refresh token for user: {}", user.getEmail());
    return saved;
}
```

### 2.5 Token Rotation (토큰 순환)
```java
// RefreshTokenService.java:58
@Transactional
public void revokeAllUserTokens(User user) {
    refreshTokenRepository.revokeAllByUser(user, LocalDateTime.now());
    log.info("Revoked all refresh tokens for user: {}", user.getEmail());
}
```

**Token Rotation 전략**:
1. 로그인 시 새 Refresh Token 발급
2. 기존 Refresh Token 모두 무효화 (`revoked = true`)
3. 단일 디바이스만 활성 상태 유지
4. 탈취된 토큰 사용 시 즉시 감지 가능

### 2.6 자동 정리 (Scheduled Task)
```java
// RefreshTokenService.java:80
@Scheduled(cron = "0 0 2 * * ?")  // 매일 새벽 2시
@Transactional
public void cleanupExpiredTokens() {
    LocalDateTime now = LocalDateTime.now();
    refreshTokenRepository.deleteExpiredTokens(now);
    log.info("Cleaned up expired refresh tokens");
}
```

### 2.7 인증 흐름
```
[클라이언트 로그인]
    ↓
[Access Token + Refresh Token 발급]
    ↓
[Access Token으로 API 요청]
    ↓
[15분 후 Access Token 만료]
    ↓
[Refresh Token으로 새 Access Token 발급]
    ↓
[7일 후 Refresh Token 만료]
    ↓
[재로그인 필요]
```

### 2.8 설정
```yaml
# application.yml:125
jwt:
  secret: ${JWT_SECRET:aVerySecureSecretKeyForJWTTokenGenerationThatIsAtLeast256BitsLong}
  expiration: ${JWT_EXPIRATION:900000}  # 15 minutes
  refresh-expiration: ${JWT_REFRESH_EXPIRATION:604800000}  # 7 days
```

---

## 3. OAuth2 통합

### 3.1 개요
Kakao OAuth 2.0을 통한 **소셜 로그인**을 지원하여 사용자 편의성을 높입니다.

### 3.2 OAuth2 설정
```yaml
# application.yml:105
security:
  oauth2:
    client:
      registration:
        kakao:
          client-id: ${KAKAO_CLIENT_ID:your-kakao-client-id}
          client-secret: ${KAKAO_CLIENT_SECRET:your-kakao-client-secret}
          redirect-uri: "{baseUrl}/login/oauth2/code/kakao"
          authorization-grant-type: authorization_code
          client-authentication-method: client_secret_post
          scope: profile_nickname, account_email
          client-name: Kakao
      provider:
        kakao:
          authorization-uri: https://kauth.kakao.com/oauth/authorize
          token-uri: https://kauth.kakao.com/oauth/token
          user-info-uri: https://kapi.kakao.com/v2/user/me
          user-name-attribute: id
```

### 3.3 Spring Security OAuth2 통합
```java
// SecurityConfig.java:52
if (clientRegistrationRepository != null) {
    http.oauth2Login(oauth2 -> oauth2
            .successHandler(oAuth2LoginSuccessHandler)
    );
}
```

### 3.4 OAuth2 인증 흐름
```
[사용자 "카카오 로그인" 클릭]
    ↓
[Kakao 인증 페이지로 리다이렉트]
    ↓
[사용자 카카오 계정으로 로그인]
    ↓
[Kakao가 인가 코드 발급]
    ↓
[서버가 인가 코드로 액세스 토큰 교환]
    ↓
[Kakao API로 사용자 정보 조회]
    ↓
[OAuth2LoginSuccessHandler 실행]
    ↓
[JWT Access Token + Refresh Token 발급]
    ↓
[클라이언트에 토큰 반환]
```

### 3.5 보안 고려사항
- `client-secret`은 환경 변수로 주입 (코드에 노출 금지)
- HTTPS 필수 (중간자 공격 방지)
- `state` 파라미터로 CSRF 방지 (Spring Security 자동 처리)

---

## 4. 보안 헤더

### 4.1 개요
HTTP 보안 헤더를 설정하여 **XSS, Clickjacking, MIME Sniffing** 등의 공격을 방지합니다.

### 4.2 구현
```java
// SecurityHeadersConfig.java:26
@Override
public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException {

    HttpServletResponse httpResponse = (HttpServletResponse) response;

    // Content Security Policy - Prevent XSS attacks
    httpResponse.setHeader("Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'");

    // X-Content-Type-Options - Prevent MIME sniffing
    httpResponse.setHeader("X-Content-Type-Options", "nosniff");

    // X-Frame-Options - Prevent clickjacking
    httpResponse.setHeader("X-Frame-Options", "DENY");

    // X-XSS-Protection - Enable browser XSS protection
    httpResponse.setHeader("X-XSS-Protection", "1; mode=block");

    // Referrer-Policy - Control referrer information
    httpResponse.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions-Policy - Control browser features
    httpResponse.setHeader("Permissions-Policy",
            "geolocation=(), microphone=(), camera=()");

    chain.doFilter(request, response);
}
```

### 4.3 보안 헤더 설명
| 헤더 | 목적 | 설정 값 |
|-----|------|--------|
| **Content-Security-Policy** | XSS 공격 방지 | `default-src 'self'` (동일 출처만 허용) |
| **X-Content-Type-Options** | MIME Sniffing 방지 | `nosniff` |
| **X-Frame-Options** | Clickjacking 방지 | `DENY` (iframe 사용 금지) |
| **X-XSS-Protection** | 브라우저 XSS 필터 활성화 | `1; mode=block` |
| **Referrer-Policy** | Referrer 정보 제어 | `strict-origin-when-cross-origin` |
| **Permissions-Policy** | 브라우저 기능 제한 | 위치, 마이크, 카메라 비활성화 |

### 4.4 HSTS (Strict-Transport-Security)
```java
// SecurityHeadersConfig.java:52 (Production 환경에서만 활성화)
// httpResponse.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
```

**HSTS 효과**:
- 브라우저가 항상 HTTPS로만 접속
- HTTP 요청을 자동으로 HTTPS로 리다이렉트
- 중간자 공격(MITM) 방지

---

## 5. 추가 보안 기능

### 5.1 BCrypt 비밀번호 해싱
```java
// SecurityConfig.java:67
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

**BCrypt 특징**:
- **Salt 자동 생성**: 매 해싱마다 다른 salt 사용
- **강력한 해싱**: Rainbow Table 공격 무효화
- **작업 인자 조정 가능**: CPU 비용 증가로 브루트포스 방지

### 5.2 SQL Injection 방지
```java
// JPA 사용으로 자동 방지
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);  // Prepared Statement 자동 사용
}
```

**JPA의 SQL Injection 방지**:
- Prepared Statement 자동 사용
- 파라미터 바인딩으로 안전한 쿼리 실행
- Native Query 사용 시 주의 필요

### 5.3 Rate Limiting
```java
// Stage 3.2 (caching-redis.md)에서 구현
// Redis 기반 IP별 Rate Limiting: 100 req/min
```

### 5.4 CORS 설정
```java
// SecurityConfig.java (필요 시 추가)
// .cors(cors -> cors.configurationSource(corsConfigurationSource()))
```

---

## 6. 보안 스캔

### 6.1 개요
**OWASP Dependency Check**와 **Trivy**를 사용하여 의존성 취약점과 컨테이너 이미지 취약점을 스캔합니다.

### 6.2 보안 스캔 스크립트
```bash
# scripts/security-scan.sh:13
echo "Running OWASP Dependency Check..."
mvn org.owasp:dependency-check-maven:check

# scripts/security-scan.sh:18
echo "Building Docker image for Trivy scan..."
docker build -t sagaline:latest .

# scripts/security-scan.sh:22
echo "Running Trivy container scan..."
trivy image --severity HIGH,CRITICAL sagaline:latest
```

### 6.3 OWASP Dependency Check
```bash
# pom.xml에 플러그인 추가
<plugin>
    <groupId>org.owasp</groupId>
    <artifactId>dependency-check-maven</artifactId>
    <version>8.4.0</version>
    <configuration>
        <failBuildOnCVSS>7</failBuildOnCVSS>
        <suppressionFiles>
            <suppressionFile>owasp-suppressions.xml</suppressionFile>
        </suppressionFiles>
    </configuration>
</plugin>
```

**주요 기능**:
- Maven/Gradle 의존성 취약점 스캔
- CVE 데이터베이스와 비교
- CVSS 7.0 이상 발견 시 빌드 실패

**보고서 위치**:
```
target/dependency-check/dependency-check-report.html
```

### 6.4 Trivy Container Scan
```bash
trivy image --severity HIGH,CRITICAL sagaline:latest
```

**주요 기능**:
- 컨테이너 이미지 취약점 스캔
- OS 패키지, 애플리케이션 의존성 검사
- HIGH/CRITICAL 취약점만 필터링

### 6.5 CI/CD 통합
```yaml
# .github/workflows/ci.yml (예시)
- name: Run Security Scan
  run: |
    chmod +x scripts/security-scan.sh
    ./scripts/security-scan.sh
```

---

## 메트릭 및 모니터링

### 보안 메트릭
```java
// 메트릭 수집 예시
meterRegistry.counter("security.pii.encryption.success").increment();
meterRegistry.counter("security.pii.encryption.failure").increment();
meterRegistry.counter("security.jwt.validation.success").increment();
meterRegistry.counter("security.jwt.validation.failure").increment();
meterRegistry.counter("security.oauth2.login.success").increment();
meterRegistry.counter("security.refresh_token.rotation").increment();
```

### Grafana 대시보드 쿼리
```promql
# JWT 검증 실패율
rate(security_jwt_validation_failure_total[5m]) /
rate(security_jwt_validation_total[5m]) * 100

# PII 암호화 실패 건수
increase(security_pii_encryption_failure_total[1h])

# OAuth2 로그인 성공률
rate(security_oauth2_login_success_total[5m]) /
rate(security_oauth2_login_total[5m]) * 100
```

---

## 트러블슈팅

### 문제 1: PII 복호화 실패
**증상**:
```
Failed to decrypt PII data
```

**원인**:
- 암호화 키 변경
- 데이터 손상

**해결**:
```bash
# 암호화 키 확인
echo $ENCRYPTION_SECRET

# 키가 변경된 경우 재암호화 필요
# 데이터 손상 시 백업에서 복구
```

### 문제 2: JWT 검증 실패
**증상**:
```
JwtException: Invalid JWT signature
```

**원인**:
- JWT Secret 키 불일치
- 토큰 만료

**해결**:
```bash
# JWT Secret 확인
echo $JWT_SECRET

# 토큰 재발급
curl -X POST /api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "..."}'
```

### 문제 3: OAuth2 로그인 실패
**증상**:
```
OAuth2AuthenticationException: invalid_client
```

**원인**:
- Kakao Client ID/Secret 오류
- Redirect URI 불일치

**해결**:
```bash
# Kakao Developers Console 확인
# 1. Client ID, Client Secret 확인
# 2. Redirect URI 등록 확인: http://localhost:8080/login/oauth2/code/kakao
# 3. 활성화 상태 확인
```

### 문제 4: 보안 헤더 누락
**증상**:
- 브라우저 콘솔에 CSP 위반 경고

**원인**:
- SecurityHeadersConfig 필터 미등록
- 필터 순서 문제

**해결**:
```java
// SecurityHeadersConfig.java:17
@Order(Ordered.HIGHEST_PRECEDENCE)  // 최우선 순위 확인
public class SecurityHeadersConfig implements Filter {
```

### 문제 5: OWASP Dependency Check 실패
**증상**:
```
One or more dependencies were identified with known vulnerabilities
```

**원인**:
- 취약한 의존성 사용

**해결**:
```bash
# 취약점 보고서 확인
open target/dependency-check/dependency-check-report.html

# 의존성 업데이트
mvn versions:display-dependency-updates

# 특정 라이브러리 버전 업그레이드
# pom.xml에서 버전 수정
```

---

## 정리

Stage 4.1에서는 다음과 같은 **보안 기능**을 구현했습니다:

1. ✅ **PII 암호화**: Jasypt AES-256으로 전화번호 등 민감 정보 보호
2. ✅ **JWT + Refresh Token**: Access Token(15분) + Refresh Token(7일) 분리 전략
3. ✅ **OAuth2 통합**: Kakao 소셜 로그인 지원
4. ✅ **보안 헤더**: XSS, Clickjacking 등 웹 취약점 방어
5. ✅ **추가 보안**: BCrypt, SQL Injection 방지, Rate Limiting
6. ✅ **보안 스캔**: OWASP Dependency Check, Trivy 컨테이너 스캔

다음 단계: **Stage 4.2 - Resilience (복원력)** 구현
