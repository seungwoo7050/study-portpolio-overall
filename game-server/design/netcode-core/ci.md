# netcode-core CI/CD 설계 일지
> UDP 권위 서버 빌드 자동화, 테스트, 품질 게이트 (v1.0 베이스라인)

## 1. 목표 & 범위

### 1.1 목표

netcode-core의 **모든 버전 (v1.0~v1.3+)에 대한 공통 CI/CD 파이프라인**을 확립하여:
- 코드 변경 시 빌드 실패를 조기 발견
- 메모리 안전성 검증 (ASan/UBSan)
- 성능 회귀 방지 (60 TPS, p99 < 15ms)
- 코드 품질 유지 (clang-format, clang-tidy)

### 1.2 범위

**CI 작업:**
1. **Debug 빌드 + ASan/UBSan**
   - 메모리 릭, 버퍼 오버플로우, 정의되지 않은 동작 검출
2. **Release 빌드**
   - 최적화 적용, 성능 테스트용
3. **유닛 테스트**
   - Google Test 기반 테스트 실행
4. **통합 테스트** (선택적)
   - 서버 시작 → loadgen → 결과 검증
5. **정적 분석**
   - clang-tidy 경고 0개

**품질 게이트 (v1.0 이후 모든 버전 공통):**
| 항목 | 기준 |
|------|------|
| 빌드 | Debug/Release 모두 성공 |
| 테스트 | 모든 유닛 테스트 통과 |
| 메모리 안전 | ASan/UBSan 에러 0개 |
| 성능 | 60 TPS ±1, p99 < 15ms |
| 린트 | clang-format/tidy 경고 0개 |

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
  netcode-core:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y cmake libboost-all-dev \
            protobuf-compiler libprotobuf-dev libhiredis-dev \
            clang-tidy clang-format

      - name: Configure netcode-core (Debug + ASan)
        run: |
          cmake -S netcode-core -B build/netcode-core \
            -DCMAKE_BUILD_TYPE=Debug \
            -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -g -fno-omit-frame-pointer"

      - name: Build netcode-core
        run: cmake --build build/netcode-core --config Debug -j4

      - name: Run tests (with ASan/UBSan)
        run: |
          cd build/netcode-core
          ctest --output-on-failure --timeout 60

      - name: Configure Release build
        run: |
          cmake -S netcode-core -B build/netcode-release \
            -DCMAKE_BUILD_TYPE=Release

      - name: Build Release
        run: cmake --build build/netcode-release --config Release -j4

      - name: Lint (clang-tidy)
        run: |
          find netcode-core -name "*.cpp" -not -path "*/build/*" | \
            xargs clang-tidy -p build/netcode-core
```

### 2.2 각 단계 설명

#### Step 1-2: Checkout & Dependencies
- gameserver-fundamentals와 동일 (Boost, protobuf, hiredis)
- 추가: `clang-tidy`, `clang-format` (정적 분석)

#### Step 3: Configure Debug + ASan/UBSan
**ASan (AddressSanitizer):**
- 메모리 릭, use-after-free, 버퍼 오버플로우 검출
- `-fsanitize=address`

**UBSan (UndefinedBehaviorSanitizer):**
- 정수 오버플로우, null 포인터 역참조, 시프트 연산 등
- `-fsanitize=undefined`

**추가 플래그:**
- `-g`: 디버그 심볼 (스택 트레이스 출력)
- `-fno-omit-frame-pointer`: 정확한 스택 추적

#### Step 4: Build
- 병렬 빌드 (`-j4`)
- 빌드 실패 시 workflow 중단

#### Step 5: Run tests
**CTest:**
- CMake 테스트 러너
- `--output-on-failure`: 실패 시 출력 표시
- `--timeout 60`: 테스트당 최대 60초

**ASan/UBSan 동작:**
- 테스트 실행 중 메모리 에러 발견 시 즉시 종료
- 에러 리포트 출력 (파일:라인 정보 포함)

#### Step 6-7: Release 빌드
- 최적화 적용 (`-O3`)
- 성능 테스트용 (loadgen)

#### Step 8: Lint
**clang-tidy:**
- 정적 분석 도구
- 경고 예시:
  - 사용되지 않는 변수
  - 잠재적 null 역참조
  - 스타일 위반 (naming convention)

---

## 3. 품질 게이트 스크립트

**파일 경로:** `netcode-core/scripts/quality-gate.sh`

```bash
#!/bin/bash
set -e

echo "=== Quality Gate v1.0 ==="

# 1. Build Debug + ASan/UBSan
echo "Step 1: Debug build with sanitizers..."
cmake -S netcode-core -B build/debug \
  -DCMAKE_BUILD_TYPE=Debug \
  -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -g -fno-omit-frame-pointer"
cmake --build build/debug -j$(nproc)

