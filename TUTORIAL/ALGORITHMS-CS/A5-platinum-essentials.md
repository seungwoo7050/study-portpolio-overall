# A5: 플래티넘 필수 알고리즘 (Platinum Essentials)

> **목표**: 플래티넘 5-3 안정적 통과, 플래티넘 1 도전 가능
> **예상 시간**: 60-80시간
> **난이도**: 🔴 매우 어려움
> **선행 요구사항**: A3 완료 (골드 1-2 안정적 해결)
> **문제 수**: 40-60문제 (토픽당 8-15문제)
> **완료 기준**: 플래티넘 3 문제를 보고 접근 방법 파악 가능

---

## ⚠️ 시작하기 전에

### 이 단계는 누구를 위한 것인가?

**YES - 필요한 경우**:
- ✅ 골드 1을 안정적으로 해결 (90% 이상)
- ✅ 삼성/카카오/네이버 등 최상위 기업 코테 준비
- ✅ ICPC/대회 준비
- ✅ PS가 취미/목표

**NO - 불필요한 경우**:
- ❌ 아직 골드 3-4 수준
- ❌ 주니어 개발자 취업만 목표
- ❌ 시간이 부족함 (프로젝트 우선)

### 학습 철학

**골드와 플래티넘의 차이**:
- 골드: "알고리즘을 알면 풀림"
- 플래티넘: "알고리즘을 알아도 구현이 어려움"

**접근 방법**:
- ✅ 완벽한 이해보다 "쓸 수 있는 수준"
- ✅ 템플릿 암기 + 변형 연습
- ✅ 많은 시행착오 각오

---

## 목차

