# 사용자 관리 & 인증 시스템 설계 일지 (User & Authentication Domain)
> JWT 기반 인증, OAuth 2.0 통합, PII 암호화를 포함한 사용자 관리 시스템 설계

## 1. 문제 정의 & 요구사항

### 1.1 목표

안전하고 확장 가능한 사용자 인증 시스템 구축:
- 이메일/비밀번호 기반 회원가입 및 로그인
- JWT 기반 Stateless 인증
- Refresh Token을 통한 장기 세션 관리
- Kakao OAuth 2.0 소셜 로그인
- 역할 기반 접근 제어 (RBAC)
- 개인정보(PII) 암호화

### 1.2 기능 요구사항

#### 1.2.1 사용자 관리
- **회원가입**
  - 이메일 중복 검증
  - 비밀번호 암호화 (BCrypt)
  - 기본 역할(USER) 자동 부여
  - 전화번호 PII 암호화 저장

- **로그인**
  - 이메일/비밀번호 검증
  - 계정 활성화 상태 확인
  - Last Login 시간 업데이트
  - JWT Access Token + Refresh Token 발급

- **토큰 갱신**
  - Refresh Token 검증
  - 새로운 Access Token 발급
  - Refresh Token 재사용 (Single Rotation)

#### 1.2.2 OAuth 2.0 (Kakao)
- Authorization Code Flow
- Kakao Profile 정보 조회
- 자동 회원가입 (첫 로그인 시)
- JWT 토큰 발급

#### 1.2.3 역할 기반 접근 제어
- 역할: USER, ADMIN
- 엔드포인트별 역할 검증
- `@PreAuthorize` 어노테이션

### 1.3 비기능 요구사항

#### 1.3.1 보안
- 비밀번호: BCrypt (cost factor 10)
- JWT: HS256 알고리즘
- PII 암호화: AES-256-GCM
- Access Token 만료: 15분
- Refresh Token 만료: 7일
- CSRF 방어: Stateless (비활성화)

#### 1.3.2 성능
- 회원가입/로그인 응답: p99 < 200ms
- Token 검증: < 10ms (메모리 기반)
- DB 쿼리 최적화 (인덱스 활용)

#### 1.3.3 가용성
- 인증 실패 시에도 서비스 유지
- DB 장애 시 Graceful Degradation

---

## 2. 도메인 모델 설계

### 2.1 엔티티 구조

#### 2.1.1 User 엔티티
```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;  // BCrypt

    @Column(nullable = false)
    private String name;

    @Column(name = "phone_number")
    @Convert(converter = PiiEncryptionConverter.class)
    private String phoneNumber;  // AES-256 암호화

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastLoginAt;

    private Boolean isActive = true;
    private Boolean isEmailVerified = false;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private Set<UserRoleEntity> roles = new HashSet<>();
}
```

**설계 결정:**
- `email`: 유니크 제약조건으로 중복 방지
- `passwordHash`: 원본 비밀번호는 저장하지 않음
- `phoneNumber`: `@Convert`로 자동 암호화/복호화
- `roles`: Eager Loading으로 인증 시 한 번에 조회

#### 2.1.2 UserRoleEntity 엔티티
```java
@Entity
@Table(name = "user_roles")
public class UserRoleEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;  // ROLE_USER, ROLE_ADMIN

    private LocalDateTime createdAt;
}
```

**유니크 제약:**
```sql
UNIQUE(user_id, role)  -- 동일 역할 중복 방지
```

#### 2.1.3 RefreshToken 엔티티
```java
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, unique = true)
    private String token;  // UUID

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean isValid = true;  // Revocation 지원

    private LocalDateTime createdAt;
}
```

**토큰 관리:**
- 사용자당 여러 Refresh Token 가능 (다중 기기)
- `isValid` 플래그로 토큰 무효화
- 만료된 토큰은 정기 삭제 (Scheduled Task)

### 2.2 데이터베이스 스키마

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),  -- 암호화됨
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