# 2. Run tests
echo "Step 2: Running tests..."
cd build/debug
ctest --output-on-failure --timeout 60
cd ../..

# 3. Build Release
echo "Step 3: Release build..."
cmake -S netcode-core -B build/release -DCMAKE_BUILD_TYPE=Release
cmake --build build/release -j$(nproc)

# 4. Lint
echo "Step 4: Running clang-tidy..."
find netcode-core -name "*.cpp" -not -path "*/build/*" | \
  xargs clang-tidy -p build/debug --warnings-as-errors='*'

# 5. Performance test (60 TPS, p99 < 15ms)
echo "Step 5: Performance test..."
./build/release/apps/pong_udp/pong_udp --metrics-port 9090 &
SERVER_PID=$!
sleep 2

# loadgen 실행
./build/release/apps/loadgen/loadgen \
  --clients 50 --duration 30 --output perf_results.csv

# 결과 검증 (Python 스크립트)
python3 netcode-core/scripts/check_perf_regression.py perf_results.csv

# 정리
kill $SERVER_PID

# 6. Network experiment (3% loss)
echo "Step 6: Network stress test..."
sudo tc qdisc add dev lo root netem loss 3%

./build/release/apps/pong_udp/pong_udp &
SERVER_PID=$!
sleep 2

./build/release/apps/loadgen/loadgen \
  --clients 10 --duration 30 --output stress_results.csv

kill $SERVER_PID
sudo tc qdisc del dev lo root

echo "=== All checks passed ==="
```

**check_perf_regression.py:**
```python
#!/usr/bin/env python3
import sys
import pandas as pd

df = pd.read_csv(sys.argv[1])
avg_rtt = df['avg_rtt_ms'].mean()
max_rtt = df['max_rtt_ms'].quantile(0.99)

print(f"Average RTT: {avg_rtt:.2f}ms")
print(f"p99 RTT: {max_rtt:.2f}ms")

if max_rtt > 15.0:
    print(f"FAIL: p99 RTT {max_rtt:.2f}ms > 15ms")
    sys.exit(1)

print("PASS: Performance within SLO")
```

---

## 4. 테스트 전략

### 4.1 유닛 테스트 (Google Test)

**테스트 파일 구조:**
```
netcode-core/
  net/udp/
    udp_transport_test.cpp
  sync/
    delta_test.cpp
    snapshot_test.cpp
  core/
    physics_test.cpp
```

**CMakeLists.txt 설정:**
```cmake
enable_testing()
find_package(GTest REQUIRED)

add_executable(udp_transport_test net/udp/udp_transport_test.cpp)
target_link_libraries(udp_transport_test GTest::GTest GTest::Main udp_transport)
add_test(NAME UdpTransportTest COMMAND udp_transport_test)
```

**예시 테스트 (net/udp/udp_transport_test.cpp):**
```cpp
#include <gtest/gtest.h>
#include "net/udp/udp_transport.h"

TEST(UdpTransport, IsSeqNewer) {
    EXPECT_TRUE(net::udp::UdpTransport::is_seq_newer(10, 5));
    EXPECT_FALSE(net::udp::UdpTransport::is_seq_newer(5, 10));
    EXPECT_TRUE(net::udp::UdpTransport::is_seq_newer(0, 65535)); // 순환
}

TEST(UdpTransport, IsSeqAcked) {
    EXPECT_TRUE(net::udp::UdpTransport::is_seq_acked(100, 100, 0));
    EXPECT_TRUE(net::udp::UdpTransport::is_seq_acked(99, 100, 0b1));
    EXPECT_FALSE(net::udp::UdpTransport::is_seq_acked(98, 100, 0b1));
}
```

### 4.2 통합 테스트

**시나리오: 서버-클라이언트 정상 통신**

```cpp
TEST(Integration, ServerClientCommunication) {
    // 1. 서버 시작
    boost::asio::io_context ioc;
    UdpTransport server(ioc, udp::endpoint(udp::v4(), 7777));
    server.start([](auto endpoint, auto data) {
        // echo back
        server.send(endpoint, data, false);
    });
    std::thread io_thread([&]() { ioc.run(); });

    // 2. 클라이언트 연결
    UdpTransport client(ioc, udp::endpoint(udp::v4(), 0));
    bool received = false;
    client.start([&](auto endpoint, auto data) {
        received = true;
    });

    // 3. 메시지 전송
    client.send(udp::endpoint(address::from_string("127.0.0.1"), 7777),
                {0x01, 0x02, 0x03}, false);

    // 4. 응답 대기 (최대 1초)
    for (int i = 0; i < 100 && !received; ++i) {
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }

    EXPECT_TRUE(received);

    // 정리
    server.stop();
    client.stop();
    ioc.stop();
    io_thread.join();
}
```

### 4.3 메모리 안전 테스트 (ASan)

**의도적으로 메모리 릭 유발 (테스트용):**
```cpp
TEST(MemorySafety, NoLeak) {
    // 이 테스트는 ASan 활성화 시 릭 감지
    auto* ptr = new int[100];
    // delete[] ptr;  // 의도적으로 주석 처리 -> ASan 에러
}
```

**ASan 출력 예시:**
```
=================================================================
==12345==ERROR: LeakSanitizer: detected memory leaks

