# 팀 & 역할 기반 권한(RBAC) 설계 일지 (Milestone 2.2)
> 팀/역할 도메인을 설계하고 ROLE 기반 권한 제어 패턴을 구현한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.1의 레이어드 아키텍처 위에 **역할 기반 접근 제어(RBAC)**를 추가한다:
- Team 도메인 설계 (팀, 멤버십, 워크스페이스 아이템)
- OWNER / MANAGER / MEMBER 역할 정의
- 역할에 따른 행동 허용/차단 로직
- 401 / 403 / 404 HTTP 상태 코드 명확한 구분

작은 팀 협업 도메인을 통해 **권한 제어 패턴**을 학습한다.

### 1.2 기능 요구사항

#### 1.2.1 도메인 모델

**Team (팀)**
- `id`: Long (PK)
- `name`: String
- `createdAt`: LocalDateTime

**TeamMember (팀 멤버십)**
- `id`: Long (PK)
- `teamId`: Long (FK to Team)
- `userId`: Long (FK to User)
- `role`: Enum (OWNER, MANAGER, MEMBER)
- `joinedAt`: LocalDateTime

**WorkspaceItem (워크스페이스 공유 리소스)**
- `id`: Long (PK)
- `teamId`: Long (FK to Team)
- `title`: String
- `content`: String
- `createdBy`: Long (FK to User)
- `createdAt`, `updatedAt`: LocalDateTime

#### 1.2.2 역할 정의 및 권한

| 역할 | 권한 |
|------|------|
| OWNER | 모든 작업 수행, 멤버 추가/삭제/역할 변경, 워크스페이스 아이템 CRUD |
| MANAGER | 멤버 추가/역할 변경 (OWNER 제외), 워크스페이스 아이템 CRUD |
| MEMBER | 워크스페이스 아이템 조회만 가능, 생성/수정/삭제 불가 |

**비즈니스 규칙:**
- 팀 생성 시 생성자가 자동으로 OWNER가 됨
- 팀에는 최소 1명의 OWNER가 존재해야 함
- 마지막 OWNER를 삭제하거나 역할 변경 불가

#### 1.2.3 API 엔드포인트

**팀 관리:**
- `POST /api/teams` - 팀 생성 (생성자가 OWNER)
- `GET /api/teams` - 내가 속한 팀 목록
- `GET /api/teams/{id}` - 팀 상세 (멤버만 조회 가능)

**팀 멤버 관리:**
- `GET /api/teams/{id}/members` - 멤버 목록 (멤버만 조회 가능)
- `POST /api/teams/{id}/members` - 멤버 추가 (OWNER/MANAGER만)
- `PATCH /api/teams/{id}/members/{memberId}` - 역할 변경 (OWNER/MANAGER만)
- `DELETE /api/teams/{id}/members/{memberId}` - 멤버 삭제 (OWNER/MANAGER만)

**워크스페이스 아이템:**
- `POST /api/teams/{teamId}/items` - 아이템 생성 (OWNER/MANAGER만)
- `GET /api/teams/{teamId}/items` - 아이템 목록 (멤버만 조회 가능)
- `GET /api/items/{id}` - 아이템 상세 (팀 멤버만)
- `PUT /api/items/{id}` - 아이템 수정 (OWNER/MANAGER만)
- `DELETE /api/items/{id}` - 아이템 삭제 (OWNER/MANAGER만)

### 1.3 비기능 요구사항

#### 1.3.1 보안 & 권한
- 모든 엔드포인트는 JWT 인증 필요 (2.1에서 구축)
- 역할 기반 권한 체크를 서비스 계층에서 수행
- 권한 없을 시 명확한 HTTP 상태 코드 반환

#### 1.3.2 HTTP 상태 코드 정책

