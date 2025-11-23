# Spring Boot 부트스트랩 & CI 베이스라인 설계 일지 (Milestone 2.0)
> 단일 Spring Boot 프로젝트의 골격을 만들고 GitHub Actions CI를 구축한 설계 기록

## 1. 문제 정의 & 요구사항

### 1.1 목표

Milestone 2.1 ~ 2.5에서 확장할 **단일 Spring Boot 프로젝트의 기반**을 마련한다:
- 최소 기능의 실행 가능한 Spring Boot 애플리케이션
- GitHub Actions 기반 CI/CD 파이프라인 구축
- 이후 마일스톤에서 **테스트만 추가**하면 되도록 설정

이 단계는 **인프라 구축**에 집중하며, 도메인 로직은 거의 없어도 된다.

### 1.2 기능 요구사항

#### 1.2.1 Spring Boot 애플리케이션
1. **부트스트랩 클래스**
   - `@SpringBootApplication` 어노테이션
   - `main` 메서드로 애플리케이션 시작
   - 패키지 루트에 위치하여 하위 패키지 자동 스캔

2. **기본 설정 파일**
   - `application.yml`: 공통 설정
   - `application-local.yml`: 로컬 개발 환경 설정
   - `application-test.yml`: 테스트 환경 설정

3. **헬스 체크 엔드포인트**
   - `GET /api/health`
   - 응답 형식: `{ "status": "OK", "timestamp": "..." }`
   - 애플리케이션 실행 상태 확인용

#### 1.2.2 CI/CD 파이프라인
1. **GitHub Actions 워크플로우**
   - Java 17 환경 구성
   - Gradle 빌드 및 테스트 실행
   - main/develop/feature 브랜치 푸시 시 자동 실행
   - Pull Request 생성 시 자동 실행

2. **테스트 기준선**
   - 최소 1개의 통과하는 테스트
   - 컨텍스트 로딩 테스트 또는 헬스 체크 테스트

### 1.3 비기능 요구사항

#### 1.3.1 빌드 & 의존성
- Java 17
- Spring Boot 3.3.5
- Gradle 빌드 시스템
- H2 인메모리 데이터베이스 (개발/테스트용)

#### 1.3.2 코드 품질
- 모든 테스트 통과
- 빌드 성공 보장
- CI 파이프라인 통과

#### 1.3.3 확장성
- 새로운 도메인 패키지 추가 용이
- 설정 파일 프로파일 기반 확장 가능
- 테스트 추가만으로 검증 가능한 구조

---

## 2. 기술적 배경 & 설계 동기

### 2.1 왜 초기에 CI를 구축하는가?

**CI 우선 접근의 이점:**
- **빠른 피드백**: 코드 변경 시 즉시 빌드/테스트 결과 확인
- **설정 불변성**: 이후 마일스톤에서 CI 설정 수정 불필요
- **현실 개발 흐름 반영**: 실무에서는 프로젝트 초기에 CI 구축
- **품질 게이트 확립**: 모든 코드 변경이 자동 검증됨

**2.0에서 CI를 완성하면:**
- 2.1 ~ 2.5는 **테스트 케이스만 추가**하면 됨
- 워크플로우 재설정 불필요
- 일관된 검증 환경 유지

### 2.2 왜 H2 인메모리 데이터베이스인가?

**개발/테스트 단계의 선택:**
- **빠른 시작**: 별도 DB 서버 설치 불필요
- **격리된 환경**: 각 테스트 실행마다 깨끗한 상태
- **CI 친화적**: GitHub Actions에서 추가 서비스 없이 실행 가능
- **프로덕션 준비**: PostgreSQL 설정은 설정 파일에만 준비

**트레이드오프:**
- 실제 프로덕션 DB와의 차이 존재 (예: 일부 SQL 문법)
- 데이터 영속성 없음 (매번 초기화)
- → 학습/훈련 목적에는 충분, 프로덕션은 설정 전환만 하면 됨

### 2.3 프로젝트 구조 설계 원칙

