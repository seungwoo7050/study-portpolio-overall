# gameserver-fundamentals CI/CD 설계 일지
> Lab 1.1~1.4 빌드 자동화 및 품질 검증

## 1. 목표 & 범위

### 1.1 목표

gameserver-fundamentals의 4개 Lab (1.1 TCP Echo ~ 1.4 WebSocket Pong)을 **자동으로 빌드하고 검증**하여:
- 코드 변경 시 빌드 실패를 조기 발견
- Lab 간 의존성 충돌 방지
- 학습용 코드의 정확성 보장

### 1.2 범위

**대상:**
- Lab 1.1: TCP Echo Server
- Lab 1.2: Turn-based Combat
- Lab 1.3: WebSocket Chat
- Lab 1.4: WebSocket Pong

**CI 작업:**
1. Debug 빌드 (모든 Lab 활성화)
2. 컴파일 에러 검출
3. 기본 실행 가능성 확인 (바이너리 존재)

**비범위:**
- 유닛 테스트 (Lab 코드에는 테스트 없음)
- 성능 벤치마크
- 메모리 검증 (ASan/UBSan은 netcode-core에서만 사용)

---

## 2. GitHub Actions Workflow

### 2.1 Workflow 파일 구조

**파일 경로:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ["main", "master"]
  pull_request:

jobs:
  gameserver-fundamentals:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y cmake libboost-all-dev \
            protobuf-compiler libprotobuf-dev libhiredis-dev

      - name: Configure gameserver-fundamentals
        run: |
          cmake -S gameserver-fundamentals -B build/gameserver \
            -DENABLE_LAB1_1=ON -DENABLE_LAB1_2=ON \
            -DENABLE_LAB1_3=ON -DENABLE_LAB1_4=ON

      - name: Build gameserver-fundamentals
        run: cmake --build build/gameserver --config Debug
```

### 2.2 각 단계 설명

#### Step 1: Checkout repository
- GitHub Actions 기본 액션
- 리포지토리 코드를 러너에 복사

#### Step 2: Install dependencies
- **cmake**: 빌드 시스템 (3.20+)
- **libboost-all-dev**: Boost.Asio, Boost.Beast (WebSocket)
- **protobuf-compiler, libprotobuf-dev**: netcode-core 의존성 (함께 설치)
- **libhiredis-dev**: Redis 클라이언트 (netcode-core 의존성)

#### Step 3: Configure
- CMake 설정 단계
- `-S gameserver-fundamentals`: 소스 디렉토리
- `-B build/gameserver`: 빌드 출력 디렉토리
- `-DENABLE_LAB1_X=ON`: 각 Lab 활성화 플래그

**CMakeLists.txt 예시 (gameserver-fundamentals/):**
```cmake
cmake_minimum_required(VERSION 3.20)
project(gameserver-fundamentals)

option(ENABLE_LAB1_1 "Build Lab 1.1 TCP Echo" OFF)
option(ENABLE_LAB1_2 "Build Lab 1.2 Turn Combat" OFF)
option(ENABLE_LAB1_3 "Build Lab 1.3 WebSocket Chat" OFF)
option(ENABLE_LAB1_4 "Build Lab 1.4 WebSocket Pong" OFF)

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

#### Step 4: Build
- 실제 컴파일 수행
- `--config Debug`: Debug 빌드 타입
- 에러 발생 시 workflow 실패 (exit code != 0)

---

## 3. 빌드 검증 기준

### 3.1 성공 조건

1. **컴파일 성공**: 모든 소스 파일 컴파일 완료
2. **링크 성공**: 실행 파일 생성
3. **바이너리 존재 확인**:
   ```bash
   ls build/gameserver/lab1.1-tcp-echo/echo_server
   ls build/gameserver/lab1.2-turn-combat/turn_combat
   ls build/gameserver/lab1.3-ws-chat/ws_chat
   ls build/gameserver/lab1.4-ws-pong/pong_ws
   ```

### 3.2 실패 시나리오

#### 시나리오 1: 컴파일 에러
```
lab1.3-ws-chat/main.cpp:42:15: error: 'async_accept' is not a member of 'boost::asio::ip::tcp::acceptor'
```
- **원인**: Boost 버전 불일치, 오타
- **대응**: PR 머지 차단, 수정 후 재푸시

#### 시나리오 2: 링크 에러
```
undefined reference to `boost::beast::websocket::stream::async_read'
```
- **원인**: Boost.Beast 라이브러리 누락
- **대응**: CMakeLists.txt에서 `find_package(Boost ... beast)` 확인

#### 시나리오 3: 의존성 설치 실패
```
E: Unable to locate package libboost-all-dev
```
- **원인**: APT 저장소 업데이트 필요
- **대응**: `sudo apt-get update` 추가 (이미 포함됨)

---

## 4. 로컬 검증 스크립트

개발자가 PR 전에 로컬에서 CI와 동일한 검증을 수행할 수 있도록 스크립트 제공.

**파일 경로:** `gameserver-fundamentals/scripts/verify-build.sh`

```bash
#!/bin/bash
set -e

echo "=== gameserver-fundamentals Build Verification ==="

# 1. 의존성 체크
echo "Checking dependencies..."
command -v cmake >/dev/null 2>&1 || { echo "cmake not found"; exit 1; }
dpkg -l | grep libboost-dev >/dev/null || { echo "Boost not found"; exit 1; }