| 상황 | 상태 코드 | 예시 |
|------|-----------|------|
| 인증 안 됨 | 401 Unauthorized | JWT 토큰 없음/만료 |
| 권한 부족 | 403 Forbidden | MEMBER가 멤버 추가 시도 |
| 리소스 없음 (공개) | 404 Not Found | 존재하지 않는 아이템 ID |
| 리소스 없음 (권한 이유) | 404 Not Found | 팀 멤버가 아닌 경우 (정보 유출 방지) |

**404 vs 403 구분 원칙:**
- 팀 멤버십 자체가 없으면 → **404** (팀 존재 여부 숨김)
- 팀 멤버지만 역할이 부족하면 → **403** (권한 부족 명시)

#### 1.3.3 데이터 일관성
- 마지막 OWNER 삭제/역할 변경 시도 → `IllegalArgumentException` (400)
- 중복 멤버 추가 시도 → `IllegalArgumentException` (400)
- 트랜잭션 내에서 검증 및 변경 수행

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 RBAC인가?

**역할 기반 접근 제어 (Role-Based Access Control):**
- 사용자에게 **역할**을 부여하고, 역할에 따라 권한 결정
- 개별 사용자마다 권한 설정보다 관리 용이
- 확장성: 새 역할 추가 시 기존 로직 변경 최소화

**대안: ACL (Access Control List):**
- 각 리소스마다 사용자별 권한 정의
- 세밀한 제어 가능하지만 복잡도 높음
- → 학습 목적에서는 RBAC가 더 직관적

### 2.2 왜 서비스 계층에서 권한 체크인가?

**선택지:**
1. **Controller에서 체크**: `@PreAuthorize` 등 Spring Security 어노테이션
2. **Service에서 체크**: 비즈니스 로직으로 명시적 검증
3. **Database 제약**: Row-Level Security (PostgreSQL 등)

**선택: Service 계층**
- **이유**:
  - 비즈니스 규칙으로 표현 (마지막 OWNER 삭제 방지 등)
  - 테스트 용이 (Spring Security 모킹 불필요)
  - 명확한 예외 메시지 및 로그
- **트레이드오프**:
  - 보일러플레이트 코드 증가 (`assertCanManageMembers` 등)
  - Spring Security의 선언적 방식보다 번거로움

### 2.3 404 vs 403 전략

**보안 고려사항:**
- **403 Forbidden**: 리소스 존재를 확인시켜줌
  - 공격자가 팀 ID를 추측하여 존재 여부 확인 가능
- **404 Not Found**: 리소스 존재 여부 숨김
  - 팀 멤버가 아니면 팀 존재 자체를 알 수 없음

**우리의 정책:**
```java
// 팀 멤버가 아닌 경우 → 404 (팀 존재 숨김)
private void assertTeamMember(Long userId, Long teamId) {
    if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
        throw new ResourceNotFoundException("Team not found");
    }
}

// 팀 멤버지만 역할 부족 → 403 (권한 부족 명시)
private void assertCanManageMembers(Long userId, Long teamId) {
    TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

    if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.MANAGER) {
        throw new ForbiddenException("Only OWNER or MANAGER can manage team members");
    }
}
```

### 2.4 마지막 OWNER 보호 패턴

**비즈니스 불변성:**
- 팀에는 항상 최소 1명의 OWNER가 있어야 함
- OWNER가 1명일 때:
  - 삭제 시도 → 차단
  - MANAGER/MEMBER로 역할 변경 → 차단

**구현 전략:**
```java
// OWNER 수 카운트
int ownerCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER);

if (member.getRole() == TeamRole.OWNER && ownerCount <= 1) {
    throw new IllegalArgumentException("Cannot remove the last owner");
}
```

**트레이드오프:**
- 추가 DB 쿼리 필요 (COUNT)
- 트랜잭션 격리 레벨에 따라 동시성 이슈 가능
- → 학습 단계에서는 충분히 안전

---

## 3. 도메인 설계

### 3.1 Entity 구조

#### 3.1.1 TeamRole Enum

**파일:** `team/domain/TeamRole.java`

