# 문서 2. C 개발자를 위한 JS/TS + Node 기본기

> 이 문서는 **Stage 1 중 “JS/TS + Node" 부분**을 채우는 문서다.
> React 쪽은 문서 3에서 자세히 다룬다.

---

## 0. 전제 / 목표

### 전제 (이미 알고 있다고 가정하는 것)

* C 문법: 포인터, struct, 함수 포인터, malloc/free
* 프로세스/스레드, 블로킹/논블로킹 I/O 개념
* 간단한 HTTP 개념 정도 (REST가 뭔지 대충)

### 이 문서의 목표

* JavaScript가 C와 **어디가 다른지** 감 잡기
* 비동기 모델(Promise, async/await) 이해
* TypeScript로 간단한 타입 붙이기
* Node.js + Express로 **간단한 REST API 서버** 만들기

최종적으로 이 정도를 목표로 한다:

* `GET /ping` → `"pong"`
* `POST /echo` → 받은 JSON 그대로 반환
* TypeScript로 작성, `curl` / Postman으로 확인 가능

---

## 1. C에서 JavaScript로: 핵심 개념

JavaScript는 C와 **근본적으로 다른 설계 철학**을 가진 언어입니다. C 프로그래머 입장에서 이해하기 어려운 핵심 개념들을 체계적으로 설명합니다.

### 1.1 C vs JavaScript 비교 테이블

| 측면 | C | JavaScript |
|------|---|------------|
| 메모리 관리 | 수동 (malloc/free) | 자동 (가비지 컬렉터) |
| 타입 시스템 | 정적 타입 (컴파일 타임) | 동적 타입 (런타임) |
| 포인터 | 명시적 포인터 (`*`, `&`) | 없음 (참조는 암묵적) |
| 문자열 | `char*` (널 종료) | 불변 String 객체 |
| 배열 | 고정 크기 | 동적 크기 (자동 확장) |
| 함수 | 전역 함수, 함수 포인터 | 일급 객체 (변수 할당 가능) |
| 동시성 | 멀티스레드 (pthread) | 단일 스레드 + 이벤트 루프 |
| I/O 모델 | 블로킹 (동기) | 논블로킹 (비동기) |
| 컴파일 | 기계어 직접 | JIT 컴파일 또는 인터프리터 |
| 헤더 파일 | `.h` 필요 | `import/export` 시스템 |

### 1.2 메모리 관리: malloc/free vs 가비지 컬렉터

**C 스타일 (수동 관리)**:

```c
// C: 메모리를 직접 할당하고 해제
#include <stdlib.h>
#include <string.h>

typedef struct {
    char* title;
    int duration;
} Video;

Video* create_video(const char* title, int duration) {
    // 1. struct 메모리 할당
    Video* v = (Video*)malloc(sizeof(Video));
    if (v == NULL) return NULL;

    // 2. 문자열 메모리 할당
    v->title = (char*)malloc(strlen(title) + 1);
    if (v->title == NULL) {
        free(v);  // 실패 시 정리
        return NULL;
    }

    strcpy(v->title, title);
    v->duration = duration;
    return v;
}

void destroy_video(Video* v) {
    if (v != NULL) {
        free(v->title);  // 순서 중요!
        free(v);
    }
}

int main() {
    Video* v = create_video("Intro", 120);

    // ... 사용

    destroy_video(v);  // 반드시 해제해야 함!
    return 0;
}
```

**JavaScript 스타일 (자동 관리)**:

```javascript
// JavaScript: 가비지 컬렉터가 자동으로 메모리 해제
function createVideo(title, duration) {
    // 객체 생성 (메모리 자동 할당)
    const video = {
        title: title,  // 문자열도 자동 할당
        duration: duration
    };
    return video;
}

function main() {
    const v = createVideo("Intro", 120);

    // ... 사용

    // v를 더 이상 참조하지 않으면 자동으로 메모리 해제!
    // destroy 함수 불필요
}

main();
```

**TypeScript (타입 추가)**:

```typescript
interface Video {
    title: string;
    duration: number;
}

function createVideo(title: string, duration: number): Video {
    return { title, duration };  // 축약 문법
}
```

**왜 GC가 편한가?**
- **C**: `malloc` 했으면 반드시 `free` 해야 함 → 메모리 누수 위험
- **JavaScript**: 더 이상 사용하지 않는 객체는 자동 정리 → 편리함
- **단점**: GC 타이밍을 제어할 수 없음 (하지만 대부분의 경우 문제없음)

### 1.3 동시성 모델: pthread vs 이벤트 루프

**C 멀티스레드 (pthread)**:

```c
// C: 멀티스레드로 병렬 처리
#include <pthread.h>
#include <stdio.h>
#include <unistd.h>

void* process_video(void* arg) {
    char* video_id = (char*)arg;
    printf("Processing video: %s\n", video_id);
    sleep(2);  // 2초 걸리는 작업 (블로킹)
    printf("Done: %s\n", video_id);
    return NULL;
}

int main() {
    pthread_t thread1, thread2;

    // 두 개의 스레드로 병렬 처리
    pthread_create(&thread1, NULL, process_video, "video1");
    pthread_create(&thread2, NULL, process_video, "video2");

    // 두 스레드 모두 완료 대기
    pthread_join(thread1, NULL);
    pthread_join(thread2, NULL);

    return 0;
}
```

**JavaScript 단일 스레드 + 이벤트 루프**:

