# B1: OS 기초

> **목표**: OS 핵심 개념을 본인 말로 설명하고 프로젝트와 연결
> **예상 시간**: 15-20시간
> **난이도**: 🟢 기초
> **선행 요구사항**: 프로그래밍 기본 지식
> **완료 기준**: 면접 예상 질문 10개 중 8개 이상 답변 가능

---

## 목차

1. [프로세스 vs 스레드](#1-프로세스-vs-스레드)
2. [문맥 전환](#2-문맥-전환)
3. [동기화 & 락](#3-동기화--락)
4. [메모리 관리](#4-메모리-관리)
5. [시스템 콜](#5-시스템-콜)
6. [프로젝트 연계](#6-프로젝트-연계)

---

## 1. 프로세스 vs 스레드

### 개념

**프로세스 (Process)**:
- 실행 중인 프로그램의 인스턴스
- 독립적인 메모리 공간 (코드, 데이터, 힙, 스택)
- PCB (Process Control Block)로 관리

**스레드 (Thread)**:
- 프로세스 내의 실행 흐름
- 프로세스의 메모리 공간 공유 (코드, 데이터, 힙)
- 각자의 스택, 레지스터, PC (Program Counter)

### 차이점 비교

| 항목 | 프로세스 | 스레드 |
|-----|---------|--------|
| 메모리 | 독립적 | 공유 (힙/데이터) |
| 생성 비용 | 높음 | 낮음 |
| 통신 | IPC (파이프, 소켓) | 메모리 직접 접근 |
| 안정성 | 한 프로세스 죽어도 다른 프로세스 영향 없음 | 한 스레드 죽으면 전체 프로세스 영향 |

### 코드 예제

```cpp
// 스레드 생성 예제 (C++11)
#include <thread>
#include <iostream>

void workerThread(int id) {
    std::cout << "Thread " << id << " is running\n";
}

int main() {
    std::thread t1(workerThread, 1);
    std::thread t2(workerThread, 2);

    t1.join();
    t2.join();

    return 0;
}
```

### 프로젝트 연결

**C++ 게임 서버 (gameserver-fundamentals)**:
- 클라이언트마다 스레드 생성 (thread per connection)
- 공유 데이터: 플레이어 리스트, 게임 상태
- 스레드 풀로 생성 비용 절감

---

## 2. 문맥 전환

### 개념

**Context Switch**: CPU가 한 프로세스/스레드에서 다른 것으로 전환

**과정**:
1. 현재 프로세스의 상태 저장 (레지스터, PC, 스택 포인터)
2. 다음 프로세스의 상태 복원
3. CPU 제어권 이동

**비용**:
- 레지스터/캐시 저장/복원
- 캐시 무효화 (cache miss 증가)
- TLB (Translation Lookaside Buffer) 플러시

### 왜 비싼가?

```
프로세스 A 실행 중:
- CPU 캐시에 A의 데이터 적재
- TLB에 A의 페이지 테이블 적재

Context Switch 발생:
- A의 상태 PCB에 저장
- B의 상태 PCB에서 복원
- 캐시/TLB 무효화

프로세스 B 실행:
- 캐시 miss → 메모리 접근 (느림)
- TLB miss → 페이지 테이블 재구축
```

**시간**: 수십 마이크로초 ~ 수 밀리초

### 최적화 방법

1. **스레드 사용**: 프로세스보다 Context Switch 비용 낮음
2. **스레드 풀**: 스레드 생성/소멸 비용 절감
3. **비동기 I/O**: 블로킹 호출 최소화

---

## 3. 동기화 & 락

### 3.1 Race Condition

```cpp
// ❌ Race Condition 예제
int counter = 0;

void increment() {
    for (int i = 0; i < 100000; i++) {
        counter++;  // 비원자적 연산!
    }
}

int main() {
    std::thread t1(increment);
    std::thread t2(increment);

    t1.join();
    t2.join();

    std::cout << counter << '\n';  // 200000이 아닐 수 있음!
}
```

**문제**: `counter++`는 실제로 3개 명령어
```assembly
LOAD  counter, R1
ADD   R1, 1
STORE R1, counter
```

### 3.2 Mutex (Mutual Exclusion)

```cpp
#include <mutex>

int counter = 0;
std::mutex mtx;

void increment() {
    for (int i = 0; i < 100000; i++) {
        mtx.lock();
        counter++;
        mtx.unlock();
    }
}

// 또는 RAII 패턴
void incrementSafe() {
    for (int i = 0; i < 100000; i++) {
        std::lock_guard<std::mutex> lock(mtx);
        counter++;
    }  // 스코프 벗어나면 자동 unlock
}
```

### 3.3 Deadlock (교착 상태)

**발생 조건** (4가지 모두 만족):
1. **상호 배제**: 자원을 한 번에 한 스레드만 사용
2. **점유와 대기**: 자원을 갖고 다른 자원 기다림
3. **비선점**: 강제로 자원 뺏기 불가
4. **순환 대기**: A→B→C→A 형태로 대기

**예제**:
```cpp
std::mutex mtx1, mtx2;

void thread1() {
    mtx1.lock();
    // ... 작업 ...
    mtx2.lock();  // thread2가 mtx2를 잡고 있으면 deadlock!
    mtx2.unlock();
    mtx1.unlock();
}

void thread2() {
    mtx2.lock();
    // ... 작업 ...
    mtx1.lock();  // thread1이 mtx1을 잡고 있으면 deadlock!
    mtx1.unlock();
    mtx2.unlock();
}
```

**해결 방법**:
1. **락 순서 고정**: 항상 mtx1 → mtx2 순으로 획득
2. **try_lock**: 일정 시간 기다리다 포기
3. **std::lock**: 여러 mutex를 동시에 획득

```cpp
void thread1Safe() {
    std::lock(mtx1, mtx2);  // 둘 다 획득하거나 둘 다 실패
    std::lock_guard<std::mutex> lock1(mtx1, std::adopt_lock);
    std::lock_guard<std::mutex> lock2(mtx2, std::adopt_lock);
    // ...
}
```

---

## 4. 메모리 관리

### 4.1 메모리 구조

```
+------------------+ 높은 주소
|      Stack       | 지역 변수, 함수 호출
|        ↓         |
|                  |
|        ↑         |
|       Heap       | 동적 할당 (new/malloc)
+------------------+
|       Data       | 전역 변수, static
+------------------+
|       Code       | 실행 코드
+------------------+ 낮은 주소
```

### 4.2 동적 할당

```cpp
// C++ RAII 패턴
void safeFunction() {
    std::unique_ptr<int[]> arr(new int[100]);
    // 사용...
}  // 자동 해제

// ❌ 메모리 누수
void leakFunction() {
    int* arr = new int[100];
    // ...
    // delete[] arr;  // 호출 안 하면 누수!
}

// ✅ 스마트 포인터 사용
void noLeakFunction() {
    auto arr = std::make_unique<int[]>(100);
    // ...
}  // 자동 해제
```

---

## 5. 시스템 콜

### 개념

**System Call**: 유저 프로그램이 커널 기능 요청

**유저 모드 vs 커널 모드**:
- 유저 모드: 제한된 명령어만 실행
- 커널 모드: 모든 명령어 실행 가능 (하드웨어 제어)

**예시**:
- 파일 I/O: `open()`, `read()`, `write()`, `close()`
- 네트워크: `socket()`, `bind()`, `listen()`, `accept()`
- 프로세스: `fork()`, `exec()`, `wait()`

```cpp
// POSIX 파일 I/O (시스템 콜)
#include <fcntl.h>
#include <unistd.h>

int fd = open("file.txt", O_RDONLY);  // 시스템 콜
char buffer[100];
read(fd, buffer, 100);  // 시스템 콜
close(fd);  // 시스템 콜
```

---

## 6. 프로젝트 연계

### 게임 서버 (C++)

**스레드 사용**:
```cpp
// gameserver-fundamentals/lab1.1
// 클라이언트 연결마다 스레드 생성
void handleClient(int clientSocket) {
    // 클라이언트 요청 처리
}

int main() {
    while (true) {
        int clientSocket = accept(serverSocket, ...);
        std::thread(handleClient, clientSocket).detach();
    }
}
```

**동기화**:
```cpp
// 공유 플레이어 리스트
std::vector<Player> players;
std::mutex playersMutex;

void addPlayer(const Player& p) {
    std::lock_guard<std::mutex> lock(playersMutex);
    players.push_back(p);
}
```

### NestJS 백엔드

**프로세스 관리**:
```typescript
// NestJS는 단일 스레드 (이벤트 루프)
// CPU 집약적 작업은 Worker Threads 사용

import { Worker } from 'worker_threads';

function heavyTask(data: any) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
```

---

## 면접 질문

### 1. 프로세스와 스레드의 차이는?
**답변**: 프로세스는 독립적인 메모리 공간을 가지며 PCB로 관리됩니다. 스레드는 프로세스 내에서 메모리를 공유하며, 각자의 스택과 레지스터만 가집니다. 스레드가 생성 비용이 낮고 통신이 빠르지만, 한 스레드의 오류가 전체 프로세스에 영향을 줄 수 있습니다.

### 2. Context Switch가 비싼 이유는?
**답변**: 레지스터와 PC를 저장/복원해야 하고, CPU 캐시와 TLB가 무효화되어 캐시 miss가 증가하기 때문입니다. 수십 마이크로초에서 수 밀리초가 소요됩니다.

### 3. Deadlock을 어떻게 방지하나요?
**답변**: (1) 락 획득 순서를 고정하거나, (2) try_lock으로 타임아웃을 설정하거나, (3) std::lock으로 여러 mutex를 동시에 획득합니다. 본인 프로젝트에서는 항상 같은 순서로 락을 획득하도록 설계했습니다.

---

## 다음 단계

✅ **B1 완료 후**:
- [B2: 네트워크 기초](./B2-networking.md)

**체크리스트**:
- [ ] 프로세스/스레드 차이 설명 가능
- [ ] Context Switch 비용 이해
- [ ] Mutex/Deadlock 개념 숙지
- [ ] 본인 프로젝트와 연결 정리

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