```java
public enum TeamRole {
    OWNER,      // 모든 권한
    MANAGER,    // 멤버 관리 + 워크스페이스 편집
    MEMBER      // 워크스페이스 조회만
}
```

**설계 포인트:**
- 3개 역할로 단순화
- Enum으로 타입 안전성 보장
- DB 저장 시 `EnumType.STRING` 사용 (가독성, 순서 변경 안전)

#### 3.1.2 Team Entity

```java
@Entity
@Table(name = "teams")
public class Team {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    protected Team() {}

    public Team(String name) {
        this.name = name;
    }
}
```

**설계 포인트:**
- 팀 자체는 단순한 엔티티 (이름과 생성일만)
- 멤버십은 별도 엔티티로 분리 (정규화)

#### 3.1.3 TeamMember Entity

```java
@Entity
@Table(name = "team_members",
       uniqueConstraints = @UniqueConstraint(columnNames = {"teamId", "userId"}))
public class TeamMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long teamId;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TeamRole role;

    @Column(nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }

    protected TeamMember() {}

    public TeamMember(Long teamId, Long userId, TeamRole role) {
        this.teamId = teamId;
        this.userId = userId;
        this.role = role;
    }

    public void setRole(TeamRole role) {
        this.role = role;
    }
}
```

**설계 포인트:**
- **Unique 제약**: (teamId, userId) 복합 유니크 → 중복 멤버십 방지
- **role 필드**: 역할 정보 저장, 변경 가능 (setter)
- **joinedAt**: 가입 시각 추적 (분석/감사용)

#### 3.1.4 WorkspaceItem Entity

```java
@Entity
@Table(name = "workspace_items")
public class WorkspaceItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long teamId;

    @Column(nullable = false)
    private String title;

    @Column(length = 5000)
    private String content;

    @Column(nullable = false)
    private Long createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    protected WorkspaceItem() {}

    public WorkspaceItem(Long teamId, String title, String content, Long createdBy) {
        this.teamId = teamId;
        this.title = title;
        this.content = content;
        this.createdBy = createdBy;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
```

**설계 포인트:**
- 팀에 속한 공유 리소스 (문서, 노트 등)
- `createdBy`: 생성자 추적 (향후 소유자 기반 권한 확장 가능)
- `content`: 5000자 제한 (간단한 메모 수준)

### 3.2 Repository 계층

#### 3.2.1 TeamMemberRepository

```java
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByUserId(Long userId);

    List<TeamMember> findByTeamId(Long teamId);

    Optional<TeamMember> findByTeamIdAndUserId(Long teamId, Long userId);

    boolean existsByTeamIdAndUserId(Long teamId, Long userId);

    int countByTeamIdAndRole(Long teamId, TeamRole role);
}
```

**쿼리 메서드 활용:**
- `findByUserId`: 사용자가 속한 팀 멤버십 조회 (내 팀 목록용)
- `findByTeamIdAndUserId`: 특정 팀 내 멤버십 조회 (권한 체크용)
- `existsByTeamIdAndUserId`: 멤버 여부만 확인 (최적화)
- `countByTeamIdAndRole`: 특정 역할 수 카운트 (마지막 OWNER 체크용)

#### 3.2.2 WorkspaceItemRepository

```java
public interface WorkspaceItemRepository extends JpaRepository<WorkspaceItem, Long> {
    List<WorkspaceItem> findByTeamId(Long teamId);
}
```

---

## 4. Service 계층 설계

### 4.1 TeamService 핵심 로직

**파일:** `team/service/TeamService.java`