---

## 3. 인증 흐름 설계

### 3.1 회원가입 흐름

```
Client: POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "홍길동",
  "phoneNumber": "010-1234-5678"
}

↓

AuthController.register()
  ↓
UserService.register()
  ├─ 1. 이메일 중복 체크 (userRepository.existsByEmail)
  ├─ 2. 비밀번호 암호화 (passwordEncoder.encode)
  ├─ 3. User 엔티티 생성 및 저장
  ├─ 4. 기본 역할(ROLE_USER) 부여
  ├─ 5. 메트릭 기록 (businessMetrics.incrementUserRegistrations)
  ├─ 6. JWT Access Token 생성
  ├─ 7. Refresh Token 생성 및 저장
  └─ 8. AuthResponse 반환

↓

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "d7f8a9b0-...",
  "expiresIn": 900,  // 15분 (초 단위)
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "roles": ["ROLE_USER"]
  }
}
```

**핵심 로직:**
```java
public AuthResponse register(RegisterRequest request) {
    // 중복 체크
    if (userRepository.existsByEmail(request.getEmail())) {
        throw new IllegalArgumentException("Email already registered");
    }

    // User 생성
    User user = User.builder()
        .email(request.getEmail())
        .passwordHash(passwordEncoder.encode(request.getPassword()))
        .name(request.getName())
        .phoneNumber(request.getPhoneNumber())  // 자동 암호화
        .build();

    user = userRepository.save(user);

    // 역할 부여
    UserRoleEntity roleEntity = UserRoleEntity.builder()
        .user(user)
        .role(UserRole.ROLE_USER)
        .build();
    user.getRoles().add(roleEntity);
    userRepository.save(user);

    // JWT 생성
    String accessToken = jwtTokenProvider.createToken(
        user.getEmail(), user.getId(), getRoles(user)
    );
    String refreshToken = refreshTokenService.createRefreshToken(user).getToken();

    return AuthResponse.of(accessToken, refreshToken, expiresIn, toDTO(user));
}
```

### 3.2 로그인 흐름

```
Client: POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

↓

UserService.login()
  ├─ 1. 이메일로 사용자 조회
  ├─ 2. 비밀번호 검증 (passwordEncoder.matches)
  ├─ 3. 계정 활성화 확인 (isActive)
  ├─ 4. Last Login 시간 업데이트
  ├─ 5. JWT Access Token 생성
  ├─ 6. Refresh Token 생성
  └─ 7. AuthResponse 반환

↓

Response: (회원가입과 동일 형식)
```

**핵심 로직:**
```java
public AuthResponse login(LoginRequest request) {
    User user = userRepository.findByEmail(request.getEmail())
        .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

    // 비밀번호 검증
    if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
        throw new IllegalArgumentException("Invalid email or password");
    }

    // 활성화 확인
    if (!user.getIsActive()) {
        throw new IllegalStateException("Account is deactivated");
    }

    // Last Login 업데이트
    user.setLastLoginAt(LocalDateTime.now());
    userRepository.save(user);

    // Token 생성
    String accessToken = jwtTokenProvider.createToken(...);
    String refreshToken = refreshTokenService.createRefreshToken(user).getToken();

    return AuthResponse.of(accessToken, refreshToken, expiresIn, toDTO(user));
}
```

### 3.3 JWT 인증 필터 체인

```
HTTP Request
  ↓
JwtAuthenticationFilter.doFilterInternal()
  ├─ 1. Authorization 헤더 추출
  ├─ 2. "Bearer " prefix 제거
  ├─ 3. JWT 토큰 검증 (jwtTokenProvider.validateToken)
  ├─ 4. 토큰에서 userId 추출
  ├─ 5. SecurityContext에 인증 정보 저장
  └─ 6. FilterChain.doFilter() 계속

↓

Controller Method
@GetMapping("/api/orders")
public List<OrderDTO> getMyOrders(@AuthenticationPrincipal Long userId) {
    // userId는 SecurityContext에서 자동 주입됨
    return orderService.findByUserId(userId);
}
```