**단일 프로젝트, 도메인 패키지 분리:**
```
com.example.training/
  ├── Application.java           # 부트스트랩
  ├── common/                    # 공통 (설정, 예외, 헬스체크)
  ├── issue/                     # 2.1에서 추가
  ├── team/                      # 2.2에서 추가
  ├── stats/                     # 2.3에서 추가
  ├── search/                    # 2.4에서 추가
  └── order/                     # 2.5에서 추가
```

**원칙:**
- Application.java는 최상위 패키지에 위치 → 하위 패키지 자동 스캔
- 도메인별 패키지로 모듈성 확보
- common 패키지로 횡단 관심사 분리

---

## 3. 구현 아키텍처

### 3.1 프로젝트 구조

```
backend/spring/
├── build.gradle                # 빌드 설정 및 의존성
├── settings.gradle             # 프로젝트 이름 설정
├── gradlew, gradlew.bat        # Gradle Wrapper
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions 워크플로우
└── src/
    ├── main/
    │   ├── java/com/example/training/
    │   │   ├── Application.java
    │   │   └── common/
    │   │       ├── controller/
    │   │       │   └── HealthController.java
    │   │       └── dto/
    │   │           └── HealthResponse.java
    │   └── resources/
    │       ├── application.yml
    │       ├── application-local.yml
    │       └── application-test.yml
    └── test/
        ├── java/com/example/training/
        │   ├── ApplicationTest.java
        │   └── common/controller/
        │       └── HealthControllerTest.java
        └── resources/
            └── application-test.yml
```

### 3.2 핵심 컴포넌트 설계

#### 3.2.1 Application.java (부트스트랩)

**책임:**
- Spring Boot 애플리케이션 시작점
- 컴포넌트 스캔 루트 정의

**구현:**
```java
package com.example.training;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

**포인트:**
- `@SpringBootApplication` = `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan`
- 패키지 `com.example.training`에 위치 → 모든 하위 패키지 자동 스캔
- 별도 설정 없이 최소 구성

#### 3.2.2 HealthController (헬스 체크)

**책임:**
- 애플리케이션 실행 상태 확인
- 모니터링/로드 밸런서 헬스 체크용

**구현:**
```java
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<HealthResponse> health() {
        HealthResponse response = HealthResponse.builder()
            .status("OK")
            .timestamp(LocalDateTime.now())
            .build();
        return ResponseEntity.ok(response);
    }
}
```

**DTO:**
```java
public class HealthResponse {
    private String status;
    private LocalDateTime timestamp;
    // Lombok @Builder, @Getter 활용
}
```

**포인트:**
- `@RestController`: `@Controller` + `@ResponseBody`
- `@GetMapping`: `GET /api/health` 매핑
- `ResponseEntity<T>`: HTTP 상태 코드 명시적 제어
- 타임스탬프로 응답 시각 확인 가능

### 3.3 설정 파일 구조

#### 3.3.1 application.yml (공통 설정)

```yaml
spring:
  application:
    name: web-phase1-5-training

  datasource:
    url: jdbc:h2:mem:testdb
    driver-class-name: org.h2.Driver
    username: sa
    password:

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true

  h2:
    console:
      enabled: true
      path: /h2-console
```

**설계 포인트:**
- H2 인메모리 DB (`jdbc:h2:mem:testdb`)
- JPA `ddl-auto: update`: 엔티티 변경 시 스키마 자동 업데이트
- `show-sql: true`: SQL 로그 출력 (개발 중 디버깅용)
- H2 콘솔 활성화 (개발 환경에서 DB 직접 확인 가능)

#### 3.3.2 application-test.yml (테스트 설정)

```yaml
spring:
  jpa:
    show-sql: false
```

**설계 포인트:**
- 테스트 시 SQL 로그 최소화 (테스트 출력 간결화)
- 필요 시 추가 설정 오버라이드 가능

#### 3.3.3 application-local.yml (로컬 개발 설정)

```yaml
# 현재는 기본 설정 사용
# 필요 시 로컬 환경 특화 설정 추가
```

**설계 포인트:**
- 확장성을 위한 파일 준비
- 로컬 포트 변경, 로깅 레벨 조정 등 향후 추가 가능

### 3.4 빌드 설정 (build.gradle)

```gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.3.5'
    id 'io.spring.dependency-management' version '1.1.6'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring Boot Starters
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'

    // H2 Database
    runtimeOnly 'com.h2database:h2'

    // Lombok (선택)
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'

    // Test Dependencies
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