```javascript
// JavaScript: 단일 스레드지만 비동기로 동시 처리
function processVideo(videoId) {
    return new Promise((resolve) => {
        console.log(`Processing video: ${videoId}`);

        // 2초 걸리는 작업 (논블로킹!)
        setTimeout(() => {
            console.log(`Done: ${videoId}`);
            resolve();
        }, 2000);
    });
}

async function main() {
    // 두 작업을 동시에 시작 (단일 스레드지만 비동기!)
    await Promise.all([
        processVideo("video1"),
        processVideo("video2")
    ]);
}

main();
```

**핵심 차이점**:

| 측면 | C (pthread) | JavaScript (이벤트 루프) |
|------|-------------|----------------------|
| 스레드 수 | 멀티스레드 (n개) | 단일 스레드 (1개) |
| CPU 코어 활용 | 병렬 실행 가능 | 한 번에 하나만 실행 |
| I/O 대기 | 스레드 블로킹 | 논블로킹 (다른 작업 진행) |
| 동기화 | mutex, semaphore 필요 | 불필요 (싱글 스레드) |
| 적합한 작업 | CPU 집약적 | I/O 집약적 |

**왜 Node.js는 단일 스레드인가?**
- 웹 서버는 대부분 **I/O 대기 시간**이 많음 (DB 조회, 파일 읽기, API 호출)
- 이벤트 루프는 I/O 대기 중에 다른 요청 처리 가능
- **CPU 집약적 작업은 외부 프로세스로** (예: FFmpeg)

### 1.4 I/O 모델: 블로킹 vs 논블로킹

**C 블로킹 I/O**:

```c
// C: 동기 방식 (파일 읽기가 끝날 때까지 대기)
#include <stdio.h>

void process_file(const char* path) {
    FILE* f = fopen(path, "r");  // 파일 열기 (블로킹)
    if (f == NULL) {
        perror("fopen failed");
        return;
    }

    char buffer[1024];
    size_t n = fread(buffer, 1, 1024, f);  // 읽기 완료까지 대기 (블로킹)

    printf("Read %zu bytes\n", n);

    fclose(f);  // 파일 닫기
}

int main() {
    process_file("video1.mp4");  // 완료까지 대기
    process_file("video2.mp4");  // 이제야 실행
    // 총 시간 = video1 시간 + video2 시간
    return 0;
}
```

**JavaScript 논블로킹 I/O (콜백)**:

```javascript
// JavaScript: 비동기 방식 (구식 - 콜백)
const fs = require('fs');

function processFile(path, callback) {
    // 파일 읽기 시작 (즉시 리턴! 블로킹 안 함)
    fs.readFile(path, (err, data) => {
        // 읽기 완료되면 나중에 이 콜백 호출
        if (err) {
            console.error('Error:', err);
            return callback(err);
        }
        console.log(`Read ${data.length} bytes from ${path}`);
        callback(null, data);
    });
}

// 두 파일 읽기 (거의 동시에 시작!)
processFile('video1.mp4', (err1, data1) => {
    console.log('video1 done');
});

processFile('video2.mp4', (err2, data2) => {
    console.log('video2 done');
});

// 총 시간 = max(video1 시간, video2 시간) - 병렬!
```

**JavaScript 논블로킹 I/O (Promise + async/await)**:

```javascript
// JavaScript: 비동기 방식 (현대 - async/await)
const fs = require('fs').promises;

async function processFile(path) {
    try {
        // await: Promise 완료까지 기다림 (하지만 다른 작업은 블로킹 안 함!)
        const data = await fs.readFile(path);
        console.log(`Read ${data.length} bytes from ${path}`);
        return data;
    } catch (err) {
        console.error('Error:', err);
        throw err;
    }
}

async function main() {
    // 순차 실행 (C와 비슷)
    await processFile('video1.mp4');
    await processFile('video2.mp4');

    // 또는 병렬 실행
    await Promise.all([
        processFile('video1.mp4'),
        processFile('video2.mp4')
    ]);
}

main();
```

**비교 요약**:

```c
// C: 블로킹 (동기)
read_file("a.txt");  // 완료까지 대기
read_file("b.txt");  // 이제야 시작
```

```javascript
// JavaScript: 논블로킹 (비동기)
await readFile("a.txt");  // 대기하지만 이벤트 루프는 계속 돌아감
await readFile("b.txt");  // 또는 Promise.all로 병렬 실행
```

### 1.5 타입 시스템: 정적 vs 동적

**C 정적 타입**:

```c
// C: 컴파일 타임에 타입 고정
int count = 10;
count = "hello";  // 컴파일 에러!

char* message = "hello";
int length = strlen(message);  // OK
int x = strlen(10);  // 컴파일 에러! (타입 불일치)
```

**JavaScript 동적 타입**:

```javascript
// JavaScript: 런타임에 타입 결정
let count = 10;       // number
count = "hello";      // string (문제 없음!)

let message = "hello";
let length = message.length;  // OK
let x = (10).toString();  // OK (숫자도 메서드 있음)
```

**TypeScript 정적 타입 (선택적)**:

```typescript
// TypeScript: 컴파일 타임 타입 체크
let count: number = 10;
count = "hello";  // 컴파일 에러!

let message: string = "hello";
let length: number = message.length;  // OK

// 함수 타입
function processVideo(id: string, duration: number): void {
    console.log(`${id}: ${duration}s`);
}

processVideo("v1", 120);  // OK
processVideo("v1", "120");  // 컴파일 에러! (string은 number 아님)
```

