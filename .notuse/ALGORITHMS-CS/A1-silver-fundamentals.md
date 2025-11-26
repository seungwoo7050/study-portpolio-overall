# A1: 실버 전 구간 정리 (기본기: 골드로 가기 위한 바닥)

> **목표**: 백준 실버 1~2 문제를 안 보고 구현 가능한 수준
> **예상 시간**: 40-60시간 (주 10-15시간 기준 4-6주)
> **난이도**: 🟢 기초
> **선행 요구사항**: A0 완료 (환경 세팅, 기본 입출력)
> **문제 수**: 80-120문제 (토픽별 10-20문제)
> **완료 기준**: 실버 1~2 문제를 30분 안에 해결

---

## 목차

1. [기본 자료구조](#1-기본-자료구조)
2. [완전 탐색 & 백트래킹](#2-완전-탐색--백트래킹)
3. [그리디 기본](#3-그리디-기본)
4. [기본 그래프 + BFS/DFS](#4-기본-그래프--bfsdfs)
5. [기본 DP](#5-기본-dp)
6. [구간 합 & 누적합](#6-구간-합--누적합)
7. [종합 연습](#7-종합-연습)

---

## 1. 기본 자료구조

### 학습 목표
- 배열, 리스트, 스택, 큐, 덱의 특징과 사용법
- 정렬 알고리즘 (O(N log N))
- 이분 탐색 (Binary Search)

### 핵심 개념

#### 1.1 스택 (Stack)

**특징**: LIFO (Last In First Out)

```cpp
#include <stack>

stack<int> s;
s.push(1);
s.push(2);
s.push(3);

cout << s.top() << '\n';  // 3
s.pop();
cout << s.top() << '\n';  // 2
```

**활용**:
- 괄호 검사
- 후위 표기식 계산
- DFS 구현

**추천 문제**:
- [백준 10828번: 스택](https://www.acmicpc.net/problem/10828)
- [백준 9012번: 괄호](https://www.acmicpc.net/problem/9012)
- [백준 1874번: 스택 수열](https://www.acmicpc.net/problem/1874)

#### 1.2 큐 (Queue)

**특징**: FIFO (First In First Out)

```cpp
#include <queue>

queue<int> q;
q.push(1);
q.push(2);
q.push(3);

cout << q.front() << '\n';  // 1
q.pop();
cout << q.front() << '\n';  // 2
```

**활용**:
- BFS
- 시뮬레이션
- 레벨 순회

**추천 문제**:
- [백준 10845번: 큐](https://www.acmicpc.net/problem/10845)
- [백준 1158번: 요세푸스 문제](https://www.acmicpc.net/problem/1158)

#### 1.3 정렬 (Sorting)

```cpp
#include <algorithm>
#include <vector>

vector<int> arr = {3, 1, 4, 1, 5, 9};

// 오름차순 정렬
sort(arr.begin(), arr.end());
// {1, 1, 3, 4, 5, 9}

// 내림차순 정렬
sort(arr.begin(), arr.end(), greater<int>());
// {9, 5, 4, 3, 1, 1}

// 커스텀 비교
sort(arr.begin(), arr.end(), [](int a, int b) {
    return a % 10 < b % 10;  // 일의 자리 기준
});
```

**시간 복잡도**: O(N log N)

**추천 문제**:
- [백준 2750번: 수 정렬하기](https://www.acmicpc.net/problem/2750)
- [백준 11650번: 좌표 정렬하기](https://www.acmicpc.net/problem/11650)
- [백준 1181번: 단어 정렬](https://www.acmicpc.net/problem/1181)

#### 1.4 이분 탐색 (Binary Search)

**개념**: 정렬된 배열에서 O(log N)에 원소 찾기

```cpp
#include <algorithm>
#include <vector>

vector<int> arr = {1, 2, 3, 4, 5, 6, 7, 8, 9};

// 값 존재 여부 확인
bool found = binary_search(arr.begin(), arr.end(), 5);  // true

// 값의 위치 찾기
auto it = lower_bound(arr.begin(), arr.end(), 5);
int pos = it - arr.begin();  // 4 (인덱스)

// lower_bound: ≥ target인 첫 위치
// upper_bound: > target인 첫 위치

// 직접 구현
int binarySearch(vector<int>& arr, int target) {
    int left = 0, right = arr.size() - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (arr[mid] == target) {
            return mid;
        } else if (arr[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return -1;  // 못 찾음
}
```

**추천 문제**:
- [백준 1920번: 수 찾기](https://www.acmicpc.net/problem/1920)
- [백준 10816번: 숫자 카드 2](https://www.acmicpc.net/problem/10816)
- [백준 1654번: 랜선 자르기](https://www.acmicpc.net/problem/1654) (파라메트릭 서치)

---

## 2. 완전 탐색 & 백트래킹

### 학습 목표
- 모든 경우의 수를 탐색하는 방법
- 백트래킹으로 불필요한 탐색 제거
- 순열, 조합, 부분수열 생성

### 핵심 개념

#### 2.1 순열 (Permutation)

```cpp
#include <algorithm>
#include <vector>

vector<int> arr = {1, 2, 3};

// STL 사용
do {
    for (int x : arr) cout << x << ' ';
    cout << '\n';
} while (next_permutation(arr.begin(), arr.end()));

// 직접 구현 (백트래킹)
void permutation(vector<int>& arr, vector<bool>& used, vector<int>& current, int n) {
    if (current.size() == n) {
        for (int x : current) cout << x << ' ';
        cout << '\n';
        return;
    }

    for (int i = 0; i < n; i++) {
        if (!used[i]) {
            used[i] = true;
            current.push_back(arr[i]);
            permutation(arr, used, current, n);
            current.pop_back();
            used[i] = false;
        }
    }
}
```

#### 2.2 조합 (Combination)

```cpp
// 백트래킹으로 조합 생성
void combination(vector<int>& arr, vector<int>& current, int start, int n, int r) {
    if (current.size() == r) {
        for (int x : current) cout << x << ' ';
        cout << '\n';
        return;
    }

    for (int i = start; i < n; i++) {
        current.push_back(arr[i]);
        combination(arr, current, i + 1, n, r);
        current.pop_back();
    }
}
```

#### 2.3 부분수열 (Subsequence)

```cpp
// 비트마스크로 부분수열 생성
void generateSubsequences(vector<int>& arr) {
    int n = arr.size();

    for (int mask = 0; mask < (1 << n); mask++) {
        cout << "{ ";
        for (int i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                cout << arr[i] << ' ';
            }
        }
        cout << "}\n";
    }
}
```

**추천 문제**:
- [백준 15649번: N과 M (1)](https://www.acmicpc.net/problem/15649) - 순열
- [백준 15650번: N과 M (2)](https://www.acmicpc.net/problem/15650) - 조합
- [백준 1182번: 부분수열의 합](https://www.acmicpc.net/problem/1182)
- [백준 9663번: N-Queen](https://www.acmicpc.net/problem/9663)

---

## 3. 그리디 기본

### 학습 목표
- 그리디 알고리즘의 정의와 증명 방법
- 정렬 후 선택 패턴
- 간단한 교환 논증

### 핵심 개념

**그리디**: 매 순간 최선의 선택을 하여 전체 최적해를 구하는 방법

**증명 방법**:
1. **교환 논증**: "다른 선택을 하면 더 나쁜 결과"를 보임
2. **귀류법**: 반례가 없음을 증명

#### 예제: 동전 거스름돈

```cpp
// 동전 종류: {500, 100, 50, 10, 1}
// 거스름돈: 1260원

int coins[] = {500, 100, 50, 10, 1};
int target = 1260;
int count = 0;

for (int coin : coins) {
    count += target / coin;
    target %= coin;
}

cout << count << '\n';  // 6 (500*2 + 100*2 + 50*1 + 10*1)
```

#### 예제: 회의실 배정

```cpp
struct Meeting {
    int start, end;
};

bool cmp(const Meeting& a, const Meeting& b) {
    if (a.end == b.end) return a.start < b.start;
    return a.end < b.end;  // 끝나는 시간 우선
}

int maxMeetings(vector<Meeting>& meetings) {
    sort(meetings.begin(), meetings.end(), cmp);

    int count = 0;
    int lastEnd = 0;

    for (const Meeting& m : meetings) {
        if (m.start >= lastEnd) {
            count++;
            lastEnd = m.end;
        }
    }

    return count;
}
```

**추천 문제**:
- [백준 11047번: 동전 0](https://www.acmicpc.net/problem/11047)
- [백준 1931번: 회의실 배정](https://www.acmicpc.net/problem/1931)
- [백준 11399번: ATM](https://www.acmicpc.net/problem/11399)

---

## 4. 기본 그래프 + BFS/DFS

### 학습 목표
- 그래프 표현 방법 (인접 리스트, 인접 행렬)
- BFS/DFS 구현 및 응용
- 연결 요소, 최단 거리

### 핵심 개념

#### 4.1 그래프 표현

```cpp
// 인접 리스트 (추천)
vector<vector<int>> adj(n + 1);

for (int i = 0; i < m; i++) {
    int u, v;
    cin >> u >> v;
    adj[u].push_back(v);
    adj[v].push_back(u);  // 무방향 그래프
}

// 인접 행렬 (N ≤ 1000일 때만)
bool adj[1001][1001];

for (int i = 0; i < m; i++) {
    int u, v;
    cin >> u >> v;
    adj[u][v] = adj[v][u] = true;
}
```

#### 4.2 BFS (너비 우선 탐색)

```cpp
#include <queue>

vector<int> bfs(int start, const vector<vector<int>>& adj) {
    int n = adj.size() - 1;
    vector<int> dist(n + 1, -1);
    queue<int> q;

    dist[start] = 0;
    q.push(start);

    while (!q.empty()) {
        int cur = q.front();
        q.pop();

        for (int next : adj[cur]) {
            if (dist[next] == -1) {
                dist[next] = dist[cur] + 1;
                q.push(next);
            }
        }
    }

    return dist;
}
```

**활용**:
- 최단 거리 (가중치 없는 그래프)
- 레벨 순회
- Flood Fill

#### 4.3 DFS (깊이 우선 탐색)

```cpp
void dfs(int cur, vector<bool>& visited, const vector<vector<int>>& adj) {
    visited[cur] = true;

    for (int next : adj[cur]) {
        if (!visited[next]) {
            dfs(next, visited, adj);
        }
    }
}
```

**활용**:
- 연결 요소 개수
- 사이클 탐지
- 위상 정렬

**추천 문제**:
- [백준 1260번: DFS와 BFS](https://www.acmicpc.net/problem/1260)
- [백준 2606번: 바이러스](https://www.acmicpc.net/problem/2606)
- [백준 2667번: 단지번호붙이기](https://www.acmicpc.net/problem/2667)
- [백준 7576번: 토마토](https://www.acmicpc.net/problem/7576) (다중 시작점 BFS)

---

## 5. 기본 DP

### 학습 목표
- DP의 정의와 메모이제이션
- 점화식 세우기
- 1D/2D DP 기본 패턴

### 핵심 개념

**DP (Dynamic Programming)**:
- **중복 부분 문제**: 같은 문제를 여러 번 풀게 됨
- **최적 부분 구조**: 작은 문제의 최적해로 큰 문제 해결

#### 5.1 1D DP

**피보나치**:
```cpp
int fib(int n) {
    vector<int> dp(n + 1);
    dp[1] = dp[2] = 1;

    for (int i = 3; i <= n; i++) {
        dp[i] = dp[i-1] + dp[i-2];
    }

    return dp[n];
}
```

**계단 오르기**:
```cpp
// 1칸 또는 2칸씩 오를 수 있음
int climbStairs(int n) {
    vector<int> dp(n + 1);
    dp[0] = 1;
    dp[1] = 1;

    for (int i = 2; i <= n; i++) {
        dp[i] = dp[i-1] + dp[i-2];
    }

    return dp[n];
}
```

#### 5.2 2D DP

**배낭 문제 (Knapsack)**:
```cpp
// dp[i][w] = i번째 물건까지 고려, 무게 w일 때 최대 가치
int knapsack(vector<int>& weights, vector<int>& values, int W) {
    int n = weights.size();
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));

    for (int i = 1; i <= n; i++) {
        for (int w = 1; w <= W; w++) {
            // i번째 물건을 넣지 않음
            dp[i][w] = dp[i-1][w];

            // i번째 물건을 넣음 (가능하면)
            if (w >= weights[i-1]) {
                dp[i][w] = max(dp[i][w], dp[i-1][w - weights[i-1]] + values[i-1]);
            }
        }
    }

    return dp[n][W];
}
```

**LCS (Longest Common Subsequence)**:
```cpp
int lcs(string& a, string& b) {
    int n = a.size(), m = b.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));

    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= m; j++) {
            if (a[i-1] == b[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }

    return dp[n][m];
}
```

**추천 문제**:
- [백준 1463번: 1로 만들기](https://www.acmicpc.net/problem/1463)
- [백준 2579번: 계단 오르기](https://www.acmicpc.net/problem/2579)
- [백준 1149번: RGB거리](https://www.acmicpc.net/problem/1149)
- [백준 9095번: 1, 2, 3 더하기](https://www.acmicpc.net/problem/9095)
- [백준 11053번: 가장 긴 증가하는 부분 수열](https://www.acmicpc.net/problem/11053)

---

## 6. 구간 합 & 누적합

### 학습 목표
- 1D/2D 누적합 계산
- 구간 쿼리 O(1) 처리

### 핵심 개념

#### 6.1 1D 누적합

```cpp
vector<int> arr = {1, 2, 3, 4, 5};
vector<int> prefix(arr.size() + 1, 0);

// prefix[i] = arr[0] + arr[1] + ... + arr[i-1]
for (int i = 0; i < arr.size(); i++) {
    prefix[i+1] = prefix[i] + arr[i];
}

// 구간 [L, R] 합 (0-indexed)
auto rangeSum = [&](int L, int R) {
    return prefix[R+1] - prefix[L];
};

cout << rangeSum(1, 3) << '\n';  // 2+3+4 = 9
```

#### 6.2 2D 누적합

```cpp
int n = 3, m = 4;
vector<vector<int>> arr = {
    {1, 2, 3, 4},
    {5, 6, 7, 8},
    {9, 10, 11, 12}
};

vector<vector<int>> prefix(n + 1, vector<int>(m + 1, 0));

// prefix[i][j] = 왼쪽 위부터 (i-1, j-1)까지 합
for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= m; j++) {
        prefix[i][j] = arr[i-1][j-1]
                     + prefix[i-1][j]
                     + prefix[i][j-1]
                     - prefix[i-1][j-1];
    }
}

// 구간 [(r1, c1), (r2, c2)] 합 (1-indexed)
auto rangeSum2D = [&](int r1, int c1, int r2, int c2) {
    return prefix[r2][c2]
         - prefix[r1-1][c2]
         - prefix[r2][c1-1]
         + prefix[r1-1][c1-1];
};
```

**추천 문제**:
- [백준 11659번: 구간 합 구하기 4](https://www.acmicpc.net/problem/11659)
- [백준 11660번: 구간 합 구하기 5](https://www.acmicpc.net/problem/11660) (2D)

---

## 7. 종합 연습

### 실버 레벨 종합 문제 리스트

#### 실버 5
- [백준 1978번: 소수 찾기](https://www.acmicpc.net/problem/1978)
- [백준 2751번: 수 정렬하기 2](https://www.acmicpc.net/problem/2751)
- [백준 11650번: 좌표 정렬하기](https://www.acmicpc.net/problem/11650)

#### 실버 4
- [백준 10773번: 제로](https://www.acmicpc.net/problem/10773) (스택)
- [백준 1920번: 수 찾기](https://www.acmicpc.net/problem/1920) (이분 탐색)
- [백준 1018번: 체스판 다시 칠하기](https://www.acmicpc.net/problem/1018) (완전 탐색)

#### 실버 3
- [백준 15649번: N과 M (1)](https://www.acmicpc.net/problem/15649) (백트래킹)
- [백준 1929번: 소수 구하기](https://www.acmicpc.net/problem/1929) (에라토스테네스의 체)
- [백준 11047번: 동전 0](https://www.acmicpc.net/problem/11047) (그리디)

#### 실버 2
- [백준 1260번: DFS와 BFS](https://www.acmicpc.net/problem/1260)
- [백준 1927번: 최소 힙](https://www.acmicpc.net/problem/1927) (우선순위 큐)
- [백준 11725번: 트리의 부모 찾기](https://www.acmicpc.net/problem/11725)

#### 실버 1
- [백준 1074번: Z](https://www.acmicpc.net/problem/1074) (분할 정복)
- [백준 1932번: 정수 삼각형](https://www.acmicpc.net/problem/1932) (DP)
- [백준 2178번: 미로 탐색](https://www.acmicpc.net/problem/2178) (BFS)
- [백준 1991번: 트리 순회](https://www.acmicpc.net/problem/1991)

---

## 학습 전략

### 주차별 목표

| 주차 | 토픽 | 문제 수 | 목표 |
|-----|------|---------|------|
| 1주 | 자료구조 | 15-20 | 스택/큐/정렬/이분탐색 |
| 2주 | 완전 탐색 | 15-20 | 순열/조합/백트래킹 |
| 3주 | 그리디 + 그래프 | 15-20 | 그리디 증명, BFS/DFS |
| 4주 | 기본 DP | 20-25 | 1D/2D DP 점화식 |
| 5-6주 | 종합 복습 | 20-30 | 실버 1~2 집중 |

### 문제 풀이 루틴

```
1. 문제 분류 숨기기 (solved.ac)
2. 10분 고민 → 접근 방법 못 찾으면 힌트 확인
3. 30분 구현 → 안 되면 다른 사람 풀이 참고
4. 틀린 문제는 3일 후 다시 풀기
```

---

## 다음 단계

✅ **A1 완료 후**:
- [A2: 골드 하위~중위](./A2-gold-mid-tier.md)
- 골드 문제 120-180개 목표

**체크리스트**:
- [ ] 실버 1~2 문제를 30분 안에 해결 가능
- [ ] 각 토픽별 핵심 문제 10개 이상 해결
- [ ] BFS/DFS 템플릿 암기
- [ ] 기본 DP 점화식 세우기 가능
- [ ] 총 80-120문제 해결 완료

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: [A2: 골드 하위~중위](./A2-gold-mid-tier.md)

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