```java
@Service
@Transactional(readOnly = true)
public class TeamService {

    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;

    // 생성자 주입...

    @Transactional
    public TeamResponse createTeam(Long userId, CreateTeamRequest request) {
        // 1. 사용자 존재 확인
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }

        // 2. 팀 생성
        Team team = new Team(request.getName());
        team = teamRepository.save(team);

        // 3. 생성자를 OWNER로 추가
        TeamMember ownerMember = new TeamMember(team.getId(), userId, TeamRole.OWNER);
        teamMemberRepository.save(ownerMember);

        return TeamResponse.from(team);
    }

    public List<TeamResponse> getMyTeams(Long userId) {
        // 1. 사용자가 속한 멤버십 조회
        List<TeamMember> memberships = teamMemberRepository.findByUserId(userId);

        // 2. 팀 ID 목록 추출
        List<Long> teamIds = memberships.stream()
            .map(TeamMember::getTeamId)
            .collect(Collectors.toList());

        // 3. 팀 정보 조회 및 DTO 변환
        return teamRepository.findAllById(teamIds).stream()
            .map(TeamResponse::from)
            .collect(Collectors.toList());
    }

    public TeamResponse getTeam(Long userId, Long teamId) {
        // 멤버 여부 확인 (404 if not member)
        assertTeamMember(userId, teamId);

        Team team = teamRepository.findById(teamId)
            .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        return TeamResponse.from(team);
    }

    @Transactional
    public TeamMemberResponse addTeamMember(Long userId, Long teamId, AddTeamMemberRequest request) {
        // 1. 권한 체크 (OWNER/MANAGER만 가능)
        assertCanManageMembers(userId, teamId);

        // 2. 대상 사용자 존재 확인
        if (!userRepository.existsById(request.getUserId())) {
            throw new ResourceNotFoundException("User not found");
        }

        // 3. 중복 멤버십 체크
        if (teamMemberRepository.existsByTeamIdAndUserId(teamId, request.getUserId())) {
            throw new IllegalArgumentException("User is already a team member");
        }

        // 4. 멤버 추가
        TeamMember member = new TeamMember(teamId, request.getUserId(), request.getRole());
        member = teamMemberRepository.save(member);

        return TeamMemberResponse.from(member);
    }

    @Transactional
    public TeamMemberResponse updateTeamMemberRole(Long userId, Long teamId, Long memberId,
                                                     UpdateTeamMemberRoleRequest request) {
        // 1. 권한 체크
        assertCanManageMembers(userId, teamId);

        // 2. 대상 멤버 조회
        TeamMember member = teamMemberRepository.findById(memberId)
            .orElseThrow(() -> new ResourceNotFoundException("Team member not found"));

        // 3. 팀 일치 확인
        if (!member.getTeamId().equals(teamId)) {
            throw new ResourceNotFoundException("Team member not found in this team");
        }

        // 4. 마지막 OWNER 보호
        if (member.getRole() == TeamRole.OWNER && request.getRole() != TeamRole.OWNER) {
            int ownerCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER);
            if (ownerCount <= 1) {
                throw new IllegalArgumentException("Cannot remove the last owner");
            }
        }

        // 5. 역할 변경
        member.setRole(request.getRole());
        member = teamMemberRepository.save(member);

        return TeamMemberResponse.from(member);
    }

    @Transactional
    public void removeTeamMember(Long userId, Long teamId, Long memberId) {
        // 1. 권한 체크
        assertCanManageMembers(userId, teamId);

        // 2. 대상 멤버 조회
        TeamMember member = teamMemberRepository.findById(memberId)
            .orElseThrow(() -> new ResourceNotFoundException("Team member not found"));

        // 3. 팀 일치 확인
        if (!member.getTeamId().equals(teamId)) {
            throw new ResourceNotFoundException("Team member not found in this team");
        }

        // 4. 마지막 OWNER 보호
        if (member.getRole() == TeamRole.OWNER) {
            int ownerCount = teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER);
            if (ownerCount <= 1) {
                throw new IllegalArgumentException("Cannot remove the last owner");
            }
        }

        // 5. 삭제
        teamMemberRepository.delete(member);
    }

    // === 권한 체크 헬퍼 메서드 ===

    private void assertTeamMember(Long userId, Long teamId) {
        if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
            // 404 반환 (팀 존재 여부 숨김)
            throw new ResourceNotFoundException("Team not found");
        }
    }

    private void assertCanManageMembers(Long userId, Long teamId) {
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.MANAGER) {
            // 403 반환 (권한 부족)
            throw new ForbiddenException("Only OWNER or MANAGER can manage team members");
        }
    }
}
```

