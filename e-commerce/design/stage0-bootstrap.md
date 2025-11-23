# Stage 0: 프로젝트 부트스트랩 (Project Bootstrap)

## 📋 목차
- [개요](#개요)
- [1. 프로젝트 초기화](#1-프로젝트-초기화)
- [2. Maven 빌드 설정](#2-maven-빌드-설정)
- [3. Spring Boot 애플리케이션 구성](#3-spring-boot-애플리케이션-구성)
- [4. 디렉토리 구조](#4-디렉토리-구조)
- [5. GitHub Actions CI](#5-github-actions-ci)
- [6. 로컬 개발 환경](#6-로컬-개발-환경)
- [트러블슈팅](#트러블슈팅)

---

## 개요

Stage 0에서는 Sagaline E-commerce 플랫폼의 **초기 프로젝트 설정**을 다룹니다. 이 단계에서는 이후 모든 Stage에서 사용할 기본 인프라를 구축합니다.

### 목표
- Spring Boot 3.2.0 기반 프로젝트 생성
- Maven 빌드 시스템 구성
- 핵심 의존성 설정
- CI/CD 파이프라인 구축
- 실행 가능한 최소 애플리케이션 생성

### 기술 스택
- **Java**: 17 (LTS)
- **Spring Boot**: 3.2.0
- **빌드 도구**: Maven 3.9+
- **데이터베이스**: PostgreSQL 15
- **CI/CD**: GitHub Actions

---

## 1. 프로젝트 초기화

### 1.1 Spring Initializr 설정

프로젝트는 다음 설정으로 생성되었습니다:

```
Project: Maven
Language: Java
Spring Boot: 3.2.0
Packaging: Jar
Java: 17

Group: com.sagaline
Artifact: sagaline-platform
Name: Sagaline
Description: E-commerce platform for Korean market
Package name: com.sagaline
```

### 1.2 프로젝트 메타데이터

```xml
<!-- pom.xml:15-19 -->
<groupId>com.sagaline</groupId>
<artifactId>sagaline-platform</artifactId>
<version>0.1.0</version>
<name>Sagaline</name>
<description>E-commerce platform for Korean market</description>
```

**주요 특징**:
- **Group ID**: `com.sagaline` (패키지 네임스페이스)
- **Artifact ID**: `sagaline-platform` (프로젝트 식별자)
- **Version**: `0.1.0` (초기 버전, SemVer 준수)

---

## 2. Maven 빌드 설정

### 2.1 Parent POM

```xml
<!-- pom.xml:8-13 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
    <relativePath/>
</parent>
```

**Spring Boot Starter Parent의 장점**:
- 의존성 버전 자동 관리
- 플러그인 설정 자동화
- 리소스 필터링
- 프로파일 지원

### 2.2 Java 설정

```xml
<!-- pom.xml:21-25 -->
<properties>
    <java.version>17</java.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.reporting.outputEncoding>UTF-8</project.reporting.outputEncoding>
</properties>
```

**Java 17 선택 이유**:
- LTS (Long-Term Support) 버전
- Record, Sealed Classes, Pattern Matching 등 최신 기능
- Spring Boot 3.x 최소 요구 버전

### 2.3 핵심 의존성

#### 2.3.1 Spring Boot Starters
```xml
<!-- pom.xml:28-56 -->
<!-- Spring Boot Web -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>

<!-- Spring Boot Data JPA -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- Spring Boot Security -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- Spring Boot Actuator -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Spring Boot Validation -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

#### 2.3.2 데이터베이스
```xml
<!-- pom.xml:58-69 -->
<!-- PostgreSQL Driver -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>

<!-- Flyway Database Migration -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

#### 2.3.3 관찰성 (Observability)
```xml
<!-- pom.xml:71-95 -->
<!-- Micrometer Prometheus -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
    <scope>runtime</scope>
</dependency>

<!-- Micrometer Tracing (Distributed Tracing) -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-brave</artifactId>
</dependency>

<!-- Zipkin Reporter (for distributed tracing) -->
<dependency>
    <groupId>io.zipkin.reporter2</groupId>
    <artifactId>zipkin-reporter-brave</artifactId>
</dependency>

<!-- Logstash Logback Encoder (for structured JSON logging) -->
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

#### 2.3.4 유틸리티
```xml
<!-- pom.xml:97-106 -->
<!-- Lombok -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>

<!-- JWT -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.3</version>
</dependency>
```

### 2.4 Maven 빌드 명령어

```bash
# 의존성 다운로드 및 컴파일
mvn clean compile

# 테스트 실행
mvn test

# 패키징 (JAR 생성)
mvn clean package

# 테스트 건너뛰고 빌드
mvn clean install -DskipTests

# 애플리케이션 실행
mvn spring-boot:run
```

---

## 3. Spring Boot 애플리케이션 구성

### 3.1 메인 애플리케이션 클래스

```java
// src/main/java/com/sagaline/SagalineApplication.java
package com.sagaline;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SagalineApplication {

    public static void main(String[] args) {
        SpringApplication.run(SagalineApplication.class, args);
    }
}
```

**주요 어노테이션**:
- `@SpringBootApplication`:
  - `@Configuration` (Bean 정의)
  - `@EnableAutoConfiguration` (자동 설정)
  - `@ComponentScan` (컴포넌트 스캔)
- `@EnableScheduling`: 스케줄링 기능 활성화 (예: Refresh Token 정리)

### 3.2 application.yml 설정

```yaml
# src/main/resources/application.yml:1-10
spring:
  application:
    name: sagaline
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/sagaline}
    username: ${DATABASE_USERNAME:postgres}
    password: ${DATABASE_PASSWORD:postgres}
    driver-class-name: org.postgresql.Driver
```

**환경 변수 기반 설정**:
- `${VAR_NAME:default}` 패턴 사용
- 로컬 개발: 기본값 사용
- 프로덕션: 환경 변수로 주입

### 3.3 프로파일별 설정

프로젝트는 다음 프로파일을 지원합니다:

| 프로파일 | 파일 | 용도 |
|---------|------|------|
| `dev` | `application-dev.yml` | 로컬 개발 환경 |
| `prod` | `application-prod.yml` | 프로덕션 환경 |
| `test` | `application-test.yml` | 테스트 환경 |

**프로파일 활성화**:
```bash
# 개발 환경
export SPRING_PROFILES_ACTIVE=dev
mvn spring-boot:run

# 프로덕션 환경
export SPRING_PROFILES_ACTIVE=prod
java -jar target/sagaline-platform-0.1.0.jar
```

---

## 4. 디렉토리 구조

### 4.1 프로젝트 루트
```
e-commerce/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI
├── .meta/
│   └── state.yml                  # 프로젝트 상태 추적
├── design/
│   ├── stage0/                    # 부트스트랩 문서
│   ├── stage1/                    # 도메인 설계 문서
│   ├── stage2/                    # 관찰성 설계 문서
│   ├── stage3/                    # 확장성 설계 문서
│   └── stage4/                    # 안정성 설계 문서
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── Dockerfile.elasticsearch
│   └── monitoring/
│       ├── prometheus/
│       ├── grafana/
│       ├── zipkin/
│       └── logstash/
├── scripts/
│   └── security-scan.sh
├── src/
│   ├── main/
│   │   ├── java/com/sagaline/
│   │   └── resources/
│   └── test/
│       ├── java/com/sagaline/
│       └── resources/
├── pom.xml
└── README.md
```

### 4.2 소스 코드 구조
```
src/main/java/com/sagaline/
├── SagalineApplication.java      # 메인 애플리케이션 클래스
├── common/                        # 공통 모듈
│   ├── config/                    # 설정 클래스
│   ├── security/                  # 보안 관련
│   ├── api/                       # 공통 API
│   ├── event/                     # 이벤트 처리
│   ├── health/                    # Health Check
│   └── ratelimit/                 # Rate Limiting
├── user/                          # 사용자 도메인
│   ├── api/                       # REST Controller
│   ├── service/                   # 비즈니스 로직
│   ├── domain/                    # 엔티티
│   └── repository/                # 데이터 액세스
├── product/                       # 상품 도메인
├── cart/                          # 장바구니 도메인
├── order/                         # 주문 도메인
├── payment/                       # 결제 도메인
└── inventory/                     # 재고 도메인
```

**아키텍처 패턴**:
- **레이어드 아키텍처**: API → Service → Repository
- **도메인 주도 설계(DDD)**: 도메인별 패키지 분리
- **의존성 방향**: API → Service → Domain ← Repository

---

## 5. GitHub Actions CI

### 5.1 CI 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop, 'claude/**' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: maven

      - name: Build with Maven
        run: mvn clean install -DskipTests

      - name: Run tests
        run: mvn test

      - name: Generate coverage report
        run: mvn jacoco:report
```

**CI 트리거**:
- `main`, `develop` 브랜치 푸시
- Pull Request 생성
- `claude/**` 브랜치 푸시 (AI 개발 브랜치)

### 5.2 CI 단계

1. **Checkout**: 소스 코드 체크아웃
2. **Setup JDK**: Java 17 (Temurin) 설치
3. **Maven Cache**: 의존성 캐싱으로 빌드 속도 향상
4. **Build**: Maven 빌드 (컴파일, 패키징)
5. **Test**: 단위 테스트 및 통합 테스트 실행
6. **Coverage**: JaCoCo 코드 커버리지 리포트 생성

---

## 6. 로컬 개발 환경

### 6.1 필수 도구

```bash
# Java 17 설치 확인
java -version
# openjdk version "17.0.x" 출력 확인

# Maven 설치 확인
mvn -version
# Apache Maven 3.9.x 출력 확인

# Docker 설치 확인 (인프라용)
docker --version
docker-compose --version
```

### 6.2 로컬 실행

#### 방법 1: Maven을 이용한 실행
```bash
# 1. 의존성 다운로드
mvn clean install -DskipTests

# 2. 애플리케이션 실행
mvn spring-boot:run

# 출력:
# Started SagalineApplication in 3.456 seconds
```

#### 방법 2: JAR를 이용한 실행
```bash
# 1. JAR 빌드
mvn clean package -DskipTests

# 2. JAR 실행
java -jar target/sagaline-platform-0.1.0.jar
```

#### 방법 3: IDE 실행
- IntelliJ IDEA: `SagalineApplication.java` 우클릭 → Run
- VSCode: Spring Boot Dashboard에서 Run

### 6.3 인프라 시작 (Docker Compose)

```bash
# PostgreSQL, Redis, Elasticsearch, Kafka 등 시작
cd infrastructure/docker
docker-compose up -d

# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f

# 종료
docker-compose down
```

### 6.4 Health Check

```bash
# 애플리케이션 상태 확인
curl http://localhost:8080/api/health

# 응답:
# {
#   "status": "UP",
#   "timestamp": "2025-11-23T12:00:00Z",
#   "service": "sagaline",
#   "version": "0.1.0"
# }

# Actuator Health Endpoint
curl http://localhost:8080/actuator/health

# 응답:
# {
#   "status": "UP",
#   "components": {
#     "db": { "status": "UP" },
#     "redis": { "status": "UP" },
#     ...
#   }
# }
```

---

## 트러블슈팅

### 문제 1: Maven 빌드 실패
**증상**:
```
[ERROR] Failed to execute goal on project sagaline-platform
```

**원인**:
- Java 버전 불일치
- Maven 로컬 저장소 손상

**해결**:
```bash
# Java 버전 확인
java -version  # 17.0.x 확인

# Maven 로컬 저장소 정리
rm -rf ~/.m2/repository

# 의존성 재다운로드
mvn clean install -U
```

### 문제 2: Spring Boot 실행 실패
**증상**:
```
Error creating bean with name 'dataSource'
```

**원인**:
- PostgreSQL 연결 실패
- 데이터베이스 스키마 없음

**해결**:
```bash
# PostgreSQL 시작 확인
docker-compose ps

# 데이터베이스 생성
docker exec -it postgres psql -U postgres -c "CREATE DATABASE sagaline;"

# 연결 테스트
psql -h localhost -U postgres -d sagaline
```

### 문제 3: Port 8080 already in use
**증상**:
```
Web server failed to start. Port 8080 was already in use.
```

**원인**:
- 다른 프로세스가 8080 포트 사용 중

**해결**:
```bash
# 포트 사용 프로세스 확인
lsof -i :8080

# 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

### 문제 4: Flyway Migration 실패
**증상**:
```
FlywayException: Validate failed: Migration checksum mismatch
```

**원인**:
- 마이그레이션 파일 변경
- 데이터베이스 상태 불일치

**해결**:
```bash
# 개발 환경: 데이터베이스 재생성
docker-compose down -v
docker-compose up -d

# 또는 Flyway 리셋 (주의: 데이터 손실)
mvn flyway:clean
mvn flyway:migrate
```

### 문제 5: Lombok 어노테이션이 인식되지 않음
**증상**:
```
Cannot resolve symbol 'log'
Cannot resolve method 'builder()'
```

**원인**:
- Lombok 플러그인 미설치
- Annotation Processing 비활성화

**해결**:
```bash
# IntelliJ IDEA
# 1. Settings → Plugins → Lombok 설치
# 2. Settings → Build → Compiler → Annotation Processors
#    → Enable annotation processing 체크

# VSCode
# 1. Java Extension Pack 설치
# 2. 워크스페이스 재로드
```

---

## 정리

Stage 0에서는 다음과 같은 **프로젝트 부트스트랩**을 완료했습니다:

1. ✅ **프로젝트 초기화**: Spring Boot 3.2.0, Java 17, Maven
2. ✅ **빌드 설정**: pom.xml 의존성 구성
3. ✅ **애플리케이션 구성**: 메인 클래스, application.yml, 프로파일
4. ✅ **디렉토리 구조**: 레이어드 아키텍처, DDD 패키지 구조
5. ✅ **CI/CD**: GitHub Actions 파이프라인
6. ✅ **로컬 환경**: Docker Compose 인프라, Health Check

**다음 단계**: **Stage 1 - Foundation** (핵심 도메인 구현)
