# 레이어드 CRUD & 트랜잭션 패턴 설계 일지 (Milestone 2.1)
> Issue Tracker 도메인을 통해 Controller-Service-Repository 패턴과 JWT 인증을 구현한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.0에서 구축한 프로젝트 골격 위에 **전형적인 Spring 웹 백엔드 패턴**을 적용한다:
- 레이어드 아키텍처 (Controller-Service-Repository)
- DTO와 Entity 분리
- 트랜잭션 관리
- JWT 기반 인증
- Bean Validation
- 공통 에러 처리

작은 Issue Tracker 도메인을 구현하면서 이 패턴들을 체득한다.

### 1.2 기능 요구사항

#### 1.2.1 도메인 모델

**User (사용자)**
- `id`: Long (PK)
- `email`: String (unique, 로그인 ID)
- `passwordHash`: String (BCrypt 해싱)
- `nickname`: String
- `createdAt`: LocalDateTime

**Project (프로젝트)**
- `id`: Long (PK)
- `name`: String
- `description`: String
- `createdAt`: LocalDateTime

**Issue (이슈)**
- `id`: Long (PK)
- `projectId`: Long (FK)
- `reporterId`: Long (FK to User)
- `assigneeId`: Long (FK to User, nullable)
- `title`: String
- `description`: String (2000자 제한)
- `status`: Enum (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- `createdAt`, `updatedAt`: LocalDateTime
- `viewCount`: Integer (조회수 추적)

**Comment (댓글)**
- `id`: Long (PK)
- `issueId`: Long (FK)
- `authorId`: Long (FK to User)
- `content`: String
- `createdAt`, `updatedAt`: LocalDateTime

#### 1.2.2 API 엔드포인트

**인증 & 사용자:**
- `POST /api/users` - 회원가입
- `POST /api/auth/login` - 로그인 (JWT 발급)

**프로젝트:**
- `POST /api/projects` - 프로젝트 생성
- `GET /api/projects` - 프로젝트 목록

**이슈:**
- `POST /api/projects/{projectId}/issues` - 이슈 생성
- `GET /api/projects/{projectId}/issues?status=&page=&size=` - 이슈 목록 (페이징, 필터링)
- `GET /api/issues/{id}` - 이슈 상세 조회 (조회수 증가)
- `PUT /api/issues/{id}` - 이슈 수정
- `DELETE /api/issues/{id}` - 이슈 삭제
- `GET /api/issues/popular` - 인기 이슈 Top 10 (캐싱)

**댓글:**
- `POST /api/issues/{id}/comments` - 댓글 작성
- `GET /api/issues/{id}/comments` - 댓글 목록

### 1.3 비기능 요구사항

#### 1.3.1 보안
- 비밀번호 BCrypt 해싱 (강도 10)
- JWT 토큰 기반 인증 (HMAC-SHA256)
- 토큰 유효기간 24시간
- Stateless 세션 관리

#### 1.3.2 트랜잭션
- 쓰기 작업: `@Transactional` (기본 전파 REQUIRED)
- 읽기 작업: `@Transactional(readOnly = true)` (최적화)
- 예외 발생 시 자동 롤백

#### 1.3.3 데이터 검증
- 요청 DTO에 Bean Validation 적용
- `@NotBlank`, `@Email`, `@Size` 등 활용
- 검증 실패 시 400 Bad Request + 필드별 에러 메시지

#### 1.3.4 에러 처리
- 공통 에러 응답 포맷: `{ "code": "...", "message": "..." }`
- HTTP 상태 코드 명확히 구분:
  - 401: 인증 실패 (토큰 없음/만료)
  - 403: 인가 실패 (권한 부족, 2.2에서 주로 사용)
  - 404: 리소스 없음
  - 409: 중복 (이메일 등)
  - 500: 서버 에러

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 레이어드 아키텍처인가?

**관심사 분리 (Separation of Concerns):**
```
Controller  → HTTP 처리, DTO 변환, 인증 정보 추출
Service     → 비즈니스 로직, 트랜잭션 경계
Repository  → 데이터 접근, JPA 쿼리
```

**장점:**
- 각 계층의 책임 명확
- 테스트 용이 (계층별 독립 테스트)
- 변경 영향 범위 제한
- 코드 재사용성 향상

**트레이드오프:**
- 간단한 CRUD에도 3개 파일 필요 (보일러플레이트)
- 계층 간 데이터 변환 오버헤드
- → 학습 목적에는 명확성이 더 중요

### 2.2 왜 DTO와 Entity를 분리하는가?

**Entity를 API에 직접 노출하지 않는 이유:**
1. **순환 참조 문제**: 양방향 관계 시 JSON 직렬화 실패
2. **과도한 정보 노출**: 비밀번호 해시, 내부 ID 등 유출
3. **API 계약 고정**: Entity 변경이 API 변경으로 전파
4. **유연성 제한**: API 응답 형식과 DB 스키마 1:1 강제

**DTO 패턴:**
- Request DTO: 클라이언트 → 서버 (Validation 포함)
- Response DTO: 서버 → 클라이언트 (필요한 필드만)
- Entity: 영속성 계층 (JPA 어노테이션)

### 2.3 왜 JWT 인증인가?

**Stateless 인증의 필요성:**
- 서버 메모리에 세션 저장 불필요
- 수평 확장 용이 (여러 서버 인스턴스)
- REST API 원칙 부합 (무상태성)

**JWT 선택 이유:**
- 자체 포함형 (토큰에 사용자 정보 포함)
- 표준 (RFC 7519)
- 라이브러리 성숙도 (JJWT)

**트레이드오프:**
- 토큰 크기 (세션 ID보다 큼)
- 토큰 폐기 어려움 (로그아웃 처리 복잡)
- → 학습 단계에서는 충분히 실용적

### 2.4 왜 트랜잭션을 서비스 계층에 두는가?

**비즈니스 로직의 원자성 보장:**
```java
@Transactional
public IssueResponse createIssue(...) {
    // 1. 프로젝트 존재 확인 (조회)
    // 2. 이슈 생성 (쓰기)
    // 3. DTO 변환
    // → 모두 하나의 트랜잭션 안에서 실행
}
```

**장점:**
- 비즈니스 로직 단위로 트랜잭션 경계 설정
- 여러 Repository 호출을 하나의 트랜잭션으로 묶음
- 예외 시 자동 롤백

**readOnly = true 최적화:**
- Hibernate flush 모드를 MANUAL로 설정 → 변경 감지 스킵
- 읽기 전용 트랜잭션으로 DB에 힌트 제공
- 성능 향상 (특히 대량 조회 시)

---

## 3. 레이어드 아키텍처 설계

### 3.1 전체 구조

```
┌─────────────────────────────────────────┐
│  Controller Layer                       │
│  - HTTP 요청/응답 처리                   │
│  - DTO 변환                             │
│  - Authentication 정보 추출              │
│  - Bean Validation 트리거                │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  Service Layer                           │
│  - 비즈니스 로직                          │
│  - 트랜잭션 경계 (@Transactional)         │
│  - 도메인 규칙 검증                       │
│  - Entity ↔ DTO 변환                     │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  Repository Layer                        │
│  - JpaRepository 인터페이스               │
│  - 커스텀 쿼리 메서드                      │
│  - @Query JPQL/SQL                       │
└──────────────┬───────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│  Database (H2 / PostgreSQL)              │
└──────────────────────────────────────────┘
```

### 3.2 Entity 계층 설계

#### 3.2.1 Issue Entity

**파일:** `issue/domain/Issue.java`

```java
@Entity
@Table(name = "issues")
public class Issue {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long reporterId;

    private Long assigneeId;  // nullable

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IssueStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private Integer viewCount = 0;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (viewCount == null) viewCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // 생성자, getter, setter, 비즈니스 메서드
    public void incrementViewCount() {
        this.viewCount++;
    }
}
```

**설계 포인트:**
- **FK를 Long으로 관리**: `@ManyToOne` 대신 ID만 저장
  - 이유: N+1 문제 회피, 순환 참조 방지, 쿼리 제어 용이
  - 트레이드오프: 객체 그래프 탐색 불가
- **@Enumerated(EnumType.STRING)**: 상태를 문자열로 저장
  - 이유: DB에서 가독성, 순서 변경 시 안전성
- **@PrePersist/@PreUpdate**: 타임스탬프 자동 설정
  - Spring Data JPA의 `@CreatedDate`/`@LastModifiedDate` 대신 직접 구현
  - 의존성 최소화
- **viewCount**: 조회수 추적
  - 인기 이슈 계산용 (2.3에서 캐싱)
  - `incrementViewCount()` 비즈니스 메서드로 캡슐화

#### 3.2.2 User Entity

```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String nickname;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // protected 기본 생성자 (JPA 필수)
    protected User() {}

    // 비즈니스 생성자
    public User(String email, String passwordHash, String nickname) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.nickname = nickname;
    }
}
```

**설계 포인트:**
- **passwordHash 필드명**: 명확히 해싱된 값임을 표현
- **email unique 제약**: DB 레벨에서 중복 방지
- **protected 생성자**: JPA 리플렉션용, 외부 직접 생성 방지

### 3.3 Repository 계층 설계

#### 3.3.1 IssueRepository

```java
public interface IssueRepository extends JpaRepository<Issue, Long> {

    Page<Issue> findByProjectId(Long projectId, Pageable pageable);

    Page<Issue> findByProjectIdAndStatus(Long projectId, IssueStatus status, Pageable pageable);

    @Query("SELECT i FROM Issue i WHERE i.createdAt >= :since ORDER BY (i.viewCount + (SELECT COUNT(c) FROM Comment c WHERE c.issueId = i.id)) DESC")
    List<Issue> findPopularIssues(@Param("since") LocalDateTime since, Pageable pageable);
}
```

**설계 포인트:**
- **메서드 네이밍 쿼리**: `findByProjectIdAndStatus`
  - Spring Data JPA가 자동으로 JPQL 생성
  - 간단한 조건은 메서드명으로 충분
- **@Query로 복잡한 로직**: `findPopularIssues`
  - 조회수 + 댓글수 합산 정렬
  - 서브쿼리 활용
- **Pageable 지원**: 페이징/정렬 자동 처리

#### 3.3.2 UserRepository

```java
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

**설계 포인트:**
- `Optional<User>`: null 대신 Optional로 안전한 조회
- `existsByEmail`: 중복 체크 최적화 (SELECT id만 실행)

### 3.4 Service 계층 설계

#### 3.4.1 IssueService

**파일:** `issue/service/IssueService.java`

```java
@Service
public class IssueService {

    private final IssueRepository issueRepository;
    private final ProjectRepository projectRepository;

    public IssueService(IssueRepository issueRepository,
                        ProjectRepository projectRepository) {
        this.issueRepository = issueRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public IssueResponse createIssue(Long projectId, Long reporterId, IssueRequest request) {
        // 1. 비즈니스 규칙 검증
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project not found: " + projectId);
        }

        // 2. 엔티티 생성
        Issue issue = new Issue(projectId, reporterId,
                                request.getTitle(), request.getDescription());
        if (request.getAssigneeId() != null) {
            issue.setAssigneeId(request.getAssigneeId());
        }

        // 3. 영속화
        Issue savedIssue = issueRepository.save(issue);

        // 4. DTO 변환
        return IssueResponse.from(savedIssue);
    }

    @Transactional(readOnly = true)
    public Page<IssueResponse> getIssuesByProject(Long projectId, IssueStatus status, Pageable pageable) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project not found: " + projectId);
        }

        Page<Issue> issues;
        if (status != null) {
            issues = issueRepository.findByProjectIdAndStatus(projectId, status, pageable);
        } else {
            issues = issueRepository.findByProjectId(projectId, pageable);
        }

        return issues.map(IssueResponse::from);
    }

    @Transactional
    public IssueResponse getIssueById(Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Issue not found: " + id));

        // 조회수 증가 (dirty checking으로 자동 업데이트)
        issue.incrementViewCount();

        return IssueResponse.from(issue);
    }

    @Transactional
    public IssueResponse updateIssue(Long id, IssueUpdateRequest request) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Issue not found: " + id));

        // Null 체크 후 부분 업데이트
        if (request.getTitle() != null) issue.setTitle(request.getTitle());
        if (request.getDescription() != null) issue.setDescription(request.getDescription());
        if (request.getStatus() != null) issue.setStatus(request.getStatus());
        if (request.getAssigneeId() != null) issue.setAssigneeId(request.getAssigneeId());

        // Dirty Checking으로 자동 UPDATE (save 호출 불필요하지만 명시)
        Issue updatedIssue = issueRepository.save(issue);
        return IssueResponse.from(updatedIssue);
    }

    @Transactional
    public void deleteIssue(Long id) {
        if (!issueRepository.existsById(id)) {
            throw new ResourceNotFoundException("Issue not found: " + id);
        }
        issueRepository.deleteById(id);
    }
}
```

**설계 포인트:**
- **생성자 주입**: 필드 주입보다 테스트 용이, 불변성 보장
- **트랜잭션 경계**: 메서드 단위로 `@Transactional` 적용
- **readOnly 최적화**: 조회 메서드는 `readOnly = true`
- **Dirty Checking 활용**: `updateIssue`에서 엔티티 변경만으로 UPDATE
- **예외 기반 흐름 제어**: 리소스 없으면 `ResourceNotFoundException`
- **DTO 변환**: `IssueResponse.from(entity)` 정적 팩토리 메서드

#### 3.4.2 AuthService (인증 서비스)

```java
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public UserResponse registerUser(UserRegistrationRequest request) {
        // 중복 체크
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email already exists: " + request.getEmail());
        }

        // 비밀번호 해싱
        String passwordHash = passwordEncoder.encode(request.getPassword());

        // 엔티티 생성 및 저장
        User user = new User(request.getEmail(), passwordHash, request.getNickname());
        User savedUser = userRepository.save(user);

        return UserResponse.from(savedUser);
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        // 비밀번호 검증
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        // JWT 토큰 발급
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new LoginResponse(token, UserResponse.from(user));
    }
}
```

**설계 포인트:**
- **BCrypt 해싱**: `PasswordEncoder.encode()` 사용
- **검증 실패 메시지 통일**: 이메일/비밀번호 구분하지 않음 (보안)
- **JWT 발급**: 사용자 ID와 이메일을 토큰에 포함

### 3.5 Controller 계층 설계

#### 3.5.1 IssueController

```java
@RestController
@RequestMapping("/api")
public class IssueController {