**왜 TypeScript를 쓰는가?**
- **JavaScript**: 유연하지만 오타나 타입 실수 발견이 런타임까지 미뤄짐
- **TypeScript**: C처럼 컴파일 타임에 에러 발견 → 안전함

### 1.6 함수: 일급 객체

**C 함수 포인터**:

```c
// C: 함수 포인터로 콜백 구현
typedef int (*CompareFunc)(int, int);

int compare_asc(int a, int b) {
    return a - b;
}

int compare_desc(int a, int b) {
    return b - a;
}

void sort(int* arr, int n, CompareFunc cmp) {
    // cmp 함수 포인터 사용
}

int main() {
    int arr[] = {3, 1, 2};
    sort(arr, 3, compare_asc);  // 함수를 인자로 전달
    return 0;
}
```

**JavaScript 일급 함수**:

```javascript
// JavaScript: 함수는 값처럼 취급됨
const compareAsc = (a, b) => a - b;
const compareDesc = (a, b) => b - a;

function sort(arr, cmp) {
    // cmp 함수 사용
    return arr.sort(cmp);
}

const arr = [3, 1, 2];

// 1. 함수를 변수에 할당
const compare = compareAsc;

// 2. 함수를 인자로 전달
sort(arr, compareAsc);

// 3. 함수를 즉석에서 정의 (익명 함수)
sort(arr, (a, b) => a - b);

// 4. 함수를 리턴
function makeComparer(ascending) {
    if (ascending) {
        return (a, b) => a - b;
    } else {
        return (a, b) => b - a;
    }
}

const cmp = makeComparer(true);
sort(arr, cmp);
```

**배열 메서드와 콜백**:

```javascript
const videos = [
    { id: "v1", duration: 120 },
    { id: "v2", duration: 60 },
    { id: "v3", duration: 180 }
];

// map: 각 요소 변환 (C: for 루프 + 새 배열 생성)
const ids = videos.map(v => v.id);
// ["v1", "v2", "v3"]

// filter: 조건 필터링 (C: for 루프 + if 문)
const long = videos.filter(v => v.duration > 100);
// [{ id: "v1", duration: 120 }, { id: "v3", duration: 180 }]

// find: 첫 번째 일치 항목 (C: for 루프 + break)
const first = videos.find(v => v.duration > 100);
// { id: "v1", duration: 120 }
```

이 패턴은 React/Node에서 **끊임없이** 사용됩니다.

### 1.7 배열: 고정 크기 vs 동적 크기

**C 배열 (고정 크기)**:

```c
// C: 크기 고정 또는 수동 재할당
int arr[3] = {1, 2, 3};
// arr[3] = 4;  // 버퍼 오버플로우!

// 동적 배열 (수동 관리)
int* dynamic = (int*)malloc(3 * sizeof(int));
dynamic[0] = 1;
dynamic[1] = 2;
dynamic[2] = 3;

// 크기 늘리려면 realloc
dynamic = (int*)realloc(dynamic, 4 * sizeof(int));
dynamic[3] = 4;

free(dynamic);  // 반드시 해제
```

**JavaScript 배열 (동적 크기)**:

```javascript
// JavaScript: 자동으로 크기 조절
const arr = [1, 2, 3];

arr.push(4);  // [1, 2, 3, 4] - realloc 자동!
arr.push(5);  // [1, 2, 3, 4, 5]

console.log(arr.length);  // 5

arr.pop();  // 마지막 제거 → [1, 2, 3, 4]
arr.shift();  // 첫 번째 제거 → [2, 3, 4]
arr.unshift(0);  // 맨 앞 추가 → [0, 2, 3, 4]

// 메모리 해제 걱정 없음!
```

### 1.8 문자열: char* vs String 객체

**C 문자열 (널 종료 배열)**:

```c
// C: 문자열은 char 배열 + '\0'
char str1[10] = "hello";  // ['h','e','l','l','o','\0',...]

// 문자열 복사 (수동)
char str2[10];
strcpy(str2, str1);

// 문자열 연결 (수동)
char result[20];
strcpy(result, "hello ");
strcat(result, "world");  // "hello world"

// 길이
int len = strlen(str1);  // O(n) - '\0'까지 세야 함
```

**JavaScript 문자열 (불변 객체)**:

```javascript
// JavaScript: 문자열은 불변 객체
const str1 = "hello";

// 복사 (참조만 복사, 실제로는 같은 객체)
const str2 = str1;

// 연결 (새 문자열 생성)
const result = "hello " + "world";  // "hello world"
const result2 = `hello ${"world"}`;  // 템플릿 리터럴

// 길이
const len = str1.length;  // O(1) - 프로퍼티로 저장됨

// 불변성 - 변경 불가!
str1[0] = 'H';  // 에러 안 나지만 실제로 변경 안 됨
console.log(str1);  // "hello" (그대로)

// 메서드 (새 문자열 리턴)
const upper = str1.toUpperCase();  // "HELLO"
const sub = str1.substring(0, 3);  // "hel"
```

---

## 2. JavaScript 기본 문법 (C와 비교)

### 2.1 타입 / 메모리 관점

* **동적 타입**: 변수에 타입이 붙는 게 아니라 값에 붙는다.
* 포인터 없음. 대신 **객체 / 배열은 참조로 다뤄짐**.
* 자동 메모리 관리(GC). `malloc/free` 없음.

```js
let x = 10;       // number
x = "hello";      // string (문제 없음)

const obj = { a: 1 };
const arr = [1, 2, 3];
```

C 기준으로 보면:

* `int`, `double` 같은 **원시 타입 값**은 “값 복사" 느낌
* 객체/배열은 “포인터 비슷한 참조" 느낌 (단, 진짜 포인터는 아님)

```js
const a = { x: 1 };
const b = a;

b.x = 2;
console.log(a.x); // 2 (같은 객체를 가리킨다고 보면 됨)
```

### 1.2 값 타입 vs 참조 타입

대략 이렇게 생각하면 된다:

* 값처럼 복사되는 타입: `number`, `string`, `boolean`, `null`, `undefined`, `bigint`, `symbol`
* 참조처럼 동작하는 타입: `object` (객체, 배열, 함수 등)

```js
let n1 = 10;
let n2 = n1;
n2 = 20;
console.log(n1, n2); // 10, 20

let o1 = { v: 10 };
let o2 = o1;
o2.v = 20;
console.log(o1.v, o2.v); // 20, 20
```

React/Node에서 상태 관리할 때 **“객체/배열을 직접 바꾸지 말라(불변성)"**라는 말이 여기서 나온다.

---

### 1.3 구조 분해 할당 (Destructuring)

객체/배열에서 필요한 값만 바로 뽑아 쓰는 문법.

```ts
const video = {
  id: "v1",
  title: "My Video",
  duration: 123,
};

// 객체 구조 분해
const { id, title } = video;
// id: "v1", title: "My Video"

// 이름 바꾸기
const { title: videoTitle } = video;
// videoTitle: "My Video"

// 배열 구조 분해
const arr = [10, 20, 30];
const [first, second] = arr;
// first: 10, second: 20

// 나머지 모으기
const [head, ...rest] = arr;
// head: 10, rest: [20, 30]
```

C 관점: `struct`에서 필드 하나씩 꺼내 쓰는 걸, **선언 단계에서 한 번에 풀어버리는 문법**이라고 보면 된다.

---

### 1.4 스프레드 / 나머지 (... 연산자)

배열/객체를 복사하거나, 나머지 요소를 모을 때 쓴다.

```ts
// 배열 스프레드
const nums = [1, 2, 3];
const extended = [...nums, 4]; // [1, 2, 3, 4]

// 객체 스프레드 (얕은 복사 + 일부만 수정)
const base = { id: "v1", title: "Old" };
const updated = { ...base, title: "New" };
// { id: "v1", title: "New" }

// 함수 인자에서 나머지 모으기 (rest)
function sum(...values: number[]) {
  return values.reduce((acc, x) => acc + x, 0);
}

sum(1, 2, 3); // 6
```

React 상태 업데이트, 옵션 병합에서 계속 쓰인다.

---

### 1.5 배열 메서드: map / filter / find

React와 Node 코드에서 가장 많이 쓰는 3개만.

```ts
const numbers = [1, 2, 3, 4];

// map: 각 원소를 변환해서 새 배열 생성
const doubled = numbers.map((n) => n * 2); // [2, 4, 6, 8]

// filter: 조건을 만족하는 것만 남김
const even = numbers.filter((n) => n % 2 === 0); // [2, 4]

// find: 조건을 만족하는 "첫 번째" 요소 반환 (없으면 undefined)
const firstEven = numbers.find((n) => n % 2 === 0); // 2 | undefined
```

React에서:

```tsx
{videos.map((v) => (
  <VideoItem key={v.id} video={v} />
))}
```

이 패턴을 이해하려면 `map`은 알고 있어야 한다.

---

## 3. JavaScript에서 조심해야 할 것들

### 3.1 `==` vs `===`

* `==` : 타입을 암묵 변환해서 비교 (쓰지 말 것)
* `===` : 타입까지 비교 (이거만 쓴다고 생각해도 된다)

```js
0 == false;   // true
0 === false;  // false

"123" == 123;   // true
"123" === 123;  // false
```

실무에서는 **`===`, `!==`만 쓴다고 생각하는 게 편하다.**

### 3.2 truthy / falsy

조건문에서 **“거짓으로 취급되는 값"**:

* `false`
* `0`
* `""` (빈 문자열)
* `null`
* `undefined`
* `NaN`

```js
if ("") {
  // 실행 안 됨
}

if ("hello") {
  // 실행됨
}
```

C의 `if (ptr)` 같은 느낌인데, 값 종류가 더 넓다.

### 3.3 스코프 / 클로저 / `this` 개요

#### 블록 스코프: `let`, `const`

```js
if (true) {
  let x = 10;
}
// x는 여기서 접근 불가
```

`var`는 함수 스코프라서 헷갈린다. **새 코드에서는 `let`, `const`만 쓰면 된다.**

#### 클로저(Closure)

```js
function makeCounter() {
  let count = 0;

  return function () {
    count += 1;
    return count;
  };
}

const c1 = makeCounter();
console.log(c1()); // 1
console.log(c1()); // 2

const c2 = makeCounter();
console.log(c2()); // 1
```

* `makeCounter`가 끝나도, 내부에서 반환된 함수가 `count`를 계속 가지고 있음.
* C로 치면 내부에 static 변수가 있는 함수 비슷하지만, 함수 인스턴스마다 독립된 캡슐화 상태가 생긴다고 보면 된다.

#### `this` (간단 버전)

* 일반 함수에서 `this`는 **호출 방식에 따라** 달라진다.
* 화살표 함수의 `this`는 **상위 스코프의 `this`를 캡처**.

초반에는 `this`를 적극적으로 쓰지 말고, **화살표 함수 + 명시적인 인자**로 처리하는 게 낫다.

