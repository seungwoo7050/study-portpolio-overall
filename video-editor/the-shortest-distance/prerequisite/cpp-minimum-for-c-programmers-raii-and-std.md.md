# 글 2 — C 쓰던 사람이 C++ 코드 바로 읽게 만드는 최소 문법

목표:
**C는 할 줄 아는데 C++은 어색한 사람**이,

* 기존 C++ 프로젝트 코드 읽고
* 간단한 클래스/RAII 코드 수정하고
* 직접 g++로 빌드까지 할 수 있게 만드는 것.

딱 그 정도까지만.

---

## 1. `namespace` 기본

C에서:

```c
int printf(const char *fmt, ...);
```

C++ 표준 라이브러리는 대부분 `std`라는 namespace 안에 들어 있다.

```cpp
#include <iostream>

int main() {
    std::cout << "hello\n";
}
```

* `std::cout` = `std` 네임스페이스 안의 `cout` 심볼
* `::` : "이 네임스페이스/클래스 안에 있는 이름" 접근 연산자

쓰는 패턴 2개만 알면 된다.

```cpp
// 1) std:: 를 매번 붙이기
std::string s = "abc";

// 2) using으로 지역에서만 풀어 쓰기
using std::string;

string s2 = "def";
```

전역에 `using namespace std;` 남발하는 건 실무 코드에서는 보통 지양.

---

## 2. `reference (&)` 기본

### C 스타일 포인터

```c
void inc(int *p) {
    (*p)++;
}

int x = 10;
inc(&x);
```

### C++ reference 버전

```cpp
void inc(int& x) {
    x++;
}

int a = 10;
inc(a);   // & 안 써도 원본 값이 증가
```

포인트:

* `int&` = "int에 대한 별칭"
* 함수 안에서 수정하면 **호출한 쪽 변수 자체가 바뀐다** (포인터로 주소 넘긴 것과 동일 효과)
* 호출할 때 `&x` 같은 거 안 써서 깔끔함

자주 보는 패턴:

```cpp
void foo(const std::string& s); // 읽기 전용 참조
void bar(std::vector<int>& v);  // 수정 가능한 참조
```

---

## 3. `class` / 생성자 / 소멸자 / 멤버 함수

### 구조체 느낌으로 시작

C 구조체:

```c
typedef struct {
    int x;
    int y;
} Point;
```

C++ 클래스(가장 단순형):

```cpp
class Point {
public:
    int x;
    int y;

    void move(int dx, int dy) {
        x += dx;
        y += dy;
    }
};
```

사용:

```cpp
Point p;
p.x = 1;
p.y = 2;
p.move(3, 4); // (4, 6)
```

`class`와 `struct` 차이:

* `class` : 기본 접근 지정자 `private`
* `struct`: 기본 `public`
* 나머지는 거의 동일. 실무에서도 `struct`에 멤버 함수 넣기도 한다.

---

### 생성자 / 소멸자

```cpp
class File {
public:
    File(const std::string& path) {
        // 생성자: 객체가 만들어질 때 실행
        printf("open %s\n", path.c_str());
    }

    ~File() {
        // 소멸자: 객체가 scope를 벗어날 때 자동 호출
        printf("close\n");
    }
};
```

사용:

```cpp
int main() {
    File f("test.txt"); // 여기서 open
    // ...
} // main 끝날 때 f 소멸 → close
```

이 패턴이 RAII의 기반.

---

## 4. RAII 감각만 잡기

RAII(Resource Acquisition Is Initialization):

> "리소스 획득은 곧 초기화에서 한다"
> → **생성자에서 확보 / 소멸자에서 해제**

C 스타일:

```c
FILE* fp = fopen("a.txt", "r");
if (!fp) return -1;
/* ... */
fclose(fp);
```

C++ RAII 스타일(거친 의사 코드):

```cpp
class File {
public:
    File(const std::string& path) {
        fp = fopen(path.c_str(), "r");
        // 실패 처리 생략
    }

    ~File() {
        if (fp) fclose(fp);
    }

private:
    FILE* fp;
};

int main() {
    File f("a.txt"); // 생성자에서 fopen
    // ... 중간에 return 되든 예외가 나든 ...
} // 소멸자에서 fclose 자동 호출
```