# 2. Configure
echo "Configuring..."
cmake -S gameserver-fundamentals -B build/gameserver \
    -DENABLE_LAB1_1=ON -DENABLE_LAB1_2=ON \
    -DENABLE_LAB1_3=ON -DENABLE_LAB1_4=ON \
    -DCMAKE_BUILD_TYPE=Debug

# 3. Build
echo "Building..."
cmake --build build/gameserver --config Debug -j$(nproc)

# 4. Verify binaries
echo "Verifying binaries..."
test -f build/gameserver/lab1.1-tcp-echo/echo_server || { echo "Lab 1.1 build failed"; exit 1; }
test -f build/gameserver/lab1.2-turn-combat/turn_combat || { echo "Lab 1.2 build failed"; exit 1; }
test -f build/gameserver/lab1.3-ws-chat/ws_chat || { echo "Lab 1.3 build failed"; exit 1; }
test -f build/gameserver/lab1.4-ws-pong/pong_ws || { echo "Lab 1.4 build failed"; exit 1; }

echo "=== All checks passed ==="
```

**실행:**
```bash
cd /path/to/repo
chmod +x gameserver-fundamentals/scripts/verify-build.sh
./gameserver-fundamentals/scripts/verify-build.sh
```

---

## 5. 빌드 최적화

### 5.1 캐싱 (선택적)

GitHub Actions에서 의존성 설치 시간 절감을 위해 APT 패키지 캐싱 가능:

```yaml
- name: Cache APT packages
  uses: actions/cache@v3
  with:
    path: /var/cache/apt/archives
    key: ${{ runner.os }}-apt-${{ hashFiles('.github/workflows/ci.yml') }}

- name: Install dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y cmake libboost-all-dev ...
```

**효과:**
- 첫 실행: ~2분 (의존성 다운로드)
- 캐시 히트 시: ~30초

### 5.2 병렬 빌드

```yaml
- name: Build gameserver-fundamentals
  run: cmake --build build/gameserver --config Debug -j4
```

- `-j4`: 4 코어 병렬 컴파일
- GitHub Actions 러너는 2 코어 제공 (Free tier)
- 빌드 시간: 단일 스레드 대비 ~40% 단축

---

## 6. 트러블슈팅

### 6.1 "Boost not found" 에러

**증상:**
```
CMake Error: Could not find Boost
```

**원인:**
- `libboost-all-dev` 설치 안 됨
- CMake가 Boost를 찾을 수 없음

**해결:**
```bash
sudo apt-get install -y libboost-all-dev
# 또는 최소 필요 패키지만:
sudo apt-get install -y libboost-system-dev libboost-thread-dev libboost-chrono-dev
```

### 6.2 "undefined reference to std::filesystem" (C++17)

**증상:**
```
undefined reference to `std::filesystem::path::_M_split_cmpts()'
```

**원인:**
- GCC 8 이하에서 C++17 filesystem은 `-lstdc++fs` 링크 필요

**해결 (CMakeLists.txt):**
```cmake
target_link_libraries(echo_server PRIVATE stdc++fs)
```

### 6.3 빌드는 성공하지만 실행 시 segfault

**증상:**
- CI에서는 빌드만 확인 → 실행 에러 발견 못 함

**해결:**
- 로컬에서 반드시 실행 테스트
- 향후 개선: CI에 간단한 실행 테스트 추가
  ```yaml
  - name: Smoke test Lab 1.1
    run: timeout 5 ./build/gameserver/lab1.1-tcp-echo/echo_server 8080 || true
  ```

---

## 7. 향후 개선 방향

### 7.1 단기 (현재 범위 내)

1. **바이너리 실행 테스트**
   - 각 바이너리를 `--help` 옵션으로 실행
   - segfault 없이 종료되는지 확인

2. **Release 빌드 추가**
   ```yaml
   - name: Build Release
     run: |
       cmake -S gameserver-fundamentals -B build/gameserver-release \
         -DCMAKE_BUILD_TYPE=Release ...
       cmake --build build/gameserver-release
   ```

### 7.2 중기 (v2.0+)

1. **통합 테스트**
   - 각 Lab에 대한 Python 스크립트
   - 예: Lab 1.1 서버 시작 → `nc` 접속 → echo 확인

2. **코드 품질 도구**
   - `clang-format` 검증 (코드 스타일 일관성)
   - `clang-tidy` 정적 분석

### 7.3 장기 (교육 목적)

1. **학습 가이드 자동 생성**
   - 각 Lab의 주요 코드 블록 추출
   - 마크다운 문서 자동 생성

2. **웹 기반 데모**
   - GitHub Pages로 Lab 1.3, 1.4 WebSocket 클라이언트 호스팅
   - CI에서 자동 배포

---

## 8. 체크리스트 (CI 완료 기준)

- [x] GitHub Actions workflow 파일 작성 (`.github/workflows/ci.yml`)
- [x] 모든 Lab (1.1~1.4) 빌드 성공 확인
- [x] PR에 자동 빌드 트리거 설정
- [x] 로컬 검증 스크립트 (`verify-build.sh`) 작성
- [x] 빌드 실패 시 PR 머지 차단 확인
- [ ] README에 CI 배지 추가 (예: ![CI Status](https://github.com/...))
- [ ] 빌드 최적화 (캐싱, 병렬) 적용 (선택)
- [ ] 문서화: CI 사용법, 트러블슈팅 가이드

---

## 9. 참고 자료

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [CMake 빌드 옵션](https://cmake.org/cmake/help/latest/manual/cmake.1.html)
- [Boost 설치 가이드](https://www.boost.org/doc/libs/release/more/getting_started/unix-variants.html)