---

## 4. 비동기 모델: 이벤트 루프, Promise, async/await

### 4.1 이벤트 루프 개념

Node/브라우저에서 JS는 **싱글 스레드**다.

* 오래 걸리는 I/O(파일, 네트워크 등)는 커널/런타임에 맡기고
* JS 코드는 콜백/Promise를 통해 “나중에 결과를 받아서 처리"

이벤트 루프는 “**할 일 큐에 쌓인 콜백들을 하나씩 꺼내 실행하는 루프**"라고 생각하면 된다.

### 4.2 콜백 기반

```js
function readFileCallback(path, cb) {
  fs.readFile(path, "utf-8", (err, data) => {
    if (err) return cb(err);
    cb(null, data);
  });
}
```

콜백 지옥을 피하기 위해 Promise/async가 나온다.

### 4.3 Promise

```js
function wait(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(); // 성공
      // reject(new Error("fail")); // 실패 시
    }, ms);
  });
}

wait(1000)
  .then(() => {
    console.log("done");
  })
  .catch((err) => {
    console.error(err);
  });
```

### 4.4 async / await

```js
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  console.log("start");
  await wait(1000);
  console.log("end");
}

main().catch((err) => {
  console.error(err);
});
```

* `async` 함수는 항상 Promise를 반환한다.
* `await`은 Promise가 끝날 때까지 기다렸다가 결과를 꺼낸다.
* `try/catch`로 에러를 다루는 패턴이 기본.

---

## 5. TypeScript 기초

> TS는 “컴파일 타임 타입 시스템"이다.
> 런타임에는 모두 JS로 변환되고 타입 정보는 사라진다.

### 5.1 타입 주석

```ts
let title: string = "Video";
let count: number = 0;

function inc(x: number): number {
  return x + 1;
}
```

대부분의 경우 타입 추론이 잘 되기 때문에, **필요한 곳에만** 타입을 적어도 된다.

### 5.2 `interface`, `type`

```ts
interface Video {
  id: string;
  title: string;
  duration: number;
}

type VideoId = string;

function printVideo(v: Video): void {
  console.log(v.id, v.title, v.duration);
}
```

* `interface` : 객체 형태 정의에 주로 사용
* `type` : 유니온, 튜플 등 포함해서 더 넓은 개념

```ts
type Status = "idle" | "loading" | "done" | "error";
```

### 5.3 구조적 타입 (structural typing)

TS의 타입 시스템은 **“구조가 같으면 같은 타입"**이라는 개념이다.

```ts
interface Video {
  id: string;
  title: string;
}

interface Clip {
  id: string;
  title: string;
}

const v: Video = { id: "v1", title: "hello" };
const c: Clip = v; // OK, 구조가 같아서 호환
```

C++의 “다른 struct는 다른 타입"과는 다르다.

### 5.4 `any` 피하기

```ts
let x: any = 10;
x = "hello"; // 다 통과됨
x.foo.bar(); // 컴파일러도 아무 말 안 함
```

* `any`는 타입 시스템을 포기하는 것과 거의 같다.
* 에러 날 때마다 `any`로 덮어버리면 TS 쓰는 의미가 없다.
* 모르면 일단 `unknown` 또는 좀 더 구체적인 타입을 정의하려고 시도하는 쪽이 낫다.

### 5.5 간단한 제네릭 예

```ts
function identity<T>(value: T): T {
  return value;
}

const n = identity(10);        // T = number
const s = identity("hello");   // T = string
```

실무에서 자주 마주치는 형태:

```ts
interface ApiResponse<T> {
  ok: boolean;
  data: T;
}

function makeOk<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}
```

---

### 5.6 타입 단언 (`as`)와 런타임 체크

`as`는 **컴파일러에게만 “이 타입으로 취급해"라고 말하는 것**이다.
실제 값이 그 타입인지 **런타임에서 검증해주지 않는다.**

```ts
interface CreateVideoRequest {
  title: string;
  description?: string;
}

function handleCreate(req: any) {
  const body = req.body as CreateVideoRequest;

  // body가 진짜로 이 형태인지 보장은 없다.
  // 그래서 런타임 체크를 추가로 해줘야 한다.
  if (typeof body.title !== "string") {
    throw new Error("title must be string");
  }
}
```

정리:

* `as`는 **타입스크립트 에러를 없애는 도구일 뿐, 런타임 검증은 안 해줌**
* 외부 입력(HTTP body, 파일 등)에 `as`를 쓴 뒤에는 **반드시 typeof 체크**로 검증해야 한다.

---

### 5.7 optional / null / undefined / optional chaining

#### optional property (`?`)

```ts
interface Video {
  id: string;
  title: string;
  description?: string; // 있어도 되고, 없어도 되고
}

const v1: Video = { id: "1", title: "A" }; // 가능 (description 생략)
```

`description?: string` 의 의미:

* 타입은 `string | undefined`
* 실제로는 `v.description`이 **존재하지 않을 수도 있음**

#### `null` vs `undefined`

* `undefined`: 아예 값이 없음, 미설정
* `null`: “값이 없음"을 **명시**한 것

보통:

* 외부 라이브러리 / JS 런타임: `undefined`를 많이 씀
* API 설계에서 “존재하지 않음"을 명시하고 싶으면 `null`을 쓰는 경우도 있음

#### `== null` 체크

`null` 또는 `undefined` 둘 다 잡고 싶을 때:

```ts
if (value == null) {
  // value가 null이거나 undefined인 경우
}
```

