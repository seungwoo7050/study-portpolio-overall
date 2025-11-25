# A3: 골드 상위 선택 심화 (골드 1~2 + 플래티넘 입문)

> **목표**: 골드 1~2 접근 가능, 플래티넘 문제 맛보기
> **예상 시간**: 40-60시간
> **난이도**: 🟠 고급
> **선행 요구사항**: A2 완료 (골드 4~3 안정적 해결)
> **문제 수**: 40-60문제 (토픽별 접근, 완벽 이해보다 경험 중심)
> **완료 기준**: 골드 1 문제를 보고 접근 방법 파악 가능

---

## ⚠️ 중요: 이 단계의 학습 철학

**"모든 문제를 완벽히 이해"가 아닌 "이런 게 있다는 걸 경험"**

이 구간은:
- ✅ 한 번 구현해보고 감 잡기
- ✅ 필요할 때 다시 찾아볼 수 있게 기억
- ❌ 모든 엣지 케이스 마스터 (시간 낭비)
- ❌ 복잡한 증명 이해 (면접에 안 나옴)

---

## 목차

1. [트리 알고리즘 (LCA + Tree DP)](#1-트리-알고리즘)
2. [강한 연결 요소 (SCC)](#2-강한-연결-요소-scc)
3. [2-SAT](#3-2-sat)
4. [네트워크 플로우 기초](#4-네트워크-플로우-기초)
5. [기타 고급 주제](#5-기타-고급-주제)

---

## 1. 트리 알고리즘

### 1.1 LCA (Lowest Common Ancestor)

**문제**: 트리에서 두 노드의 최소 공통 조상 찾기

**접근 1: Binary Lifting (O(log N) 쿼리)**

```cpp
const int MAX_N = 100001;
const int LOG = 17;  // log2(100000) + 1

vector<int> adj[MAX_N];
int parent[MAX_N][LOG];  // parent[v][k] = v의 2^k번째 조상
int depth[MAX_N];

void dfs(int cur, int par, int d) {
    parent[cur][0] = par;
    depth[cur] = d;

    for (int next : adj[cur]) {
        if (next != par) {
            dfs(next, cur, d + 1);
        }
    }
}

void buildSparseTable(int n) {
    for (int k = 1; k < LOG; k++) {
        for (int v = 1; v <= n; v++) {
            if (parent[v][k-1] != -1) {
                parent[v][k] = parent[parent[v][k-1]][k-1];
            }
        }
    }
}

int lca(int u, int v) {
    // u를 더 깊은 노드로
    if (depth[u] < depth[v]) swap(u, v);

    // u를 v와 같은 깊이로
    int diff = depth[u] - depth[v];
    for (int k = 0; k < LOG; k++) {
        if ((diff >> k) & 1) {
            u = parent[u][k];
        }
    }

    if (u == v) return u;

    // 동시에 올라가기
    for (int k = LOG - 1; k >= 0; k--) {
        if (parent[u][k] != parent[v][k]) {
            u = parent[u][k];
            v = parent[v][k];
        }
    }

    return parent[u][0];
}

int main() {
    int n;
    cin >> n;

    // 트리 입력
    for (int i = 0; i < n - 1; i++) {
        int u, v;
        cin >> u >> v;
        adj[u].push_back(v);
        adj[v].push_back(u);
    }

    // 초기화
    memset(parent, -1, sizeof(parent));
    dfs(1, -1, 0);
    buildSparseTable(n);

    // 쿼리 처리
    int q;
    cin >> q;
    while (q--) {
        int u, v;
        cin >> u >> v;
        cout << lca(u, v) << '\n';
    }

    return 0;
}
```

**핵심 아이디어**:
- `parent[v][k]`: v의 2^k번째 조상을 미리 계산
- 쿼리 시 비트 연산으로 빠르게 점프

**추천 문제**:
- [백준 11437번: LCA](https://www.acmicpc.net/problem/11437)
- [백준 11438번: LCA 2](https://www.acmicpc.net/problem/11438) (Binary Lifting)

---

### 1.2 Tree DP

**개념**: 트리 구조에서 DP, 보통 DFS로 구현

**예제 1: 트리의 지름**

```cpp
int maxDist = 0;

// 각 노드에서 아래로 내려가는 최대 거리 반환
int dfs(int cur, int parent, const vector<vector<pair<int, int>>>& adj) {
    int max1 = 0, max2 = 0;

    for (auto [next, weight] : adj[cur]) {
        if (next == parent) continue;

        int dist = dfs(next, cur, adj) + weight;

        if (dist > max1) {
            max2 = max1;
            max1 = dist;
        } else if (dist > max2) {
            max2 = dist;
        }
    }

    // cur를 거치는 경로의 최대 길이
    maxDist = max(maxDist, max1 + max2);

    return max1;
}
```

**예제 2: 독립 집합 (Independent Set)**

```cpp
// dp[v][0] = v를 선택 안 함
// dp[v][1] = v를 선택함
int dp[MAX_N][2];

void dfs(int cur, int parent, const vector<vector<int>>& adj) {
    dp[cur][0] = 0;
    dp[cur][1] = 1;  // 노드 선택 시 가중치 (여기서는 1)

    for (int child : adj[cur]) {
        if (child == parent) continue;

        dfs(child, cur, adj);

        // cur를 선택 안 하면 자식은 선택/미선택 모두 가능
        dp[cur][0] += max(dp[child][0], dp[child][1]);

        // cur를 선택하면 자식은 선택 불가
        dp[cur][1] += dp[child][0];
    }
}
```

**추천 문제**:
- [백준 1167번: 트리의 지름](https://www.acmicpc.net/problem/1167)
- [백준 2213번: 트리의 독립집합](https://www.acmicpc.net/problem/2213)

---

## 2. 강한 연결 요소 (SCC)

**개념**: 방향 그래프에서 서로 도달 가능한 정점들의 집합

**Kosaraju's Algorithm**:

```cpp
vector<int> adj[MAX_N];
vector<int> rev[MAX_N];  // 역방향 그래프
vector<int> order;       // 종료 순서
vector<int> sccId;       // 각 노드의 SCC 번호
bool visited[MAX_N];

void dfs1(int cur) {
    visited[cur] = true;
    for (int next : adj[cur]) {
        if (!visited[next]) {
            dfs1(next);
        }
    }
    order.push_back(cur);  // 종료 시 추가
}

void dfs2(int cur, int id) {
    sccId[cur] = id;
    for (int next : rev[cur]) {
        if (sccId[next] == -1) {
            dfs2(next, id);
        }
    }
}

vector<vector<int>> findSCC(int n) {
    // 1단계: 종료 순서 구하기
    for (int i = 1; i <= n; i++) {
        if (!visited[i]) {
            dfs1(i);
        }
    }

    // 2단계: 역순으로 DFS (역방향 그래프)
    sccId.assign(n + 1, -1);
    int id = 0;
    for (int i = n - 1; i >= 0; i--) {
        int cur = order[i];
        if (sccId[cur] == -1) {
            dfs2(cur, id++);
        }
    }

    // 3단계: SCC별로 노드 그룹화
    vector<vector<int>> sccs(id);
    for (int i = 1; i <= n; i++) {
        sccs[sccId[i]].push_back(i);
    }

    return sccs;
}
```

**핵심 아이디어**:
1. 정방향 DFS로 종료 순서 기록
2. 역방향 그래프에서 역순으로 DFS
3. 각 DFS 트리가 하나의 SCC

**Tarjan's Algorithm (한 번의 DFS)**:

```cpp
int id[MAX_N], low[MAX_N];
bool onStack[MAX_N];
stack<int> st;
int idCounter = 0;
int sccCounter = 0;

void tarjan(int cur, const vector<vector<int>>& adj) {
    id[cur] = low[cur] = idCounter++;
    st.push(cur);
    onStack[cur] = true;

    for (int next : adj[cur]) {
        if (id[next] == -1) {
            tarjan(next, adj);
            low[cur] = min(low[cur], low[next]);
        } else if (onStack[next]) {
            low[cur] = min(low[cur], id[next]);
        }
    }

    // SCC의 루트인 경우
    if (id[cur] == low[cur]) {
        while (true) {
            int node = st.top();
            st.pop();
            onStack[node] = false;
            sccId[node] = sccCounter;
            if (node == cur) break;
        }
        sccCounter++;
    }
}
```

**추천 문제**:
- [백준 2150번: Strongly Connected Component](https://www.acmicpc.net/problem/2150)
- [백준 4196번: 도미노](https://www.acmicpc.net/problem/4196)

---

## 3. 2-SAT

**문제**: Boolean 변수들의 논리식을 만족시키는 값 찾기

**예제**: (x1 ∨ x2) ∧ (¬x1 ∨ x3) ∧ (¬x2 ∨ ¬x3)

**핵심 아이디어**: 그래프로 변환 후 SCC

```cpp
// (a ∨ b) 절을 간선으로 변환
// ¬a → b, ¬b → a

class TwoSAT {
    int n;
    vector<vector<int>> adj, rev;
    vector<int> sccId;

public:
    TwoSAT(int n) : n(n), adj(2*n), rev(2*n), sccId(2*n, -1) {}

    // 변수 x는 0-indexed
    // true: x, false: NOT x
    int node(int x, bool val) {
        return val ? x : x + n;
    }

    // (a ∨ b) 절 추가
    void addClause(int a, bool aVal, int b, bool bVal) {
        // ¬a → b
        adj[node(a, !aVal)].push_back(node(b, bVal));
        rev[node(b, bVal)].push_back(node(a, !aVal));

        // ¬b → a
        adj[node(b, !bVal)].push_back(node(a, aVal));
        rev[node(a, aVal)].push_back(node(b, !bVal));
    }

    bool solve() {
        // SCC 구하기 (Kosaraju)
        // ... (위의 SCC 코드 사용)

        // 각 변수 x와 NOT x가 같은 SCC면 불가능
        for (int i = 0; i < n; i++) {
            if (sccId[i] == sccId[i + n]) {
                return false;
            }
        }
        return true;
    }

    vector<bool> getAssignment() {
        vector<bool> result(n);
        for (int i = 0; i < n; i++) {
            // SCC 번호가 작을수록 나중에 방문 (역위상 정렬)
            // 나중에 방문 = true
            result[i] = (sccId[i] > sccId[i + n]);
        }
        return result;
    }
};
```

**추천 문제**:
- [백준 11280번: 2-SAT - 3](https://www.acmicpc.net/problem/11280)
- [백준 11281번: 2-SAT - 4](https://www.acmicpc.net/problem/11281)

---

## 4. 네트워크 플로우 기초

### 4.1 최대 유량 (Maximum Flow)

**Ford-Fulkerson Algorithm (DFS 기반)**:

```cpp
const int INF = 1e9;

class MaxFlow {
    struct Edge {
        int to, capacity, rev;  // rev: 역방향 간선의 인덱스
    };

    vector<vector<Edge>> graph;
    vector<bool> visited;
    int n;

    int dfs(int cur, int sink, int flow) {
        if (cur == sink) return flow;

        visited[cur] = true;

        for (Edge& e : graph[cur]) {
            if (!visited[e.to] && e.capacity > 0) {
                int pushed = dfs(e.to, sink, min(flow, e.capacity));

                if (pushed > 0) {
                    e.capacity -= pushed;
                    graph[e.to][e.rev].capacity += pushed;
                    return pushed;
                }
            }
        }

        return 0;
    }

public:
    MaxFlow(int n) : n(n), graph(n), visited(n) {}

    void addEdge(int from, int to, int capacity) {
        graph[from].push_back({to, capacity, (int)graph[to].size()});
        graph[to].push_back({from, 0, (int)graph[from].size() - 1});  // 역방향 간선
    }

    int maxFlow(int source, int sink) {
        int totalFlow = 0;

        while (true) {
            fill(visited.begin(), visited.end(), false);
            int pushed = dfs(source, sink, INF);

            if (pushed == 0) break;
            totalFlow += pushed;
        }

        return totalFlow;
    }
};
```

**시간 복잡도**: O(V × E^2) (최악의 경우)

### 4.2 이분 매칭 (Bipartite Matching)

**개념**: 이분 그래프에서 최대 매칭 = 최대 유량

```cpp
// 왼쪽 그룹: 0 ~ n-1
// 오른쪽 그룹: n ~ n+m-1
// source: n+m, sink: n+m+1

MaxFlow flow(n + m + 2);

// source → 왼쪽 그룹 (용량 1)
for (int i = 0; i < n; i++) {
    flow.addEdge(n + m, i, 1);
}

// 왼쪽 → 오른쪽 (용량 1)
for (간선 (u, v)) {
    flow.addEdge(u, v, 1);
}

// 오른쪽 그룹 → sink (용량 1)
for (int i = n; i < n + m; i++) {
    flow.addEdge(i, n + m + 1, 1);
}

int maxMatching = flow.maxFlow(n + m, n + m + 1);
```

**추천 문제**:
- [백준 6086번: 최대 유량](https://www.acmicpc.net/problem/6086)
- [백준 11375번: 열혈강호](https://www.acmicpc.net/problem/11375) (이분 매칭)

---

## 5. 기타 고급 주제

### 5.1 Trie (문자열 검색 트리)

```cpp
struct TrieNode {
    unordered_map<char, TrieNode*> children;
    bool isEnd = false;
};

class Trie {
    TrieNode* root;

public:
    Trie() : root(new TrieNode()) {}

    void insert(const string& word) {
        TrieNode* cur = root;
        for (char c : word) {
            if (!cur->children[c]) {
                cur->children[c] = new TrieNode();
            }
            cur = cur->children[c];
        }
        cur->isEnd = true;
    }

    bool search(const string& word) {
        TrieNode* cur = root;
        for (char c : word) {
            if (!cur->children[c]) return false;
            cur = cur->children[c];
        }
        return cur->isEnd;
    }
};
```

**사용 예**: 자동완성, 사전, 문자열 집합 검색

**추천 문제**:
- [백준 5052번: 전화번호 목록](https://www.acmicpc.net/problem/5052)
- [백준 14425번: 문자열 집합](https://www.acmicpc.net/problem/14425)

---

### 5.2 Lazy Propagation (지연 전파)

**개념**: 세그먼트 트리에서 구간 업데이트를 O(log N)에

```cpp
class LazySegTree {
    vector<long long> tree, lazy;
    int n;

    void propagate(int node, int start, int end) {
        if (lazy[node] != 0) {
            tree[node] += (end - start + 1) * lazy[node];

            if (start != end) {
                lazy[node * 2] += lazy[node];
                lazy[node * 2 + 1] += lazy[node];
            }

            lazy[node] = 0;
        }
    }

    void updateRange(int node, int start, int end, int left, int right, long long val) {
        propagate(node, start, end);

        if (right < start || end < left) return;

        if (left <= start && end <= right) {
            lazy[node] += val;
            propagate(node, start, end);
            return;
        }

        int mid = (start + end) / 2;
        updateRange(node * 2, start, mid, left, right, val);
        updateRange(node * 2 + 1, mid + 1, end, left, right, val);

        propagate(node * 2, start, mid);
        propagate(node * 2 + 1, mid + 1, end);
        tree[node] = tree[node * 2] + tree[node * 2 + 1];
    }

public:
    LazySegTree(int n) : n(n), tree(4 * n), lazy(4 * n) {}

    void update(int left, int right, long long val) {
        updateRange(1, 0, n - 1, left, right, val);
    }
};
```

**추천 문제**:
- [백준 10999번: 구간 합 구하기 2](https://www.acmicpc.net/problem/10999)

---

## 학습 전략

### 토픽별 학습 시간

| 토픽 | 문제 수 | 시간 |
|-----|---------|------|
| LCA | 3-5 | 8-10시간 |
| Tree DP | 3-5 | 8-10시간 |
| SCC | 3-5 | 8-10시간 |
| 2-SAT | 2-3 | 5-7시간 |
| Network Flow | 3-5 | 10-15시간 |
| 기타 (Trie, Lazy) | 3-5 | 8-10시간 |

### 접근 방법

```
1. 이론 읽기 (30분)
2. 템플릿 구현 (1시간)
3. 기본 문제 1개 (1-2시간)
4. 응용 문제 1-2개 (각 2-3시간)
5. 복습 (나중에)
```

**중요**:
- ❌ 한 문제에 5시간 이상 투자 금지
- ✅ 2시간 안 풀리면 풀이 참고
- ✅ 코드 이해 후 다시 작성 (암기 아님)

---

## 면접 대응

### 자주 나오는 질문

**1. LCA를 어떻게 구현하나요?**
**답변**: Binary Lifting으로 각 노드의 2^k번째 조상을 전처리한 후, 쿼리 시 O(log N)에 구합니다. 두 노드를 같은 깊이로 맞춘 후, 동시에 올라가면서 LCA를 찾습니다.

**2. SCC는 어디에 쓰이나요?**
**답변**: 방향 그래프의 사이클 탐지, 2-SAT 문제 해결 등에 사용됩니다. Kosaraju나 Tarjan 알고리즘으로 구할 수 있습니다.

**3. 네트워크 플로우는 어떤 문제에 적용하나요?**
**답변**: 이분 매칭, 최소 컷, 최대 독립 집합 등 다양한 최적화 문제로 모델링할 수 있습니다. Ford-Fulkerson이나 Dinic 알고리즘을 사용합니다.

---

## 다음 단계

✅ **A3 완료 후**:
- [A4: 유지 루틴](./A4-maintenance-routine.md)
- 또는 실전 프로젝트 개발 시작

**체크리스트**:
- [ ] LCA Binary Lifting 구현 가능
- [ ] Tree DP 기본 패턴 이해
- [ ] SCC 알고리즘 하나 이상 구현 가능
- [ ] 2-SAT 그래프 변환 이해
- [ ] 최대 유량 기본 개념 숙지
- [ ] 골드 1 문제를 보고 접근 방법 파악 가능

**중요**: 이 단계는 "완벽한 마스터"보다 "경험과 감각"이 목표입니다.

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