**설계 포인트:**
- **권한 체크 헬퍼**: `assertTeamMember`, `assertCanManageMembers`
  - 재사용 가능, 예외 타입으로 HTTP 상태 결정
- **비즈니스 규칙 검증**: 마지막 OWNER 보호 로직
- **명확한 예외 메시지**: 디버깅 및 클라이언트 피드백 향상

### 4.2 WorkspaceItemService

```java
@Service
@Transactional(readOnly = true)
public class WorkspaceItemService {

    private final WorkspaceItemRepository itemRepository;
    private final TeamMemberRepository teamMemberRepository;

    @Transactional
    public WorkspaceItemResponse createItem(Long userId, Long teamId,
                                             CreateWorkspaceItemRequest request) {
        // OWNER/MANAGER만 생성 가능
        assertCanEditWorkspace(userId, teamId);

        WorkspaceItem item = new WorkspaceItem(teamId, request.getTitle(),
                                                 request.getContent(), userId);
        item = itemRepository.save(item);

        return WorkspaceItemResponse.from(item);
    }

    public List<WorkspaceItemResponse> getItems(Long userId, Long teamId) {
        // 팀 멤버만 조회 가능
        assertTeamMember(userId, teamId);

        return itemRepository.findByTeamId(teamId).stream()
            .map(WorkspaceItemResponse::from)
            .collect(Collectors.toList());
    }

    public WorkspaceItemResponse getItem(Long userId, Long itemId) {
        WorkspaceItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        // 팀 멤버만 조회 가능
        assertTeamMember(userId, item.getTeamId());

        return WorkspaceItemResponse.from(item);
    }

    @Transactional
    public WorkspaceItemResponse updateItem(Long userId, Long itemId,
                                             UpdateWorkspaceItemRequest request) {
        WorkspaceItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        // OWNER/MANAGER만 수정 가능
        assertCanEditWorkspace(userId, item.getTeamId());

        if (request.getTitle() != null) item.setTitle(request.getTitle());
        if (request.getContent() != null) item.setContent(request.getContent());

        item = itemRepository.save(item);
        return WorkspaceItemResponse.from(item);
    }

    @Transactional
    public void deleteItem(Long userId, Long itemId) {
        WorkspaceItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        // OWNER/MANAGER만 삭제 가능
        assertCanEditWorkspace(userId, item.getTeamId());

        itemRepository.delete(item);
    }

    // === 권한 체크 헬퍼 ===

    private void assertTeamMember(Long userId, Long teamId) {
        if (!teamMemberRepository.existsByTeamIdAndUserId(teamId, userId)) {
            throw new ResourceNotFoundException("Team not found");
        }
    }

    private void assertCanEditWorkspace(Long userId, Long teamId) {
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        if (member.getRole() == TeamRole.MEMBER) {
            throw new ForbiddenException("MEMBER role cannot edit workspace items");
        }
    }
}
```

**설계 포인트:**
- **MEMBER는 읽기 전용**: `assertCanEditWorkspace`에서 MEMBER 차단
- **일관된 권한 체크 패턴**: TeamService와 동일한 헬퍼 메서드 구조

---

## 5. Controller 계층

### 5.1 TeamController