**JwtAuthenticationFilter 핵심 로직:**
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) {
        String token = extractTokenFromRequest(request);

        if (token != null && jwtTokenProvider.validateToken(token)) {
            Long userId = jwtTokenProvider.getUserIdFromToken(token);
            String email = jwtTokenProvider.getEmailFromToken(token);

            // SecurityContext에 인증 정보 설정
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    userId,  // principal
                    null,    // credentials
                    Collections.emptyList()  // authorities
                );

            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
```

### 3.4 Refresh Token 흐름

```
Client: POST /api/auth/refresh
{
  "refreshToken": "d7f8a9b0-c1e2-4f5g-h6i7-j8k9l0m1n2o3"
}

↓

UserService.refreshAccessToken()
  ├─ 1. Refresh Token 조회 (DB)
  ├─ 2. 만료 시간 검증
  ├─ 3. 유효성 확인 (isValid = true)
  ├─ 4. 사용자 정보 조회
  ├─ 5. 새로운 Access Token 생성
  └─ 6. AuthResponse 반환 (동일한 Refresh Token)

↓

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",  // 새로 생성
  "refreshToken": "d7f8a9b0-...",           // 동일
  "expiresIn": 900,
  "user": {...}
}
```

**RefreshTokenService 핵심 로직:**
```java
@Service
public class RefreshTokenService {
    public RefreshToken createRefreshToken(User user) {
        RefreshToken refreshToken = RefreshToken.builder()
            .user(user)
            .token(UUID.randomUUID().toString())
            .expiresAt(LocalDateTime.now().plusDays(7))
            .isValid(true)
            .build();

        return refreshTokenRepository.save(refreshToken);
    }

    public void verifyExpiration(RefreshToken token) {
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            refreshTokenRepository.delete(token);
            throw new IllegalArgumentException("Refresh token expired");
        }
    }
}
```

---

## 4. JWT 토큰 설계

### 4.1 Access Token 구조

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "user@example.com",
  "userId": 1,
  "roles": ["ROLE_USER"],
  "iat": 1700000000,
  "exp": 1700000900  // 15분 후
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### 4.2 JWT 토큰 생성 로직

```java
@Component
public class JwtTokenProvider {
    private final SecretKey secretKey;
    private final long validityInMilliseconds = 900_000;  // 15분

    public JwtTokenProvider(@Value("${jwt.secret}") String secret) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String createToken(String email, Long userId, Set<UserRole> roles) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInMilliseconds);

        return Jwts.builder()
            .subject(email)
            .claim("userId", userId)
            .claim("roles", roles.stream().map(Enum::name).toList())
            .issuedAt(now)
            .expiration(validity)
            .signWith(secretKey)
            .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Long getUserIdFromToken(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .get("userId", Long.class);
    }
}
```

---

## 5. PII 암호화 설계

### 5.1 PII 데이터 식별

**암호화 대상:**
- 전화번호 (phone_number)
- 향후: 주소 (address), 주민등록번호 등

**비암호화 대상:**
- 이메일: 로그인 ID로 사용, 검색 필요
- 이름: 검색 가능성, 일반적으로 공개 정보

### 5.2 JPA Converter 기반 자동 암호화

```java
@Component
public class PiiEncryptionConverter implements AttributeConverter<String, String> {
    private final Cipher encryptCipher;
    private final Cipher decryptCipher;

    public PiiEncryptionConverter(@Value("${encryption.secret}") String secret) {
        try {
            SecretKey key = new SecretKeySpec(secret.getBytes(), "AES");
            this.encryptCipher = Cipher.getInstance("AES/GCM/NoPadding");
            this.decryptCipher = Cipher.getInstance("AES/GCM/NoPadding");
            // GCM 파라미터 설정...
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize encryption", e);
        }
    }