    private final IssueService issueService;

    @PostMapping("/projects/{projectId}/issues")
    public ResponseEntity<IssueResponse> createIssue(
            @PathVariable Long projectId,
            @Valid @RequestBody IssueRequest request,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        IssueResponse response = issueService.createIssue(projectId, userId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/projects/{projectId}/issues")
    public ResponseEntity<Page<IssueResponse>> getIssues(
            @PathVariable Long projectId,
            @RequestParam(required = false) IssueStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            Pageable pageable) {

        Page<IssueResponse> issues = issueService.getIssuesByProject(projectId, status, pageable);
        return ResponseEntity.ok(issues);
    }

    @GetMapping("/issues/{id}")
    public ResponseEntity<IssueResponse> getIssue(@PathVariable Long id) {
        IssueResponse issue = issueService.getIssueById(id);
        return ResponseEntity.ok(issue);
    }

    @PutMapping("/issues/{id}")
    public ResponseEntity<IssueResponse> updateIssue(
            @PathVariable Long id,
            @Valid @RequestBody IssueUpdateRequest request) {

        IssueResponse updated = issueService.updateIssue(id, request);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/issues/{id}")
    public ResponseEntity<Void> deleteIssue(@PathVariable Long id) {
        issueService.deleteIssue(id);
        return ResponseEntity.noContent().build();
    }
}
```

**설계 포인트:**
- **@Valid 검증**: DTO의 Bean Validation 자동 트리거
- **Authentication 주입**: Spring Security가 JWT 필터를 통해 제공
  - `authentication.getName()`으로 사용자 ID 추출
- **HTTP 상태 코드 명시**: 201 CREATED, 204 NO CONTENT 등
- **@PageableDefault**: 기본 페이징 설정 (크기 20, 생성일 역순)
- **@RequestParam(required = false)**: 선택적 필터링

### 3.6 DTO 설계

#### 3.6.1 Request DTO (IssueRequest)

```java
public class IssueRequest {
    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must be less than 200 characters")
    private String title;

    @Size(max = 2000, message = "Description must be less than 2000 characters")
    private String description;

    private Long assigneeId;  // nullable

    // Getters
}
```

**검증 어노테이션:**
- `@NotBlank`: null, 빈 문자열, 공백만 있는 문자열 거부
- `@Size`: 길이 제한
- 검증 실패 시 400 Bad Request + 필드별 에러 메시지

#### 3.6.2 Response DTO (IssueResponse)

```java
public class IssueResponse {
    private Long id;
    private Long projectId;
    private Long reporterId;
    private Long assigneeId;
    private String title;
    private String description;
    private IssueStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer viewCount;

    // 정적 팩토리 메서드
    public static IssueResponse from(Issue issue) {
        return IssueResponse.builder()
            .id(issue.getId())
            .projectId(issue.getProjectId())
            .reporterId(issue.getReporterId())
            .assigneeId(issue.getAssigneeId())
            .title(issue.getTitle())
            .description(issue.getDescription())
            .status(issue.getStatus())
            .createdAt(issue.getCreatedAt())
            .updatedAt(issue.getUpdatedAt())
            .viewCount(issue.getViewCount())
            .build();
    }

    // Lombok @Builder, @Getter 활용
}
```

**설계 포인트:**
- **from() 정적 메서드**: Entity → DTO 변환 캡슐화
- **필요한 필드만 노출**: passwordHash 같은 민감 정보 제외
- **Lombok 활용**: 보일러플레이트 최소화

---

## 4. JWT 인증 아키텍처

### 4.1 인증 흐름

```
1. 사용자 등록
   POST /api/users
   → AuthService.registerUser()
   → BCrypt 해싱 후 DB 저장

2. 로그인
   POST /api/auth/login
   → AuthService.login()
   → 비밀번호 검증
   → JWT 토큰 발급
   → 클라이언트에 반환

3. 인증된 요청
   GET /api/issues/1
   Authorization: Bearer <JWT>
   → JwtAuthenticationFilter
   → 토큰 파싱 및 검증
   → Authentication 객체 생성
   → SecurityContext에 설정
   → Controller에서 사용
```

### 4.2 JWT 구조

**토큰 생성 (JwtUtil.java):**
```java
public String generateToken(Long userId, String email) {
    Date now = new Date();
    Date expiryDate = new Date(now.getTime() + jwtExpiration);

    return Jwts.builder()
            .setSubject(String.valueOf(userId))  // 사용자 ID
            .claim("email", email)                // 이메일
            .setIssuedAt(now)
            .setExpiration(expiryDate)
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
}
```

**토큰 파싱:**
```java
public Claims parseToken(String token) {
    return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
}
```

**설계 포인트:**
- **Subject**: 사용자 ID (문자열로 저장)
- **Custom Claim**: 이메일 (선택적, 디버깅용)
- **만료 시간**: 24시간 (설정 파일에서 변경 가능)
- **서명 알고리즘**: HMAC-SHA256
- **Secret Key**: application.yml에서 256bit 이상 권장

### 4.3 Spring Security 설정

**SecurityConfig.java:**
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())  // REST API는 CSRF 불필요
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))  // 세션 미사용
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health", "/api/users", "/api/auth/login").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

**설계 포인트:**
- **CSRF 비활성화**: Stateless API에서는 불필요
- **Stateless 세션**: 서버에 세션 저장 안 함
- **공개 엔드포인트**: 헬스체크, 회원가입, 로그인
- **JWT 필터**: `UsernamePasswordAuthenticationFilter` 앞에 배치

### 4.4 JWT 인증 필터

**JwtAuthenticationFilter.java:**
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (token != null && jwtUtil.validateToken(token)) {
            Claims claims = jwtUtil.parseToken(token);
            String userId = claims.getSubject();

            // Authentication 객체 생성 및 SecurityContext 설정
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
```

**동작 흐름:**
1. `Authorization: Bearer <token>` 헤더 추출
2. 토큰 검증 (서명, 만료 시간)
3. Claims에서 사용자 ID 추출
4. `Authentication` 객체 생성
5. `SecurityContext`에 설정
6. Controller에서 `Authentication` 주입받아 사용

---

## 5. 예외 처리 & 에러 응답

### 5.1 커스텀 예외 계층

```
RuntimeException
  ├── ResourceNotFoundException (404)
  ├── DuplicateResourceException (409)
  ├── UnauthorizedException (401)
  └── ForbiddenException (403, 2.2에서 사용)
```

**예시:**
```java
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
```

### 5.2 GlobalExceptionHandler

**파일:** `common/exception/GlobalExceptionHandler.java`

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        ErrorResponse error = new ErrorResponse("RESOURCE_NOT_FOUND", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateResource(DuplicateResourceException ex) {
        ErrorResponse error = new ErrorResponse("DUPLICATE_RESOURCE", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException ex) {
        ErrorResponse error = new ErrorResponse("UNAUTHORIZED", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));

        ErrorResponse error = new ErrorResponse("VALIDATION_ERROR", message);
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        ErrorResponse error = new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
```

**ErrorResponse DTO:**
```java
public class ErrorResponse {
    private String code;      // RESOURCE_NOT_FOUND, VALIDATION_ERROR 등
    private String message;   // 상세 메시지
    private LocalDateTime timestamp;

    public ErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }
}
```

**설계 포인트:**
- **@RestControllerAdvice**: 모든 컨트롤러에 적용
- **예외별 핸들러**: 명확한 HTTP 상태 코드 매핑
- **Bean Validation 에러**: 필드별 메시지 결합
- **Generic Exception**: 500 처리, 상세 정보 노출 방지

---

## 6. 테스트 전략

### 6.1 테스트 계층별 전략

**1. 서비스 계층 단위 테스트**
- Repository를 실제 DB로 테스트 (통합 테스트 성격)
- `@DataJpaTest` 또는 `@SpringBootTest` 사용

**예시: IssueServiceTest**
```java
@SpringBootTest
@Transactional
class IssueServiceTest {

    @Autowired
    private IssueService issueService;

    @Autowired
    private IssueRepository issueRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Test
    void createIssue_성공() {
        // Given
        Project project = projectRepository.save(new Project("Test Project", ""));
        IssueRequest request = new IssueRequest("Bug fix", "Fix login bug");

        // When
        IssueResponse response = issueService.createIssue(project.getId(), 1L, request);

        // Then
        assertThat(response.getTitle()).isEqualTo("Bug fix");
        assertThat(response.getStatus()).isEqualTo(IssueStatus.OPEN);
    }

    @Test
    void createIssue_프로젝트없음_예외() {
        // Given
        IssueRequest request = new IssueRequest("Bug", "Desc");

        // When & Then
        assertThatThrownBy(() -> issueService.createIssue(999L, 1L, request))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("Project not found");
    }
}
```

**2. 컨트롤러 통합 테스트**
- `@SpringBootTest` + `@AutoConfigureMockMvc`
- 실제 HTTP 요청 시뮬레이션
- JWT 인증 포함

**예시: IssueIntegrationTest**
```java
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class IssueIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    private String authToken;
    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.save(new User("test@example.com", "hash", "Tester"));
        authToken = jwtUtil.generateToken(testUser.getId(), testUser.getEmail());
    }

    @Test
    void createIssue_인증성공() throws Exception {
        String requestBody = """
            {
                "title": "Bug fix",
                "description": "Fix critical bug"
            }
            """;

        mockMvc.perform(post("/api/projects/1/issues")
                .header("Authorization", "Bearer " + authToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Bug fix"))
            .andExpect(jsonPath("$.status").value("OPEN"));
    }

    @Test
    void createIssue_인증없음_401() throws Exception {
        mockMvc.perform(post("/api/projects/1/issues")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void createIssue_검증실패_400() throws Exception {
        String requestBody = """
            {
                "title": "",
                "description": "Desc"
            }
            """;

        mockMvc.perform(post("/api/projects/1/issues")
                .header("Authorization", "Bearer " + authToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
}
```

### 6.2 테스트 검증 항목

**기능 테스트:**
- [x] 이슈 생성 → 조회 플로우
- [x] 이슈 상태 변경 (OPEN → IN_PROGRESS)
- [x] 이슈 삭제
- [x] 댓글 작성 및 조회
- [x] 페이징 및 정렬
- [x] 상태별 필터링

**인증 테스트:**
- [x] 로그인 성공 → JWT 토큰 발급
- [x] 잘못된 비밀번호 → 401
- [x] 토큰 없이 접근 → 401
- [x] 만료된 토큰 → 401

**검증 테스트:**
- [x] 빈 제목으로 이슈 생성 → 400
- [x] 이메일 형식 오류 → 400
- [x] 중복 이메일 가입 → 409

**트랜잭션 테스트:**
- [x] 예외 발생 시 롤백 확인
- [x] readOnly 트랜잭션에서 쓰기 시도 (예상: 예외 또는 무시)

---

## 7. 완료 기준 및 검증

### 7.1 로컬 검증

**1. 회원가입 및 로그인:**
```bash
# 회원가입
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","nickname":"Tester"}'

# 로그인
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 응답: {"token":"eyJhbGc...","user":{...}}
```

**2. 이슈 CRUD:**
```bash
# 이슈 생성 (JWT 필요)
curl -X POST http://localhost:8080/api/projects/1/issues \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Bug fix","description":"Fix login bug"}'

# 이슈 조회
curl http://localhost:8080/api/issues/1 \
  -H "Authorization: Bearer <TOKEN>"

# 이슈 목록 (페이징)
curl "http://localhost:8080/api/projects/1/issues?page=0&size=10&sort=createdAt,desc" \
  -H "Authorization: Bearer <TOKEN>"
```

**3. 테스트 실행:**
```bash
./gradlew test

# 결과 확인:
# IssueServiceTest - 5 tests passed
# IssueIntegrationTest - 8 tests passed
# AuthServiceTest - 4 tests passed
```

### 7.2 완료 체크리스트

- [x] User, Project, Issue, Comment 엔티티 구현
- [x] Repository 인터페이스 정의 (JpaRepository 상속)
- [x] Service 계층 비즈니스 로직 및 트랜잭션 관리
- [x] Controller 계층 HTTP 엔드포인트
- [x] Request/Response DTO 및 Bean Validation
- [x] JWT 인증 구현 (JwtUtil, JwtAuthenticationFilter, SecurityConfig)
- [x] GlobalExceptionHandler 공통 에러 처리
- [x] 서비스 계층 단위 테스트
- [x] 컨트롤러 통합 테스트 (MockMvc + JWT)
- [x] 인증/검증/에러 응답 테스트
- [x] CI 파이프라인에서 모든 테스트 통과
- [x] 로컬에서 전체 CRUD 플로우 동작 확인

---

## 8. 설계 결정 사항 및 트레이드오프

### 8.1 FK를 ID로 관리 vs @ManyToOne

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| ID 관리 (Long projectId) | N+1 방지, 쿼리 제어 용이, 순환 참조 없음 | 객체 그래프 탐색 불가 | **선택**: 성능 최적화 우선 |
| @ManyToOne | 객체지향적, 편리한 탐색 | N+1 문제, JSON 순환 참조 | 학습 후 선택적 사용 가능 |

### 8.2 JWT vs Session

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| JWT | Stateless, 확장 용이, REST 원칙 | 토큰 폐기 어려움, 크기 큼 | **선택**: 학습 목적 + 현대적 패턴 |
| Session | 서버 제어 용이, 작은 크기 | Stateful, 확장 복잡 | 전통적 방식, 대규모에 부적합 |

### 8.3 readOnly 트랜잭션 효과

**측정 불가 수준이지만 개념 학습:**
- Hibernate flush 모드 변경 → Dirty Checking 스킵
- DB 힌트 제공 → 일부 DB는 읽기 전용 최적화
- **트레이드오프**: 메서드마다 명시 필요 → 보일러플레이트 증가

---

## 9. 알려진 제약 & 향후 개선점

### 9.1 현재 제약

1. **JWT 토큰 폐기 불가**
   - 로그아웃해도 토큰은 만료 시까지 유효
   - 개선: Redis Blacklist 또는 토큰 재발급 전략

2. **권한 제어 미흡**
   - 누구나 모든 이슈 수정/삭제 가능
   - 개선: 2.2에서 팀 기반 RBAC 추가

3. **비밀번호 정책 없음**
   - 최소 길이, 복잡도 검증 없음
   - 개선: `@Pattern` 검증 추가 가능

4. **페이징 최적화 부족**
   - `COUNT(*)` 쿼리 항상 실행
   - 개선: 큰 데이터셋에서는 커서 기반 페이징 고려

### 9.2 다음 마일스톤 (2.2)에서 추가될 것

**도메인:**
- Team, TeamMember, WorkspaceItem

**패턴:**
- Role-Based Access Control (OWNER, MANAGER, MEMBER)
- 권한 체크 로직 (`assertCanManageMembers` 등)
- 401 / 403 / 404 명확한 구분

**테스트:**
- 동일 API를 다른 역할로 호출 시 응답 차이 검증

---

## 10. 결론

Milestone 2.1에서 확립한 것:
- ✅ 레이어드 아키텍처 (Controller-Service-Repository)
- ✅ DTO와 Entity 분리 패턴
- ✅ 트랜잭션 관리 (`@Transactional`, `readOnly`)
- ✅ JWT 기반 Stateless 인증
- ✅ Bean Validation 및 공통 에러 처리
- ✅ 통합 테스트 (MockMvc + JWT)

**핵심 성과:**
- Spring 웹 백엔드의 **표준 패턴**을 작은 도메인에 적용
- 이후 마일스톤에서 이 패턴을 **재사용/확장** 가능
- CI에서 모든 테스트 자동 검증

**다음 단계 (Milestone 2.2):**
- 팀/역할 도메인 추가
- 세밀한 권한 제어 (RBAC)
- 403 Forbidden vs 404 Not Found 구분