Direct leak of 400 byte(s) in 1 object(s) allocated from:
    #0 0x7f... in operator new[](unsigned long)
    #1 0x7f... in MemorySafety_NoLeak_Test::TestBody()

SUMMARY: AddressSanitizer: 400 byte(s) leaked in 1 allocation(s).
```

---

## 5. 정적 분석 (clang-tidy)

### 5.1 설정 파일

**파일 경로:** `netcode-core/.clang-tidy`

```yaml
Checks: >
  clang-diagnostic-*,
  clang-analyzer-*,
  cppcoreguidelines-*,
  modernize-*,
  performance-*,
  readability-*,
  -readability-identifier-length

CheckOptions:
  - key: readability-identifier-naming.ClassCase
    value: CamelCase
  - key: readability-identifier-naming.FunctionCase
    value: lower_case
  - key: readability-identifier-naming.VariableCase
    value: lower_case
  - key: readability-identifier-naming.ConstantCase
    value: UPPER_CASE
```

### 5.2 주요 체크 항목

**cppcoreguidelines:**
- 포인터 관리 (use-after-free, null 체크)
- 리소스 관리 (RAII)

**modernize:**
- `auto` 사용 권장
- 범위 기반 for문 (`for (auto& x : vec)`)
- `nullptr` vs `NULL`

**performance:**
- 불필요한 복사
- move 생성자/대입 누락

**readability:**
- 네이밍 규칙
- 매직 넘버 상수화

### 5.3 CI에서 실행

```yaml
- name: Lint (clang-tidy)
  run: |
    find netcode-core -name "*.cpp" -not -path "*/build/*" | \
      xargs clang-tidy -p build/netcode-core --warnings-as-errors='*'
```

- `--warnings-as-errors='*'`: 경고를 에러로 취급 (CI 실패)

---

## 6. 성능 회귀 방지

### 6.1 벤치마크 기준선

**파일 경로:** `netcode-core/benchmarks/baseline.json`

```json
{
  "version": "1.0",
  "date": "2024-01-15",
  "tick_rate": {
    "target": 60.0,
    "tolerance": 1.0
  },
  "tick_duration_p99_ms": {
    "target": 15.0,
    "tolerance": 2.0
  },
  "rtt_p99_ms": {
    "target": 100.0,
    "clients": 50
  }
}
```

### 6.2 자동 벤치마크 (CI)

```yaml
- name: Performance benchmark
  run: |
    ./build/release/apps/pong_udp/pong_udp --metrics-port 9090 &
    SERVER_PID=$!
    sleep 2

    ./build/release/apps/loadgen/loadgen \
      --clients 50 --duration 30 --output bench_results.csv

    python3 netcode-core/scripts/compare_benchmark.py \
      bench_results.csv netcode-core/benchmarks/baseline.json

    kill $SERVER_PID
```

**compare_benchmark.py:**
```python
import sys
import json
import pandas as pd

results = pd.read_csv(sys.argv[1])
baseline = json.load(open(sys.argv[2]))

p99_rtt = results['max_rtt_ms'].quantile(0.99)
target = baseline['rtt_p99_ms']['target']

if p99_rtt > target * 1.2:  # 20% 회귀 허용
    print(f"FAIL: p99 RTT {p99_rtt:.2f}ms > {target * 1.2:.2f}ms (baseline * 1.2)")
    sys.exit(1)

print(f"PASS: p99 RTT {p99_rtt:.2f}ms within baseline")
```

---

## 7. Docker 기반 로컬 CI 환경

개발자가 로컬에서 CI와 동일한 환경 재현.

**파일 경로:** `netcode-core/docker/ci.Dockerfile`

```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    cmake \
    g++ \
    libboost-all-dev \
    protobuf-compiler \
    libprotobuf-dev \
    libhiredis-dev \
    clang-tidy \
    clang-format \
    python3 \
    python3-pip \
    iproute2

RUN pip3 install pandas

WORKDIR /workspace

CMD ["/bin/bash"]
```

**실행:**
```bash
cd /path/to/repo
docker build -t netcode-ci -f netcode-core/docker/ci.Dockerfile .
docker run -it --rm -v $(pwd):/workspace netcode-ci