핵심만 기억:

* `new/free`, `fopen/fclose`, `lock/unlock` 같은 걸 **가능하면 클래스 안으로 숨긴다**
* 사용자 입장에서는 "객체 생성 → 자동으로 리소스 관리" 흐름만 보면 된다

---

## 5. `std::string` / `std::vector` / range-based for

### `std::string`

C 스타일:

```c
char buf[256];
strcpy(buf, "hello");
printf("%s\n", buf);
```

C++:

```cpp
#include <string>
#include <iostream>

int main() {
    std::string s = "hello";
    s += " world";
    std::cout << s << "\n";
}
```

주요 메서드:

```cpp
s.size();
s.empty();
s.substr(pos, len);
s.find("abc");
```

C API와 섞어 쓸 때:

```cpp
const char* cstr = s.c_str(); // C 스타일 문자열 필요할 때
```

---

### `std::vector`

C 스타일:

```c
int arr[3] = {1, 2, 3};
```

동적 배열/리스트 대체:

```cpp
#include <vector>

std::vector<int> v;
v.push_back(1);
v.push_back(2);
v.push_back(3);
```

접근:

```cpp
int x = v[0];
int n = v.size();
```

반복:

```cpp
for (size_t i = 0; i < v.size(); ++i) {
    printf("%d\n", v[i]);
}
```

---

### range-based for

C++11부터 추가된 깔끔한 for 문.

```cpp
#include <vector>
#include <iostream>

std::vector<int> v = {1, 2, 3};

for (int x : v) {
    std::cout << x << "\n"; // 값 복사
}

for (int& x : v) {
    x *= 2;                // 참조로 받아서 원본 수정
}
```

`std::string`도 동일하게 사용:

```cpp
std::string s = "abc";
for (char c : s) {
    // c는 'a', 'b', 'c'
}
```

---

## 6. 헤더/소스 분리 + g++ 빌드 기본

### 예시: `Point` 클래스 분리

#### Point.h

```cpp
#ifndef POINT_H
#define POINT_H

class Point {
public:
    Point(int x, int y);

    void move(int dx, int dy);
    int getX() const;
    int getY() const;

private:
    int x_;
    int y_;
};

#endif
```

#### Point.cpp

```cpp
#include "Point.h"

Point::Point(int x, int y)
    : x_(x), y_(y) // 멤버 초기화 리스트
{
}

void Point::move(int dx, int dy) {
    x_ += dx;
    y_ += dy;
}

int Point::getX() const {
    return x_;
}

int Point::getY() const {
    return y_;
}
```

#### main.cpp

```cpp
#include <iostream>
#include "Point.h"

int main() {
    Point p(1, 2);
    p.move(3, 4);
    std::cout << p.getX() << ", " << p.getY() << "\n";
}
```

---

### g++로 빌드

터미널에서:

```bash
g++ main.cpp Point.cpp -o app
```

* 여러 `.cpp`를 한 번에 넘기면 g++이 알아서 컴파일 + 링크까지 한다.
* 실행:

  ```bash
  ./app
  ```

조금 더 옵션 붙일 거면:

```bash
g++ -std=c++17 -O2 -Wall main.cpp Point.cpp -o app
```

---

## 7. 정리

C에서 C++ 코드 볼 때, 일단 아래만 익숙해지면 된다:

1. **`namespace`** → `std::` 붙어서 나오는 표준 라이브러리
2. **`&` reference** → 포인터 대신 많이 쓰는 "별칭" 문법
3. **클래스/생성자/소멸자** → RAII 기반 리소스 관리 패턴
4. **`std::string`, `std::vector`, range-based for** → C 배열/문자열보다 안전하고 편한 기본 컨테이너
5. **헤더/소스 분리 + g++ 빌드** → `g++ a.cpp b.cpp -o app` 패턴만 알면 기존 C 감각으로 그대로 컴파일 가능

이 정도면 C++ 서버/툴 코드 읽고, 간단한 수정·추가 작업 하는 데 문제 없다.
