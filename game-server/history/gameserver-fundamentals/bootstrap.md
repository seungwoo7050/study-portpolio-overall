# Bootstrap - Game Server Basics Lab

> 4개의 서버 실습 프로젝트를 한 저장소에서 일관된 구조로 관리하기 위한 초기 설정 가이드

## 0.1. 저장소 루트 생성

```bash
mkdir gameserver-basics-lab
cd gameserver-basics-lab
git init
```

## 0.2: `.gitignore` 기본 설정

```bash
# Build artifacts
/build/
/out/
/bin/
/lib/
*.o
*.a
*.so
*.exe

# IDE/editor
.vscode/
.idea/
*.swp
*.swo

# Logs / debug
*.log
valgrind-*
core

# OS
.DS_Store
Thumbs.db
```

## 0.3: 최상위 CMake 부투스트랩

- 전체 프로젝트 버전/빌드 환경은 여기서 정의
- 각 Lab은 독립 서브 프로젝트로 분리
- 필요할 때만 서브 디렉토리를 켜면 된다

`CMakelists.txt`
```cmake
cmake_minimum_required(VERSION 3.20)
project(gameserver-basics-lab 
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

option(ENABLE_LAB1 "Build lab1: TCP echo server" ON)
option(ENABLE_LAB2 "Build lab2: Turn-based 10 TPS server" OFF)
option(ENABLE_LAB3 "Build lab3: WebSocket chat server" OFF)
option(ENABLE_LAB4 "Build lab4: Pong WebSocket 60 TPS server" OFF)

# ----- Subdirectories -------------------------------------------
if(ENABLE_LAB1)
    add_subdirectory(src/lab1-tcp-echo)
endif()

if(ENABLE_LAB2)
    add_subdirectory(src/lab2-turn-based-10tps)
endif()

if(ENABLE_LAB3)
    add_subdirectory(src/lab3-websocket-chat)
endif()

if(ENABLE_LAB4)
    add_subdirectory(src/lab4-pong-60tps)
endif()

# ----- Convenience target: re -------------------------------------

add_custom_target(re
    COMMAND ${CMAKE_BUILD_TOOL} clean
    COMMAND ${CMAKE_BUILD_TOOL} all
    COMMENT "Clean and rebuild entire project (re)"
)
```

## 0.4: 문서 구조 준비

- `docs/`는 모든 실습에서 공통으로 사용하는 근거/증빙 자료 보관용
- 실험 기록, 와이어샤크 캡처, CPU/GPU 프로파일링 결과 등을 넣는 공간
- 실습 단위로 정리되어 있어 향후 회고/리뷰 용이

```bash
mkdir -p docs/evidence/{lab1,lab2,lab3,lab4}
find docs -type d -exec touch {}/.gitkeep \;
```

디렉터리 구조:
```bash
docs
└── evidence
    ├── lab1
    ├── lab2
    ├── lab3
    └── lab4
```

## 0.5: 소스 디렉토리 준비

모든 서버 Lab은 동일한 패턴을 가질 것이다.

- Lab1: TCP Echo Server
- Lab2: Turn-based Server (10 TPS)
- Lab3: WebSocket Chat Server
- Lab4: Pong WebSocket Server (60 TPS)

```bash
mkdir -p src/{lab1-tcp-echo,lab2-turn-based-10tps,lab3-websocket-chat,lab4-pong-ws-60tps}
find src -type d -exec touch {}/.gitkeep \;
```

디렉터리 구조:
```bash
src
├── lab1-tcp-echo
├── lab2-turn-based-10tps
├── lab3-websocket-chat
└── lab4-pong-ws-60tps
```

## 0.6: README 작성

최상위 README에는 각 Lab이 무엇을 다루는지만 요약하고, 상세 문서는 각 Lab 내부 README에 별도로 작성한다.

`README.md`
```markdown
# Game Server Basics Lab

4개의 서버 실습 프로젝트(Lab1 ~ 4)를 하나의 저장소에서 통합 관리합니다.

## Labs Overview

### Lab1: TCP Echo Server
- TCP 기반 네트워크 I/O
- 소켓 API / 멀티 스레드 구조
- 서버 스레드 모델 기초

### Lab2: Turn-based Server (10 TPS)
### Lab3: WebSocket Chat Server
### Lab4: Pong WebSocket Server (60 TPS)

---

## Directory Structure

src/            # 각 실습 프로젝트 소스코드
docs/           # 실험/로그/증빙자료
CMakeLists.txt  # 최상위 빌드 설정
```