```java
@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService teamService;

    @PostMapping
    public ResponseEntity<TeamResponse> createTeam(
            @Valid @RequestBody CreateTeamRequest request,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        TeamResponse response = teamService.createTeam(userId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TeamResponse>> getMyTeams(Authentication authentication) {
        Long userId = Long.parseLong(authentication.getName());
        List<TeamResponse> teams = teamService.getMyTeams(userId);

        return ResponseEntity.ok(teams);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TeamResponse> getTeam(
            @PathVariable Long id,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        TeamResponse team = teamService.getTeam(userId, id);

        return ResponseEntity.ok(team);
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<TeamMemberResponse>> getTeamMembers(
            @PathVariable Long id,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        List<TeamMemberResponse> members = teamService.getTeamMembers(userId, id);

        return ResponseEntity.ok(members);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<TeamMemberResponse> addTeamMember(
            @PathVariable Long id,
            @Valid @RequestBody AddTeamMemberRequest request,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        TeamMemberResponse member = teamService.addTeamMember(userId, id, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(member);
    }

    @PatchMapping("/{id}/members/{memberId}")
    public ResponseEntity<TeamMemberResponse> updateTeamMemberRole(
            @PathVariable Long id,
            @PathVariable Long memberId,
            @Valid @RequestBody UpdateTeamMemberRoleRequest request,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        TeamMemberResponse updated = teamService.updateTeamMemberRole(userId, id, memberId, request);

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeTeamMember(
            @PathVariable Long id,
            @PathVariable Long memberId,
            Authentication authentication) {

        Long userId = Long.parseLong(authentication.getName());
        teamService.removeTeamMember(userId, id, memberId);

        return ResponseEntity.noContent().build();
    }
}
```

**설계 포인트:**
- `Authentication` 주입으로 사용자 ID 추출
- 모든 메서드에 `userId` 전달 → 서비스에서 권한 체크
- HTTP 상태 코드: 201 CREATED, 204 NO CONTENT 등 명시

---

## 6. 예외 처리 & HTTP 상태 코드 매핑

### 6.1 ForbiddenException 추가

**파일:** `common/exception/ForbiddenException.java`

```java
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
```