1. [문자열: KMP](#1-문자열-kmp)
2. [DP 최적화: Convex Hull Trick](#2-dp-최적화-convex-hull-trick)
3. [기하학: CCW & Convex Hull](#3-기하학-ccw--convex-hull)
4. [수학: 정수론 기초](#4-수학-정수론-기초)
5. [종합 실전](#5-종합-실전)

---

## 1. 문자열: KMP

### 1.1 개념

**KMP (Knuth-Morris-Pratt)**: 문자열 패턴 매칭을 O(N+M)에 해결

**문제**: 텍스트 T에서 패턴 P가 몇 번 등장하는가?

**Naive 방법**: O(NM)
```cpp
int count = 0;
for (int i = 0; i <= n - m; i++) {
    bool match = true;
    for (int j = 0; j < m; j++) {
        if (T[i+j] != P[j]) {
            match = false;
            break;
        }
    }
    if (match) count++;
}
```

**KMP 핵심 아이디어**: 불일치 시 패턴을 얼마나 이동시킬지 미리 계산

### 1.2 Failure Function (실패 함수)

**정의**: `fail[i]` = P[0..i]의 접두사이면서 접미사인 문자열의 최대 길이 (자기 자신 제외)

**예시**:
```
P = "ABABC"
i:    0  1  2  3  4
P[i]: A  B  A  B  C
fail: 0  0  1  2  0

설명:
- i=0: "" → 길이 0
- i=1: "AB" → 접두사이면서 접미사 없음 → 0
- i=2: "ABA" → "A" 공통 → 1
- i=3: "ABAB" → "AB" 공통 → 2
- i=4: "ABABC" → 공통 없음 → 0
```

**Failure Function 계산**:
```cpp
vector<int> getFailure(const string& P) {
    int m = P.size();
    vector<int> fail(m, 0);

    int j = 0;
    for (int i = 1; i < m; i++) {
        // j를 줄여가며 매칭 위치 찾기
        while (j > 0 && P[i] != P[j]) {
            j = fail[j - 1];
        }

        // 매칭되면 길이 증가
        if (P[i] == P[j]) {
            fail[i] = ++j;
        }
    }

    return fail;
}
```

### 1.3 KMP 매칭

```cpp
vector<int> kmp(const string& T, const string& P) {
    int n = T.size(), m = P.size();
    vector<int> fail = getFailure(P);
    vector<int> result;  // 매칭 시작 위치들

    int j = 0;  // 패턴 인덱스
    for (int i = 0; i < n; i++) {
        // 불일치 시 j를 줄임
        while (j > 0 && T[i] != P[j]) {
            j = fail[j - 1];
        }

        // 매칭되면 j 증가
        if (T[i] == P[j]) {
            if (j == m - 1) {
                // 패턴 전체 매칭
                result.push_back(i - m + 1);
                j = fail[j];  // 다음 매칭 찾기
            } else {
                j++;
            }
        }
    }

    return result;
}
```

**시간 복잡도**: O(N + M)

### 1.4 응용: 문자열 주기

**문제**: 문자열 S가 어떤 패턴의 반복인가?

```cpp
// S = "ABCABCABC" → 주기 3
int getPeriod(const string& S) {
    int n = S.size();
    vector<int> fail = getFailure(S);

    int period = n - fail[n - 1];

    // 주기로 나눠떨어지는지 확인
    if (n % period == 0) {
        return period;
    }

    return n;  // 주기 없음
}
```

**추천 문제**:
- [백준 1786번: 찾기](https://www.acmicpc.net/problem/1786) - KMP 기본
- [백준 4354번: 문자열 제곱](https://www.acmicpc.net/problem/4354) - 주기
- [백준 1305번: 광고](https://www.acmicpc.net/problem/1305)

---

## 2. DP 최적화: Convex Hull Trick

### 2.1 문제 유형

**전형적인 DP**:
```
dp[i] = min/max(dp[j] + cost(j, i))  for all j < i
```

**일반 DP**: O(N²)
**CHT 적용 시**: O(N log N) 또는 O(N)

### 2.2 조건

CHT를 적용하려면:
1. `cost(j, i) = A[j] × B[i] + C[j]` 형태
2. `A[j]`가 단조 증가/감소
3. `B[i]`가 단조 증가/감소

**예제**:
```
dp[i] = min(dp[j] + (sum[i] - sum[j])²)
      = min(dp[j] + sum[i]² - 2×sum[i]×sum[j] + sum[j]²)
      = sum[i]² + min((-2×sum[j])×sum[i] + (dp[j] + sum[j]²))
            ↓
      A[j] = -2×sum[j]
      B[i] = sum[i]
      C[j] = dp[j] + sum[j]²
```

### 2.3 직선으로 생각하기

각 j를 **직선**으로 봄:
```
y = A[j] × x + C[j]
```

**목표**: 특정 x = B[i]에서 최솟값을 주는 직선 찾기

**핵심 아이디어**:
- 기울기 순서대로 직선 저장
- 불필요한 직선 제거 (다른 직선들보다 항상 큼)

### 2.4 구현 (쿼리가 단조 증가)

```cpp
struct Line {
    long long a, b;  // y = ax + b

    long long eval(long long x) const {
        return a * x + b;
    }

    // 이 직선과 other의 교점 x좌표
    double cross(const Line& other) const {
        return (double)(other.b - b) / (a - other.a);
    }
};

class ConvexHullTrick {
    deque<Line> lines;

public:
    // 직선 추가 (a는 단조 감소해야 함)
    void addLine(long long a, long long b) {
        Line newLine = {a, b};

        // 불필요한 직선 제거
        while (lines.size() >= 2) {
            Line last = lines.back();
            Line prev = lines[lines.size() - 2];

            // newLine이 last를 쓸모없게 만드는가?
            if (prev.cross(last) >= last.cross(newLine)) {
                lines.pop_back();
            } else {
                break;
            }
        }

        lines.push_back(newLine);
    }

    // 최솟값 쿼리 (x는 단조 증가해야 함)
    long long query(long long x) {
        // 앞쪽 직선이 더 이상 최적이 아니면 제거
        while (lines.size() >= 2) {
            if (lines[0].eval(x) >= lines[1].eval(x)) {
                lines.pop_front();
            } else {
                break;
            }
        }

        return lines[0].eval(x);
    }
};

// 사용 예시
void solveProblem() {
    int n;
    cin >> n;

    vector<long long> sum(n + 1);
    for (int i = 1; i <= n; i++) {
        int a;
        cin >> a;
        sum[i] = sum[i-1] + a;
    }

    ConvexHullTrick cht;
    vector<long long> dp(n + 1);

    cht.addLine(-2 * sum[0], dp[0] + sum[0] * sum[0]);

    for (int i = 1; i <= n; i++) {
        dp[i] = cht.query(sum[i]) + sum[i] * sum[i];
        cht.addLine(-2 * sum[i], dp[i] + sum[i] * sum[i]);
    }

    cout << dp[n] << '\n';
}
```

### 2.5 일반 쿼리 (Li Chao Tree)

쿼리가 단조 증가하지 않으면:

```cpp
// Li Chao Tree로 O(log N) 쿼리 가능
// 복잡하므로 필요 시 구현 참고
```

**추천 문제**:
- [백준 13263번: 나무 자르기](https://www.acmicpc.net/problem/13263) - CHT 기본
- [백준 12795번: 반평면 땅따먹기](https://www.acmicpc.net/problem/12795) - Li Chao
- [백준 4008번: 특공대](https://www.acmicpc.net/problem/4008)

---

## 3. 기하학: CCW & Convex Hull

### 3.1 CCW (Counter-Clockwise)

**개념**: 세 점 A, B, C가 반시계 방향인지 판별

```cpp
struct Point {
    long long x, y;

    Point operator-(const Point& p) const {
        return {x - p.x, y - p.y};
    }
};

// 외적 (Cross Product)
long long cross(const Point& A, const Point& B) {
    return A.x * B.y - A.y * B.x;
}

// CCW
// > 0: 반시계 방향
// = 0: 일직선
// < 0: 시계 방향
long long ccw(const Point& A, const Point& B, const Point& C) {
    return cross(B - A, C - A);
}
```

**응용 1: 선분 교차 판정**
```cpp
bool lineIntersects(Point A, Point B, Point C, Point D) {
    long long ab = ccw(A, B, C) * ccw(A, B, D);
    long long cd = ccw(C, D, A) * ccw(C, D, B);

    // 두 선분이 교차
    if (ab == 0 && cd == 0) {
        // 일직선상에 있는 경우
        if (A > B) swap(A, B);
        if (C > D) swap(C, D);
        return !(B < C || D < A);
    }

    return ab <= 0 && cd <= 0;
}
```

### 3.2 Convex Hull (볼록 껍질)

**문제**: N개 점을 모두 포함하는 최소 볼록 다각형

**Graham Scan**: O(N log N)

```cpp
vector<Point> convexHull(vector<Point> points) {
    int n = points.size();
    if (n < 3) return points;

    // 1. 가장 아래(y 최소), 그 중 왼쪽(x 최소) 점 찾기
    swap(points[0], *min_element(points.begin(), points.end(),
        [](const Point& a, const Point& b) {
            return a.y < b.y || (a.y == b.y && a.x < b.x);
        }));

    Point base = points[0];

    // 2. 극각 정렬
    sort(points.begin() + 1, points.end(),
        [&](const Point& a, const Point& b) {
            long long c = ccw(base, a, b);
            if (c != 0) return c > 0;  // 반시계 방향 우선
            // 일직선이면 가까운 점 우선
            return (a.x - base.x) * (a.x - base.x) + (a.y - base.y) * (a.y - base.y)
                 < (b.x - base.x) * (b.x - base.x) + (b.y - base.y) * (b.y - base.y);
        });

    // 3. Convex Hull 구성
    vector<Point> hull;
    for (const Point& p : points) {
        // 오목한 점 제거
        while (hull.size() >= 2 &&
               ccw(hull[hull.size()-2], hull.back(), p) <= 0) {
            hull.pop_back();
        }
        hull.push_back(p);
    }

    return hull;
}
```

### 3.3 Rotating Calipers

**문제**: Convex Hull의 가장 먼 두 점 거리

```cpp
long long rotatingCalipers(const vector<Point>& hull) {
    int n = hull.size();
    long long maxDist = 0;

    int j = 1;
    for (int i = 0; i < n; i++) {
        while (true) {
            int next_i = (i + 1) % n;
            int next_j = (j + 1) % n;

            Point edge_i = hull[next_i] - hull[i];
            Point edge_j = hull[next_j] - hull[j];

            // j를 더 돌려야 하는가?
            if (cross(edge_i, edge_j) > 0) {
                j = next_j;
            } else {
                break;
            }
        }

        long long dx = hull[i].x - hull[j].x;
        long long dy = hull[i].y - hull[j].y;
        maxDist = max(maxDist, dx * dx + dy * dy);
    }

    return maxDist;
}
```

**추천 문제**:
- [백준 11758번: CCW](https://www.acmicpc.net/problem/11758) - CCW 기본
- [백준 1708번: 볼록 껍질](https://www.acmicpc.net/problem/1708) - Convex Hull
- [백준 2254번: 감옥 건설](https://www.acmicpc.net/problem/2254)
- [백준 10254번: 고속도로](https://www.acmicpc.net/problem/10254) - Rotating Calipers

---

## 4. 수학: 정수론 기초

### 4.1 모듈러 연산

**기본 성질**:
```cpp
(a + b) % m = ((a % m) + (b % m)) % m
(a - b) % m = ((a % m) - (b % m) + m) % m
(a × b) % m = ((a % m) × (b % m)) % m
```

**모듈러 거듭제곱**:
```cpp
long long modpow(long long a, long long b, long long mod) {
    long long res = 1;
    a %= mod;

    while (b > 0) {
        if (b & 1) {
            res = (res * a) % mod;
        }
        a = (a * a) % mod;
        b >>= 1;
    }

    return res;
}
```

### 4.2 확장 유클리드 알고리즘

**목표**: `ax + by = gcd(a, b)`를 만족하는 x, y 찾기

```cpp
long long extgcd(long long a, long long b, long long& x, long long& y) {
    if (b == 0) {
        x = 1;
        y = 0;
        return a;
    }

    long long x1, y1;
    long long g = extgcd(b, a % b, x1, y1);

    x = y1;
    y = x1 - (a / b) * y1;

    return g;
}
```

### 4.3 모듈러 역원

**문제**: `a × x ≡ 1 (mod m)`을 만족하는 x 찾기

```cpp
long long modinv(long long a, long long m) {
    long long x, y;
    long long g = extgcd(a, m, x, y);

    if (g != 1) {
        // 역원 없음
        return -1;
    }

    return (x % m + m) % m;
}

// Fermat's Little Theorem (m이 소수일 때)
long long modinv_prime(long long a, long long p) {
    return modpow(a, p - 2, p);
}
```

### 4.4 중국인의 나머지 정리 (CRT)

**문제**:
```
x ≡ a1 (mod m1)
x ≡ a2 (mod m2)
...
```

**해법** (m1, m2가 서로소):
```cpp
long long crt(long long a1, long long m1, long long a2, long long m2) {
    long long x, y;
    extgcd(m1, m2, x, y);

    long long m = m1 * m2;
    long long res = (a1 * m2 * y + a2 * m1 * x) % m;

    return (res + m) % m;
}
```

### 4.5 소수 판정 (Miller-Rabin)

**확률적 소수 판정**: O(k log³ n)

```cpp
bool isPrime(long long n, int k = 10) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;

    // n-1 = 2^s × d
    long long d = n - 1;
    int s = 0;
    while (d % 2 == 0) {
        d /= 2;
        s++;
    }

    auto check = [&](long long a) {
        long long x = modpow(a, d, n);
        if (x == 1 || x == n - 1) return true;

        for (int i = 0; i < s - 1; i++) {
            x = (x * x) % n;
            if (x == n - 1) return true;
        }
        return false;
    };

    // 작은 소수들로 테스트
    vector<long long> witnesses = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37};
    for (long long a : witnesses) {
        if (a >= n) break;
        if (!check(a)) return false;
    }

    return true;
}
```

**추천 문제**:
- [백준 11401번: 이항 계수 3](https://www.acmicpc.net/problem/11401) - 모듈러 역원
- [백준 6086번: 최대 유량](https://www.acmicpc.net/problem/6086) - 확장 유클리드
- [백준 4355번: 서로소](https://www.acmicpc.net/problem/4355) - 오일러 파이 함수
- [백준 4149번: 큰 수 소인수분해](https://www.acmicpc.net/problem/4149) - Miller-Rabin

---

## 5. 종합 실전

### 5.1 플래티넘 문제 풀이 전략

**1단계: 토픽 파악**
```
문제 읽기 → 키워드 찾기
- "패턴 매칭" → KMP
- "DP + 직선" → CHT
- "볼록 다각형" → Convex Hull
- "나머지 연산" → 정수론
```

**2단계: 템플릿 적용**
```
기본 템플릿 작성 → 문제에 맞게 수정
```

**3단계: 디버깅**
```
플래티넘은 엣지 케이스가 많음
- 오버플로 (long long 사용)
- 0으로 나누기
- 배열 범위
```

### 5.2 추천 학습 순서

| 주차 | 토픽 | 문제 수 | 시간 |
|-----|------|---------|------|
| 1-2 | KMP | 10-12 | 15-20h |
| 3-4 | CHT | 8-10 | 20-25h |
| 5-6 | Geometry | 10-12 | 15-20h |
| 7-8 | Number Theory | 8-10 | 10-15h |

**총 60-80시간**

### 5.3 플래티넘 문제집

**입문 (플래티넘 5-4)**:
- [백준 1786번: 찾기](https://www.acmicpc.net/problem/1786)
- [백준 11758번: CCW](https://www.acmicpc.net/problem/11758)
- [백준 11401번: 이항 계수 3](https://www.acmicpc.net/problem/11401)

**중급 (플래티넘 3-2)**:
- [백준 13263번: 나무 자르기](https://www.acmicpc.net/problem/13263)
- [백준 1708번: 볼록 껍질](https://www.acmicpc.net/problem/1708)
- [백준 4354번: 문자열 제곱](https://www.acmicpc.net/problem/4354)

**고급 (플래티넘 1)**:
- [백준 12795번: 반평면 땅따먹기](https://www.acmicpc.net/problem/12795)
- [백준 10254번: 고속도로](https://www.acmicpc.net/problem/10254)
- [백준 4149번: 큰 수 소인수분해](https://www.acmicpc.net/problem/4149)

---

## 면접 대응

### 자주 나오는 질문

**1. KMP를 왜 쓰나요?**
**답변**: 문자열 패턴 매칭을 O(N+M)에 해결하기 위해서입니다. Naive 방법은 O(NM)이지만, KMP는 실패 함수를 이용해 불필요한 비교를 건너뜁니다.

**2. DP 최적화는 언제 필요한가요?**
**답변**: 일반 DP가 O(N²)으로 시간 초과가 나는 경우, Convex Hull Trick을 사용하면 O(N log N) 또는 O(N)으로 최적화할 수 있습니다. DP 점화식이 직선 형태로 표현될 때 적용 가능합니다.

**3. 기하학 문제는 어떻게 접근하나요?**
**답변**: CCW로 방향 판별, Convex Hull로 볼록 껍질을 구합니다. 대부분의 기하 문제는 이 두 가지 기법의 조합으로 해결 가능합니다.

---

## 다음 단계

✅ **A5 완료 후**:
- 플래티넘 5-3 안정화 (3-6개월)
- 더 고급 토픽 (A6) 또는
- 실전 프로젝트/대회 준비

**체크리스트**:
- [ ] KMP 템플릿 암기 및 변형 가능
- [ ] CHT를 DP 문제에 적용 가능
- [ ] CCW, Convex Hull 구현 가능
- [ ] 모듈러 연산, 확장 유클리드 이해
- [ ] 플래티넘 3 문제를 보고 접근 방법 파악 가능

**중요**: 플래티넘은 골드보다 훨씬 어렵습니다. 인내심을 가지세요!

---

## 추가 리소스

### 온라인 저지
- **Codeforces**: Div.2 C-D 문제
- **AtCoder**: ABC D-E 문제
- **solved.ac**: CLASS 5-6

### 참고 자료
- [cp-algorithms](https://cp-algorithms.com/): 영문 알고리즘 위키
- [GeeksforGeeks](https://www.geeksforgeeks.org/): 예제 코드
- [TopCoder Tutorials](https://www.topcoder.com/community/competitive-programming/tutorials/)

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0

---

**경고**:
> 플래티넘은 "천재들의 놀이터"가 아닙니다.
> 꾸준함과 인내가 재능을 이깁니다.
> 하루 2시간, 3개월이면 플래티넘 5-3 도달 가능합니다.
