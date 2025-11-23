# 리크루팅 가이드 (Recruitment Guide)

> **기준 시점**: ROADMAP.md 완료 (4개 메인 프로젝트 + 알고리즘/CS 트랙)
> **최종 업데이트**: 2025-11-23
> **목표**: 주니어/중니어 백엔드/풀스택 개발자 포지션

---

## 목차

1. [포트폴리오 요약](#1-포트폴리오-요약)
2. [지원 가능 회사 및 포지션](#2-지원-가능-회사-및-포지션)
3. [예상 연봉 범위](#3-예상-연봉-범위)
4. [기술 스택별 포지셔닝](#4-기술-스택별-포지셔닝)
5. [지원 전략](#5-지원-전략)
6. [면접 준비 가이드](#6-면접-준비-가이드)
7. [포트폴리오 활용 전략](#7-포트폴리오-활용-전략)
8. [타임라인 및 체크리스트](#8-타임라인-및-체크리스트)

---

## 1. 포트폴리오 요약

### 1.1 완성된 프로젝트

#### ✅ VrewCraft (video-editor)
- **상태**: Phase 1-3 완료 (프로덕션 완성)
- **핵심 기술**: React 18, Node.js 20, TypeScript 5, C++17 Native Addon, FFmpeg C API
- **특징**:
  - WebSocket 실시간 통신
  - C++ RAII 메모리 관리, 메모리 풀 최적화
  - PostgreSQL, Redis, Prometheus/Grafana
  - Docker 프로덕션 배포
  - p99 < 50ms 성능 최적화
- **타겟**: Voyager X (Vrew), 비디오 처리 관련 스타트업

#### ✅ NestJS Backend (backend/node.js)
- **상태**: N2.0-N2.5 완료
- **핵심 기술**: NestJS 10, TypeScript, Prisma, PostgreSQL
- **특징**:
  - Issue Tracker (CRUD, JWT, RBAC)
  - Elasticsearch 검색
  - Kafka 이벤트 처리
  - 배치/통계/캐시 패턴
  - GitHub Actions CI
- **타겟**: Node.js 백엔드 포지션

#### ✅ Sagaline E-commerce (Spring Boot)
- **상태**: Bootstrap 완료, Stage 1-4 진행 예정
- **핵심 기술**: Spring Boot 3.2, Java 17, PostgreSQL, Redis
- **특징**:
  - 한국 시장 특화 (Toss Payments, Kakao OAuth)
  - Elasticsearch, Kafka
  - 모놀리스 → 마이크로서비스 설계
  - Prometheus/Grafana 모니터링
  - PIPA 컴플라이언스
- **타겟**: Java/Spring 백엔드 포지션, 이커머스 회사

#### ✅ Game Server (C++)
- **상태**: gameserver-fundamentals (Lab 1.1-1.4) + netcode-core 설계
- **핵심 기술**: C++17, boost.asio, WebSocket, UDP 넷코드
- **특징**:
  - TCP/WebSocket 기초 → UDP 권위 서버
  - 60 TPS 게임 루프
  - 스냅샷/델타 동기화
  - 예측/리컨실리에이션
  - Redis 세션, PostgreSQL 리더보드
- **타겟**: 게임 서버 개발자, C++ 백엔드

#### 📋 React Frontend
- **상태**: 설계 완료, 구현 예정
- **핵심 기술**: React 18, TypeScript, React Query, RHF+zod
- **특징**:
  - Issue Tracker UI
  - 통계 대시보드
  - Elasticsearch 검색 UI
  - Vitest/Playwright 테스트
  - 접근성 (a11y)

### 1.2 알고리즘/CS 역량

#### 알고리즘 (백준 기준)
- **목표**: 골드 상위 (골드 1-3)
- **커버 범위**:
  - 실버 전 구간 (BFS/DFS, DP, 그리디, 이분탐색)
  - 골드 (Dijkstra, Union-Find, 세그먼트 트리, 비트마스크 DP)
  - 선택 심화 (LCA, 트리 DP, SCC, 네트워크 플로우)

#### CS 기초
- **OS**: 프로세스/스레드, 컨텍스트 스위칭, 동기화, 데드락, 메모리 관리
- **네트워크**: TCP/UDP, HTTP/HTTPS, WebSocket, DNS, 3-way handshake
- **DB**: 인덱스, 트랜잭션, 격리 수준, 락, N+1 문제

---

## 2. 지원 가능 회사 및 포지션

### 2.1 우선순위 타겟 (Tier 1)

이 회사들은 포트폴리오와 직접적인 매칭이 있거나 기술 스택이 정확히 일치합니다.

#### 🎯 Voyager X (Vrew) - Web Application Developer
- **매칭도**: ⭐⭐⭐⭐⭐ (완벽)
- **요구사항 vs 포트폴리오**:
  - C++ 깊은 이해 ✅ (FFmpeg C API, N-API, RAII)
  - 저수준 프로그래밍 ✅ (메모리 풀, 성능 최적화)
  - 동영상 기술 관심 ✅ (video-editor 전체)
  - React/Node.js/TypeScript ✅
  - FFmpeg ✅ (wrapper가 아닌 C API 직접 사용)
- **예상 연봉**: 5,000만원 - 6,500만원
- **지원 전략**: VrewCraft 프로젝트를 메인으로 강조, 기술 블로그 필수

#### 🎯 토스페이먼츠 - Backend Engineer
- **매칭도**: ⭐⭐⭐⭐
- **요구사항 vs 포트폴리오**:
  - Java/Spring Boot ✅ (Sagaline)
  - 결제 시스템 이해 ✅ (Toss Payments 통합)
  - 트랜잭션/동시성 제어 ✅
  - Kafka/이벤트 기반 ✅
  - 모니터링/관측성 ✅
- **예상 연봉**: 5,500만원 - 7,000만원
- **지원 전략**: Sagaline 프로젝트 + 결제 도메인 지식 강조

#### 🎯 당근마켓 - Backend Engineer
- **매칭도**: ⭐⭐⭐⭐
- **요구사항 vs 포트폴리오**:
  - Node.js/NestJS 또는 Spring Boot ✅
  - PostgreSQL, Redis ✅
  - Elasticsearch 검색 ✅
  - Kafka 메시징 ✅
  - 대규모 트래픽 경험 (부하 테스트로 보완)
- **예상 연봉**: 5,000만원 - 6,500만원
- **지원 전략**: NestJS 프로젝트 + 검색/캐싱 최적화 경험 강조

#### 🎯 크래프톤 / 넥슨 / 넷마블 - Game Server Developer
- **매칭도**: ⭐⭐⭐⭐
- **요구사항 vs 포트폴리오**:
  - C++ 숙련도 ✅
  - 네트워크 프로그래밍 ✅ (UDP, WebSocket)
  - 실시간 동기화 ✅ (넷코드)
  - 게임 루프/물리 ✅
  - 성능 최적화 ✅
- **예상 연봉**: 4,500만원 - 6,000만원 (신입), 6,000만원 - 8,000만원 (경력)
- **지원 전략**: game-server 프로젝트 중심, netcode-core 강조

#### 🎯 라인 / 카카오 - Backend Engineer
- **매칭도**: ⭐⭐⭐⭐
- **요구사항 vs 포트폴리오**:
  - Java/Spring 또는 Node.js ✅
  - MSA 이해 ✅
  - Kafka, Redis, Elasticsearch ✅
  - 대규모 시스템 설계 (아키텍처 문서로 보완)
- **예상 연봉**: 5,500만원 - 7,500만원
- **지원 전략**: 다양한 기술 스택 경험 강조, 시스템 설계 능력

### 2.2 적합 타겟 (Tier 2)

기술 스택이 부분적으로 일치하거나 성장 가능성을 인정받을 수 있는 회사들.

#### Backend 포지션
- **컬리 (Kurly)**: Spring Boot, MSA, 이커머스 도메인
- **무신사**: E-commerce, Spring Boot, 대규모 트래픽
- **야놀자**: Spring Boot, 트래픽 최적화
- **배달의민족 (우아한형제들)**: Spring Boot, MSA, Kafka
- **토스뱅크**: Spring Boot, 금융 도메인
- **하이퍼커넥트**: Node.js/C++, WebRTC, 실시간 통신
- **지그재그**: Spring Boot, E-commerce
- **29CM**: E-commerce, Spring Boot

#### 스타트업 (Series A-C)
- **센드버드**: Node.js, 실시간 채팅 플랫폼
- **원티드**: Node.js, MSA
- **오늘의집**: Spring Boot, E-commerce
- **마이리얼트립**: Spring Boot, 여행 플랫폼
- **에이프릴**: React/Node.js, 헬스케어
- **직방**: Spring Boot, PropTech
- **리멤버**: Node.js/Spring Boot, B2B SaaS

#### 외국계 테크 (한국 지사)
- **AWS Korea**: 다양한 포지션
- **Microsoft Korea**: Backend/Cloud
- **Google Korea**: Software Engineer
- **메타 (Facebook)**: Backend Engineer
- **Netflix**: Backend Engineer (경력 우대)

### 2.3 도전 타겟 (Tier 3)

경쟁이 매우 치열하거나 경력이 우대되지만, 포트폴리오가 충분히 강력하면 도전 가능.

- **네이버**: Backend Engineer, 검색/클라우드 플랫폼
- **쿠팡**: Backend Engineer, E-commerce 플랫폼
- **토스 (비바리퍼블리카)**: Backend Engineer, Fintech
- **뱅크샐러드**: Backend Engineer, Fintech

---

## 3. 예상 연봉 범위

### 3.1 신입 개발자 (0-2년 차)

포트폴리오 수준을 고려하면 "경력 있는 신입" 또는 "주니어 경력직"으로 평가받을 가능성이 높습니다.

| 회사 분류 | 연봉 범위 (세전) | 비고 |
|----------|----------------|------|
| **스타트업 (Series A-B)** | 4,000만원 - 5,000만원 | 스톡옵션 별도 |
| **스타트업 (Series C+)** | 4,500만원 - 5,500만원 | 성과급 포함 |
| **중견 IT 기업** | 4,500만원 - 6,000만원 | 복지 충실 |
| **대기업 (카카오/라인/네이버)** | 5,000만원 - 7,000만원 | 연봉 상한 높음 |
| **외국계 테크** | 5,500만원 - 8,000만원 | RSU 별도 |
| **게임 회사** | 4,500만원 - 6,000만원 | 프로젝트 성과급 |

### 3.2 주니어 경력직 (2-4년 차)

포트폴리오의 깊이와 프로덕션 수준을 고려하면 이 범위로 협상 가능.

| 회사 분류 | 연봉 범위 (세전) | 비고 |
|----------|----------------|------|
| **스타트업 (Series A-B)** | 5,000만원 - 6,500만원 | 스톡옵션 + 성과급 |
| **스타트업 (Series C+)** | 5,500만원 - 7,000만원 | 복지 개선 |
| **중견 IT 기업** | 5,500만원 - 7,000만원 | 안정적 |
| **대기업** | 6,000만원 - 8,500만원 | 복지 최고 |
| **외국계 테크** | 7,000만원 - 10,000만원 | RSU + Bonus |
| **게임 회사** | 5,500만원 - 7,500만원 | 프로젝트 보너스 |

### 3.3 연봉 협상 전략

#### 강점 카드
1. **다중 기술 스택**: Java/Spring, Node.js/Nest, C++, React
2. **프로덕션 수준**: Docker 배포, 모니터링, 성능 최적화
3. **깊은 이해**: 저수준 C++, 메모리 관리, 네트워크 프로토콜
4. **완성도**: 단순 토이 프로젝트가 아닌 실무 수준 문서화

#### 협상 팁
- **최소 희망 연봉**: 5,000만원 (신입), 6,000만원 (경력)
- **현실적 목표**: 5,500만원 - 6,500만원
- **최대 기대**: 7,000만원 - 8,000만원 (외국계/대기업)
- **협상 포인트**:
  - 포트폴리오 깊이 강조
  - 다중 언어/프레임워크 능숙도
  - 프로덕션 배포 경험
  - 성능 최적화 실적 (수치 기반)

---

## 4. 기술 스택별 포지셔닝

### 4.1 풀스택 개발자

**주력 스택**: React + Node.js + TypeScript

**타겟 회사**:
- Voyager X (Vrew)
- 센드버드
- 원티드
- 스타트업 전반

**강점**:
- video-editor: React 18 + Node.js 20 + TypeScript 5
- 실시간 통신 (WebSocket)
- 프론트/백엔드 모두 프로덕션 수준

**차별화**:
- C++ Native Addon으로 저수준까지 가능
- 성능 최적화 경험 (p99 < 50ms)
- 모니터링 구축 (Prometheus/Grafana)

### 4.2 백엔드 개발자 (Java/Spring)

**주력 스택**: Spring Boot + PostgreSQL + Redis + Kafka

**타겟 회사**:
- 토스페이먼츠
- 당근마켓
- 컬리
- 무신사
- 배달의민족

**강점**:
- Sagaline: Spring Boot 3.2 + Java 17
- 이커머스 도메인 이해
- MSA 아키텍처 설계
- Elasticsearch + Kafka
- 한국 시장 특화 (Toss Payments, Kakao OAuth)

**차별화**:
- 모놀리스 → 마이크로서비스 전환 설계
- 관측성 (Prometheus/Grafana/ELK)
- PIPA 컴플라이언스

### 4.3 백엔드 개발자 (Node.js)

**주력 스택**: NestJS + TypeScript + PostgreSQL

**타겟 회사**:
- 당근마켓
- 센드버드
- 하이퍼커넥트
- 라인
- 원티드

**강점**:
- NestJS 백엔드 (N2.0-N2.5 완료)
- Prisma ORM
- Elasticsearch 검색
- Kafka 이벤트 처리
- RBAC/JWT 인증

**차별화**:
- 계층형 아키텍처 (Controller/Service/Repository)
- 배치 작업 (@nestjs/schedule)
- 외부 API 통합 (retry 로직)

### 4.4 게임 서버 개발자

**주력 스택**: C++17 + boost.asio + UDP/WebSocket

**타겟 회사**:
- 크래프톤
- 넥슨
- 넷마블
- 펄어비스
- 하이퍼커넥트

**강점**:
- C++17 modern 문법 (RAII, smart pointer)
- TCP/WebSocket 기초
- UDP 권위 서버 + 넷코드
- 60 TPS 게임 루프
- 스냅샷/델타 동기화
- 예측/리컨실리에이션

**차별화**:
- 네트워크 프로토콜 직접 구현
- 성능 최적화 (p99 < 15ms 서버 처리)
- 부하 테스트 + 재현 가능한 벤치마크
- Redis 세션, PostgreSQL 리더보드

### 4.5 DevOps/SRE (보조 포지션)

**주력 스택**: Docker + Kubernetes + Prometheus/Grafana

**타겟 회사**:
- 모든 클라우드 네이티브 회사

**강점**:
- Docker 프로덕션 배포 (video-editor)
- Prometheus + Grafana 모니터링
- GitHub Actions CI/CD
- 성능 지표 추적 (SLO/SLI)

**차별화**:
- 개발자 관점의 관측성 설계
- 메트릭 기반 성능 최적화

---

## 5. 지원 전략

### 5.1 지원 우선순위

#### Phase 1: 우선 타겟 (즉시 지원)
1. **Voyager X (Vrew)** - VrewCraft 프로젝트 완벽 매칭
2. **게임 회사 (크래프톤/넥슨)** - C++ 게임 서버
3. **당근마켓** - NestJS + Elasticsearch
4. **토스페이먼츠** - Spring Boot + 결제

#### Phase 2: 병렬 지원 (2주 후)
- 중견 IT 회사 5-7곳
- 스타트업 (Series B+) 5-10곳
- 외국계 테크 2-3곳

#### Phase 3: 추가 지원 (1개월 후)
- 경쟁이 치열한 대기업 (네이버/카카오/라인)
- 외국계 글로벌 포지션

### 5.2 이력서 전략

#### 기본 구성
1. **요약 (Summary)**: 3-4줄, 핵심 강점
   - "C++/Java/Node.js를 다루는 풀스택 개발자"
   - "프로덕션 수준의 4개 프로젝트 완성"
   - "저수준 최적화부터 클라우드 배포까지"

2. **기술 스택 (Tech Stack)**: 테이블 형태
   - **Languages**: C++17, Java 17, TypeScript 5, JavaScript ES6+
   - **Backend**: Spring Boot 3.2, NestJS 10, Node.js 20
   - **Frontend**: React 18, Vite
   - **Database**: PostgreSQL 15+, Redis 7+
   - **Search & Messaging**: Elasticsearch 8, Kafka 3
   - **Monitoring**: Prometheus, Grafana
   - **Infrastructure**: Docker, AWS EC2/RDS
   - **Tools**: Git, GitHub Actions, CMake, Maven

3. **프로젝트 (Projects)**: 각 2-3단락
   - **제목**: 프로젝트명 + 한 줄 설명
   - **기술 스택**: 3-5개 핵심 기술
   - **성과**: 수치 기반 (p99 < 50ms, 60 TPS, 0 memory leaks)
   - **링크**: GitHub + README

4. **알고리즘/CS**: 간단히
   - 백준 골드 상위 (120+ 문제)
   - OS/네트워크/DB 기초 이론

#### 회사별 맞춤

**Voyager X (Vrew)**:
- VrewCraft 최상단 배치
- C++ FFmpeg C API 강조
- 저수준 최적화 경험 (메모리 풀, RAII)
- 성능 지표 (p99 latency)

**토스페이먼츠**:
- Sagaline 최상단
- Toss Payments 통합 경험
- 트랜잭션/동시성 제어
- MSA 설계

**게임 회사**:
- game-server 최상단
- C++ 네트워크 프로그래밍
- UDP 넷코드, 60 TPS 게임 루프
- 스냅샷/델타, 예측/리컨실리에이션

**Node.js 포지션**:
- NestJS 프로젝트 최상단
- Prisma, Elasticsearch, Kafka
- 계층형 아키텍처
- RBAC, JWT

### 5.3 포트폴리오 사이트 전략

#### 필수 요소
1. **랜딩 페이지**:
   - 3초 안에 핵심 전달
   - "4 Production-Ready Projects"
   - 기술 스택 로고
   - GitHub/LinkedIn 링크

2. **프로젝트 페이지** (각각):
   - 스크린샷/데모 영상
   - 아키텍처 다이어그램
   - 핵심 코드 스니펫 (syntax highlighting)
   - 성능 그래프 (Grafana)
   - GitHub 링크

3. **About 페이지**:
   - 기술 스택 매트릭스
   - 타임라인 (프로젝트 완성 히스토리)
   - 연락처

4. **Blog 페이지** (선택):
   - 기술 블로그 3-5개
   - 예: "C++ RAII로 FFmpeg 메모리 릭 제로 만들기"
   - "NestJS + Kafka로 이벤트 기반 아키텍처 구현"
   - "UDP 넷코드: 스냅샷/델타 동기화"

#### 기술 스택 (포트폴리오 사이트)
- **프레임워크**: Next.js 14 (SSG)
- **스타일**: TailwindCSS
- **호스팅**: Vercel (무료)
- **도메인**: 개인 도메인 (선택, 연 $12)

### 5.4 GitHub 프로필 최적화

#### README.md
```markdown
# 👋 안녕하세요, [이름]입니다

## 🚀 Production-Ready Projects

- **[VrewCraft](link)**: C++/React/Node.js 비디오 편집기 (Vrew 포지션 타겟)
- **[Sagaline](link)**: Spring Boot E-commerce (한국 시장 특화)
- **[NestJS Backend](link)**: Issue Tracker + Elasticsearch + Kafka
- **[Game Server](link)**: C++ UDP 넷코드 (60 TPS)

## 💻 Tech Stack

[shields.io 배지들]

## 📊 Stats

[GitHub stats 카드]
```

#### Pinned Repositories (6개)
1. video-editor
2. e-commerce (Sagaline)
3. backend/node.js (NestJS)
4. game-server
5. 알고리즘 연습 리포 (백준 문제풀이)
6. 포트폴리오 사이트 소스코드

#### Contribution Graph
- 매일 커밋 습관 유지 (최소 3개월 연속)
- Green boxes로 활동성 증명

---

## 6. 면접 준비 가이드

### 6.1 기술 면접 (Technical Interview)

#### 예상 질문 및 준비

**프로젝트 기반 질문**

1. **VrewCraft (video-editor)**
   - Q: "FFmpeg C API를 직접 사용한 이유는?"
   - A: wrapper 오버헤드 제거, 메모리 제어, 성능 최적화 (p99 < 50ms 달성)

   - Q: "메모리 풀을 어떻게 구현했나?"
   - A: Arena60 패턴, AVFrame 재사용, RAII 가드로 누수 방지

   - Q: "WebSocket으로 실시간 진행률을 전송할 때 어떤 문제가 있었나?"
   - A: 과도한 메시지, throttling (100ms), 재연결 처리

2. **Sagaline (e-commerce)**
   - Q: "트랜잭션 격리 수준을 어떻게 선택했나?"
   - A: 재고 감소는 Serializable, 일반 조회는 Read Committed

   - Q: "Kafka를 사용한 이유는?"
   - A: 주문-결제-알림 간 느슨한 결합, 이벤트 소싱, 확장성

   - Q: "Elasticsearch 인덱싱 전략은?"
   - A: 상품 생성/수정 시 비동기 인덱싱, Bulk API, Nori 토크나이저

3. **NestJS Backend**
   - Q: "N+1 문제를 어떻게 해결했나?"
   - A: Prisma include, eager loading, DataLoader 패턴

   - Q: "RBAC을 어떻게 구현했나?"
   - A: Custom Guard + Decorator, 팀별 권한 체크

4. **Game Server**
   - Q: "UDP에서 패킷 손실을 어떻게 처리했나?"
   - A: seq/ack/ack_bits, 32 프레임 윈도우, 선택적 재전송

   - Q: "클라이언트 예측과 서버 리컨실리에이션의 차이는?"
   - A: 클라이언트는 입력 즉시 예측 이동, 서버 응답 시 차이 발견하면 회귀(resim)

   - Q: "60 TPS를 어떻게 안정적으로 유지했나?"
   - A: 고정 타임스텝, sleep_for 정밀도, 처리 시간 p99 < 15ms

#### 알고리즘 코딩 테스트
- **난이도**: 백준 골드 3-5
- **시간**: 60-90분, 2-3문제
- **준비**:
  - 백준 골드 문제 100+ 풀이
  - LeetCode Medium 50+
  - 프로그래머스 레벨 3

#### 라이브 코딩
- **형태**: 화면 공유 + 실시간 구현
- **주제**: 간단한 API 구현, 알고리즘 최적화
- **팁**:
  - 설명하며 코딩 (사고 과정 공유)
  - 테스트 케이스 먼저 작성
  - 복잡도 분석

### 6.2 시스템 설계 면접 (System Design)

#### 예상 주제
1. **URL Shortener** (bit.ly)
2. **실시간 채팅 시스템** (WebSocket, Redis Pub/Sub)
3. **이커머스 주문 시스템** (Saga 패턴, 보상 트랜잭션)
4. **게임 매치메이킹** (ELO, Redis sorted set)
5. **동영상 스트리밍** (CDN, adaptive bitrate)

#### 준비 방법
- **책**: "가상 면접 사례로 배우는 대규모 시스템 설계 기초" (System Design Interview)
- **리소스**:
  - ByteByteGo (YouTube)
  - System Design Primer (GitHub)
- **프로젝트 연결**:
  - Sagaline 주문/결제 설계
  - game-server 매치메이킹

#### 면접 진행 팁
1. **요구사항 명확화** (5분): 사용자 수, QPS, 기능 범위
2. **개략적 설계** (10분): 박스 다이어그램, 주요 컴포넌트
3. **상세 설계** (15분): DB 스키마, API, 캐싱, 동시성
4. **스케일링** (5분): 샤딩, 레플리케이션, CDN
5. **트레이드오프** (5분): CAP, 성능 vs 일관성

### 6.3 컬쳐 핏 면접 (Culture Fit)

#### 예상 질문
1. "왜 개발자가 되고 싶으신가요?"
2. "팀에서 갈등이 있었던 경험은?"
3. "가장 어려웠던 기술적 문제와 해결 과정은?"
4. "우리 회사에 지원한 이유는?"
5. "5년 후 자신의 모습은?"

#### 준비 전략
- **STAR 기법**: Situation, Task, Action, Result
- **프로젝트 스토리**:
  - "VrewCraft에서 메모리 릭을 발견하고 RAII로 해결한 경험"
  - "NestJS에서 N+1 문제로 API가 느려진 것을 DataLoader로 해결"
- **회사 리서치**:
  - 회사 기술 블로그 3-5개 읽기
  - 최근 뉴스, 제품 사용 경험
  - 기술 스택 확인

### 6.4 임원 면접 (Executive Interview)

#### 예상 질문
1. "본인의 강점 3가지는?"
2. "우리 회사에 어떤 기여를 할 수 있나?"
3. "다른 회사 지원 현황은?"
4. "연봉 기대치는?"

#### 준비 전략
- **강점**: 다중 기술 스택, 프로덕션 경험, 빠른 학습
- **기여**: 포트폴리오 기반 구체적 예시
- **연봉**: 리서치 기반 현실적 범위 제시 (5,500만원 - 6,500만원)

---

## 7. 포트폴리오 활용 전략

### 7.1 프로젝트별 활용 시나리오

#### VrewCraft (video-editor)
**활용 회사**: Voyager X (Vrew), 비디오 처리 스타트업

**강조점**:
1. **C++ 깊이**: FFmpeg C API, N-API, RAII, 메모리 풀
2. **성능 수치**: p99 < 50ms, 0 memory leaks (valgrind)
3. **실시간 통신**: WebSocket, < 100ms latency
4. **관측성**: Prometheus 메트릭, Grafana 대시보드
5. **프로덕션**: Docker 배포, 다단계 빌드

**데모 준비**:
- 로컬 Docker Compose로 1분 안에 실행
- 비디오 업로드 → 편집 → 실시간 진행률 → 다운로드
- Grafana 대시보드에서 p99 지표 실시간 확인

#### Sagaline (e-commerce)
**활용 회사**: 토스페이먼츠, 컬리, 무신사, 배달의민족

**강조점**:
1. **도메인 이해**: 주문/결제/재고 흐름, Saga 패턴
2. **한국 특화**: Toss Payments, Kakao OAuth, PIPA
3. **MSA 설계**: 모놀리스 → 마이크로서비스 전환 로드맵
4. **이벤트 기반**: Kafka 비동기 처리
5. **검색**: Elasticsearch + Nori 토크나이저

**데모 준비**:
- Swagger/OpenAPI로 API 문서 자동 생성
- 주문 생성 → Kafka 이벤트 → 알림 전송 흐름
- Elasticsearch 검색 API (한글 검색)

#### NestJS Backend
**활용 회사**: 당근마켓, 센드버드, 원티드, 라인

**강조점**:
1. **아키텍처**: Controller/Service/Repository 계층
2. **인증/인가**: JWT, RBAC, Custom Guard
3. **검색**: Elasticsearch 통합
4. **메시징**: Kafka producer/consumer
5. **배치**: @nestjs/schedule, 통계 집계

**데모 준비**:
- Issue Tracker CRUD
- 팀 생성 → 멤버 초대 → 권한별 접근 제어
- Elasticsearch 검색 vs PostgreSQL LIKE 성능 비교

#### Game Server (C++)
**활용 회사**: 크래프톤, 넥슨, 넷마블, 펄어비스

**강조점**:
1. **네트워크**: TCP → WebSocket → UDP 진화
2. **게임 루프**: 60 TPS, 고정 타임스텝
3. **넷코드**: 스냅샷/델타, 예측/리컨실리에이션
4. **성능**: p99 < 15ms, RTT 120ms에서도 안정
5. **부하 테스트**: 200 동시 클라이언트, 2시간 Soak

**데모 준비**:
- 브라우저로 WebSocket Pong 플레이
- UDP 버전 실행 + Grafana에서 RTT/패킷 손실 확인
- netem으로 지연/손실 주입 → 여전히 안정적 동작

### 7.2 기술 블로그 작성

#### 블로그 주제 (5-7개 추천)

1. **"C++ RAII로 FFmpeg 메모리 릭 제로 만들기"**
   - 문제: FFmpeg 구조체 수동 해제 → 예외 발생 시 누수
   - 해결: RAII 래퍼 클래스, std::unique_ptr 커스텀 deleter
   - 결과: valgrind 0 leaks

2. **"NestJS + Kafka로 이벤트 기반 아키텍처 구현"**
   - 주문 생성 → 이벤트 발행 → 알림 서비스 구독
   - At-least-once 보장, 멱등성 처리
   - 코드 예제, 다이어그램

3. **"UDP 넷코드: 스냅샷/델타 동기화 깊이 파기"**
   - 키프레임 vs 델타 프레임
   - 델타 생성 알고리즘 (이전 상태 대비 diff)
   - 대역폭 50% 절감 효과

4. **"Spring Boot E-commerce: 재고 동시성 제어 전략"**
   - Pessimistic Lock vs Optimistic Lock
   - Redis Distributed Lock
   - 성능 벤치마크

5. **"Prometheus + Grafana로 실시간 성능 모니터링 구축"**
   - prom-client 메트릭 export
   - Histogram, Counter, Gauge 활용
   - p50/p95/p99 latency 추적

6. **"Elasticsearch로 한글 검색 최적화 (Nori 토크나이저)"**
   - 기본 토크나이저의 한계
   - Nori 설정 및 매핑
   - 검색 품질 개선 예시

7. **"Docker Multi-stage Build로 이미지 크기 90% 줄이기"**
   - 일반 빌드 vs Multi-stage
   - 프로덕션 최적화 (alpine, 불필요 파일 제거)
   - 빌드 시간 단축

#### 블로그 플랫폼
- **Medium**: 영문, 글로벌 노출
- **Velog**: 한글, 한국 개발자 커뮤니티
- **개인 블로그**: Next.js + MDX, SEO 최적화
- **GitHub Pages**: 간단한 Jekyll 블로그

#### SEO 전략
- **키워드**: "C++ FFmpeg", "NestJS Kafka", "Spring Boot 동시성", "게임 서버 넷코드"
- **제목**: 구체적이고 검색 가능한 제목
- **구조**: 코드 예제, 다이어그램, 결과 수치
- **링크**: GitHub 리포지토리 연결

### 7.3 오픈소스 기여 (선택)

#### 추천 프로젝트
1. **NestJS**: 공식 문서 한글 번역, 예제 추가
2. **Prisma**: 한글 문서, 버그 리포트
3. **FFmpeg**: 버그 수정 (난이도 높음)
4. **Awesome 리스트**: "Awesome Game Server", "Awesome NestJS" 기여

#### 기여 방법
- 작은 것부터: 오타 수정, 문서 개선
- 이슈 해결: "good first issue" 라벨
- PR 작성: 명확한 설명, 테스트 포함

---

## 8. 타임라인 및 체크리스트

### 8.1 지원 준비 타임라인 (4주)

#### Week 1: 문서 정리
- [ ] 각 프로젝트 README 최종 검토
- [ ] 아키텍처 다이어그램 업데이트
- [ ] 성능 벤치마크 그래프 추가
- [ ] 데모 영상 촬영 (각 프로젝트 2-3분)
- [ ] GitHub 리포지토리 정리 (pinned, description)

#### Week 2: 이력서 & 포트폴리오
- [ ] 이력서 3개 버전 작성 (풀스택/백엔드/게임서버)
- [ ] 포트폴리오 사이트 구축 (Next.js)
- [ ] 기술 블로그 2-3개 작성
- [ ] LinkedIn 프로필 업데이트
- [ ] GitHub 프로필 README 작성

#### Week 3: 면접 준비
- [ ] 프로젝트별 예상 질문 30개 정리
- [ ] STAR 기법으로 경험 스토리 5개 작성
- [ ] 알고리즘 문제 복습 (골드 10문제)
- [ ] 시스템 설계 연습 (5개 주제)
- [ ] 모의 면접 (친구/멘토)

#### Week 4: 지원 시작
- [ ] 타겟 회사 리스트 20개 작성
- [ ] 회사별 이력서 맞춤
- [ ] 자기소개서 작성 (필요 시)
- [ ] 지원 (우선순위 5개)
- [ ] 추가 지원 (10개)

### 8.2 지원 후 관리

#### 서류 통과 시
- [ ] 1차 면접 일정 조율
- [ ] 회사 리서치 (기술 블로그 3개, 뉴스)
- [ ] 프로젝트 데모 준비
- [ ] 예상 질문 리스트 업데이트

#### 1차 면접 통과 시
- [ ] 2차 면접 (시스템 설계) 준비
- [ ] 화이트보드 코딩 연습
- [ ] 회사 제품 사용 경험 정리

#### 최종 면접 후
- [ ] Thank you 이메일 발송
- [ ] 다른 회사 지원 속도 조절
- [ ] 연봉 협상 준비 (시장 조사)

### 8.3 최종 체크리스트

#### 포트폴리오
- [ ] 4개 프로젝트 모두 GitHub 공개
- [ ] README 각 1,000줄 이상 (상세 문서)
- [ ] 아키텍처 다이어그램 각 2-3개
- [ ] 데모 영상 각 2-5분
- [ ] Docker Compose로 1분 안에 실행 가능

#### 문서화
- [ ] 각 프로젝트 설계 문서 (design/)
- [ ] 성능 리포트 (벤치마크, 그래프)
- [ ] 장애 대응 runbook (선택)
- [ ] API 문서 (Swagger/OpenAPI)

#### 코드 품질
- [ ] Linter 통과 (ESLint, clang-format)
- [ ] 테스트 커버리지 ≥ 70%
- [ ] 메모리 릭 0 (valgrind, ASan)
- [ ] 보안 스캔 통과 (npm audit, Trivy)

#### 온라인 프레즌스
- [ ] GitHub: 100+ commits, 4+ pinned repos
- [ ] LinkedIn: 완성된 프로필, 프로젝트 링크
- [ ] 포트폴리오 사이트: 도메인, 반응형, SEO
- [ ] 기술 블로그: 3-5개 게시글

#### 면접 준비
- [ ] 알고리즘: 백준 골드 100+ 문제
- [ ] 시스템 설계: 5개 주제 연습
- [ ] 프로젝트 질문: 각 프로젝트 10개씩
- [ ] 컬쳐 핏: STAR 스토리 5개

---

## 9. 추가 리소스

### 9.1 학습 자료

#### 책
- "가상 면접 사례로 배우는 대규모 시스템 설계 기초" (System Design Interview)
- "이펙티브 자바" (Effective Java)
- "Node.js 디자인 패턴"
- "C++ Concurrency in Action"

#### 온라인 코스
- LeetCode Premium (알고리즘)
- System Design Interview (Exponent)
- Udemy: Spring Boot Masterclass
- Udemy: NestJS Complete Developer Guide

#### 유튜브 채널
- ByteByteGo (시스템 설계)
- 노마드 코더 (한국 개발자 취업)
- 개발자 황준일 (기술 면접)
- 얄팍한 코딩사전 (CS 기초)

### 9.2 커뮤니티

#### 온라인 커뮤니티
- **OKKY**: 한국 개발자 커뮤니티
- **GeekNews**: 기술 뉴스
- **Reddit**: r/cscareerquestions, r/ExperiencedDevs
- **LinkedIn**: 개발자 그룹 가입

#### 오프라인
- **AWSKRUG**: AWS 한국 사용자 모임
- **GDG Korea**: Google Developer Group
- **Spring Camp**: Spring 개발자 컨퍼런스
- **NDC**: 넥슨 개발자 컨퍼런스 (게임)

### 9.3 채용 플랫폼

#### 추천 플랫폼
1. **원티드**: IT 스타트업 중심
2. **로켓펀치**: 스타트업
3. **프로그래머스**: 개발자 특화, 코딩 테스트
4. **잡플래닛**: 회사 리뷰
5. **LinkedIn**: 외국계, 글로벌
6. **사람인/잡코리아**: 중견/대기업

#### 활용 팁
- 프로필 100% 완성
- 포트폴리오 링크 추가
- "구직 중" 상태 공개
- 채용 공고 알림 설정
- 헤드헌터 연락 대응

---

## 10. 마무리

### 10.1 핵심 강점 요약

1. **다중 기술 스택**: C++, Java, Node.js, React를 모두 프로덕션 수준으로
2. **저수준 이해**: FFmpeg C API, RAII, 메모리 풀, UDP 프로토콜
3. **프로덕션 경험**: Docker 배포, 모니터링, 성능 최적화, 수치 기반 증명
4. **도메인 지식**: 비디오 처리, 이커머스, 게임 서버, Issue Tracker
5. **완성도**: 단순 토이 프로젝트가 아닌 실무 수준 아키텍처와 문서화

### 10.2 차별화 포인트

| 일반 신입 개발자 | 나의 포트폴리오 |
|---------------|---------------|
| 토이 프로젝트 1-2개 | 프로덕션 수준 4개 프로젝트 |
| 단일 언어/프레임워크 | C++/Java/Node.js 다중 스택 |
| 기본 CRUD | 저수준 최적화 + 고급 패턴 |
| 문서화 부족 | 상세 설계 문서, 성능 리포트 |
| 로컬 실행만 | Docker 배포, 모니터링 구축 |

### 10.3 목표 설정

#### 단기 (3개월)
- [ ] 10개 회사 지원
- [ ] 3개 회사 최종 면접
- [ ] 1개 이상 오퍼 수령
- [ ] 연봉 5,500만원 이상

#### 중기 (1년)
- [ ] 실무 프로젝트 1개 완수
- [ ] 기술 블로그 10개 이상
- [ ] 사내 기술 발표 1회
- [ ] 오픈소스 기여 5개

#### 장기 (3년)
- [ ] 시니어 개발자 (연봉 8,000만원+)
- [ ] 기술 리드/아키텍트
- [ ] 컨퍼런스 발표
- [ ] 책 집필 (선택)

---

## 부록

### A. 회사별 기술 블로그

- **Voyager X (Vrew)**: https://www.vrew.ai/blog
- **토스**: https://toss.tech
- **당근마켓**: https://medium.com/daangn
- **라인**: https://engineering.linecorp.com/ko/
- **카카오**: https://tech.kakao.com
- **네이버**: https://d2.naver.com
- **쿠팡**: https://medium.com/coupang-engineering/kr
- **배달의민족**: https://techblog.woowahan.com

### B. 연봉 정보 사이트

- **잡플래닛**: 회사별 실제 연봉 리뷰
- **블라인드**: 익명 커뮤니티, 연봉 공유
- **사람인**: 연봉 계산기
- **크레딧잡**: 연봉 시뮬레이터

### C. 면접 후기 모음

- **Blind**: 한국 tech 회사 면접 후기
- **OKKY**: 개발자 면접 후기
- **Reddit**: r/cscareerquestions
- **GeekNews**: 채용 관련 토론

---

**작성자**: 포트폴리오 기반 자동 생성
**업데이트**: 지원 과정에서 지속적으로 업데이트
**피드백**: GitHub Issue 또는 PR로 개선 사항 제안
