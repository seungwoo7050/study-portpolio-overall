# A2: 골드 하위~중위 (골4~골2 메인 영역)

> **목표**: 골드 하위(골4~3) 대부분 해결, 골드 1~2 접근 가능
> **예상 시간**: 60-80시간
> **난이도**: 🟡 중급
> **선행 요구사항**: A1 완료 (실버 전 구간)
> **문제 수**: 120-180문제
> **완료 기준**: 골드 3 문제를 1시간 안에 해결

---

## 목차

1. [그래프 심화](#1-그래프-심화)
2. [Union-Find & MST](#2-union-find--mst)
3. [고급 BFS/DFS 패턴](#3-고급-bfsdfs-패턴)
4. [DP 심화](#4-dp-심화)
5. [Two Pointers & 슬라이딩 윈도우](#5-two-pointers--슬라이딩-윈도우)
6. [구간 자료구조](#6-구간-자료구조)

---

## 1. 그래프 심화

### 1.1 Dijkstra (다익스트라)

**개념**: 가중치 그래프에서 최단 거리 (음수 간선 불가)
**시간 복잡도**: O((V + E) log V)

```cpp
#include <vector>
#include <queue>
using namespace std;

const int INF = 1e9;

vector<int> dijkstra(int start, const vector<vector<pair<int, int>>>& adj) {
    int n = adj.size() - 1;
    vector<int> dist(n + 1, INF);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        auto [d, cur] = pq.top();
        pq.pop();

        if (d > dist[cur]) continue;

        for (auto [next, weight] : adj[cur]) {
            if (dist[cur] + weight < dist[next]) {
                dist[next] = dist[cur] + weight;
                pq.push({dist[next], next});
            }
        }
    }

    return dist;
}
```

**추천 문제**:
- [백준 1753번: 최단경로](https://www.acmicpc.net/problem/1753)
- [백준 1916번: 최소비용 구하기](https://www.acmicpc.net/problem/1916)

### 1.2 위상 정렬

**개념**: DAG(Directed Acyclic Graph)의 선형 순서
**활용**: 선수과목, 작업 순서

```cpp
vector<int> topologicalSort(int n, const vector<vector<int>>& adj) {
    vector<int> indegree(n + 1, 0);
    queue<int> q;
    vector<int> result;

    // 진입 차수 계산
    for (int u = 1; u <= n; u++) {
        for (int v : adj[u]) {
            indegree[v]++;
        }
    }

    // 진입 차수 0인 노드 큐에 삽입
    for (int i = 1; i <= n; i++) {
        if (indegree[i] == 0) {
            q.push(i);
        }
    }

    while (!q.empty()) {
        int cur = q.front();
        q.pop();
        result.push_back(cur);

        for (int next : adj[cur]) {
            indegree[next]--;
            if (indegree[next] == 0) {
                q.push(next);
            }
        }
    }

    return result;
}
```

**추천 문제**:
- [백준 2252번: 줄 세우기](https://www.acmicpc.net/problem/2252)
- [백준 1005번: ACM Craft](https://www.acmicpc.net/problem/1005)

---

## 2. Union-Find & MST

### 2.1 Union-Find (Disjoint Set)

```cpp
class UnionFind {
    vector<int> parent, rank;

public:
    UnionFind(int n) : parent(n + 1), rank(n + 1, 1) {
        for (int i = 0; i <= n; i++) parent[i] = i;
    }

    int find(int x) {
        if (parent[x] != x) {
            parent[x] = find(parent[x]);  // 경로 압축
        }
        return parent[x];
    }

    bool unite(int x, int y) {
        x = find(x);
        y = find(y);

        if (x == y) return false;

        // Union by rank
        if (rank[x] < rank[y]) swap(x, y);
        parent[y] = x;
        if (rank[x] == rank[y]) rank[x]++;

        return true;
    }
};
```

### 2.2 Kruskal MST

```cpp
struct Edge {
    int u, v, weight;
    bool operator<(const Edge& other) const {
        return weight < other.weight;
    }
};

int kruskal(int n, vector<Edge>& edges) {
    sort(edges.begin(), edges.end());
    UnionFind uf(n);

    int mstWeight = 0;
    int edgeCount = 0;

    for (const Edge& e : edges) {
        if (uf.unite(e.u, e.v)) {
            mstWeight += e.weight;
            edgeCount++;
            if (edgeCount == n - 1) break;
        }
    }

    return mstWeight;
}
```

**추천 문제**:
- [백준 1717번: 집합의 표현](https://www.acmicpc.net/problem/1717)
- [백준 1197번: 최소 스패닝 트리](https://www.acmicpc.net/problem/1197)

---

## 3. 고급 BFS/DFS 패턴

### 3.1 다중 시작점 BFS

```cpp
// 토마토 문제 패턴
void multiSourceBFS(vector<vector<int>>& grid) {
    int n = grid.size(), m = grid[0].size();
    queue<pair<int, int>> q;

    // 모든 시작점 큐에 넣기
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < m; j++) {
            if (grid[i][j] == 1) {
                q.push({i, j});
            }
        }
    }

    int dx[] = {0, 0, 1, -1};
    int dy[] = {1, -1, 0, 0};

    while (!q.empty()) {
        auto [x, y] = q.front();
        q.pop();

        for (int d = 0; d < 4; d++) {
            int nx = x + dx[d];
            int ny = y + dy[d];

            if (nx >= 0 && nx < n && ny >= 0 && ny < m && grid[nx][ny] == 0) {
                grid[nx][ny] = grid[x][y] + 1;
                q.push({nx, ny});
            }
        }
    }
}
```

### 3.2 0-1 BFS

**개념**: 가중치가 0 또는 1인 그래프의 최단 거리
**시간 복잡도**: O(V + E)

```cpp
vector<int> zeroOneBFS(int start, const vector<vector<pair<int, int>>>& adj) {
    int n = adj.size() - 1;
    vector<int> dist(n + 1, INF);
    deque<int> dq;

    dist[start] = 0;
    dq.push_back(start);

    while (!dq.empty()) {
        int cur = dq.front();
        dq.pop_front();

        for (auto [next, weight] : adj[cur]) {
            if (dist[cur] + weight < dist[next]) {
                dist[next] = dist[cur] + weight;

                if (weight == 0) {
                    dq.push_front(next);  // 가중치 0은 앞으로
                } else {
                    dq.push_back(next);   // 가중치 1은 뒤로
                }
            }
        }
    }

    return dist;
}
```

**추천 문제**:
- [백준 7576번: 토마토](https://www.acmicpc.net/problem/7576)
- [백준 13549번: 숨바꼭질 3](https://www.acmicpc.net/problem/13549) (0-1 BFS)

---

## 4. DP 심화

### 4.1 LIS (Longest Increasing Subsequence) O(N log N)

```cpp
#include <algorithm>

int lis(vector<int>& arr) {
    vector<int> dp;

    for (int x : arr) {
        auto it = lower_bound(dp.begin(), dp.end(), x);
        if (it == dp.end()) {
            dp.push_back(x);
        } else {
            *it = x;
        }
    }

    return dp.size();
}
```

### 4.2 비트마스크 DP

```cpp
// 외판원 순회 (TSP)
int tsp(int cur, int visited, const vector<vector<int>>& dist, vector<vector<int>>& dp) {
    int n = dist.size();

    if (visited == (1 << n) - 1) {
        return dist[cur][0] == 0 ? INF : dist[cur][0];
    }

    if (dp[cur][visited] != -1) {
        return dp[cur][visited];
    }

    int ret = INF;
    for (int next = 0; next < n; next++) {
        if (visited & (1 << next)) continue;
        if (dist[cur][next] == 0) continue;

        ret = min(ret, tsp(next, visited | (1 << next), dist, dp) + dist[cur][next]);
    }

    return dp[cur][visited] = ret;
}
```

**추천 문제**:
- [백준 12015번: 가장 긴 증가하는 부분 수열 2](https://www.acmicpc.net/problem/12015)
- [백준 2098번: 외판원 순회](https://www.acmicpc.net/problem/2098)

---

## 5. Two Pointers & 슬라이딩 윈도우

### 5.1 Two Pointers

```cpp
// 두 용액 문제
pair<int, int> twoPointers(vector<int>& arr, int target) {
    sort(arr.begin(), arr.end());

    int left = 0, right = arr.size() - 1;
    int minDiff = INF;
    pair<int, int> result;

    while (left < right) {
        int sum = arr[left] + arr[right];

        if (abs(sum - target) < minDiff) {
            minDiff = abs(sum - target);
            result = {arr[left], arr[right]};
        }

        if (sum < target) {
            left++;
        } else {
            right--;
        }
    }

    return result;
}
```

**추천 문제**:
- [백준 2003번: 수들의 합 2](https://www.acmicpc.net/problem/2003)
- [백준 2470번: 두 용액](https://www.acmicpc.net/problem/2470)

---

## 6. 구간 자료구조

### 6.1 세그먼트 트리

```cpp
class SegmentTree {
    vector<int> tree;
    int n;

    void build(vector<int>& arr, int node, int start, int end) {
        if (start == end) {
            tree[node] = arr[start];
            return;
        }

        int mid = (start + end) / 2;
        build(arr, node * 2, start, mid);
        build(arr, node * 2 + 1, mid + 1, end);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    void update(int node, int start, int end, int idx, int val) {
        if (start == end) {
            tree[node] = val;
            return;
        }

        int mid = (start + end) / 2;
        if (idx <= mid) {
            update(node * 2, start, mid, idx, val);
        } else {
            update(node * 2 + 1, mid + 1, end, idx, val);
        }
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

    int query(int node, int start, int end, int left, int right) {
        if (right < start || end < left) return 0;
        if (left <= start && end <= right) return tree[node];

        int mid = (start + end) / 2;
        return query(node * 2, start, mid, left, right) +
               query(node * 2 + 1, mid + 1, end, left, right);
    }

public:
    SegmentTree(vector<int>& arr) : n(arr.size()) {
        tree.resize(4 * n);
        build(arr, 1, 0, n - 1);
    }

    void update(int idx, int val) {
        update(1, 0, n - 1, idx, val);
    }

    int query(int left, int right) {
        return query(1, 0, n - 1, left, right);
    }
};
```

**추천 문제**:
- [백준 2042번: 구간 합 구하기](https://www.acmicpc.net/problem/2042)
- [백준 11505번: 구간 곱 구하기](https://www.acmicpc.net/problem/11505)

---

## 학습 전략

### 주차별 목표 (8-12주)

| 주차 | 토픽 | 문제 수 |
|-----|------|---------|
| 1-2 | 그래프 심화 | 20-25 |
| 3-4 | Union-Find, MST | 15-20 |
| 5-6 | 고급 BFS/DFS | 20-25 |
| 7-8 | DP 심화 | 25-30 |
| 9-10 | Two Pointers | 15-20 |
| 11-12 | 세그먼트 트리 | 20-25 |

---

## 다음 단계

✅ **A2 완료 후**:
- [A3: 골드 상위 선택 심화](./A3-gold-advanced.md)
- [A4: 유지 루틴](./A4-maintenance-routine.md)

**체크리스트**:
- [ ] 골드 4~3 문제를 1시간 안에 해결 가능
- [ ] Dijkstra, Union-Find 템플릿 암기
- [ ] 세그먼트 트리 구현 가능
- [ ] 총 120-180문제 해결 완료

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
