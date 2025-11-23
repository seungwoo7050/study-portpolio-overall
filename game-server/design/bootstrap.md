# 게임 서버 프로젝트 부트스트랩 (Project Bootstrap)

## 📋 목차
- [개요](#개요)
- [1. 프로젝트 구조](#1-프로젝트-구조)
- [2. CMake 빌드 시스템](#2-cmake-빌드-시스템)
- [3. C++ 설정 및 컴파일러 옵션](#3-c-설정-및-컴파일러-옵션)
- [4. 의존성 관리](#4-의존성-관리)
- [5. 빌드 및 실행](#5-빌드-및-실행)
- [6. 개발 환경 설정](#6-개발-환경-설정)
- [트러블슈팅](#트러블슈팅)

---

## 개요

이 문서는 게임 서버 프로젝트의 **초기 프로젝트 설정 및 빌드 시스템**을 다룹니다. 프로젝트는 두 개의 메인 서브프로젝트로 구성되어 있습니다.

### 프로젝트 목표
- C++17 기반 게임 서버 개발
- CMake를 이용한 멀티 프로젝트 빌드
- 모듈화된 아키텍처
- 학습 및 실전 프로토타입 개발

### 서브프로젝트
1. **gameserver-fundamentals**: 게임 서버 기초 학습 프로젝트 (Lab 1.1-1.4)
2. **netcode-core**: 실전 네트워크 게임 엔진 (v1.3)

### 기술 스택
- **언어**: C++17
- **빌드 시스템**: CMake 3.20+
- **컴파일러**: GCC 9+ / Clang 10+
- **의존성**: Threads, Protobuf, Boost

---

## 1. 프로젝트 구조

### 1.1 루트 디렉토리 구조
```
game-server/
├── .github/
│   └── workflows/              # GitHub Actions CI (선택)
├── design/
│   ├── bootstrap.md            # 이 문서 (프로젝트 부트스트랩)
│   ├── gameserver-fundamentals/
│   │   ├── ci.md               # CI 설정
│   │   ├── lab1.1.md           # TCP 에코 서버 설계
│   │   ├── lab1.2.md           # 턴제 전투 서버 설계
│   │   ├── lab1.3.md           # WebSocket 채팅 서버 설계
│   │   └── lab1.4.md           # WebSocket Pong 서버 설계
│   └── netcode-core/
│       ├── architecture.md     # 전체 아키텍처 설계
│       ├── sync.md             # 상태 동기화 설계
│       └── match.md            # 매칭 시스템 설계
├── gameserver-fundamentals/    # Lab 프로젝트 (기초)
│   ├── CMakeLists.txt
│   ├── lab1.1-tcp-echo/
│   ├── lab1.2-turn-combat/
│   ├── lab1.3-ws-chat/
│   └── lab1.4-ws-pong/
├── netcode-core/               # 실전 네트워크 엔진
│   ├── CMakeLists.txt
│   ├── core/                   # 핵심 유틸리티
│   ├── net/                    # 네트워크 레이어
│   ├── sync/                   # 상태 동기화
│   ├── match/                  # 매칭 시스템
│   ├── metrics/                # 메트릭 수집
│   └── apps/                   # 애플리케이션
│       ├── pong_udp/           # UDP Pong 게임
│       ├── matcher/            # 매칭 서버
│       └── loadgen/            # 부하 테스트 생성기
├── history/                    # 이전 버전 아카이브
└── README.md
```

### 1.2 프로젝트별 특징

#### gameserver-fundamentals
- **목적**: 게임 서버 기초 학습
- **구조**: 독립적인 4개의 Lab 프로젝트
- **빌드**: 각 Lab을 별도 실행 파일로 빌드
- **의존성**: 최소한의 의존성 (Threads만 필요)

#### netcode-core
- **목적**: 실전 네트워크 게임 엔진
- **구조**: 라이브러리 + 애플리케이션
- **빌드**: 공유 라이브러리 + 실행 파일
- **의존성**: Protobuf, Boost, Threads

---

## 2. CMake 빌드 시스템

### 2.1 gameserver-fundamentals CMakeLists.txt

```cmake
# gameserver-fundamentals/CMakeLists.txt:1-18
cmake_minimum_required(VERSION 3.20)
project(gameserver-fundamentals
    VERSION 0.1.0
    LANGUAGES CXX
)

# ----- Global C++ settings --------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler warnings
add_compile_options(-Wall -Wextra -Wpedantic -Werror)

# Thread library
find_package(Threads REQUIRED)

# ----- Lab build options ----------------------------------------
```

**주요 설정**:
- **CMake 버전**: 3.20 이상 필요
- **프로젝트 버전**: 0.1.0 (초기 버전)
- **언어**: C++만 사용

### 2.2 Lab 빌드 옵션

```cmake
# gameserver-fundamentals/CMakeLists.txt:20-40
option(ENABLE_LAB1_1 "Build lab1.1: TCP echo server" ON)
option(ENABLE_LAB1_2 "Build lab1.2: Turn-based 10 TPS server" ON)
option(ENABLE_LAB1_3 "Build lab1.3: WebSocket chat server" ON)
option(ENABLE_LAB1_4 "Build lab1.4: Pong WebSocket 60 TPS server" ON)

# ----- Subdirectories -------------------------------------------
if(ENABLE_LAB1_1)
    add_subdirectory(lab1.1-tcp-echo)
endif()

if(ENABLE_LAB1_2)
    add_subdirectory(lab1.2-turn-combat)
endif()

if(ENABLE_LAB1_3)
    add_subdirectory(lab1.3-ws-chat)
endif()

if(ENABLE_LAB1_4)
    add_subdirectory(lab1.4-ws-pong)
endif()
```

**빌드 옵션 사용**:
```bash
# 특정 Lab만 빌드
cmake -DENABLE_LAB1_1=ON -DENABLE_LAB1_2=OFF ..

# 모든 Lab 빌드 (기본값)
cmake ..
```

### 2.3 netcode-core CMakeLists.txt

```cmake
# netcode-core/CMakeLists.txt:1-17
cmake_minimum_required(VERSION 3.20)
project(netcode-core VERSION 1.3 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_compile_options(-Wall -Wextra -Wpedantic -Werror)

find_package(Threads REQUIRED)
find_package(Protobuf REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)

set(PROTO_GEN_DIR ${CMAKE_CURRENT_BINARY_DIR})
protobuf_generate_cpp(PROTO_SRCS PROTO_HDRS proto/mini.proto)
```

**주요 특징**:
- **버전**: 1.3 (실전 버전)
- **PIC**: Position Independent Code 활성화 (공유 라이브러리용)
- **Protobuf 통합**: 자동 코드 생성

### 2.4 Protobuf 라이브러리 생성

```cmake
# netcode-core/CMakeLists.txt:19-26
add_library(mini_proto ${PROTO_SRCS} ${PROTO_HDRS})
target_include_directories(mini_proto
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/proto
        ${PROTO_GEN_DIR}
        ${Protobuf_INCLUDE_DIRS}
)
target_link_libraries(mini_proto PUBLIC ${Protobuf_LIBRARIES})
```

### 2.5 서브디렉토리 구조

```cmake
# netcode-core/CMakeLists.txt:28-33
add_subdirectory(core)
add_subdirectory(net)
add_subdirectory(sync)
add_subdirectory(metrics)
add_subdirectory(match)
add_subdirectory(apps)
```

**빌드 순서**:
1. `core`: 핵심 유틸리티 라이브러리
2. `net`: 네트워크 레이어 (TCP, UDP, WebSocket)
3. `sync`: 상태 동기화 라이브러리
4. `metrics`: 메트릭 수집 라이브러리
5. `match`: 매칭 시스템 라이브러리
6. `apps`: 실행 파일 (pong_udp, matcher, loadgen)

---

## 3. C++ 설정 및 컴파일러 옵션

### 3.1 C++17 표준

```cmake
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
```

**C++17 선택 이유**:
- **std::optional**: Null 안전성
- **std::variant**: 타입 안전한 Union
- **Structured Bindings**: 튜플 언패킹
- **if constexpr**: 컴파일 타임 분기
- **std::string_view**: 효율적인 문자열 뷰
- **Fold Expressions**: 가변 인자 템플릿

**사용 예시**:
```cpp
// std::optional
std::optional<int> find_player(int id);

// Structured Bindings
auto [name, score] = player.get_info();

// if constexpr
if constexpr (is_debug_mode) {
    log_debug("Debug info");
}
```

### 3.2 컴파일러 경고

```cmake
add_compile_options(-Wall -Wextra -Wpedantic -Werror)
```

**경고 옵션 설명**:
- `-Wall`: 기본 경고 활성화
- `-Wextra`: 추가 경고 (사용되지 않는 변수, 형변환 등)
- `-Wpedantic`: 표준 준수 경고
- `-Werror`: 모든 경고를 에러로 처리

**이점**:
- 코드 품질 향상
- 잠재적 버그 조기 발견
- 표준 준수 강제

### 3.3 Position Independent Code

```cmake
# netcode-core만 해당
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
```

**PIC가 필요한 이유**:
- 공유 라이브러리(.so) 빌드
- 주소 공간 배치 무작위화(ASLR) 지원
- 보안 향상

---

## 4. 의존성 관리

### 4.1 gameserver-fundamentals 의존성

```cmake
find_package(Threads REQUIRED)
```

**Threads (pthread)**:
- 멀티스레드 프로그래밍 필수
- 클라이언트 연결별 스레드 생성
- POSIX Threads (pthread) 사용

**사용 예시**:
```cpp
#include <thread>
#include <mutex>

std::thread client_thread([socket]() {
    handle_client(socket);
});

std::mutex mtx;
std::lock_guard<std::mutex> lock(mtx);
```

### 4.2 netcode-core 의존성

```cmake
find_package(Threads REQUIRED)
find_package(Protobuf REQUIRED)
find_package(Boost REQUIRED COMPONENTS system)
```

#### Protobuf
- **목적**: 직렬화/역직렬화
- **버전**: 3.x 이상
- **사용처**: 네트워크 메시지, 상태 동기화

**설치**:
```bash
# Ubuntu/Debian
sudo apt-get install libprotobuf-dev protobuf-compiler

# macOS
brew install protobuf
```

#### Boost
- **목적**: 네트워크 I/O (Asio)
- **컴포넌트**: system
- **사용처**: UDP 소켓, 비동기 I/O

**설치**:
```bash
# Ubuntu/Debian
sudo apt-get install libboost-system-dev

# macOS
brew install boost
```

### 4.3 의존성 확인

```bash
# Protobuf 확인
protoc --version
# libprotoc 3.x.x

# Boost 확인
ls /usr/include/boost
# 또는
dpkg -l | grep libboost

# Threads 확인 (항상 사용 가능)
echo "Threads available"
```

---

## 5. 빌드 및 실행

### 5.1 gameserver-fundamentals 빌드

```bash
# 1. 프로젝트 디렉토리로 이동
cd game-server/gameserver-fundamentals

# 2. 빌드 디렉토리 생성
mkdir -p build
cd build

# 3. CMake 구성
cmake ..

# 출력:
# -- The CXX compiler identification is GNU 11.4.0
# -- Configuring done
# -- Generating done
# -- Build files have been written to: .../build

# 4. 빌드
make

# 또는 병렬 빌드 (4코어)
make -j4

# 5. 실행 파일 확인
ls -lh lab1.*/*.out
# lab1.1-tcp-echo/echo_server.out
# lab1.2-turn-combat/game_server.out
# lab1.3-ws-chat/chat_server.out
# lab1.4-ws-pong/pong_server.out
```

### 5.2 netcode-core 빌드

```bash
# 1. 프로젝트 디렉토리로 이동
cd game-server/netcode-core

# 2. 빌드 디렉토리 생성
mkdir -p build
cd build

# 3. CMake 구성
cmake ..

# 4. 빌드
make -j4

# 5. 실행 파일 확인
ls -lh apps/*/bin/*
# apps/pong_udp/bin/pong_server
# apps/matcher/bin/matcher_server
# apps/loadgen/bin/load_generator
```

### 5.3 특정 Lab만 빌드

```bash
# Lab 1.1만 빌드
cd gameserver-fundamentals/build
cmake -DENABLE_LAB1_1=ON \
      -DENABLE_LAB1_2=OFF \
      -DENABLE_LAB1_3=OFF \
      -DENABLE_LAB1_4=OFF ..
make

# Lab 1.3, 1.4만 빌드
cmake -DENABLE_LAB1_1=OFF \
      -DENABLE_LAB1_2=OFF \
      -DENABLE_LAB1_3=ON \
      -DENABLE_LAB1_4=ON ..
make
```

### 5.4 Clean & Rebuild

```bash
# Clean (빌드 결과물 삭제)
make clean

# 또는 빌드 디렉토리 전체 삭제
cd ..
rm -rf build

# Rebuild (gameserver-fundamentals 편의 기능)
make re  # Clean + Build
```

### 5.5 실행 예시

```bash
# TCP 에코 서버 실행
cd gameserver-fundamentals/build
./lab1.1-tcp-echo/echo_server.out 8080

# 출력:
# [INFO] Echo Server started on port 8080
# [INFO] Waiting for connections...

# 클라이언트 연결 (별도 터미널)
telnet localhost 8080
# 또는
nc localhost 8080
```

---

## 6. 개발 환경 설정

### 6.1 필수 도구

```bash
# GCC/G++ 컴파일러
g++ --version
# g++ (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0

# CMake
cmake --version
# cmake version 3.22.1

# Make
make --version
# GNU Make 4.3
```

### 6.2 IDE 설정

#### Visual Studio Code
```json
// .vscode/settings.json
{
    "cmake.configureOnOpen": true,
    "cmake.buildDirectory": "${workspaceFolder}/build",
    "C_Cpp.default.cppStandard": "c++17",
    "C_Cpp.default.compilerPath": "/usr/bin/g++",
    "files.associations": {
        "*.hpp": "cpp",
        "*.cpp": "cpp"
    }
}
```

**추천 확장**:
- C/C++ (Microsoft)
- CMake Tools (Microsoft)
- CMake Language Support

#### CLion
1. File → Open → `game-server/` 선택
2. CLion이 자동으로 CMakeLists.txt 감지
3. Build Configuration:
   - Debug (최적화 없음, 디버그 심볼)
   - Release (최적화, 디버그 심볼 없음)

### 6.3 디버깅 설정

#### GDB 디버깅
```bash
# Debug 빌드
cmake -DCMAKE_BUILD_TYPE=Debug ..
make

# GDB 실행
gdb ./lab1.1-tcp-echo/echo_server.out

# GDB 명령
(gdb) break main          # main에 브레이크포인트
(gdb) run 8080            # 프로그램 실행
(gdb) next                # 다음 줄
(gdb) print variable      # 변수 출력
(gdb) backtrace           # 스택 트레이스
```

#### Valgrind 메모리 검사
```bash
# Valgrind 설치
sudo apt-get install valgrind

# 메모리 누수 검사
valgrind --leak-check=full \
         --show-leak-kinds=all \
         ./echo_server.out 8080

# 출력:
# HEAP SUMMARY:
#     in use at exit: 0 bytes in 0 blocks
#   total heap usage: 10 allocs, 10 frees, 1,024 bytes allocated
#
# All heap blocks were freed -- no leaks are possible
```

### 6.4 코드 포맷팅

#### clang-format 설정
```yaml
# .clang-format
---
Language: Cpp
BasedOnStyle: Google
IndentWidth: 4
ColumnLimit: 100
PointerAlignment: Left
---
```

**사용**:
```bash
# 파일 포맷팅
clang-format -i src/*.cpp src/*.hpp

# 전체 프로젝트 포맷팅
find . -name "*.cpp" -o -name "*.hpp" | xargs clang-format -i
```

---

## 트러블슈팅

### 문제 1: CMake 버전이 낮음
**증상**:
```
CMake Error: CMake 3.20 or higher is required
```

**해결**:
```bash
# Ubuntu 22.04+는 기본으로 3.22 제공
sudo apt-get update
sudo apt-get install cmake

# 이전 버전은 Kitware 저장소 추가
wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc | sudo apt-key add -
sudo apt-add-repository 'deb https://apt.kitware.com/ubuntu/ focal main'
sudo apt-get update
sudo apt-get install cmake
```

### 문제 2: Protobuf not found
**증상**:
```
CMake Error: Could not find a package configuration file provided by "Protobuf"
```

**해결**:
```bash
# Protobuf 설치
sudo apt-get install libprotobuf-dev protobuf-compiler

# 확인
protoc --version
pkg-config --modversion protobuf
```

### 문제 3: Boost not found
**증상**:
```
CMake Error: Could not find a package configuration file provided by "Boost"
```

**해결**:
```bash
# Boost 설치
sudo apt-get install libboost-all-dev

# 또는 system만 설치
sudo apt-get install libboost-system-dev

# 확인
ls /usr/include/boost
```

### 문제 4: 컴파일 에러 (-Werror)
**증상**:
```
error: unused variable 'x' [-Werror,-Wunused-variable]
```

**해결**:
```cpp
// 방법 1: 변수 제거
// int x = 10;  // 사용하지 않으면 제거

// 방법 2: 변수 사용
int x = 10;
(void)x;  // 사용하지 않지만 의도적으로 유지

// 방법 3: [[maybe_unused]] (C++17)
[[maybe_unused]] int x = 10;
```

### 문제 5: 링크 에러
**증상**:
```
undefined reference to `pthread_create'
```

**해결**:
```cmake
# CMakeLists.txt에 추가
find_package(Threads REQUIRED)
target_link_libraries(your_target PRIVATE Threads::Threads)
```

### 문제 6: Out-of-source 빌드 권장
**증상**:
- 소스 디렉토리가 빌드 파일로 오염됨

**해결**:
```bash
# ❌ In-source 빌드 (권장하지 않음)
cmake .
make

# ✅ Out-of-source 빌드 (권장)
mkdir build
cd build
cmake ..
make
```

---

## 정리

게임 서버 프로젝트의 **부트스트랩**을 완료했습니다:

### gameserver-fundamentals
1. ✅ **CMake 3.20+ 빌드 시스템**
2. ✅ **C++17 표준 + 엄격한 컴파일러 경고**
3. ✅ **4개의 독립적인 Lab 프로젝트**
4. ✅ **선택적 빌드 옵션 (ENABLE_LAB1_x)**
5. ✅ **Threads 의존성**

### netcode-core
1. ✅ **모듈화된 라이브러리 구조** (core, net, sync, match, metrics)
2. ✅ **Protobuf 통합** (자동 코드 생성)
3. ✅ **Boost.Asio** (UDP 비동기 I/O)
4. ✅ **3개의 애플리케이션** (pong_udp, matcher, loadgen)
5. ✅ **공유 라이브러리 지원** (PIC)

**다음 단계**: 각 Lab 및 netcode-core 애플리케이션 설계 및 구현 (design/ 문서 참조)
