# T10: C++ 기초 튜토리얼

> **목표**: T11 Modern C++ 전에 필요한 C++ 기초 완전 정복
> **예상 시간**: 2-4주 (주 5-10시간)
> **난이도**: 🟢 초보자
> **선행 요구사항**: 프로그래밍 기본 지식 (T01 JS/TS 코어 완료 추천)
> **퀄리티 보장**: 실행 가능한 코드, 단계적 실습, 오류 방지 팁
> **효율성 보장**: 필수 내용만, 퀴즈로 복습, 프로젝트로 통합

---

## 목차

1. [C++ 개요 및 환경 설정](#1-c-개요-및-환경-설정)
2. [기본 문법](#2-기본-문법)
3. [함수와 모듈](#3-함수와-모듈)
4. [객체 지향 프로그래밍](#4-객체-지향-프로그래밍)
5. [메모리 관리](#5-메모리-관리)
6. [STL 기초](#6-stl-기초)
7. [컴파일과 디버깅](#7-컴파일과-디버깅)
8. [실습 프로젝트](#8-실습-프로젝트)
9. [공통 오류와 해결](#9-공통-오류와-해결)
10. [퀴즈 및 다음 단계](#10-퀴즈-및-다음-단계)
11. [추가 리소스](#11-추가-리소스)

---

## 1. C++ 개요 및 환경 설정

### 1.1 C++란?
- **개념**: 고성능 시스템 언어. C 확장으로 객체 지향, 메모리 제어.
- **장점**: 빠름, 저수준 제어.
- **단점**: 복잡, 메모리 관리 수동.

### 1.2 환경 설정
- **컴파일러**: GCC 설치 (`brew install gcc` on macOS).
- **IDE**: VS Code + C++ 확장.
- **빌드**: `g++ hello.cpp -o hello && ./hello`.

**첫 프로그램**:
```cpp
#include <iostream>

int main() {
    std::cout << "Hello, C++!" << std::endl;  // 출력: Hello, C++!
    return 0;
}
```
**팁**: `std::endl`은 줄바꿈 + 버퍼 플러시. 성능 중요 시 `\n` 사용.

---

## 2. 기본 문법

### 2.1 변수와 타입
```cpp
int age = 25;              // int: 정수
double pi = 3.14159;       // double: 실수
char letter = 'A';         // char: 문자
bool isAdult = age > 18;   // bool: true/false
std::string name = "Alice"; // string: 문자열 (#include <string>)
```

### 2.2 연산자와 제어 구조
```cpp
// 산술
int sum = 5 + 3;  // 8

// 조건문
if (age >= 18) {
    std::cout << "성인\n";
} else {
    std::cout << "미성년\n";
}

// 반복문
for (int i = 0; i < 3; i++) {
    std::cout << i << " ";  // 0 1 2
}
```

**실습**: 나이 입력받아 출력 (cin 사용).
```cpp
#include <iostream>
int main() {
    int age;
    std::cin >> age;
    std::cout << "나이: " << age << std::endl;
    return 0;
}
```

---

## 3. 함수와 모듈

### 3.1 함수
```cpp
int square(int x) { return x * x; }  // 선언 + 정의

int main() {
    std::cout << square(5) << std::endl;  // 25
    return 0;
}
```

### 3.2 헤더와 네임스페이스
**헤더 파일 (math.h)**:
```cpp
#ifndef MATH_H
#define MATH_H
int add(int a, int b);
#endif
```

**구현 파일 (math.cpp)**:
```cpp
#include "math.h"
int add(int a, int b) { return a + b; }
```

**메인 파일**:
```cpp
#include "math.h"
#include <iostream>

int main() {
    std::cout << add(2, 3) << std::endl;  // 5
    return 0;
}
```

**컴파일**: `g++ main.cpp math.cpp -o program`

---

## 4. 객체 지향 프로그래밍

### 왜 객체 지향이 필요한가?

절차적 프로그래밍의 문제:
```cpp
// 나쁜 예: 데이터와 함수가 분리됨
std::string player_name = "Alice";
int player_hp = 100;
int player_mp = 50;

void heal_player(int amount) {
    player_hp += amount;  // 전역 변수 의존
}
```

**문제점**:
- 플레이어가 2명이면? 변수 6개 (player1_name, player1_hp, ...)
- `heal_player`가 실수로 `player_mp`를 건드리면? 버그 추적 어려움.
- 코드 100줄 넘어가면 누가 어느 변수 건드렸는지 모름.

**OOP 해결책**: 관련 데이터와 함수를 **클래스**로 묶음.
```cpp
class Player {
private:
    std::string name;
    int hp, mp;
public:
    void heal(int amount) { hp += amount; }  // 자신의 데이터만 접근
};
```

**장점**:
- **캡슐화**: private으로 실수 방지. `hp`를 직접 못 건드림.
- **재사용**: Player 객체 100개 쉽게 생성.
- **유지보수**: Player 관련 코드가 한 곳에 모임.

### 4.1 클래스
```cpp
class Person {
private:
    std::string name;
    int age;

public:
    Person(std::string n, int a) : name(n), age(a) {}  // 생성자

    void introduce() {
        std::cout << "이름: " << name << ", 나이: " << age << std::endl;
    }
};

int main() {
    Person p("Alice", 25);
    p.introduce();  // 이름: Alice, 나이: 25
    return 0;
}
```

**왜 생성자가 필요한가?**
- 객체 생성 시 **초기화 보장**. `Person p;` (초기화 안 함) 컴파일 에러.
- 초기화 리스트 `: name(n), age(a)`는 **멤버 변수를 직접 초기화** (대입보다 빠름).

```cpp
// 잘못된 초기화 (생성자 없으면)
Person p;
p.name = "Alice";  // private이라 에러!
```

### 4.2 상속 기초
```cpp
class Animal {
public:
    virtual void sound() { std::cout << "동물 소리\n"; }
};

class Dog : public Animal {
public:
    void sound() override { std::cout << "멍멍\n"; }
};
```

### 실습: Person 클래스 확장하기

**목표**: Person 클래스에 `birthday()` 메서드와 getter 추가

**단계별 가이드**:

**1단계: 기존 Person 클래스 복사**
```cpp
class Person {
private:
    std::string name;
    int age;

public:
    Person(std::string n, int a) : name(n), age(a) {}

    void introduce() {
        std::cout << "이름: " << name << ", 나이: " << age << std::endl;
    }
};
```

**2단계: `birthday()` 메서드 추가**
```cpp
    // introduce() 아래에 추가
    void birthday() {
        age++;
        std::cout << name << "님 생일 축하합니다! 이제 " << age << "살입니다.\n";
    }
```

**3단계: Getter 메서드 추가** (private 멤버 접근용)
```cpp
    int getAge() const { return age; }  // const: 멤버 변수 변경 안 함
    std::string getName() const { return name; }
```

**4단계: 테스트 코드 작성**
```cpp
int main() {
    Person alice("Alice", 25);
    alice.introduce();        // 이름: Alice, 나이: 25

    alice.birthday();         // Alice님 생일 축하합니다! 이제 26살입니다.
    alice.birthday();         // Alice님 생일 축하합니다! 이제 27살입니다.

    std::cout << alice.getName() << "의 현재 나이: "
              << alice.getAge() << std::endl;  // Alice의 현재 나이: 27

    return 0;
}
```

**5단계: 컴파일 및 실행**
```bash
g++ -std=c++17 person.cpp -o person
./person
```

**예상 출력**:
```
이름: Alice, 나이: 25
Alice님 생일 축하합니다! 이제 26살입니다.
Alice님 생일 축하합니다! 이제 27살입니다.
Alice의 현재 나이: 27
```

**완료 조건**:
- [ ] `birthday()` 메서드가 나이를 1 증가시킴
- [ ] Getter가 private 멤버 반환
- [ ] 출력이 위와 일치

**도전 과제**:
- `setAge(int newAge)` setter 추가 (단, 0~150 범위 검증)
- `isAdult()` 메서드 추가 (18세 이상이면 true)

---

## 5. 메모리 관리

### 왜 포인터와 참조가 필요한가?

**문제 상황**: 큰 데이터를 함수에 전달할 때
```cpp
struct Player {
    std::string name;
    int inventory[1000];  // 4KB 데이터
};

void levelUp(Player p) {  // 값 복사: 4KB 복사!
    p.level++;
}

int main() {
    Player alice;
    levelUp(alice);       // 4KB 복사 비용
    // alice.level은 그대로! (복사본만 변경됨)
}
```

**문제점**:
- **성능 낭비**: 4KB 복사는 느림 (10,000번 호출하면?)
- **의도와 다름**: `levelUp` 후에도 alice는 변경 안 됨.

**해결책**: 포인터 또는 참조로 **주소만 전달**
```cpp
void levelUp(Player& p) {  // 참조: 8바이트 주소만 전달
    p.level++;
}
// alice.level이 실제로 증가!
```

**핵심**:
- 포인터/참조는 **메모리 주소**만 전달 → 복사 비용 없음.
- 원본 데이터를 직접 수정 가능.

### 5.1 포인터와 참조
```cpp
int x = 10;
int* ptr = &x;     // 포인터: 주소 저장
int& ref = x;      // 참조: 별명

*ptr = 20;         // x = 20
ref = 30;          // x = 30
```

**포인터 vs 참조 언제 사용?**
| 기능 | 포인터 | 참조 |
|------|--------|------|
| null 가능 | ✅ `int* p = nullptr;` | ❌ 항상 유효한 객체 |
| 재할당 | ✅ `p = &y;` | ❌ 초기화 후 변경 불가 |
| 배열/동적 메모리 | ✅ `int* arr = new int[10];` | ❌ 불가능 |
| 함수 매개변수 | 🟡 optional 값 전달 시 | ✅ 일반적 권장 |

**권장**: 함수 매개변수는 **참조** 사용 (간결, 안전). 동적 메모리는 **포인터** (나중에 스마트 포인터로 대체).

### 5.2 동적 메모리

**왜 동적 메모리가 필요한가?**
```cpp
// 문제: 컴파일 타임에 크기를 모름
int n;
std::cin >> n;  // 사용자 입력: 100
int arr[n];     // 컴파일 에러! (배열 크기는 상수여야 함)
```

**해결**: `new`로 런타임에 할당
```cpp
int* arr = new int[n];  // OK! 런타임에 크기 결정
arr[0] = 1;
delete[] arr;           // 해제 (필수!)
```

**new/delete의 위험**:
```cpp
int* arr = new int[100];
// ... 500줄 코드 ...
// delete[] arr; 깜빡함! → 메모리 누수
// 또는 조기 return으로 delete 못 함
```

**스마트 포인터 (권장)**:
```cpp
#include <memory>
std::unique_ptr<int[]> arr = std::make_unique<int[]>(5);
// 자동 해제! 스코프 벗어나면 자동으로 delete
// 예외 발생해도 안전
```

**왜 스마트 포인터?**
- **RAII**: 생성자에서 할당, 소멸자에서 해제 (자동).
- **메모리 누수 방지**: delete 깜빡임 불가능.
- **예외 안전**: 예외 발생 시에도 자동 해제.
- **Modern C++ 표준**: T11에서 자세히 다룸.

---

## 6. STL 기초

### 왜 STL이 필요한가?

**STL 없이 동적 배열 구현하면?**
```cpp
// 직접 구현: 200줄 코드...
class MyVector {
    int* data;
    size_t size, capacity;
public:
    MyVector() : data(nullptr), size(0), capacity(0) {}
    ~MyVector() { delete[] data; }
    void push_back(int val) {
        if (size == capacity) {
            capacity = capacity == 0 ? 1 : capacity * 2;
            int* new_data = new int[capacity];
            for (size_t i = 0; i < size; i++) new_data[i] = data[i];
            delete[] data;
            data = new_data;
        }
        data[size++] = val;
    }
    // ... operator[], iterator, resize, reserve, clear 등 50개 메서드
};
```

**STL 사용하면?**
```cpp
#include <vector>
std::vector<int> v;
v.push_back(1);  // 끝! 버그 없는 1줄
```

**STL의 장점**:
- **검증됨**: 수백만 개발자가 20년간 사용. 버그 거의 없음.
- **최적화됨**: 컴파일러 제작사가 성능 최적화.
- **표준**: 모든 C++ 컴파일러에 내장. 설치 불필요.
- **생산성**: 자료구조 직접 구현 안 해도 됨 → 비즈니스 로직에 집중.

### 6.1 컨테이너
```cpp
#include <vector>
#include <map>

std::vector<int> v = {1, 2, 3};
v.push_back(4);  // [1,2,3,4]

std::map<std::string, int> m;
m["Alice"] = 25;
std::cout << m["Alice"] << std::endl;  // 25
```

**주요 컨테이너 선택 가이드**:
| 컨테이너 | 사용 시기 | 성능 |
|----------|----------|------|
| `vector` | 순차 저장, 빠른 접근 | O(1) 접근, O(n) 삽입 |
| `list` | 중간 삽입/삭제 빈번 | O(1) 삽입/삭제 |
| `map` | 키-값 쌍, 정렬 필요 | O(log n) 접근 |
| `unordered_map` | 키-값 쌍, 빠른 접근 | O(1) 평균 접근 |
| `set` | 중복 없는 집합 | O(log n) 삽입/검색 |

### 6.2 알고리즘
```cpp
#include <algorithm>

std::vector<int> v = {3, 1, 4};
std::sort(v.begin(), v.end());  // [1,3,4]
auto it = std::find(v.begin(), v.end(), 3);
if (it != v.end()) std::cout << "찾음\n";
```

---

## 7. 컴파일과 디버깅

### 7.1 컴파일
```bash
g++ -std=c++17 main.cpp -o main  # C++17 표준
./main
```

### 7.2 디버깅
- **gdb**: `gdb main`, `b main`, `r`, `p x`, `c`
- **에러**: try/catch
```cpp
try {
    // 코드
} catch (const std::exception& e) {
    std::cout << "오류: " << e.what() << std::endl;
}
```

### 7.3 CMake 프로젝트 구조

#### 왜 CMake가 필요한가?

간단한 프로그램은 `g++ main.cpp -o main`으로 충분하지만, 실제 프로젝트는:
- **파일 수십~수백 개**: 매번 g++ 명령어로 컴파일? 불가능.
- **플랫폼 차이**: Windows/Linux/macOS 각각 다른 빌드 명령.
- **라이브러리 의존성**: Boost, OpenSSL 등 외부 라이브러리 링크.
- **빌드 설정**: Debug/Release, 최적화 옵션 등.

**CMake**는 이런 복잡성을 추상화하는 **빌드 시스템 생성기**입니다.
- CMakeLists.txt에 한 번 설정하면, 어떤 플랫폼에서도 빌드 가능.
- T11 이후 모든 튜토리얼에서 CMake 사용.

#### 표준 프로젝트 구조

```
my_project/
├── CMakeLists.txt          # CMake 설정 파일
├── include/                # 헤더 파일 (.h)
│   └── math_utils.h
├── src/                    # 구현 파일 (.cpp)
│   ├── main.cpp
│   └── math_utils.cpp
└── build/                  # 빌드 출력 (생성됨)
    └── my_program
```

**왜 이렇게 구조화?**
- `include/`: 공개 API (헤더). 다른 프로젝트에서 재사용 가능.
- `src/`: 구현 세부사항. 외부에 노출 안 함.
- `build/`: 빌드 산출물. Git에 커밋하지 않음 (.gitignore에 추가).

#### CMakeLists.txt 상세 설명

**예제: my_project/CMakeLists.txt**
```cmake
# CMake 최소 버전 (너무 낮으면 최신 기능 못 씀)
cmake_minimum_required(VERSION 3.10)

# 프로젝트 이름과 버전
project(MyMathApp VERSION 1.0)

# C++ 표준 설정 (C++17 사용)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

# 헤더 파일 디렉터리 지정
include_directories(${PROJECT_SOURCE_DIR}/include)

# 실행 파일 생성: my_program (소스 파일 나열)
add_executable(my_program
    src/main.cpp
    src/math_utils.cpp
)

# 외부 라이브러리 링크 (예: pthread)
# target_link_libraries(my_program pthread)
```

**각 줄 설명**:
1. `cmake_minimum_required`: CMake 버전 체크. 3.10 이상 권장.
2. `project`: 프로젝트 메타데이터. `${PROJECT_NAME}`, `${PROJECT_VERSION}` 변수 생성.
3. `set(CMAKE_CXX_STANDARD 17)`: C++17 기능 활성화 (auto, lambda 등).
4. `include_directories`: 컴파일러에 `-I./include` 옵션 추가. `#include "math_utils.h"` 가능.
5. `add_executable`: 실행 파일 이름과 소스 파일. 자동으로 컴파일+링크.
6. `target_link_libraries`: 외부 라이브러리 링크 (주석 처리됨).

#### 단계별 실습: CMake 프로젝트 생성

**1단계: 프로젝트 구조 생성**
```bash
mkdir my_project && cd my_project
mkdir include src build
```

**2단계: 헤더 파일 작성 (include/math_utils.h)**
```cpp
#ifndef MATH_UTILS_H
#define MATH_UTILS_H

int add(int a, int b);
int multiply(int a, int b);

#endif
```

**3단계: 구현 파일 작성 (src/math_utils.cpp)**
```cpp
#include "math_utils.h"

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}
```

**4단계: 메인 파일 작성 (src/main.cpp)**
```cpp
#include <iostream>
#include "math_utils.h"  // include/ 디렉터리에서 찾음

int main() {
    std::cout << "2 + 3 = " << add(2, 3) << std::endl;       // 5
    std::cout << "4 * 5 = " << multiply(4, 5) << std::endl;  // 20
    return 0;
}
```

**5단계: CMakeLists.txt 작성 (위 예제 참고)**

**6단계: 빌드 및 실행**
```bash
cd build                         # 빌드 디렉터리로 이동
cmake ..                         # CMakeLists.txt 읽고 Makefile 생성
make                             # 컴파일 + 링크
./my_program                     # 실행
```

**출력**:
```
2 + 3 = 5
4 * 5 = 20
```

#### CMake 명령어 정리

| 명령어 | 설명 | 예제 |
|--------|------|------|
| `cmake ..` | 상위 디렉터리의 CMakeLists.txt 읽고 빌드 시스템 생성 | Makefile (Linux), .sln (Windows) |
| `make` | 컴파일 + 링크 (Linux/macOS) | `make -j4` (4코어 병렬 빌드) |
| `cmake --build .` | 플랫폼 무관 빌드 명령 | Windows에서도 동작 |
| `make clean` | 빌드 산출물 삭제 | 재빌드 전 정리 |

**팁**: `build/` 디렉터리를 통째로 삭제하고 다시 `cmake ..`하면 클린 빌드.

#### 라이브러리 추가 예제

**외부 라이브러리 (pthread) 링크**:
```cmake
# CMakeLists.txt에 추가
find_package(Threads REQUIRED)  # pthread 찾기
target_link_libraries(my_program Threads::Threads)
```

**사용자 정의 라이브러리**:
```cmake
# 정적 라이브러리 생성
add_library(math_lib STATIC src/math_utils.cpp)

# 실행 파일에 링크
add_executable(my_program src/main.cpp)
target_link_libraries(my_program math_lib)
```

#### CMake 트러블슈팅

| 에러 | 원인 | 해결 |
|------|------|------|
| `CMake Error: Could not find CMAKE_ROOT` | CMake 미설치 | `brew install cmake` (macOS) |
| `No such file or directory: math_utils.h` | include_directories 누락 | CMakeLists.txt에 `include_directories(include)` 추가 |
| `undefined reference to add` | 소스 파일 누락 | `add_executable`에 math_utils.cpp 추가 |
| `-- Build files written to: /wrong/path` | 잘못된 디렉터리에서 cmake 실행 | `build/`로 이동 후 `cmake ..` |

**디버그 팁**: `cmake .. --trace`로 상세 로그 확인.

#### 실습 과제

1. **과제 1**: 위 예제 프로젝트를 직접 생성하고 빌드하세요.
2. **과제 2**: `subtract(int a, int b)` 함수를 math_utils에 추가하세요.
3. **과제 3**: `set(CMAKE_BUILD_TYPE Debug)`를 추가하고 gdb로 디버깅하세요.
4. **과제 4**: `.gitignore`에 `build/`를 추가하고 Git 커밋하세요.

**완료 조건**: `./my_program` 실행 시 올바른 출력, `subtract` 함수 동작.

### 7.4 C++ 개발 Best Practices

#### 1. 네이밍 규칙 (Naming Conventions)

**일관성이 핵심**. 프로젝트 전체에 동일한 규칙 적용.

```cpp
// ✅ 좋은 예: 명확하고 일관적
class GamePlayer {                    // 클래스: PascalCase
private:
    int health_points_;               // 멤버 변수: snake_case + _ 접미사
    std::string player_name_;

public:
    int getHealthPoints() const {     // 메서드: camelCase
        return health_points_;
    }

    void takeDamage(int damage) {
        health_points_ -= damage;
    }
};

const int MAX_PLAYERS = 100;          // 상수: UPPER_SNAKE_CASE

// ❌ 나쁜 예: 일관성 없고 모호함
class gp {                            // 약어 사용, 의미 불명
    int hp;                           // 너무 짧음
    int numberOfHealthPointsForThisPlayer;  // 너무 김
};
```

**권장 규칙**:
- 클래스/구조체: `PascalCase` (예: `GameServer`, `Vector3D`)
- 함수/메서드: `camelCase` 또는 `snake_case` (예: `calculateDamage`, `calculate_damage`)
- 변수: `snake_case` (예: `player_count`, `is_alive`)
- 상수: `UPPER_SNAKE_CASE` (예: `MAX_HEALTH`, `PI`)
- 멤버 변수: `snake_case_` 접미사 (예: `name_`, `age_`)

---

#### 2. const 적극 활용

**const = 의도 명시 + 실수 방지**

```cpp
// ✅ 좋은 예: const로 의도 명시
class Player {
private:
    std::string name_;
    int health_;

public:
    // Getter는 const (멤버 변경 안 함)
    std::string getName() const { return name_; }
    int getHealth() const { return health_; }

    // const 참조로 복사 방지
    void setName(const std::string& name) {
        name_ = name;
    }

    // const 매개변수 (함수 내에서 변경 안 함)
    int calculateDamage(const int base_damage) const {
        return base_damage * 2;
    }
};

// const 참조로 함수 매개변수
void printPlayer(const Player& p) {  // 복사 없음 + 변경 불가
    std::cout << p.getName() << ": " << p.getHealth() << std::endl;
}

// ❌ 나쁜 예: const 없음
void printPlayer(Player p) {  // 💥 불필요한 복사!
    std::cout << p.getName() << std::endl;
}
```

**const 사용 규칙**:
- **멤버 함수**: 객체 상태 변경 안 하면 `const` 붙이기
- **매개변수**: 참조로 전달 시 `const&` (읽기 전용)
- **변수**: 변경 안 할 값은 `const` 선언

---

#### 3. 메모리 관리 원칙

**원칙**: Raw 포인터 최소화, 스마트 포인터 사용

```cpp
// ✅ 좋은 예: 스마트 포인터
#include <memory>

class Server {
private:
    std::unique_ptr<Database> db_;  // 단독 소유
    std::shared_ptr<Logger> logger_;  // 공유 소유

public:
    Server()
        : db_(std::make_unique<Database>()),
          logger_(std::make_shared<Logger>()) {
        // 자동으로 메모리 해제됨!
    }

    // 복사 방지 (unique_ptr은 복사 불가)
    Server(const Server&) = delete;
    Server& operator=(const Server&) = delete;
};

// ❌ 나쁜 예: Raw 포인터
class Server {
    Database* db_;  // 💥 누가 delete 할까?
public:
    Server() : db_(new Database()) {}
    ~Server() { delete db_; }  // 잊어버리면 메모리 누수!
};
```

**메모리 관리 규칙**:
- **소유권 명확히**: `unique_ptr` (단독), `shared_ptr` (공유)
- **Raw 포인터**: 소유권 없을 때만 (관찰 용도)
- **new/delete**: 가능한 사용 안 함 (스마트 포인터로 대체)

---

#### 4. 에러 처리 전략

**원칙**: 예외는 예외적 상황에만, 예상 가능한 에러는 반환값으로

```cpp
// ✅ 좋은 예: 예외적 상황에 예외 사용
class FileReader {
public:
    std::string readFile(const std::string& path) {
        std::ifstream file(path);
        if (!file.is_open()) {
            // 파일 없음 = 예외적 상황
            throw std::runtime_error("파일을 열 수 없음: " + path);
        }
        // ... 파일 읽기
    }
};

// 예상 가능한 에러는 optional 반환
#include <optional>
std::optional<int> parseInteger(const std::string& str) {
    try {
        return std::stoi(str);
    } catch (...) {
        return std::nullopt;  // 에러 = 예상 가능
    }
}

// 사용
auto result = parseInteger("123");
if (result.has_value()) {
    std::cout << result.value() << std::endl;
} else {
    std::cout << "파싱 실패\n";
}

// ❌ 나쁜 예: 예외 남용
int divide(int a, int b) {
    if (b == 0) {
        throw std::runtime_error("0으로 나눔");  // 💥 예외 남용
    }
    return a / b;
}
```

**에러 처리 규칙**:
- **예외**: 생성자 실패, 파일 I/O 에러, 네트워크 에러
- **반환값**: 파싱 실패, 검색 실패, 범위 체크
- **assert**: 디버그 시 전제 조건 검증 (`#include <cassert>`)

---

#### 5. RAII (Resource Acquisition Is Initialization)

**핵심**: 리소스 획득 = 초기화, 리소스 해제 = 소멸자

```cpp
// ✅ 좋은 예: RAII 패턴
class FileHandle {
private:
    FILE* file_;

public:
    FileHandle(const char* path) {
        file_ = fopen(path, "r");
        if (!file_) throw std::runtime_error("파일 열기 실패");
    }

    ~FileHandle() {
        if (file_) fclose(file_);  // 자동 해제!
    }

    // 복사 방지
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    FILE* get() { return file_; }
};

// 사용: 스코프 벗어나면 자동 닫힘
void processFile() {
    FileHandle file("data.txt");
    // ... 파일 사용
}  // 여기서 자동으로 fclose() 호출!

// ❌ 나쁜 예: 수동 관리
void processFile() {
    FILE* file = fopen("data.txt", "r");
    // ... 코드 100줄 ...
    fclose(file);  // 💥 예외 발생 시 호출 안 됨!
}
```

**RAII 적용 대상**:
- 파일 핸들, 소켓, 뮤텍스, 메모리
- 모든 리소스를 클래스로 래핑

---

#### 6. 값 vs 참조 전달 가이드

```cpp
// 작은 타입 (8바이트 이하) → 값 전달
void setHealth(int hp) { /*...*/ }
void setPosition(double x, double y) { /*...*/ }

// 큰 타입 (string, vector, 객체) → const 참조
void setName(const std::string& name) { /*...*/ }
void processPlayers(const std::vector<Player>& players) { /*...*/ }

// 수정 필요 → 비-const 참조
void levelUp(Player& player) {
    player.addExperience(100);
}

// 소유권 이전 → 이동 (T11에서 자세히)
void addPlayer(std::unique_ptr<Player> player) { /*...*/ }
```

---

#### 7. 코드 가독성

```cpp
// ✅ 좋은 예: 읽기 쉬운 코드
bool isPlayerAlive(const Player& player) {
    return player.getHealth() > 0;
}

void updateGame() {
    for (auto& player : players_) {  // range-based for
        if (isPlayerAlive(player)) {
            player.update();
        }
    }
}

// ❌ 나쁜 예: 읽기 어려운 코드
void u() {  // 의미 불명 함수명
    for (int i = 0; i < p.size(); i++) {  // 인덱스 루프
        if (p[i].h > 0) p[i].u();  // 약어 남발
    }
}
```

**가독성 규칙**:
- 함수는 한 가지 일만 (10-20줄 권장)
- 의미 있는 이름 (약어 최소화)
- range-based for 선호 (`for (auto& item : container)`)
- 매직 넘버 대신 상수 (`const int MAX_HEALTH = 100;`)

---

#### 8. 헤더 파일 구조

```cpp
// game_server.h
#pragma once  // 또는 #ifndef/#define/#endif

#include <string>      // 표준 라이브러리
#include <vector>

#include "player.h"    // 프로젝트 헤더
#include "world.h"

class GameServer {
public:
    // 공개 API만 선언
    void start();
    void stop();

private:
    // private 구현 세부사항
    void updateWorld();

    std::vector<Player> players_;
};

// game_server.cpp에서 구현
```

**헤더 작성 규칙**:
- 필요한 것만 include (컴파일 속도)
- 전방 선언 활용 (`class Player;`)
- 헤더에 `using namespace` 금지!

---

#### Best Practices 요약

| 항목 | 권장 | 피해야 할 것 |
|------|------|-------------|
| 포인터 | `unique_ptr`, `shared_ptr` | Raw 포인터 + new/delete |
| 매개변수 | `const Type&` (큰 타입) | 불필요한 복사 |
| 에러 | 예외 (예외적 상황만) | 에러 코드 남용 |
| 루프 | `for (auto& x : vec)` | 인덱스 루프 |
| const | 모든 가능한 곳 | const 누락 |
| 네이밍 | `clear_name` | 약어, 모호한 이름 |
| 리소스 | RAII 패턴 | 수동 관리 |

---

## 면접 질문

### Q1: C와 C++의 차이는?
**답변**: C는 절차적 언어, C++은 객체 지향 지원. C++은 클래스, 상속, 템플릿 등 추가.

### Q2: 포인터와 참조의 차이는?
**답변**: 포인터는 주소를 저장하는 변수, 참조는 변수의 별명. 참조는 null 불가, 초기화 필수.

### Q3: new/delete vs malloc/free?
**답변**: new/delete는 객체 생성/소멸자 호출, malloc/free는 메모리만 할당/해제.

### Q4: STL 컨테이너 종류는?
**답변**: vector, list, deque, set, map 등. 각 용도에 맞게 선택.

### Q5: const의 용도는?
**답변**: 상수 선언, 함수 매개변수 보호, 멤버 함수에서 객체 변경 방지.

### Q6: 컴파일 vs 링크 에러?
**답변**: 컴파일 에러는 문법 오류, 링크 에러는 정의 누락 (함수, 변수).

### Q7: 헤더 가드의 목적은?
**답변**: 다중 포함 방지, #ifndef/#define/#endif 사용.

### Q8: 스마트 포인터의 장점은?
**답변**: 자동 메모리 해제, 메모리 누수 방지, RAII 패턴.

---

## 8. 실습 프로젝트: 콘솔 계산기

### 프로젝트 개요

**목표**: OOP와 에러 처리를 활용한 실전 계산기 구현

**기능 요구사항**:
- 사칙연산 (덧셈, 뺄셈, 곱셈, 나눗셈)
- 0으로 나누기 에러 처리
- 연산 이력 저장 (vector 사용)
- 계속 실행 (종료 명령까지)

**예상 시간**: 1-2시간

### 단계별 구현 가이드

#### 1단계: Calculator 클래스 기본 구조

**파일**: calculator.cpp

```cpp
#include <iostream>
#include <vector>
#include <string>

class Calculator {
private:
    std::vector<std::string> history;  // 연산 이력

public:
    // 연산 메서드들
    double add(double a, double b) {
        return a + b;
    }

    double subtract(double a, double b) {
        return a - b;
    }

    double multiply(double a, double b) {
        return a * b;
    }

    double divide(double a, double b) {
        if (b == 0) {
            throw std::runtime_error("0으로 나눌 수 없습니다!");
        }
        return a / b;
    }

    // 이력에 추가
    void addHistory(const std::string& record) {
        history.push_back(record);
    }

    // 이력 출력
    void showHistory() const {
        std::cout << "\n=== 연산 이력 ===\n";
        if (history.empty()) {
            std::cout << "(이력 없음)\n";
            return;
        }
        for (size_t i = 0; i < history.size(); i++) {
            std::cout << i + 1 << ". " << history[i] << "\n";
        }
    }
};
```

**배운 개념 적용**:
- ✅ 클래스와 멤버 함수
- ✅ private/public 캡슐화
- ✅ STL vector 사용
- ✅ 예외 처리 (throw)

#### 2단계: 메인 루프 구현

```cpp
int main() {
    Calculator calc;
    std::cout << "=== C++ 계산기 ===\n";
    std::cout << "사용법: 2 + 3 (Enter)\n";
    std::cout << "종료: q (Enter)\n";
    std::cout << "이력: h (Enter)\n\n";

    while (true) {
        std::cout << "> ";

        // 첫 번째 입력 읽기
        std::string input;
        std::cin >> input;

        // 종료 명령
        if (input == "q" || input == "quit") {
            std::cout << "계산기를 종료합니다.\n";
            break;
        }

        // 이력 명령
        if (input == "h" || input == "history") {
            calc.showHistory();
            continue;
        }

        // 숫자로 변환
        double a, b, result;
        char op;

        try {
            a = std::stod(input);  // string to double
            std::cin >> op >> b;

            // 연산 수행
            switch (op) {
                case '+':
                    result = calc.add(a, b);
                    break;
                case '-':
                    result = calc.subtract(a, b);
                    break;
                case '*':
                    result = calc.multiply(a, b);
                    break;
                case '/':
                    result = calc.divide(a, b);  // 예외 발생 가능
                    break;
                default:
                    std::cout << "알 수 없는 연산자: " << op << "\n";
                    continue;
            }

            // 결과 출력 및 이력 저장
            std::cout << "= " << result << "\n";

            std::string record = std::to_string(a) + " " + op + " "
                               + std::to_string(b) + " = "
                               + std::to_string(result);
            calc.addHistory(record);

        } catch (const std::runtime_error& e) {
            // divide() 에서 던진 예외 처리
            std::cout << "에러: " << e.what() << "\n";
        } catch (const std::invalid_argument& e) {
            // stod() 변환 실패
            std::cout << "에러: 잘못된 숫자 입력\n";
        }
    }

    // 종료 전 이력 표시
    calc.showHistory();

    return 0;
}
```

**배운 개념 적용**:
- ✅ while 루프와 제어 구조
- ✅ switch 문
- ✅ try-catch 예외 처리
- ✅ string 변환 (stod, to_string)

#### 3단계: 테스트

**실행 예시**:
```bash
g++ -std=c++17 calculator.cpp -o calculator
./calculator
```

**테스트 케이스**:
```
=== C++ 계산기 ===
사용법: 2 + 3 (Enter)
종료: q (Enter)
이력: h (Enter)

> 10 + 5
= 15
> 20 - 8
= 12
> 3 * 7
= 21
> 100 / 4
= 25
> 10 / 0
에러: 0으로 나눌 수 없습니다!
> h

=== 연산 이력 ===
1. 10.000000 + 5.000000 = 15.000000
2. 20.000000 - 8.000000 = 12.000000
3. 3.000000 * 7.000000 = 21.000000
4. 100.000000 / 4.000000 = 25.000000

> q
계산기를 종료합니다.

=== 연산 이력 ===
(이력 표시)
```

#### 4단계: 개선 아이디어 (도전 과제)

1. **이력 삭제 기능**:
   ```cpp
   void clearHistory() { history.clear(); }
   ```

2. **소수점 자릿수 제어**:
   ```cpp
   #include <iomanip>
   std::cout << std::fixed << std::setprecision(2) << result << "\n";
   ```

3. **이력 파일 저장**:
   ```cpp
   #include <fstream>
   void saveHistory(const std::string& filename) {
       std::ofstream file(filename);
       for (const auto& record : history) {
           file << record << "\n";
       }
   }
   ```

4. **고급 연산 (제곱, 제곱근)**:
   ```cpp
   #include <cmath>
   double power(double base, double exp) { return std::pow(base, exp); }
   ```

### 완료 체크리스트

- [ ] Calculator 클래스 구현 (4개 연산)
- [ ] 0으로 나누기 예외 처리
- [ ] 연산 이력 vector로 저장
- [ ] while 루프로 계속 실행
- [ ] h 명령으로 이력 표시
- [ ] q 명령으로 종료
- [ ] 위 테스트 케이스 모두 통과

**예상 코드 라인 수**: 약 100줄

---

## 9. 공통 오류와 해결

### 9.1 컴파일 에러

#### 에러 1: 세미콜론 누락
```
error: expected ';' after class definition
```

**문제 코드**:
```cpp
class Person {
    int age;
}  // 세미콜론 없음!

int main() { return 0; }
```

**해결**:
```cpp
class Person {
    int age;
};  // ✅ 세미콜론 추가
```

**팁**: 클래스/구조체 정의 끝에는 **반드시** 세미콜론.

---

#### 에러 2: 함수 정의 없음
```
undefined reference to `add(int, int)'
```

**문제 코드**:
```cpp
// math.h
int add(int a, int b);  // 선언만 있음

// main.cpp
#include "math.h"
int main() {
    add(1, 2);  // 정의가 없어서 링크 에러!
}
```

**해결**:
```cpp
// math.cpp 생성
#include "math.h"
int add(int a, int b) { return a + b; }  // ✅ 정의 추가

// 컴파일
g++ main.cpp math.cpp -o program
```

**팁**: 헤더에 선언, .cpp에 정의. 컴파일 시 모든 .cpp 파일 포함.

---

#### 에러 3: include 경로 문제
```
fatal error: my_header.h: No such file or directory
```

**문제 코드**:
```cpp
#include "my_header.h"  // 파일이 다른 디렉터리에 있음
```

**해결**:
```bash
# 방법 1: -I 옵션으로 include 경로 지정
g++ main.cpp -I./include -o program

# 방법 2: CMake 사용 (권장)
include_directories(${PROJECT_SOURCE_DIR}/include)
```

---

#### 에러 4: std 네임스페이스 누락
```
error: 'cout' was not declared in this scope
```

**문제 코드**:
```cpp
#include <iostream>
int main() {
    cout << "Hello";  // std:: 없음
}
```

**해결**:
```cpp
// 방법 1: std:: 접두사 (권장)
std::cout << "Hello";

// 방법 2: using 선언 (편하지만 이름 충돌 위험)
using namespace std;
cout << "Hello";
```

**권장**: 작은 프로그램에서는 `using namespace std;` OK. 큰 프로젝트에서는 `std::` 명시.

---

### 9.2 런타임 에러

#### 에러 5: Null 포인터 역참조
```
Segmentation fault (core dumped)
```

**문제 코드**:
```cpp
int* ptr = nullptr;
*ptr = 10;  // 💥 null 포인터 역참조!
```

**해결**:
```cpp
int* ptr = nullptr;
if (ptr != nullptr) {  // ✅ null 체크
    *ptr = 10;
} else {
    std::cout << "포인터가 null입니다!\n";
}
```

**팁**: 포인터 사용 전 **항상** null 체크. 또는 참조(&) 사용.

---

#### 에러 6: 배열 범위 초과
```
Segmentation fault (core dumped)
```

**문제 코드**:
```cpp
int arr[5] = {1, 2, 3, 4, 5};
std::cout << arr[10];  // 💥 범위 초과!
```

**해결**:
```cpp
// 방법 1: vector 사용 (권장)
std::vector<int> v = {1, 2, 3, 4, 5};
std::cout << v.at(10);  // ✅ 예외 발생: out_of_range

// 방법 2: 수동 체크
if (index < 5) {
    std::cout << arr[index];
}
```

**팁**: `vector::at()`은 범위 체크. `operator[]`는 체크 안 함 (더 빠름).

---

#### 에러 7: 메모리 누수
```
(프로그램 종료 후 메모리 점유 계속)
```

**문제 코드**:
```cpp
void func() {
    int* arr = new int[1000];
    // delete[] arr; 깜빡함!
}  // 💥 메모리 누수!

int main() {
    for (int i = 0; i < 10000; i++) {
        func();  // 10GB 메모리 누수!
    }
}
```

**해결**:
```cpp
// 방법 1: 스마트 포인터 (권장)
void func() {
    auto arr = std::make_unique<int[]>(1000);
    // 자동 해제!
}

// 방법 2: 수동 delete (위험)
void func() {
    int* arr = new int[1000];
    delete[] arr;  // ✅ 반드시 해제
}
```

**디버깅**: `valgrind ./program` (Linux)로 메모리 누수 탐지.

---

### 9.3 논리 에러

#### 에러 8: 무한 루프
```
(프로그램이 멈추지 않음)
```

**문제 코드**:
```cpp
int i = 0;
while (i < 10) {
    std::cout << i << " ";
    // i++; 깜빡함!
}  // 💥 무한 루프!
```

**해결**:
```cpp
// 방법 1: for 루프 (권장)
for (int i = 0; i < 10; i++) {
    std::cout << i << " ";
}

// 방법 2: while에서 증가
int i = 0;
while (i < 10) {
    std::cout << i << " ";
    i++;  // ✅ 증가 잊지 말기
}
```

**긴급 중단**: Ctrl+C

---

#### 에러 9: 정수 나눗셈 오류
```
출력: 0 (예상: 0.5)
```

**문제 코드**:
```cpp
int a = 1, b = 2;
double result = a / b;  // 💥 정수 나눗셈 → 0
std::cout << result;    // 0.000000
```

**해결**:
```cpp
// 최소 하나를 double로 캐스팅
double result = static_cast<double>(a) / b;  // ✅ 0.5
// 또는
double result = 1.0 * a / b;
```

**팁**: 정수 / 정수 = 정수 (소수점 버림).

---

### 9.4 빌드 에러

#### 에러 10: 헤더 중복 포함
```
error: redefinition of 'class Person'
```

**문제 코드**:
```cpp
// person.h (가드 없음)
class Person {
    int age;
};

// main.cpp
#include "person.h"
#include "person.h"  // 💥 중복 포함!
```

**해결**:
```cpp
// person.h
#ifndef PERSON_H  // ✅ 헤더 가드
#define PERSON_H

class Person {
    int age;
};

#endif  // PERSON_H
```

**또는 (C++11 이상)**:
```cpp
#pragma once  // ✅ 간단한 헤더 가드

class Person {
    int age;
};
```

---

### 9.5 디버깅 체크리스트

**컴파일 에러 시**:
- [ ] 세미콜론 확인 (클래스, 변수 선언 끝)
- [ ] 헤더 파일 include 확인
- [ ] 네임스페이스 (std::) 확인
- [ ] 함수 정의 파일 컴파일 명령에 포함 확인

**런타임 에러 시**:
- [ ] 포인터 null 체크
- [ ] 배열 인덱스 범위 확인
- [ ] 무한 루프 확인 (증가 조건)
- [ ] 메모리 할당 후 해제 확인

**논리 에러 시**:
- [ ] 변수 타입 확인 (int vs double)
- [ ] 조건문 논리 검증
- [ ] gdb 디버거로 변수 값 확인 (`p variable`)

**빌드 에러 시**:
- [ ] 헤더 가드 확인
- [ ] CMakeLists.txt에 모든 소스 파일 포함 확인
- [ ] 외부 라이브러리 링크 확인

---

## 10. 퀴즈 및 다음 단계

**퀴즈**:
1. int와 double 차이? (정수 vs 실수)
2. 포인터 역참조? (*ptr)
3. vector push_back? (요소 추가)
4. 클래스 생성자? (객체 초기화)
5. new/delete? (동적 메모리 할당/해제)
6. #include 역할? (헤더 파일 포함)
7. std::cout? (표준 출력 스트림)
8. if-else? (조건문)
9. for 루프? (반복문)
10. 함수 선언? (반환타입 함수명(매개변수))

**완료 조건**: 계산기 실행, 퀴즈 80% 정답.

**다음**: [T11: Modern C++17 + RAII + TCP 소켓](./T11-cpp-raii-tcp.md)

---

## 11. 추가 리소스

더 깊이 학습하고 싶다면 다음 외부 리소스를 참고하세요:

### 공식 문서 및 레퍼런스
- [cppreference.com](https://en.cppreference.com/w/): C++ 표준 라이브러리 완전 가이드 (영어).
- [C++ 공식 사이트](https://isocpp.org/): ISO C++ 표준 및 뉴스.
- [GCC 문서](https://gcc.gnu.org/onlinedocs/): 컴파일러 옵션 및 튜토리얼.

### 온라인 튜토리얼
- [LearnCpp.com](https://www.learncpp.com/): 무료 C++ 튜토리얼 (영어, 초보자 친화적).
- [GeeksforGeeks C++](https://www.geeksforgeeks.org/c-plus-plus/): 예제 중심 튜토리얼.
- [Codecademy C++](https://www.codecademy.com/learn/learn-c-plus-plus): 인터랙티브 코스 (유료/무료 옵션).

### 비디오 튜토리얼
- [The Cherno C++ Playlist](https://www.youtube.com/playlist?list=PLlrATfBNZ98dudnM48yfGUldqGD0S4FF): YouTube에서 무료 C++ 시리즈 (영어).
- [freeCodeCamp C++](https://www.youtube.com/watch?v=vLnPwxZdW4Y): 4시간 풀 코스 (영어).
- [한국어 C++ 튜토리얼](https://www.youtube.com/results?search_query=c%2B%2B+%ED%8A%9C%ED%86%A0%EB%A6%AC%EC%96%BC): YouTube 검색 추천.

### 도서 추천
- "C++ Primer" by Stanley B. Lippman: 기초부터 심화.
- "Effective Modern C++" by Scott Meyers: 모던 C++ 팁 (T11 이후 추천).

### 커뮤니티 및 포럼
- [Stack Overflow C++](https://stackoverflow.com/questions/tagged/c%2B%2B): 질문/답변.
- [Reddit r/cpp](https://www.reddit.com/r/cpp/): 커뮤니티 토론.
- [C++ Slack Community](https://cpplang.slack.com/): 실시간 채팅.

### 실습 플랫폼
- [Compiler Explorer](https://godbolt.org/): 온라인 컴파일러.
- [LeetCode C++](https://leetcode.com/problemset/all/): 알고리즘 문제.
- [HackerRank C++](https://www.hackerrank.com/domains/cpp): 코딩 챌린지.

### 한국어 리소스
- [코딩팩토리 C++](https://coding-factory.tistory.com/): 블로그 튜토리얼.
- [TCP School C++](http://tcpschool.com/cpp/cpp_intro_programming): 기초 강의.

**팁**: 영어 리소스가 많으니 번역기 활용. 실습 위주로 학습하세요!

---

**튜토리얼 완료 체크리스트**:
- [ ] C++ 개요 및 환경 설정
  - [ ] C++ 개념 이해
  - [ ] 컴파일러 설치
  - [ ] 첫 프로그램 작성
- [ ] 기본 문법
  - [ ] 변수와 타입
  - [ ] 연산자와 제어 구조
- [ ] 함수와 모듈
  - [ ] 함수 선언과 정의
  - [ ] 헤더와 네임스페이스
- [ ] 객체 지향 프로그래밍
  - [ ] 클래스와 객체
  - [ ] 상속 기초
- [ ] 메모리 관리
  - [ ] 포인터와 참조
  - [ ] 동적 메모리 할당
  - [ ] 스마트 포인터
- [ ] STL 기초
  - [ ] 컨테이너 사용
  - [ ] 알고리즘 활용
- [ ] 컴파일과 디버깅
  - [ ] g++ 컴파일
  - [ ] gdb 디버깅
  - [ ] 에러 처리
- [ ] 실습 프로젝트
  - [ ] 콘솔 계산기 구현
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: _____