### 6.2 GlobalExceptionHandler 확장

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException ex) {
        ErrorResponse error = new ErrorResponse("FORBIDDEN", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse("BAD_REQUEST", ex.getMessage());
        return ResponseEntity.badRequest().body(error);
    }

    // 기존 핸들러들...
}
```

**매핑 정리:**
- `ResourceNotFoundException` → 404
- `ForbiddenException` → 403
- `IllegalArgumentException` → 400 (비즈니스 규칙 위반)
- `UnauthorizedException` → 401

---

## 7. 테스트 전략

### 7.1 권한 기반 테스트

**TeamIntegrationTest:**
```java
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TeamIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private JwtUtil jwtUtil;

    private User owner, manager, member, outsider;
    private Team team;
    private String ownerToken, managerToken, memberToken, outsiderToken;

    @BeforeEach
    void setUp() {
        // 사용자 생성
        owner = userRepository.save(new User("owner@test.com", "hash", "Owner"));
        manager = userRepository.save(new User("manager@test.com", "hash", "Manager"));
        member = userRepository.save(new User("member@test.com", "hash", "Member"));
        outsider = userRepository.save(new User("outsider@test.com", "hash", "Outsider"));

        // 팀 생성 및 멤버십 설정
        team = teamRepository.save(new Team("Test Team"));
        teamMemberRepository.save(new TeamMember(team.getId(), owner.getId(), TeamRole.OWNER));
        teamMemberRepository.save(new TeamMember(team.getId(), manager.getId(), TeamRole.MANAGER));
        teamMemberRepository.save(new TeamMember(team.getId(), member.getId(), TeamRole.MEMBER));

        // JWT 토큰 생성
        ownerToken = jwtUtil.generateToken(owner.getId(), owner.getEmail());
        managerToken = jwtUtil.generateToken(manager.getId(), manager.getEmail());
        memberToken = jwtUtil.generateToken(member.getId(), member.getEmail());
        outsiderToken = jwtUtil.generateToken(outsider.getId(), outsider.getEmail());
    }

    @Test
    void getTeam_팀멤버_200() throws Exception {
        mockMvc.perform(get("/api/teams/" + team.getId())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Test Team"));
    }

    @Test
    void getTeam_비멤버_404() throws Exception {
        mockMvc.perform(get("/api/teams/" + team.getId())
                .header("Authorization", "Bearer " + outsiderToken))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    void addMember_OWNER_성공() throws Exception {
        String requestBody = """
            {
                "userId": %d,
                "role": "MEMBER"
            }
            """.formatted(outsider.getId());

        mockMvc.perform(post("/api/teams/" + team.getId() + "/members")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isCreated());
    }

    @Test
    void addMember_MANAGER_성공() throws Exception {
        String requestBody = """
            {
                "userId": %d,
                "role": "MEMBER"
            }
            """.formatted(outsider.getId());

        mockMvc.perform(post("/api/teams/" + team.getId() + "/members")
                .header("Authorization", "Bearer " + managerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isCreated());
    }

    @Test
    void addMember_MEMBER_403() throws Exception {
        String requestBody = """
            {
                "userId": %d,
                "role": "MEMBER"
            }
            """.formatted(outsider.getId());

        mockMvc.perform(post("/api/teams/" + team.getId() + "/members")
                .header("Authorization", "Bearer " + memberToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void removeMember_마지막OWNER_400() throws Exception {
        // OWNER가 1명뿐인 상태에서 삭제 시도
        TeamMember ownerMembership = teamMemberRepository.findByTeamIdAndUserId(team.getId(), owner.getId()).get();

        mockMvc.perform(delete("/api/teams/" + team.getId() + "/members/" + ownerMembership.getId())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
            .andExpect(jsonPath("$.message").value(containsString("last owner")));
    }
}
```

**테스트 커버리지:**
- [x] 팀 조회: 멤버 200 / 비멤버 404
- [x] 멤버 추가: OWNER 성공 / MANAGER 성공 / MEMBER 403
- [x] 역할 변경: OWNER→MEMBER (마지막 OWNER면 400)
- [x] 멤버 삭제: 마지막 OWNER 삭제 시도 → 400
- [x] 워크스페이스 아이템 생성: MEMBER → 403

---

## 8. 완료 기준 및 검증

### 8.1 로컬 검증

**1. 팀 생성 및 조회:**
```bash
# 팀 생성 (자동으로 OWNER)
curl -X POST http://localhost:8080/api/teams \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev Team"}'

# 내 팀 목록
curl http://localhost:8080/api/teams \
  -H "Authorization: Bearer <TOKEN>"
```

**2. 멤버 관리:**
```bash
# 멤버 추가 (OWNER/MANAGER만 가능)
curl -X POST http://localhost:8080/api/teams/1/members \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"userId":2,"role":"MEMBER"}'

# 역할 변경
curl -X PATCH http://localhost:8080/api/teams/1/members/2 \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"MANAGER"}'
```

**3. 권한 체크 시나리오:**
```bash
# MEMBER가 멤버 추가 시도 → 403
curl -X POST http://localhost:8080/api/teams/1/members \
  -H "Authorization: Bearer <MEMBER_TOKEN>" \
  -d '...'
# 응답: {"code":"FORBIDDEN","message":"Only OWNER or MANAGER can manage team members"}

# 비멤버가 팀 조회 → 404
curl http://localhost:8080/api/teams/1 \
  -H "Authorization: Bearer <OUTSIDER_TOKEN>"
# 응답: {"code":"RESOURCE_NOT_FOUND","message":"Team not found"}
```

### 8.2 완료 체크리스트

- [x] Team, TeamMember, WorkspaceItem 엔티티 구현
- [x] TeamRole Enum 정의 (OWNER, MANAGER, MEMBER)
- [x] TeamMemberRepository 커스텀 쿼리 메서드
- [x] TeamService 권한 체크 헬퍼 메서드 (`assertTeamMember`, `assertCanManageMembers`)
- [x] WorkspaceItemService 권한 제어
- [x] 마지막 OWNER 보호 로직
- [x] ForbiddenException 및 GlobalExceptionHandler 확장
- [x] 역할별 통합 테스트 (200, 403, 404 시나리오)
- [x] CI 파이프라인에서 모든 테스트 통과
- [x] 로컬에서 권한 체크 시나리오 검증

---

## 9. 설계 결정 사항 및 트레이드오프

### 9.1 서비스 계층 권한 체크 vs Spring Security 어노테이션

| 방식 | 장점 | 단점 | 선택 이유 |
|------|------|------|-----------|
| Service 계층 | 명시적, 비즈니스 로직 통합, 테스트 용이 | 보일러플레이트 | **선택**: 학습 목적 + 명확성 |
| `@PreAuthorize` | 선언적, 간결 | SpEL 복잡도, 디버깅 어려움 | 학습 후 선택적 사용 |

### 9.2 404 vs 403 정책

**선택: 멤버 아니면 404, 멤버지만 권한 부족하면 403**
- **장점**: 팀 존재 여부 숨김 (보안), 권한 부족 시 명확한 피드백
- **단점**: 로직 복잡도 증가, 개발자가 구분 신경 써야 함

### 9.3 마지막 OWNER 보호

**선택: DB COUNT 쿼리로 검증**
- **장점**: 간단한 구현, 트랜잭션 내 검증
- **단점**: 추가 쿼리, 동시성 이슈 가능 (낮은 확률)
- **대안**: DB 제약 조건 (트리거 등) → 복잡도 높음

---

## 10. 알려진 제약 & 향후 개선점

### 10.1 현재 제약

1. **동시성 이슈**
   - 2명의 OWNER가 동시에 역할 변경 시도 시 마지막 OWNER 체크 실패 가능
   - 개선: 낙관적 락 (`@Version`) 또는 비관적 락 적용

2. **세밀한 권한 제어 부족**
   - 워크스페이스 아이템 생성자만 수정/삭제 가능한 정책 미구현
   - 개선: `createdBy` 필드 활용한 소유자 기반 권한 추가

3. **역할 계층 구조 없음**
   - OWNER > MANAGER > MEMBER 계층이 코드에만 존재
   - 개선: Spring Security의 `RoleHierarchy` 활용 가능

4. **팀 삭제 기능 없음**
   - 팀 자체를 삭제하는 API 미구현
   - 개선: OWNER만 삭제 가능, CASCADE 정책 정의 필요

### 10.2 다음 마일스톤 (2.3)에서 추가될 것

**도메인:**
- DailyIssueStats (일별 통계)

**패턴:**
- 배치 스케줄링 (`@Scheduled`)
- 통계 테이블 집계
- 캐싱 (`@Cacheable`)
- 외부 API 호출 (타임아웃, 재시도)

**테스트:**
- 배치 작업 검증
- 캐시 히트/미스 확인
- 외부 API Mock 테스트

---

## 11. 결론

Milestone 2.2에서 확립한 것:
- ✅ 팀/멤버십 도메인 설계
- ✅ 역할 기반 접근 제어 (RBAC) 패턴
- ✅ 서비스 계층 권한 체크 헬퍼 메서드
- ✅ 401 / 403 / 404 명확한 구분
- ✅ 비즈니스 불변성 보호 (마지막 OWNER)
- ✅ 역할별 통합 테스트

**핵심 성과:**
- **권한 제어 패턴**을 작은 도메인에 적용하여 학습
- 이후 복잡한 도메인에서 **재사용 가능한 패턴** 확립
- CI에서 권한 시나리오 자동 검증

**다음 단계 (Milestone 2.3):**
- 배치 작업으로 통계 집계
- 캐싱으로 성능 최적화
- 외부 API 연동 (타임아웃, 재시도 패턴)