#### optional chaining (`?.`) / null 병합 (`??`)

```ts
// ?. : 앞이 null/undefined면 전체 결과를 undefined로
const authorName = video.author?.name;

// ?? : 왼쪽이 null/undefined일 때만 기본값 사용
const title = video.title ?? "untitled";

// 둘을 조합한 패턴
const tagList = response.data?.tags ?? [];
```

이 패턴을 알면, “이 값이 없을 수도 있을 때"의 JS/TS 코드를 훨씬 읽기 쉬워진다.

---

### 5.8 아주 얕은 타입 narrowing

조건문으로 타입을 줄이는 기본 패턴.

```ts
function printLength(value: string | null) {
  if (value === null) {
    console.log("no value");
    return;
  }

  // 여기부터 value: string 으로 좁혀진다.
  console.log(value.length);
}

function handle(x: string | number) {
  if (typeof x === "string") {
    // 여기서 x는 string
    console.log(x.toUpperCase());
  } else {
    // 여기서 x는 number
    console.log(x.toFixed(2));
  }
}
```

strict 모드에서 “이 값이 string인지 확실하냐?"라고 타입 에러가 뜰 때,
이런 식으로 조건문으로 좁혀서 해결하게 된다.

---

### 5.9 class 문법과 서비스 패턴

Stage 2 이상에서 자주 쓰게 될 “서비스 클래스" 패턴.

```ts
class FFmpegService {
  private ffmpegPath: string;

  constructor(ffmpegPath: string) {
    this.ffmpegPath = ffmpegPath;
  }

  async trim(input: string, output: string) {
    // ffmpeg CLI 호출 로직
  }

  async extractThumbnail(input: string, time: number, output: string) {
    // ...
  }
}

const service = new FFmpegService("/usr/bin/ffmpeg");
await service.trim("in.mp4", "out.mp4");
```

핵심:

* `class` 내부의 메서드는 **자동으로 this를 첫 번째 인자로 받는 함수**라고 보면 된다.
* `public` / `private` / `readonly`

  * `public`: 어디서나 사용 가능 (디폴트)
  * `private`: 클래스 외부에서 접근 불가
  * `readonly`: 생성자에서 한 번만 할당 가능
* “서비스 클래스 하나 = 도메인 로직 한 덩어리"

  * 예: `FFmpegService`, `StorageService`, `WebSocketService`

이 패턴을 알면, 설계 문서에서 나오는 `SomethingService` 이름들을 그대로 받아들이기 쉽다.

---

### 5.10 에러 객체 타입 다루기 (선택)

strict 모드에서는 `catch (err)`의 타입이 `unknown`으로 취급되는 게 안전하다.

```ts
try {
  await doSomething();
} catch (err: unknown) {
  if (err instanceof Error) {
    console.error("Error:", err.message);
  } else {
    console.error("Unknown error:", err);
  }
}
```

정리:

* 외부에서 들어오는 에러는 `unknown`으로 취급
* `instanceof Error` 같은 체크로 **narrowing** 해서 사용

---

## 6. Node.js 개요

### 6.1 Node는 뭐 하는 놈인가

* 브라우저 밖에서 JS를 실행하는 **런타임**
* 서버, CLI, 배치 작업, 스크립팅에 사용
* **싱글 스레드 이벤트 루프 + 비동기 I/O** 모델
* 파일/네트워크/프로세스 실행 API 제공

C 서버와 비교하면:

* 각 요청마다 스레드를 파는 대신, 이벤트 루프 하나로 여러 요청을 처리
* CPU 바운드 코드가 길게 돌면 전체가 막힌다 → 그런 작업은 FFmpeg/별도 프로세스로 넘기는 이유

### 6.2 블로킹 / 논블로킹 예

```js
import fs from "fs";

// 블로킹
const data = fs.readFileSync("file.txt", "utf-8");
console.log(data);

// 논블로킹
fs.readFile("file.txt", "utf-8", (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});
```

서버 코드에서는 최대한 **논블로킹 API**를 사용하는 게 기본 원칙.

---

### 6.3 외부 프로세스 실행: `child_process.spawn` (선택)

Stage 2에서 FFmpeg를 쓸 때 핵심이 되는 패턴이지만, 여기서 맛만 본다.

```ts
import { spawn } from "child_process";

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args);

    child.stdout.on("data", (chunk) => {
      // 필요하면 로그/프로그레스 파싱
      // console.log("stdout:", chunk.toString());
    });

    child.stderr.on("data", (chunk) => {
      // ffmpeg는 stderr로 진행 로그를 많이 찍는다
      // console.error("stderr:", chunk.toString());
    });

    child.on("error", (err) => {
      // 프로세스 자체가 못 뜬 경우 (파일 없음 등)
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}
```

이벤트 의미 요약:

* `stdout.on("data")` / `stderr.on("data")`
  → 프로세스가 출력할 때마다 호출
* `on("error")`
  → 프로세스가 시작도 못했을 때 (예: 실행 파일 없음, 권한 문제)
* `on("close")`
  → 프로세스가 **완전히 종료**된 뒤 한 번 호출, 종료 코드 전달

이 패턴 하나만 익혀두면, 나중에 `ffprobe`, `gsutil`, 기타 CLI 연동도 다 똑같이 처리할 수 있다.

---

## 7. Node + TypeScript 프로젝트 골격

### 7.1 디렉터리 구조

```text
project/
  package.json
  tsconfig.json
  src/
    server.ts
```

### 7.2 package.json 예시

