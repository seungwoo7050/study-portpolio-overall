# A0: 준비 단계 (환경/습관 세팅)

> **목표**: 백준 문제를 효율적으로 풀 수 있는 환경과 습관 구축
> **예상 시간**: 3-5시간
> **난이도**: 🟢 기초
> **선행 요구사항**: 프로그래밍 기본 지식 (변수, 조건문, 반복문)
> **퀄리티 보장**: 즉시 적용 가능한 템플릿 코드 제공
> **효율성 보장**: 시행착오 최소화, 실전 최적화

---

## 목차

1. [언어 선택 가이드](#1-언어-선택-가이드)
2. [개발 환경 세팅](#2-개발-환경-세팅)
3. [백준 계정 및 설정](#3-백준-계정-및-설정)
4. [빠른 입출력 템플릿](#4-빠른-입출력-템플릿)
5. [기본 템플릿 코드](#5-기본-템플릿-코드)
6. [디버깅 환경](#6-디버깅-환경)
7. [학습 습관 설정](#7-학습-습관-설정)
8. [첫 10문제 풀기](#8-첫-10문제-풀기)

---

## 1. 언어 선택 가이드

### 추천 언어

| 언어 | 장점 | 단점 | 추천 대상 |
|-----|------|------|---------|
| **C++** | 빠른 실행 속도, STL 강력 | 문법 복잡 | 게임 서버 개발자 |
| **Python** | 간결한 문법, 빠른 구현 | 느린 속도 (시간초과 주의) | 초보자, 빠른 프로토타이핑 |
| **Java** | 안정적, 대기업 코테 표준 | 코드 길이 김 | 백엔드 개발자 |

### 결정 가이드

**C++을 선택하는 경우**:
- 게임 서버/시스템 프로그래밍 지망
- 이미 C++ 프로젝트 경험 있음
- 속도가 중요한 문제 (플래티넘 이상 목표)

**Python을 선택하는 경우**:
- 알고리즘 학습 초보자
- 빠르게 아이디어 검증 필요
- 백엔드/데이터 분석 지망

**Java를 선택하는 경우**:
- 대기업 (삼성, LG 등) 지원 예정
- Spring Boot 백엔드 개발자

**본 튜토리얼은 C++을 기준으로 작성**되었지만, Python/Java 사용자도 개념은 동일하게 적용 가능합니다.

---

## 2. 개발 환경 세팅

### C++ 환경

#### macOS/Linux
```bash
# 컴파일러 설치 확인
g++ --version  # GCC
clang++ --version  # Clang

# 없으면 설치
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt update
sudo apt install build-essential

# 빠른 컴파일 옵션 (디버그용)
g++ -std=c++17 -O2 -Wall solution.cpp -o solution

# 실행
./solution < input.txt
```

#### Windows
```bash
# MinGW 또는 Visual Studio 설치
# 또는 WSL2 사용 권장

# WSL2 설치 (PowerShell 관리자 권한)
wsl --install

# Ubuntu 설치 후 위와 동일
```

### Python 환경
```bash
# Python 3.8+ 설치 확인
python3 --version

# 빠른 입출력을 위한 설정 (필수)
import sys
input = sys.stdin.readline
```

### Java 환경
```bash
# JDK 11+ 설치 확인
java -version
javac -version

# 컴파일 및 실행
javac Main.java
java Main < input.txt
```

---

## 3. 백준 계정 및 설정

### 계정 생성
1. https://www.acmicpc.net/ 접속
2. 회원가입 (이메일 인증 필수)
3. solved.ac 연동 (https://solved.ac/)

### 언어 설정
- 프로필 → 설정 → 기본 언어 선택
- **C++**: C++17 (권장), C++20 (일부 문제 미지원)
- **Python**: Python 3
- **Java**: Java 11

### 유용한 설정
```
설정 → 코드 제출 시 자동으로 테스트 실행: ON
설정 → 다크 모드: ON (선택)
```

---

## 4. 빠른 입출력 템플릿

### C++ 빠른 입출력

**문제**: 기본 `cin`/`cout`은 느림 (시간초과 원인)

**해결**:
```cpp
#include <iostream>
using namespace std;

int main() {
    // 빠른 입출력 설정 (필수!)
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    cout << n << '\n';  // endl 대신 '\n' 사용

    return 0;
}
```

**핵심 원칙**:
- `ios_base::sync_with_stdio(false)`: C stdio와 동기화 해제
- `cin.tie(nullptr)`: cin/cout 버퍼 플러시 해제
- `'\n'` 사용: `endl`은 버퍼 플러시로 느림

### Python 빠른 입출력

```python
import sys
input = sys.stdin.readline  # 빠른 입력

# 사용
n = int(input())
arr = list(map(int, input().split()))

# 출력
print(n)
```

**주의**: `input().strip()` 사용 시 개행 문자 제거 필요

### Java 빠른 입출력

```java
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(System.out));

        int n = Integer.parseInt(br.readLine());
        bw.write(n + "\n");

        bw.flush();
        bw.close();
        br.close();
    }
}
```

---

## 5. 기본 템플릿 코드

### C++ 기본 템플릿

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // 코드 작성

    return 0;
}
```

### BFS/DFS 템플릿

```cpp
#include <iostream>
#include <vector>
#include <queue>
using namespace std;

// BFS 템플릿
vector<vector<int>> adj;  // 인접 리스트
vector<bool> visited;

void bfs(int start) {
    queue<int> q;
    q.push(start);
    visited[start] = true;

    while (!q.empty()) {
        int cur = q.front();
        q.pop();

        for (int next : adj[cur]) {
            if (!visited[next]) {
                visited[next] = true;
                q.push(next);
            }
        }
    }
}

// DFS 템플릿 (재귀)
void dfs(int cur) {
    visited[cur] = true;

    for (int next : adj[cur]) {
        if (!visited[next]) {
            dfs(next);
        }
    }
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;

    adj.resize(n + 1);
    visited.resize(n + 1, false);

    for (int i = 0; i < m; i++) {
        int u, v;
        cin >> u >> v;
        adj[u].push_back(v);
        adj[v].push_back(u);  // 무방향 그래프
    }

    bfs(1);

    return 0;
}
```

### Union-Find 템플릿

```cpp
#include <iostream>
#include <vector>
using namespace std;

vector<int> parent;

int find(int x) {
    if (parent[x] != x) {
        parent[x] = find(parent[x]);  // 경로 압축
    }
    return parent[x];
}

void unite(int x, int y) {
    x = find(x);
    y = find(y);
    if (x != y) {
        parent[y] = x;
    }
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;

    parent.resize(n + 1);
    for (int i = 1; i <= n; i++) {
        parent[i] = i;
    }

    for (int i = 0; i < m; i++) {
        int op, a, b;
        cin >> op >> a >> b;

        if (op == 0) {
            unite(a, b);
        } else {
            cout << (find(a) == find(b) ? "YES" : "NO") << '\n';
        }
    }

    return 0;
}
```

---

## 6. 디버깅 환경

### 로컬 테스트

#### input.txt 사용
```bash
# input.txt 파일 생성
echo "5
1 2 3 4 5" > input.txt

# 리다이렉션으로 실행
./solution < input.txt
```

#### 디버깅 매크로

```cpp
#ifdef LOCAL
#define debug(x) cerr << #x << " = " << (x) << endl
#else
#define debug(x)
#endif

int main() {
    int n = 42;
    debug(n);  // 로컬에서만 출력

    return 0;
}
```

컴파일:
```bash
# 로컬 디버그 모드
g++ -std=c++17 -O2 -Wall -DLOCAL solution.cpp -o solution

# 제출용 (최적화)
g++ -std=c++17 -O2 solution.cpp -o solution
```

### VS Code 디버깅 설정

`.vscode/tasks.json`:
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "C++ Compile",
            "type": "shell",
            "command": "g++",
            "args": [
                "-std=c++17",
                "-O2",
                "-Wall",
                "${file}",
                "-o",
                "${fileDirname}/${fileBasenameNoExtension}"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            }
        }
    ]
}
```

---

## 7. 학습 습관 설정

### 일일 루틴

```
시간: 오전/오후/저녁 중 고정된 시간 1-2시간
장소: 조용한 공간, 노트북 + 종이/펜
준비물: 백준, 에디터, 노트

루틴:
1. 준비 (5분): 환경 체크, 오늘 목표 설정
2. 문제 풀이 (40-50분): 1-3문제 집중
3. 복습 (10-15분): 틀린 문제 분석, 템플릿 정리
4. 기록 (5분): 학습 로그 작성
```

### 문제 풀이 프로세스

```
1. 문제 읽기 (3분)
   - 입력/출력 형식 확인
   - 제약 조건 확인 (시간/메모리)
   - 예제 손으로 따라가기

2. 접근 방법 고민 (5-10분)
   - 브루트 포스 가능한지?
   - 그리디? DP? 그래프?
   - 시간 복잡도 계산

3. 구현 (20-30분)
   - 템플릿 코드 사용
   - 예제 테스트

4. 제출 및 피드백 (5분)
   - 틀렸으면 반례 찾기
   - 맞았으면 다른 풀이 확인
```

### 학습 로그 템플릿

```markdown
## 2024-01-10

### 풀이 문제
- [백준 1000번 A+B](https://www.acmicpc.net/problem/1000) ✅
- [백준 2557번 Hello World](https://www.acmicpc.net/problem/2557) ✅
- [백준 10950번 A+B - 3](https://www.acmicpc.net/problem/10950) ✅

### 어려웠던 점
- 빠른 입출력 설정 빠뜨림 → 템플릿에 추가

### 배운 점
- `endl` 대신 `'\n'` 사용

### 내일 목표
- 브론즈 5문제 추가 풀이
```

---

## 8. 첫 10문제 풀기

### 추천 문제 목록 (브론즈)

| 번호 | 제목 | 난이도 | 학습 목표 |
|-----|------|--------|---------|
| [1000](https://www.acmicpc.net/problem/1000) | A+B | 브론즈5 | 기본 입출력 |
| [2557](https://www.acmicpc.net/problem/2557) | Hello World | 브론즈5 | 출력 |
| [10950](https://www.acmicpc.net/problem/10950) | A+B - 3 | 브론즈3 | 반복문 |
| [10951](https://www.acmicpc.net/problem/10951) | A+B - 4 | 브론즈3 | EOF 처리 |
| [10952](https://www.acmicpc.net/problem/10952) | A+B - 5 | 브론즈3 | 조건 종료 |
| [2739](https://www.acmicpc.net/problem/2739) | 구구단 | 브론즈3 | 반복문 |
| [8393](https://www.acmicpc.net/problem/8393) | 합 | 브론즈5 | 수식 |
| [10818](https://www.acmicpc.net/problem/10818) | 최소, 최대 | 브론즈3 | 배열 |
| [2562](https://www.acmicpc.net/problem/2562) | 최댓값 | 브론즈3 | 배열 순회 |
| [2577](https://www.acmicpc.net/problem/2577) | 숫자의 개수 | 브론즈2 | 문자열 |

### 예제 풀이: 백준 1000번 (A+B)

**문제**: 두 정수 A와 B를 입력받아 A+B를 출력하는 프로그램을 작성하시오.

**입력**:
```
1 2
```

**출력**:
```
3
```

**풀이 (C++)**:
```cpp
#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b << '\n';

    return 0;
}
```

**풀이 (Python)**:
```python
import sys
input = sys.stdin.readline

a, b = map(int, input().split())
print(a + b)
```

**풀이 (Java)**:
```java
import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());

        int a = Integer.parseInt(st.nextToken());
        int b = Integer.parseInt(st.nextToken());

        System.out.println(a + b);
    }
}
```

---

## 트러블슈팅

### 자주 발생하는 오류

#### 1. 시간 초과 (TLE)
**원인**:
- 빠른 입출력 미사용
- `endl` 사용 (`'\n'` 대신)
- 비효율적인 알고리즘

**해결**:
```cpp
// ❌ 느림
cout << result << endl;

// ✅ 빠름
cout << result << '\n';
```

#### 2. 메모리 초과 (MLE)
**원인**:
- 배열 크기 과도하게 큼
- 불필요한 메모리 할당

**해결**:
```cpp
// 문제 제약: N ≤ 100,000
vector<int> arr(100001);  // ✅ 적절
// vector<int> arr(1000000);  // ❌ 과도
```

#### 3. 런타임 에러 (RE)
**원인**:
- 배열 인덱스 범위 초과
- 스택 오버플로 (깊은 재귀)
- 0으로 나누기

**해결**:
```cpp
// 재귀 깊이 제한 (C++)
#include <sys/resource.h>

int main() {
    struct rlimit rl;
    getrlimit(RLIMIT_STACK, &rl);
    rl.rlim_cur = 256 * 1024 * 1024;  // 256MB
    setrlimit(RLIMIT_STACK, &rl);

    // 코드
}
```

#### 4. 컴파일 에러
**원인**:
- 문법 오류
- 헤더 누락
- C++ 버전 불일치

**해결**:
- 로컬에서 먼저 컴파일 테스트
- C++17 사용 확인

---

## 다음 단계

✅ **A0 완료 후**:
- [A1: 실버 전 구간 정리](./A1-silver-fundamentals.md)
- 백준 실버 문제 80-120개 목표

**체크리스트**:
- [ ] 백준 계정 생성 완료
- [ ] 언어 선택 완료
- [ ] 빠른 입출력 템플릿 작성
- [ ] BFS/DFS 기본 템플릿 작성
- [ ] 첫 10문제 풀이 완료
- [ ] 학습 로그 작성 시작

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: [A1: 실버 전 구간 정리](./A1-silver-fundamentals.md)

---

## 추가 리소스

### 공식 플랫폼
- [백준 온라인 저지](https://www.acmicpc.net/): 한국 최대 알고리즘 플랫폼
- [solved.ac](https://solved.ac/): 백준 문제 난이도/태그 시스템
- [Codeforces](https://codeforces.com/): 글로벌 대회 플랫폼

### 도구
- [BOJ CLI](https://github.com/kimjh7204/bojcli): 터미널에서 백준 사용
- [acmicpc.net Chrome Extension](https://chrome.google.com/webstore): 빠른 문제 접근

### 커뮤니티
- [백준 질문 게시판](https://www.acmicpc.net/board/list/qna)
- [Stack Overflow - algorithm tag](https://stackoverflow.com/questions/tagged/algorithm)

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