    @Override
    public String convertToDatabaseColumn(String plainText) {
        if (plainText == null) return null;
        try {
            byte[] encrypted = encryptCipher.doFinal(plainText.getBytes());
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String cipherText) {
        if (cipherText == null) return null;
        try {
            byte[] decrypted = decryptCipher.doFinal(Base64.getDecoder().decode(cipherText));
            return new String(decrypted);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
```

**사용:**
```java
@Entity
public class User {
    @Convert(converter = PiiEncryptionConverter.class)
    private String phoneNumber;
    // DB 저장 시: "010-1234-5678" → "ZnJhbWV3b3JrMjAyNQ=="
    // 조회 시: "ZnJhbWV3b3JrMjAyNQ==" → "010-1234-5678"
}
```

---

## 6. OAuth 2.0 (Kakao) 통합

### 6.1 OAuth 2.0 Authorization Code Flow

```
1. 사용자: GET /oauth2/authorization/kakao
   → Kakao 로그인 페이지로 리다이렉트

2. Kakao: 사용자 로그인 및 동의
   → Callback: GET /login/oauth2/code/kakao?code=abc123

3. Backend:
   ├─ Authorization Code로 Access Token 요청
   ├─ Kakao User Info API 호출
   ├─ 신규 사용자면 자동 회원가입
   ├─ JWT Access Token + Refresh Token 발급
   └─ Frontend로 리다이렉트

4. Frontend: JWT 토큰 저장 및 사용
```

### 6.2 Spring Security OAuth2 설정

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
            authorization-grant-type: authorization_code
            scope: profile_nickname, account_email
        provider:
          kakao:
            authorization-uri: https://kauth.kakao.com/oauth/authorize
            token-uri: https://kauth.kakao.com/oauth/token
            user-info-uri: https://kapi.kakao.com/v2/user/me
            user-name-attribute: id
```

### 6.3 OAuth2 Success Handler

```java
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        // Kakao 프로필에서 정보 추출
        Map<String, Object> attributes = oAuth2User.getAttributes();
        String kakaoId = attributes.get("id").toString();
        Map<String, Object> kakaoAccount = (Map) attributes.get("kakao_account");
        String email = (String) kakaoAccount.get("email");

        // 사용자 조회 또는 생성
        User user = userRepository.findByEmail(email)
            .orElseGet(() -> createUserFromKakao(email, kakaoAccount));

        // JWT 토큰 생성
        String accessToken = jwtTokenProvider.createToken(...);
        String refreshToken = refreshTokenService.createRefreshToken(user).getToken();

        // Frontend로 리다이렉트 (토큰 포함)
        String redirectUrl = String.format(
            "%s?accessToken=%s&refreshToken=%s",
            "http://localhost:3000/auth/callback",
            accessToken,
            refreshToken
        );

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}
```

---

## 7. 보안 고려사항

### 7.1 비밀번호 정책

**BCrypt 설정:**
```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(10);  // Cost factor 10
}
```

**강도 요구사항 (향후):**
- 최소 8자
- 영문 대소문자, 숫자, 특수문자 조합
- 회원가입/변경 시 검증

### 7.2 JWT Secret 관리

**환경 변수:**
```bash
export JWT_SECRET="aVerySecureSecretKeyThatIsAtLeast256BitsLong"
export ENCRYPTION_SECRET="Sagaline2025SecureEncryptionKey32b"
```

**Kubernetes Secret (향후):**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-secrets
type: Opaque
data:
  jwt-secret: YVZlcnlTZWN1cmVT...  # Base64 encoded
  encryption-secret: U2FnYWxpbmUy...
```

### 7.3 Rate Limiting

**인증 엔드포인트 보호:**
```java
@PostMapping("/api/auth/login")
@RateLimit(limit = 5, window = 60)  // 1분당 5회
public AuthResponse login(@RequestBody LoginRequest request) {
    return userService.login(request);
}
```

**구현:**
- Redis 기반 Sliding Window
- IP 또는 이메일 기준
- 실패 시 429 Too Many Requests

---

## 8. 테스트 전략

### 8.1 유닛 테스트

**UserService 테스트:**
```java
@Test
void register_Success() {
    // Given
    RegisterRequest request = RegisterRequest.builder()
        .email("test@example.com")
        .password("password123")
        .build();

    when(userRepository.existsByEmail(any())).thenReturn(false);
    when(passwordEncoder.encode(any())).thenReturn("hashed");

    // When
    AuthResponse response = userService.register(request);

    // Then
    assertThat(response.getAccessToken()).isNotNull();
    assertThat(response.getUser().getEmail()).isEqualTo("test@example.com");
    verify(userRepository).save(any(User.class));
}

@Test
void register_DuplicateEmail_ThrowsException() {
    when(userRepository.existsByEmail(any())).thenReturn(true);

    assertThatThrownBy(() -> userService.register(request))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessage("Email already registered");
}
```

### 8.2 통합 테스트

**인증 E2E 테스트:**
```java
@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTest {
    @Test
    void registerAndLogin_E2E() {
        // 1. 회원가입
        mockMvc.perform(post("/api/auth/register")
            .contentType(APPLICATION_JSON)
            .content(registerJson))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists());

        // 2. 로그인
        mockMvc.perform(post("/api/auth/login")
            .content(loginJson))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("test@example.com"));

        // 3. 인증된 엔드포인트 접근
        mockMvc.perform(get("/api/orders")
            .header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk());
    }
}
```

### 8.3 보안 테스트

**JWT 검증 테스트:**
```java
@Test
void invalidToken_Unauthorized() {
    mockMvc.perform(get("/api/orders")
        .header("Authorization", "Bearer invalid.token.here"))
        .andExpect(status().isUnauthorized());
}

@Test
void expiredToken_Unauthorized() {
    String expiredToken = createExpiredToken();

    mockMvc.perform(get("/api/orders")
        .header("Authorization", "Bearer " + expiredToken))
        .andExpect(status().isUnauthorized());
}
```

---

## 9. 성능 최적화

### 9.1 데이터베이스 쿼리 최적화

**Eager Loading:**
```java
@Entity
public class User {
    @OneToMany(fetch = FetchType.EAGER)
    private Set<UserRoleEntity> roles;
    // 인증 시 roles를 항상 사용하므로 Eager
    // N+1 문제 방지
}
```

**인덱스 활용:**
```sql
CREATE INDEX idx_users_email ON users(email);
-- 로그인 시: WHERE email = ? (인덱스 사용)
```

### 9.2 Refresh Token 정리

**Scheduled Task:**
```java
@Scheduled(cron = "0 0 3 * * ?")  // 매일 새벽 3시
public void cleanupExpiredTokens() {
    LocalDateTime cutoff = LocalDateTime.now();
    int deleted = refreshTokenRepository.deleteByExpiresAtBefore(cutoff);
    log.info("Cleaned up {} expired refresh tokens", deleted);
}
```

---

## 10. 검증 체크리스트

- [ ] 회원가입 성공 (이메일 중복 검증 포함)
- [ ] 로그인 성공 (JWT 토큰 발급)
- [ ] 잘못된 비밀번호로 로그인 실패
- [ ] 비활성 계정 로그인 차단
- [ ] Refresh Token으로 Access Token 갱신
- [ ] 만료된 Refresh Token 거부
- [ ] JWT 토큰으로 보호된 엔드포인트 접근
- [ ] 잘못된 JWT 토큰 거부
- [ ] 전화번호 PII 암호화 저장 확인
- [ ] Kakao OAuth 로그인 (Mock)
- [ ] 역할 기반 접근 제어 (ADMIN 전용 엔드포인트)
- [ ] Rate Limiting 동작 (로그인 5회 제한)
- [ ] Last Login 시간 업데이트
- [ ] 테스트 커버리지 ≥ 80%