```json
{
  "name": "video-api",
  "version": "1.0.0",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "express": "^4.19.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.0"
  }
}
```

* `dev`: 개발 시 TS 파일을 바로 실행 (ts-node)
* `build`: TS → JS 컴파일
* `start`: 컴파일된 JS 실행

### 7.3 tsconfig.json 최소 예

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

* `module: "commonjs"` : Node 기본 모듈 시스템
* `esModuleInterop: true` : `import express from "express";` 형태를 편하게 쓰기 위해 필요

---

## 8. Express로 REST API 만들기

### 8.1 최소 서버

`src/server.ts`

```ts
import express from "express";

const app = express();
const PORT = 3000;

// JSON body 파싱
app.use(express.json());

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

실행:

```bash
npm install
npm run dev
```

테스트:

```bash
curl http://localhost:3000/ping
# pong
```

### 8.2 /echo: JSON 입출력

```ts
app.post("/echo", (req, res) => {
  // req.body 에 JSON 파싱된 객체가 들어있음
  res.json(req.body);
});
```

테스트:

```bash
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

결과:

```json
{"message": "hello"}
```

### 8.3 타입 붙이기

Express 타입을 그대로 써도 되고, 간단히라도 붙여두면 읽기 좋다.

```ts
import type { Request, Response, NextFunction } from "express";

app.get("/ping", (req: Request, res: Response) => {
  res.send("pong");
});

app.post("/echo", (req: Request, res: Response) => {
  res.json(req.body);
});
```

에러 핸들링 미들웨어:

```ts
app.use(
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
);
```

`next(err)`로 넘겨진 에러가 여기로 모인다.

---

## 9. 간단한 도메인 타입 + 인메모리 REST 예제

Stage 1에서 실습용으로, 인메모리 배열을 쓰는 간단 API 하나 만들어 둔다.
(실제로는 DB를 쓰겠지만 지금은 구조만 보는 용도)

### 9.1 타입 정의

`src/types.ts` (예시)

```ts
export interface Video {
  id: string;
  title: string;
  duration: number; // seconds
}

export interface CreateVideoRequest {
  title: string;
  duration: number;
}
```

### 9.2 라우트 구현

`src/server.ts` 안에 추가:

```ts
import { v4 as uuidv4 } from "uuid";
import type { Video, CreateVideoRequest } from "./types";

const videos: Video[] = [];

// 모든 비디오 조회
app.get("/videos", (req: Request, res: Response) => {
  res.json(videos);
});

// 비디오 생성
app.post("/videos", (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CreateVideoRequest;

    if (typeof body.title !== "string" || typeof body.duration !== "number") {
      return res.status(400).json({ ok: false, message: "Invalid body" });
    }

    const video: Video = {
      id: uuidv4(),
      title: body.title,
      duration: body.duration,
    };

    videos.push(video);

    res.status(201).json({ ok: true, video });
  } catch (err) {
    next(err);
  }
});
```

`uuid` 설치:

```bash
npm install uuid
npm install -D @types/uuid
```

테스트:

```bash
curl -X POST http://localhost:3000/videos \
  -H "Content-Type: application/json" \
  -d '{"title": "Intro", "duration": 120}'
```

```bash
curl http://localhost:3000/videos
```

이 정도면:

* 타입 정의(인터페이스)
* 입력 검증
* 인메모리 저장
* JSON 응답

까지 한 번에 보는 셈이다.

---

## 10. (미리 맛보기) React에서 API 호출 한 번만

React 상세는 문서 3에서 다루지만, Stage 1에서 최소한 “React → Node API 호출" 느낌은 보고 넘어가도 된다.

```tsx
// 예: src/App.tsx
import { useEffect, useState } from "react";

function App() {
  const [pingResult, setPingResult] = useState<string>("(loading)");

  useEffect(() => {
    fetch("http://localhost:3000/ping")
      .then((res) => res.text())
      .then((text) => setPingResult(text))
      .catch((err) => setPingResult("error: " + String(err)));
  }, []);

  return (
    <div>
      <h1>Ping result</h1>
      <p>{pingResult}</p>
    </div>
  );
}

export default App;
```

실제로는 CORS 설정 등 추가가 필요하지만, 여기서는 “React에서 백엔드 HTTP 호출 → 화면 표시" 흐름만 맛보기 차원에서 보여주는 정도로 끝낸다.

---

## 11. Stage 1 체크리스트 (JS/TS + Node 관점)

이 문서 기준으로, 아래를 스스로 할 수 있으면 Stage 1의 **JS/TS + Node** 부분은 통과로 봐도 된다.

* [ ] JS에서 객체/배열이 참조로 동작한다는 걸 이해하고, 값 타입/참조 타입 차이를 설명할 수 있다.
* [ ] `==`와 `===` 차이를 알고, 실제 코딩에서는 `===`만 쓴다.
* [ ] Promise와 async/await로 비동기 작업을 처리하고, `try/catch`로 에러를 다룰 수 있다.
* [ ] TypeScript에서 `interface`, `type`, 유니온 타입을 정의하고, `any` 없이 기본적인 타입 에러를 해결할 수 있다.
* [ ] Node + Express로 `GET /ping`, `POST /echo`를 구현하고, `curl`이나 Postman으로 호출해서 결과를 확인할 수 있다.
* [ ] 인메모리 배열을 이용해 `/videos` 같은 간단한 리소스 API를 만들고, 생성/조회가 정상 동작하도록 구현할 수 있다.