**의존성 최소화:**
- 2.0 시점에는 web, data-jpa, h2만 필요
- 이후 마일스톤에서 필요한 의존성 추가 (security, cache, kafka 등)

---

## 4. CI/CD 파이프라인 설계

### 4.1 GitHub Actions 워크플로우

**파일:** `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches:
      - main
      - develop
      - 'feature/**'
      - 'claude/**'
  pull_request:
    branches:
      - main
      - develop

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3

      - name: Make gradlew executable
        run: chmod +x backend/spring/gradlew

      - name: Build with Gradle
        run: |
          cd backend/spring
          ./gradlew clean build

      - name: Run tests
        run: |
          cd backend/spring
          ./gradlew test

      - name: Print test info
        if: always()
        run: |
          cd backend/spring
          echo "Test results:"
          find build/test-results -name "*.xml" | xargs cat || echo "No test results found"
```

### 4.2 워크플로우 설계 포인트

#### 4.2.1 트리거 전략
- **Push 이벤트**: main, develop, feature/*, claude/* 브랜치
- **Pull Request**: main, develop으로의 PR

**이유:**
- 모든 개발 브랜치에서 자동 검증
- PR 머지 전 문제 사전 발견
- main/develop 브랜치 품질 보장

#### 4.2.2 빌드 환경
- **OS**: ubuntu-latest (빠르고 안정적)
- **JDK**: 17 (Temurin 배포판)
- **Gradle**: setup-gradle 액션으로 캐싱 자동 처리

#### 4.2.3 빌드 단계
1. **코드 체크아웃**: 최신 코드 가져오기
2. **JDK 설정**: Java 17 환경 구성
3. **Gradle 설정**: 의존성 캐싱 및 빌드 최적화
4. **실행 권한 부여**: gradlew에 실행 권한 추가
5. **빌드**: `clean build` 실행
6. **테스트**: `test` 실행
7. **결과 출력**: 성공/실패 여부와 관계없이 테스트 정보 출력

#### 4.2.4 품질 게이트
- 빌드 실패 시 워크플로우 실패
- 테스트 실패 시 워크플로우 실패
- → PR 머지 차단, 코드 품질 강제

### 4.3 로컬 빌드/테스트 재현

**개발자 워크플로우:**
```bash
# 빌드
cd backend/spring
./gradlew clean build

# 테스트만 실행
./gradlew test

# 애플리케이션 실행
./gradlew bootRun

# 헬스 체크
curl http://localhost:8080/api/health
```

**CI와 동일한 검증:**
```bash
# CI 재현
./gradlew clean build
./gradlew test

# 성공 시 CI도 통과 보장
```

---

## 5. 테스트 전략

### 5.1 최소 테스트 기준

Milestone 2.0의 테스트는 **인프라 검증**에 집중:
1. Spring 컨텍스트 로딩 성공
2. 헬스 체크 엔드포인트 동작

### 5.2 테스트 구조

#### 5.2.1 ApplicationTest (컨텍스트 로딩)

```java
@SpringBootTest
class ApplicationTest {

    @Test
    void contextLoads() {
        // 이 테스트가 통과하면 Spring 컨텍스트가 정상 로딩된 것
    }
}
```

**검증 내용:**
- 모든 Bean이 올바르게 생성되는가?
- 순환 의존성이 없는가?
- 설정 파일이 올바른가?

**실패 케이스:**
- Bean 정의 오류
- 설정 파일 문법 오류
- 의존성 누락

#### 5.2.2 HealthControllerTest (엔드포인트 테스트)

```java
@SpringBootTest
@AutoConfigureMockMvc
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpointReturns200() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OK"))
            .andExpect(jsonPath("$.timestamp").exists());
    }
}
```

**검증 내용:**
- HTTP 200 응답
- JSON 응답 형식 (`status`, `timestamp` 필드)
- 컨트롤러 → 응답 변환 파이프라인 정상 동작

**MockMvc 사용 이유:**
- 실제 서버 띄우지 않고도 HTTP 계층 테스트 가능
- 빠른 테스트 실행
- CI 환경에서 포트 충돌 방지

### 5.3 테스트 실행 및 검증

**로컬 실행:**
```bash
./gradlew test

# 결과 확인
cat build/test-results/test/*.xml
```

**CI 실행:**
- GitHub Actions에서 자동 실행
- 테스트 실패 시 워크플로우 실패
- PR 상태 체크 업데이트

---

## 6. 완료 기준 및 검증

### 6.1 로컬 검증

**1. 빌드 성공:**
```bash
cd backend/spring
./gradlew clean build

# 성공 메시지 확인:
# BUILD SUCCESSFUL in Xs
```

**2. 테스트 통과:**
```bash
./gradlew test

# 결과:
# ApplicationTest > contextLoads() PASSED
# HealthControllerTest > healthEndpointReturns200() PASSED
```

**3. 애플리케이션 실행:**
```bash
./gradlew bootRun

# 다른 터미널에서:
curl http://localhost:8080/api/health

# 응답:
# {"status":"OK","timestamp":"2025-01-30T10:15:30.123"}
```

### 6.2 GitHub 검증

**1. 코드 푸시:**
```bash
git add .
git commit -m "chore: Milestone 2.0 - Spring Boot bootstrap and CI baseline"
git push origin feature/milestone-2.0
```

**2. GitHub Actions 확인:**
- Actions 탭에서 워크플로우 실행 확인
- 모든 단계 초록불 확인
- 테스트 결과 출력 확인

**3. PR 생성 및 머지:**
- feature → develop PR 생성
- CI 통과 확인
- 리뷰 후 머지

### 6.3 완료 체크리스트

- [x] `Application.java` 생성 및 `@SpringBootApplication` 설정
- [x] `HealthController` 구현 및 `/api/health` 엔드포인트 동작
- [x] `application.yml`, `application-test.yml`, `application-local.yml` 설정
- [x] H2 데이터베이스 연결 설정
- [x] `build.gradle` 의존성 설정 (web, data-jpa, h2)
- [x] `ApplicationTest` 컨텍스트 로딩 테스트 통과
- [x] `HealthControllerTest` 엔드포인트 테스트 통과
- [x] `.github/workflows/ci.yml` 워크플로우 작성
- [x] GitHub Actions에서 빌드/테스트 통과 확인
- [x] 로컬에서 `./gradlew bootRun` 실행 및 헬스 체크 성공
- [x] README에 프로젝트 구조 및 실행 방법 문서화

---

## 7. 설계 결정 사항 및 트레이드오프

### 7.1 기술 선택

| 항목 | 선택 | 이유 | 트레이드오프 |
|------|------|------|--------------|
| 빌드 도구 | Gradle | 유연성, 의존성 관리 우수 | Maven보다 러닝 커브 높음 |
| DB | H2 인메모리 | 빠른 시작, CI 친화적 | 프로덕션 DB와 차이 존재 |
| 테스트 | JUnit 5 + MockMvc | Spring Boot 기본, 빠른 테스트 | 실제 HTTP 서버 검증 불가 |
| CI | GitHub Actions | 무료, GitHub 통합 | 다른 CI 도구 경험 부족 |

### 7.2 구조 결정

**단일 프로젝트 vs 멀티 모듈:**
- **선택**: 단일 프로젝트
- **이유**:
  - 학습/훈련 목적에 충분
  - 설정 단순화
  - 마일스톤 간 공통 설정 공유 용이
- **트레이드오프**:
  - 도메인 간 의존성 제어 어려움
  - 빌드 시간 최적화 제한

**패키지 구조:**
- **선택**: 도메인별 패키지 (`issue`, `team`, `stats` 등)
- **이유**:
  - 기능별 응집도 향상
  - 이후 마일스톤 추가 용이
  - 코드 탐색 직관적
- **트레이드오프**:
  - 계층별 패키지(controller, service, repository)보다 파일 분산

### 7.3 CI 전략

**모든 브랜치 검증 vs Main만 검증:**
- **선택**: feature 브랜치도 검증
- **이유**:
  - 문제 조기 발견
  - PR 전 품질 확인
  - 개발자 피드백 빠름
- **트레이드오프**:
  - CI 실행 횟수 증가 (비용/시간)
  - → 학습 프로젝트는 무료 범위 내

---

## 8. 알려진 제약 & 향후 개선점

### 8.1 현재 제약

1. **데이터베이스**
   - H2 인메모리만 지원
   - 프로덕션 PostgreSQL 설정은 준비만 됨
   - → 2.1 이후 필요 시 프로파일 전환으로 대응

2. **보안**
   - 인증/인가 없음
   - 모든 엔드포인트 공개
   - → 2.1에서 JWT 기반 인증 추가 예정

3. **에러 처리**
   - 기본 Spring Boot 에러 응답 사용
   - 커스텀 에러 응답 포맷 없음
   - → 2.1에서 GlobalExceptionHandler 추가 예정

4. **로깅/모니터링**
   - 기본 로깅만 사용
   - 메트릭/모니터링 없음
   - → 2.3 이후 Actuator 추가 고려

### 8.2 다음 마일스톤 (2.1)에서 추가될 것

**도메인:**
- User, Project, Issue, Comment 엔티티
- Issue Tracker 기능

**패턴:**
- 레이어드 아키텍처 (Controller-Service-Repository)
- DTO vs Entity 분리
- 트랜잭션 관리 (`@Transactional`)
- JWT 기반 인증
- Bean Validation
- 공통 에러 응답 포맷

**테스트:**
- 서비스 계층 단위 테스트
- 통합 테스트 (이슈 생성 → 조회 플로우)
- 인증 테스트

---

## 9. 참고 자료

### 9.1 프로젝트 실행 가이드

**Prerequisites:**
- Java 17 이상
- Git

**실행 방법:**
```bash
# 저장소 클론
git clone <repository-url>
cd backend/spring

# 빌드
./gradlew clean build

# 실행
./gradlew bootRun

# 다른 터미널에서 헬스 체크
curl http://localhost:8080/api/health
```

### 9.2 디렉토리 구조 요약

```
backend/spring/
├── .github/workflows/ci.yml       # CI 파이프라인
├── build.gradle                   # 빌드 설정
├── src/main/
│   ├── java/com/example/training/
│   │   ├── Application.java       # 부트스트랩
│   │   └── common/                # 공통 (헬스체크)
│   └── resources/
│       ├── application.yml        # 공통 설정
│       ├── application-local.yml  # 로컬 설정
│       └── application-test.yml   # 테스트 설정
└── src/test/
    └── java/com/example/training/
        ├── ApplicationTest.java           # 컨텍스트 로딩
        └── common/controller/
            └── HealthControllerTest.java  # 헬스체크 테스트
```

### 9.3 관련 문서

- Spring Boot 공식 문서: https://spring.io/projects/spring-boot
- GitHub Actions 문서: https://docs.github.com/en/actions
- Gradle 문서: https://docs.gradle.org

---

## 10. 결론

Milestone 2.0에서 확립한 것:
- ✅ 실행 가능한 Spring Boot 애플리케이션 골격
- ✅ GitHub Actions 기반 CI/CD 파이프라인
- ✅ 테스트 기준선 (컨텍스트 로딩 + 헬스체크)
- ✅ 프로파일 기반 설정 구조
- ✅ 이후 마일스톤 확장 준비 완료

**핵심 성과:**
- CI 파이프라인이 동작하므로, 이후에는 **테스트만 추가**하면 자동 검증됨
- 도메인 패키지 구조로 2.1 ~ 2.5 기능 추가 용이
- 최소 기능으로 복잡도 낮춤, 학습 집중도 향상

**다음 단계 (Milestone 2.1):**
- Issue Tracker 도메인 구현
- 레이어드 아키텍처 패턴 적용
- JWT 인증 추가
- DTO/Entity 분리 및 트랜잭션 관리