# 컨테이너 내부에서
./netcode-core/scripts/quality-gate.sh
```

---

## 8. 트러블슈팅

### 8.1 ASan false positive

**증상:**
```
==12345==ERROR: AddressSanitizer: heap-use-after-free on address 0x...
```

**원인:**
- 실제 버그
- 또는 라이브러리 내부 문제 (Boost, protobuf)

**해결:**
1. 스택 트레이스 확인 → 본인 코드인지 라이브러리인지 구분
2. 라이브러리 문제면 억제 파일 추가:
   ```bash
   export ASAN_OPTIONS=suppressions=asan_suppressions.txt
   ```

**asan_suppressions.txt:**
```
leak:boost::asio::detail::reactor::run
```

### 8.2 clang-tidy 오탐

**증상:**
```
warning: variable 'x' is not initialized [cppcoreguidelines-init-variables]
```

**원인:**
- 의도적으로 초기화 안 함 (성능 이유)

**해결:**
```cpp
// NOLINT(cppcoreguidelines-init-variables)
int x;
```

### 8.3 테스트 타임아웃

**증상:**
```
Test #1: UdpTransportTest ... ***Timeout
```

**원인:**
- 무한 루프
- 네트워크 대기 (응답 안 옴)

**해결:**
- 테스트에 타임아웃 추가:
  ```cpp
  TEST(UdpTransport, ReceiveTimeout) {
      auto start = std::chrono::steady_clock::now();
      // ...
      auto elapsed = std::chrono::steady_clock::now() - start;
      ASSERT_LT(elapsed, std::chrono::seconds(5));
  }
  ```

---

## 9. CI/CD 파이프라인 흐름도

```text
┌─────────────────────┐
│ Git Push / PR       │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ GitHub Actions      │
│ Trigger             │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     v           v
┌─────────┐ ┌─────────┐
│ Debug   │ │ Release │
│ + ASan  │ │ Build   │
└────┬────┘ └────┬────┘
     │           │
     v           v
┌─────────┐ ┌─────────┐
│ Tests   │ │ Perf    │
│ (ctest) │ │ Test    │
└────┬────┘ └────┬────┘
     │           │
     v           v
┌─────────┐ ┌─────────┐
│ Lint    │ │ Verify  │
│ (tidy)  │ │ SLO     │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           │
           v
    ┌──────────────┐
    │ All Passed?  │
    └──────┬───────┘
           │
      ┌────┴────┐
      │ Yes     │ No
      v         v
  ┌────────┐ ┌────────┐
  │ Merge  │ │ Block  │
  │ OK     │ │ PR     │
  └────────┘ └────────┘
```

---

## 10. v1.0 이후 버전별 변화

### v1.0
- **CI 확립**: Debug/Release 빌드, ASan/UBSan, 기본 테스트

### v1.1 (Snapshot/Delta)
- **추가 테스트**: `DeltaCodec`, `SnapshotGenerator` 유닛 테스트
- **메트릭**: 델타 크기, 리심 깊이

### v1.2 (Observability)
- **성능 테스트 자동화**: loadgen 통합
- **메트릭 검증**: Prometheus /metrics 엔드포인트 체크

### v1.3 (Match/Room Split)
- **통합 테스트**: Matcher + Room Server 연동
- **Redis 의존성**: CI에 Redis 서비스 추가
  ```yaml
  services:
    redis:
      image: redis:7-alpine
      ports:
        - 6379:6379
  ```

---

## 11. 체크리스트 (CI 완료 기준)

- [x] GitHub Actions workflow 작성 (`.github/workflows/ci.yml`)
- [x] Debug + ASan/UBSan 빌드 설정
- [x] Release 빌드 설정
- [x] 유닛 테스트 (Google Test) 작성 및 CTest 통합
- [x] 품질 게이트 스크립트 (`quality-gate.sh`) 작성
- [x] 성능 회귀 검증 스크립트 (`check_perf_regression.py`)
- [x] clang-tidy 설정 (`.clang-tidy`)
- [ ] clang-format 설정 (`.clang-format`) (선택)
- [ ] Docker CI 환경 (`ci.Dockerfile`)
- [ ] 통합 테스트 (서버-클라이언트) 작성
- [ ] 네트워크 스트레스 테스트 (netem) CI 통합
- [ ] 문서화: CI 사용법, 트러블슈팅, 로컬 재현 가이드

---

## 12. 참고 자료

- [GitHub Actions CI/CD](https://docs.github.com/en/actions/automating-builds-and-tests)
- [AddressSanitizer 가이드](https://github.com/google/sanitizers/wiki/AddressSanitizer)
- [clang-tidy 문서](https://clang.llvm.org/extra/clang-tidy/)
- [Google Test 가이드](https://google.github.io/googletest/)
- [CMake CTest](https://cmake.org/cmake/help/latest/manual/ctest.1.html)