여기까지가 문서 2에서 다루는 범위다.
이 다음 단계에서, **문서 3**에서 React 쪽을 붙여서 실제로 화면과 서버가 연결된 구조를 완성하게 된다.

---

## 12. High-Class Check: 이벤트 루프 블로킹, 비동기 경계, 디버깅

Node.js 쪽에서 “C 개발자 출신이 반드시 한 번씩은 밟는 지뢰"만 모은 섹션이다.

---

### 12.1 이벤트 루프를 블로킹하고 있지 않은가?

Node.js는 **요청 처리 쓰레드가 1개**다.
이 1개가 막히면 **모든 HTTP 요청, WebSocket, 타이머**가 한 번에 멈춘다.

```ts
// BAD: CPU 바운드 연산을 HTTP 핸들러에서 동기 루프로 처리
app.get('/api/heavy', (_req, res) => {
  let sum = 0;
  for (let i = 0; i < 1_000_000_000; i++) {
    sum += i;
  }
  res.json({ sum });
});
```

이 코드를 배포하면, `/api/heavy`를 한 번 호출하는 순간:

* 그 동안 **다른 사용자의 요청도 전부 대기**
* WebSocket 핑/퐁, 진행률 브로드캐스트, health check까지 모두 멈춤

**대원칙:**

* **CPU 바운드** 작업은 절대 이벤트 루프에서 직접 돌리지 않는다.
* Node main thread에서는 **I/O orchestration**만 한다.

해결 옵션(프로젝트 기준):

1. **Worker Threads 사용** (고성능, 같은 메모리 안)

   * 영상 처리, 압축, 대규모 파싱 등 CPU-heavy 작업을 worker로 보낸다.
2. **별도 프로세스 호출**

   * 이미 설계된 `ffmpeg`, native CLI, C++ binary를 `child_process.spawn`으로 실행.
3. **완전 다른 서비스로 분리**

   * 아주 무거운 배치성 편집이라면, worker 서비스(큐 기반)로 분리.

---

### 12.2 “동기 함수인데 실제로는 블로킹?" – 숨은 위험 패턴

아래 패턴이면 일단 의심해야 한다.

* `fs.readFileSync`, `fs.writeFileSync`
* `JSON.parse`에 수 MB 이상 문자열
* 대용량 배열에 대한 정렬/집계 (`array.sort`, `reduce`로 수십만 개 처리)
* 암호화 연산을 sync API로 호출 (예: `crypto.pbkdf2Sync`)

**원칙:**

* 라이브러리에 `xxxSync` 가 있으면, 일단 `xxx`(비동기 버전)가 있는지 먼저 찾는다.
* “처리 시간이 길어질 수 있는 sync 호출"은 전부 비동기/worker로 밀어낸다.

---

### 12.3 CPU 작업을 어디에서 처리할지: 비동기 경계 설계

HTTP 핸들러에서 할 일 / 안 할 일을 명확히 자른다.

**핸들러에서만 할 일 (OK)**

* 요청 파라미터 파싱/검증
* DB/Redis/파일 I/O 호출 (비동기)
* 비동기 잡 큐에 “일감" 넣기
* WebSocket으로 진행률 이벤트 전달

**핸들러에서 하면 안 되는 일 (NG)**

* ffmpeg를 직접 동기적으로 실행
* 큰 배열/버퍼를 루프 돌면서 CPU 연산
* 압축/암호화 같은 고비용 연산을 sync로

패턴 예시:

```ts
// OK: 실제 무거운 처리는 별도 서비스로 위임
app.post('/api/trim', async (req, res) => {
  const jobId = await jobQueue.enqueue({
    type: 'trim',
    payload: { /* ... */ },
  });

  res.json({ ok: true, jobId });
});
```

Worker / 별도 프로세스 쪽에서:

* 실제 ffmpeg 실행
* WebSocketService에 `progress` 이벤트 쏘기 (v1.3 설계 참고) 

---

### 12.4 Node.js 디버깅: 최소 셋업

C에서 gdb 쓰듯이, Node에서는 **Inspector + 콘솔 로그** 두 가지만 제대로 써도 충분하다.

1. **인터프리터에 --inspect-brk 붙이기**

```bash
node --inspect-brk dist/server.js
# 또는 tsx 사용 시
node --inspect-brk node_modules/tsx/dist/cli.mjs watch src/server.ts
```

2. **Chrome / Edge에서 `chrome://inspect` 접속 → “inspect" 클릭**

3. 브레이크포인트 설정:

* 문제 있는 라우트의 핸들러 첫 줄
* 비동기 체인의 `await` 직후 (응답 값 확인)
* 에러 핸들러 내부

4. **디버깅할 때 주의점**

* `console.log`와 브레이크포인트를 섞어서 사용한다.
* Promise 체인보다는 `async/await`로 풀어서 보는 편이 Node 디버깅에 유리하다.
* catch 안에서 에러를 다시 던지지 않고 묻어버리는 코드 패턴을 피한다.

---

### 12.5 성능/블로킹 점검용 체크리스트

* 특정 API 호출할 때 **전체 서비스가 굼떠지는지** 관찰
  (로컬에서 `ab` / `wrk` / 단일 탭 여러 요청)
* Node 프로세스 CPU 사용률이 1코어를 계속 100% 찍는다면,
  **이벤트 루프에서 CPU 일을 하고 있을 가능성**이 높다.
* `process.env.NODE_ENV !== 'production'` 인 상태에서만
  무거운 디버깅 로깅/트레이싱을 켜고, 배포 시에는 반드시 끈다.
