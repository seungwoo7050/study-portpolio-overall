# T01: JavaScript/TypeScript 코어

> **목표**: 4개 포트폴리오 프로젝트에서 사용하는 JS/TS 핵심 개념 완전 정복
> **예상 시간**: 8-12시간 (주 4-6시간)
> **난이도**: 🟢 기초
> **선행 요구사항**: 프로그래밍 기본 지식 (변수, 조건문, 반복문)
> **퀄리티 보장**: 실행 가능한 코드, 타입 안전, 실습 중심
> **효율성 보장**: 필수 개념만, 퀴즈 복습, 프로젝트 적용

---

## 목차

1. [ES6+ 필수 문법](#1-es6-필수-문법)
2. [Promise와 async/await](#2-promise와-asyncawait)
3. [TypeScript 타입 시스템](#3-typescript-타입-시스템)
4. [고급 타입 패턴](#4-고급-타입-패턴)
5. [모듈 시스템](#5-모듈-시스템)
6. [트러블슈팅](#6-트러블슈팅)
7. [프로젝트 적용](#7-프로젝트-적용)
8. [공통 오류와 해결](#8-공통-오류와-해결)
9. [퀴즈 및 다음 단계](#9-퀴즈-및-다음-단계)
10. [추가 리소스](#10-추가-리소스)

---

## 1. ES6+ 필수 문법

### 1.1 const/let과 블록 스코프

**개념**:
- `var`는 함수 스코프 (function scope), `const`/`let`은 블록 스코프 (block scope)
- `const`는 재할당 불가 (단, 객체/배열 내부는 변경 가능)
- `let`은 재할당 가능

**왜 중요한가?**
- 클로저(closure) 문제 해결
- 예측 가능한 변수 범위
- 실수로 인한 버그 방지

```javascript
// ❌ var의 문제점: 함수 스코프
function varProblem() {
  for (var i = 0; i < 3; i++) {
    setTimeout(() => console.log(i), 100); // 클로저 문제
  }
}
varProblem(); // 출력: 3, 3, 3 (예상: 0, 1, 2)

// ✅ let으로 해결: 블록 스코프
function letSolution() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => console.log(i), 100);
  }
}
letSolution(); // 출력: 0, 1, 2

// const는 재할당 불가
const config = { port: 3000, host: 'localhost' };
// config = {}; // ❌ TypeError: Assignment to constant variable
config.port = 4000; // ✅ 객체 내부는 변경 가능

// 실전 패턴: 기본은 const, 필요시에만 let
const users = [];
let currentPage = 1;

users.push({ id: 1, name: 'Alice' }); // ✅
currentPage++; // ✅

// 실전: React 컴포넌트에서
function UserList({ users }) {
  const [selectedUser, setSelectedUser] = useState(null); // ✅ const
  let filteredUsers = users; // ✅ let (필터링 시 변경)

  if (searchTerm) {
    filteredUsers = users.filter(user => // ✅ 재할당
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  return (
    <div>
      {filteredUsers.map(user => (
        <div key={user.id} onClick={() => setSelectedUser(user)}>
          {user.name}
        </div>
      ))}
    </div>
  );
}
```

**실전 가이드**:
- 기본적으로 `const` 사용 (재할당 방지)
- 재할당이 필요한 경우에만 `let` 사용
- `var`는 절대 사용 금지 (예측 불가능한 동작)
- 함수 매개변수는 기본적으로 `const`처럼 취급

---

### 1.2 Arrow Function과 this 바인딩

**개념**:
- Arrow function은 자신의 `this`를 가지지 않음
- 상위 스코프의 `this`를 그대로 사용 (lexical this)

```javascript
// 기본 함수 vs Arrow function
function traditional(x) {
  return x * 2;
}

const arrow = (x) => x * 2;
const arrowBlock = (x) => {
  const result = x * 2;
  return result;
};

// this 바인딩 차이
class Timer {
  constructor() {
    this.seconds = 0;
  }

  // ❌ 전통적 함수: this가 undefined
  startWrong() {
    setInterval(function() {
      this.seconds++; // TypeError!
    }, 1000);
  }

  // ✅ Arrow function: this가 Timer 인스턴스
  startCorrect() {
    setInterval(() => {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
}

const timer = new Timer();
timer.startCorrect(); // 1, 2, 3, ...
```

**실전 가이드**:
- 콜백 함수는 대부분 arrow function 사용
- 메서드 정의 시에는 일반 함수 또는 클래스 필드 arrow function 사용
- `this`가 필요 없으면 항상 arrow function

---

### 1.3 Destructuring (구조 분해 할당)

**개념**:
- 객체나 배열에서 값을 추출하여 변수에 할당

```javascript
// 객체 구조 분해
const user = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  age: 25
};

// ❌ 전통적 방식
const id = user.id;
const name = user.name;

// ✅ 구조 분해
const { id, name, email } = user;

// 기본값 설정
const { age = 18, country = 'KR' } = user;
console.log(age); // 25 (user.age 존재)
console.log(country); // 'KR' (user.country 없음)

// 이름 변경
const { id: userId, name: userName } = user;
console.log(userId); // 1

// 배열 구조 분해
const colors = ['red', 'green', 'blue'];
const [first, second] = colors;
console.log(first); // 'red'

// 나머지 요소
const [primary, ...others] = colors;
console.log(others); // ['green', 'blue']

// 실전: 함수 매개변수
function createUser({ name, email, age = 18 }) {
  return { name, email, age, createdAt: new Date() };
}

createUser({ name: 'Bob', email: 'bob@example.com' });
// { name: 'Bob', email: 'bob@example.com', age: 18, createdAt: ... }

// 실전: React props
function UserCard({ user: { name, email }, onEdit }) {
  return `<div>${name} (${email})</div>`;
}
```

**실전 가이드**:
- 함수 매개변수에서 객체 구조 분해 자주 사용
- 필요한 필드만 추출하여 코드 간결화
- 깊은 중첩은 피하기 (가독성 저하)

---

### 1.4 Spread/Rest Operator

**개념**:
- `...`는 문맥에 따라 spread 또는 rest로 동작
- Spread: 배열/객체 펼치기
- Rest: 나머지 요소 모으기

```javascript
// Spread: 배열 복사 및 합치기
const arr1 = [1, 2, 3];
const arr2 = [...arr1]; // 복사
const arr3 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]
const arr4 = [0, ...arr1, ...arr3]; // [0, 1, 2, 3, 1, 2, 3, 4, 5]

// Spread: 객체 복사 및 병합
const user = { name: 'Alice', age: 25 };
const userCopy = { ...user }; // 복사
const userWithEmail = { ...user, email: 'alice@example.com' };
// { name: 'Alice', age: 25, email: 'alice@example.com' }

// 속성 덮어쓰기
const updatedUser = { ...user, age: 26 };
// { name: 'Alice', age: 26 }

// Rest: 함수 매개변수
function sum(...numbers) {
  return numbers.reduce((acc, n) => acc + n, 0);
}
sum(1, 2, 3, 4); // 10

// Rest: 구조 분해와 함께
const { name, ...rest } = user;
console.log(name); // 'Alice'
console.log(rest); // { age: 25 }

// 실전 패턴: 불변성 유지
const state = {
  users: [{ id: 1, name: 'Alice' }],
  loading: false
};

// ❌ 직접 수정 (mutation)
state.users.push({ id: 2, name: 'Bob' });

// ✅ 새 객체 생성 (immutable)
const newState = {
  ...state,
  users: [...state.users, { id: 2, name: 'Bob' }]
};

// 실전 패턴: 배열 요소 업데이트
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];

const updatedUsers = users.map(user =>
  user.id === 1 ? { ...user, name: 'Alice Updated' } : user
);
```

**실전 가이드**:
- React/Redux에서 불변성 유지에 필수
- 얕은 복사만 수행 (깊은 복사 필요시 lodash.cloneDeep 또는 structuredClone)
- 객체 병합 시 순서 주의 (뒤의 속성이 앞의 것을 덮어씀)

---

### 1.5 Template Literals

**개념**:
- 백틱(`)으로 감싼 문자열, 변수 삽입 및 여러 줄 지원

```javascript
// 기본 사용
const name = 'Alice';
const age = 25;

// ❌ 문자열 연결
const message1 = 'Hello, ' + name + '! You are ' + age + ' years old.';

// ✅ Template literal
const message2 = `Hello, ${name}! You are ${age} years old.`;

// 표현식 삽입
const price = 1000;
const quantity = 3;
console.log(`Total: ${price * quantity} KRW`); // Total: 3000 KRW

// 여러 줄 문자열
const html = `
  <div class="user-card">
    <h2>${name}</h2>
    <p>Age: ${age}</p>
  </div>
`;

// 실전 패턴: SQL 쿼리 (주의: 실제로는 prepared statement 사용)
function buildQuery(tableName, conditions) {
  return `
    SELECT * FROM ${tableName}
    WHERE ${conditions.map(([key, value]) => `${key} = '${value}'`).join(' AND ')}
  `;
}

// Tagged template literals (고급)
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] ? `<mark>${values[i]}</mark>` : '');
  }, '');
}

const keyword = 'JavaScript';
const text = highlight`Learn ${keyword} in depth!`;
// 'Learn <mark>JavaScript</mark> in depth!'
```

---

## 2. Promise와 async/await

### 2.1 Promise 기본

**Promise란?**
- 비동기 작업의 결과를 나타내는 객체
- 3가지 상태: `pending`(대기) → `fulfilled`(성공) 또는 `rejected`(실패)
- `.then()`, `.catch()`, `.finally()`로 결과 처리

**왜 Promise가 필요한가?**
- 콜백 지옥(callback hell) 해결
- 비동기 코드의 가독성 향상
- 에러 처리 표준화

```javascript
// Promise 생성
function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(`Waited for ${ms}ms`);
    }, ms);
  });
}

// 기본 사용
delay(1000)
  .then(result => {
    console.log(result); // 'Waited for 1000ms'
    return delay(500);
  })
  .then(result => {
    console.log(result); // 'Waited for 500ms'
  })
  .catch(error => {
    console.error('Error:', error);
  });

// Promise.all: 모든 Promise가 완료될 때까지 기다림
Promise.all([
  delay(100),
  delay(200),
  delay(300)
])
  .then(messages => {
    console.log('All done:', messages);
    // ["Waited for 100ms", "Waited for 200ms", "Waited for 300ms"]
  });

// Promise.race: 가장 빠른 것만
Promise.race([
  delay(100),
  delay(200)
])
  .then(result => {
    console.log(result); // 'Waited for 100ms'
  });

// Promise.allSettled: 모두 완료 (성공/실패 무관)
Promise.allSettled([
  Promise.resolve('success'),
  Promise.reject('error'),
  delay(100)
])
  .then(results => {
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        console.log('Success:', result.value);
      } else {
        console.log('Failed:', result.reason);
      }
    });
  });

// 실전: API 호출
function fetchUser(userId) {
  return fetch(`/api/users/${userId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
}

function fetchUserPosts(userId) {
  return fetch(`/api/users/${userId}/posts`)
    .then(response => response.json());
}

// 체인 사용
fetchUser(1)
  .then(user => {
    console.log('User:', user);
    return fetchUserPosts(user.id);
  })
  .then(posts => {
    console.log('Posts:', posts);
  })
  .catch(error => {
    console.error('Failed to fetch:', error);
  });
```

---

### 2.2 async/await

**개념**:
- Promise를 동기 코드처럼 작성할 수 있는 문법 설탕
- `async` 함수는 항상 Promise를 반환
- `await`는 Promise가 완료될 때까지 기다림

```javascript
// Promise then/catch vs async/await
// ❌ then/catch (콜백 지옥 가능성)
function getUserData(userId) {
  return fetchUser(userId)
    .then(user => {
      return fetchPosts(user.id)
        .then(posts => {
          return { user, posts };
        });
    })
    .catch(error => {
      console.error(error);
      throw error;
    });
}

// ✅ async/await (깔끔함)
async function getUserData(userId) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 병렬 실행 패턴
async function fetchMultipleUsers() {
  // ❌ 순차 실행 (느림)
  const user1 = await fetchUser(1); // 1초
  const user2 = await fetchUser(2); // 1초
  const user3 = await fetchUser(3); // 1초
  // 총 3초

  // ✅ 병렬 실행 (빠름)
  const [user1, user2, user3] = await Promise.all([
    fetchUser(1),
    fetchUser(2),
    fetchUser(3)
  ]);
  // 총 1초

  return [user1, user2, user3];
}

// 실전 패턴: 에러 핸들링
async function safeOperation() {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    console.error('Operation failed:', error);
    return { success: false, error: error.message };
  }
}

// 실전 패턴: 타임아웃
async function fetchWithTimeout(url, timeout = 5000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  );

  const fetchPromise = fetch(url).then(r => r.json());

  return Promise.race([fetchPromise, timeoutPromise]);
}

// 실전 패턴: Retry 로직
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('HTTP error');
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry ${i + 1}/${maxRetries}...`);
      await delay(1000 * (i + 1)); // 지수 백오프
    }
  }
}

// 최상위 await (ES2022, TypeScript 4.7+)
// 모듈 최상위 레벨에서 await 사용 가능
const config = await fetch('/api/config').then(r => r.json());
console.log(config);
```

**실전 가이드**:
- `async/await`를 Promise보다 우선 사용
- 병렬 실행이 필요하면 `Promise.all` 사용
- `try/catch`로 에러 핸들링 필수
- `await`는 `async` 함수 내에서만 사용 가능

---

## 3. TypeScript 타입 시스템

### 3.1 기본 타입

```typescript
// 원시 타입
let isDone: boolean = false;
let count: number = 42;
let userName: string = "Alice";
let nothing: null = null;
let notDefined: undefined = undefined;

// 배열
let numbers: number[] = [1, 2, 3];
let strings: Array<string> = ["a", "b", "c"];

// 튜플 (고정 길이 배열, 각 요소 타입 지정)
let tuple: [string, number] = ["Alice", 25];
tuple[0].toUpperCase(); // ✅ string 메서드
tuple[1].toFixed(2);    // ✅ number 메서드
// tuple[0].toFixed(2); // ❌ Type error

// enum
enum Color {
  Red,
  Green,
  Blue
}
let c: Color = Color.Green;

// 실전 패턴: 문자열 enum
enum UserRole {
  Admin = "ADMIN",
  Manager = "MANAGER",
  Member = "MEMBER"
}

function checkPermission(role: UserRole) {
  if (role === UserRole.Admin) {
    return "Full access";
  }
  return "Limited access";
}

// any (가능하면 피하기)
let anything: any = 42;
anything = "string";
anything = true;
anything.nonExistentMethod(); // ❌ 런타임 에러, 컴파일 시 감지 안 됨

// unknown (any보다 안전)
let value: unknown = 42;
// value.toFixed(2); // ❌ Type error
if (typeof value === "number") {
  value.toFixed(2); // ✅ Type narrowing 후 가능
}

// void (반환값 없음)
function logMessage(message: string): void {
  console.log(message);
}

// never (절대 반환하지 않음)
function throwError(message: string): never {
  throw new Error(message);
}
```

---

### 3.2 인터페이스와 타입 별칭

```typescript
// 인터페이스 (객체 구조 정의)
interface User {
  id: number;
  name: string;
  email: string;
  age?: number; // 선택적 속성
  readonly createdAt: Date; // 읽기 전용
}

const user: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date()
};

// user.id = 2; // ✅ 가능
// user.createdAt = new Date(); // ❌ readonly

// 인터페이스 확장
interface Admin extends User {
  role: "admin";
  permissions: string[];
}

const admin: Admin = {
  id: 1,
  name: "Admin",
  email: "admin@example.com",
  createdAt: new Date(),
  role: "admin",
  permissions: ["read", "write", "delete"]
};

// 타입 별칭 (Type Alias)
type Point = {
  x: number;
  y: number;
};

type ID = number | string; // 유니온 타입

// 인터페이스 vs 타입 별칭
// 1. 인터페이스는 확장 가능 (extends)
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}

// 2. 타입 별칭은 유니온/인터섹션 가능
type StringOrNumber = string | number;
type Combined = Point & { z: number };

// 실전 패턴: API 응답 타입
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface UserData {
  id: number;
  name: string;
}

async function fetchUser(id: number): Promise<ApiResponse<UserData>> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// 실전 패턴: 함수 타입
interface SearchFunction {
  (query: string, limit?: number): Promise<User[]>;
}

const searchUsers: SearchFunction = async (query, limit = 10) => {
  // 구현
  return [];
};

// 인덱스 시그니처 (동적 키)
interface Dictionary {
  [key: string]: string;
}

const dict: Dictionary = {
  hello: "안녕하세요",
  bye: "안녕히 가세요"
};
```

**실전 가이드**:
- 객체 구조는 `interface` 우선 (확장 가능성)
- 유니온/인터섹션은 `type` 사용
- 외부 라이브러리 타입 정의는 `.d.ts` 파일 사용

---

### 3.3 제네릭 (Generics)

**개념**:
- 타입을 매개변수처럼 전달하여 재사용 가능한 컴포넌트 작성

```typescript
// 제네릭 함수
function identity<T>(arg: T): T {
  return arg;
}

const num = identity<number>(42); // num: number
const str = identity<string>("hello"); // str: string
const auto = identity(true); // 타입 추론: boolean

// 제네릭 배열
function getFirstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

const firstNum = getFirstElement([1, 2, 3]); // number | undefined
const firstStr = getFirstElement(["a", "b"]); // string | undefined

// 제네릭 인터페이스
interface Box<T> {
  value: T;
}

const numberBox: Box<number> = { value: 42 };
const stringBox: Box<string> = { value: "hello" };

// 실전 패턴: API 응답 래퍼
interface ApiResult<T> {
  success: boolean;
  data: T;
  timestamp: number;
}

async function apiCall<T>(url: string): Promise<ApiResult<T>> {
  const response = await fetch(url);
  const data = await response.json();
  return {
    success: true,
    data,
    timestamp: Date.now()
  };
}

// 사용
interface Post {
  id: number;
  title: string;
}

const posts = await apiCall<Post[]>("/api/posts");
// posts.data는 Post[] 타입

// 제네릭 제약 (extends)
interface HasId {
  id: number;
}

function findById<T extends HasId>(items: T[], id: number): T | undefined {
  return items.find(item => item.id === id);
}

const users = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" }
];

const user = findById(users, 1); // { id: number, name: string } | undefined

// 실전 패턴: React 컴포넌트 props
interface ButtonProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
}

function List<T>({ items, renderItem, onSelect }: ButtonProps<T>) {
  // 구현
}

// 다중 제네릭 매개변수
function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

const merged = merge(
  { name: "Alice" },
  { age: 25 }
);
// merged: { name: string } & { age: number }
```

**실전 가이드**:
- 제네릭은 타입 재사용성을 높임
- 제약 조건(`extends`)으로 타입 안전성 확보
- 과도한 제네릭은 복잡도 증가, 필요한 경우에만 사용

---

## 4. 고급 타입 패턴

### 4.1 유니온과 인터섹션

```typescript
// 유니온 타입 (OR)
type Status = "pending" | "success" | "error";

function handleStatus(status: Status) {
  if (status === "pending") {
    console.log("Loading...");
  } else if (status === "success") {
    console.log("Success!");
  } else {
    console.log("Error!");
  }
}

// 숫자 리터럴 유니온
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

function rollDice(): DiceRoll {
  return (Math.floor(Math.random() * 6) + 1) as DiceRoll;
}

// 유니온 타입과 타입 가드
type Shape = Circle | Rectangle;

interface Circle {
  kind: "circle";
  radius: number;
}

interface Rectangle {
  kind: "rectangle";
  width: number;
  height: number;
}

function getArea(shape: Shape): number {
  if (shape.kind === "circle") {
    // 여기서 shape는 Circle 타입으로 좁혀짐
    return Math.PI * shape.radius ** 2;
  } else {
    // 여기서 shape는 Rectangle 타입
    return shape.width * shape.height;
  }
}

// 인터섹션 타입 (AND)
interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: number;
  name: string;
}

type TimestampedUser = User & Timestamped;

const user: TimestampedUser = {
  id: 1,
  name: "Alice",
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

### 4.2 타입 좁히기 (Type Narrowing)

```typescript
// typeof 타입 가드
function padLeft(value: string, padding: string | number) {
  if (typeof padding === "number") {
    // padding은 number 타입
    return " ".repeat(padding) + value;
  }
  // padding은 string 타입
  return padding + value;
}

// instanceof 타입 가드
class Dog {
  bark() {
    console.log("Woof!");
  }
}

class Cat {
  meow() {
    console.log("Meow!");
  }
}

function makeSound(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark();
  } else {
    animal.meow();
  }
}

// in 연산자 타입 가드
interface Fish {
  swim: () => void;
}

interface Bird {
  fly: () => void;
}

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim();
  } else {
    animal.fly();
  }
}

// 사용자 정의 타입 가드
interface Car {
  type: "car";
  drive: () => void;
}

interface Boat {
  type: "boat";
  sail: () => void;
}

function isCar(vehicle: Car | Boat): vehicle is Car {
  return vehicle.type === "car";
}

function operateVehicle(vehicle: Car | Boat) {
  if (isCar(vehicle)) {
    vehicle.drive(); // vehicle은 Car 타입
  } else {
    vehicle.sail(); // vehicle은 Boat 타입
  }
}

// Discriminated Unions (판별 유니온)
type NetworkState =
  | { status: "loading" }
  | { status: "success"; data: string }
  | { status: "error"; error: Error };

function renderState(state: NetworkState) {
  switch (state.status) {
    case "loading":
      return "Loading...";
    case "success":
      return `Data: ${state.data}`;
    case "error":
      return `Error: ${state.error.message}`;
  }
}
```

---

### 4.3 유틸리티 타입

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

// Partial<T>: 모든 속성을 선택적으로
type PartialUser = Partial<User>;
// { id?: number; name?: string; email?: string; age?: number; }

function updateUser(id: number, updates: Partial<User>) {
  // updates는 일부 속성만 포함 가능
}

updateUser(1, { name: "Alice" }); // ✅
updateUser(1, { age: 26 }); // ✅

// Required<T>: 모든 속성을 필수로
interface Config {
  host?: string;
  port?: number;
}

type RequiredConfig = Required<Config>;
// { host: string; port: number; }

// Readonly<T>: 모든 속성을 읽기 전용으로
type ReadonlyUser = Readonly<User>;

const user: ReadonlyUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  age: 25
};

// user.name = "Bob"; // ❌ Cannot assign to 'name' because it is a read-only property

// Pick<T, K>: 특정 속성만 선택
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string; }

// Omit<T, K>: 특정 속성 제외
type UserWithoutEmail = Omit<User, "email">;
// { id: number; name: string; age: number; }

// Record<K, T>: 키-값 매핑
type UserRoles = Record<"admin" | "user" | "guest", string[]>;

const roles: UserRoles = {
  admin: ["read", "write", "delete"],
  user: ["read", "write"],
  guest: ["read"]
};

// 실전 패턴: API 요청/응답 타입
type CreateUserRequest = Omit<User, "id">; // id 제외
type UpdateUserRequest = Partial<Omit<User, "id">>; // id 제외 + 선택적

async function createUser(data: CreateUserRequest): Promise<User> {
  // 구현
  return { id: 1, ...data };
}

async function updateUser(id: number, data: UpdateUserRequest): Promise<User> {
  // 구현
  return { id, name: "", email: "", age: 0, ...data };
}
```

---

## 5. 모듈 시스템

### 5.1 ES Modules (import/export)

```typescript
// math.ts (export)
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export const PI = 3.14159;

// 기본 export
export default function multiply(a: number, b: number): number {
  return a * b;
}

// main.ts (import)
import multiply from './math'; // 기본 import
import { add, subtract, PI } from './math'; // named import
import * as math from './math'; // 전체 import

console.log(add(1, 2)); // 3
console.log(math.PI); // 3.14159
console.log(multiply(2, 3)); // 6

// 별칭 사용
import { add as sum } from './math';
console.log(sum(1, 2)); // 3

// 재수출 (re-export)
// index.ts
export { add, subtract } from './math';
export { default as multiply } from './math';

// 실전 패턴: 타입 전용 import (TypeScript)
import type { User } from './types';

// 동적 import
async function loadModule() {
  const module = await import('./heavy-module');
  module.heavyFunction();
}
```

---

### 5.2 CommonJS (Node.js)

```javascript
// math.js (export)
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

module.exports = {
  add,
  subtract,
  PI: 3.14159
};

// 또는
exports.add = add;
exports.subtract = subtract;

// main.js (import)
const math = require('./math');
const { add, subtract } = require('./math');

console.log(add(1, 2)); // 3
console.log(math.PI); // 3.14159
```

**실전 가이드**:
- 모던 프로젝트는 ES Modules 사용
- Node.js에서 ES Modules 사용 시 `package.json`에 `"type": "module"` 추가
- TypeScript는 `tsconfig.json`에서 `"module": "esnext"` 또는 `"commonjs"` 설정

---

## 6. 트러블슈팅

### 6.1 타입 에러 해결

**문제**: `Type 'string | undefined' is not assignable to type 'string'`

```typescript
// ❌ 에러 발생
interface User {
  name?: string;
}

const user: User = {};
const upperName: string = user.name.toUpperCase(); // Type error!

// ✅ 해결 1: Optional chaining + Nullish coalescing
const upperName = user.name?.toUpperCase() ?? "Unknown";

// ✅ 해결 2: 타입 가드
if (user.name) {
  const upperName: string = user.name.toUpperCase();
}

// ✅ 해결 3: Non-null assertion (확실한 경우만)
const upperName: string = user.name!.toUpperCase();
```

---

### 6.2 async/await 에러 핸들링

**문제**: Promise rejection이 처리되지 않음

```typescript
// ❌ Unhandled promise rejection
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}

fetchData(); // 에러 발생 시 처리되지 않음

// ✅ 해결: try/catch 또는 .catch()
async function fetchDataSafe() {
  try {
    const response = await fetch('/api/data');
    return response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

// 또는
fetchData().catch(error => {
  console.error('Fetch error:', error);
});
```

---

### 6.3 this 바인딩 문제

**문제**: 메서드 내에서 `this`가 `undefined`

```typescript
class Counter {
  count = 0;

  // ❌ 전통적 메서드
  increment() {
    this.count++;
  }
}

const counter = new Counter();
const incrementFn = counter.increment;
incrementFn(); // TypeError: Cannot read property 'count' of undefined

// ✅ 해결 1: Arrow function
class Counter {
  count = 0;

  increment = () => {
    this.count++;
  };
}

// ✅ 해결 2: bind
const incrementFn = counter.increment.bind(counter);
```

---

## 7. 프로젝트 적용

### 7.1 video-editor 프로젝트

```typescript
// src/types/video.ts
export interface VideoFile {
  id: string;
  filename: string;
  path: string;
  duration: number;
  metadata: {
    width: number;
    height: number;
    codec: string;
  };
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "error";

export interface ProcessingJob {
  id: string;
  videoId: string;
  status: ProcessingStatus;
  progress: number;
  error?: string;
}

// src/services/video.service.ts
export class VideoService {
  async uploadVideo(file: Express.Multer.File): Promise<VideoFile> {
    const metadata = await this.extractMetadata(file.path);

    return {
      id: generateId(),
      filename: file.originalname,
      path: file.path,
      duration: metadata.duration,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        codec: metadata.codec
      }
    };
  }

  private async extractMetadata(path: string) {
    // ffprobe 실행
    return { duration: 0, width: 0, height: 0, codec: "" };
  }
}
```

---

### 7.2 backend/node.js (NestJS)

```typescript
// src/users/entities/user.entity.ts
export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  Admin = "ADMIN",
  Manager = "MANAGER",
  Member = "MEMBER"
}

// src/users/dto/create-user.dto.ts
export class CreateUserDto {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
}

// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        role: dto.role ?? UserRole.Member
      }
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private async hashPassword(password: string): Promise<string> {
    // bcrypt 해싱
    return password;
  }
}
```

---

### 7.3 game-server (C++ with TypeScript client)

```typescript
// client/src/types/game.ts
export interface Player {
  id: string;
  name: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  health: number;
}

export interface GameState {
  players: Record<string, Player>;
  timestamp: number;
  sequenceNumber: number;
}

export type InputAction = "move_up" | "move_down" | "move_left" | "move_right" | "jump";

export interface InputPayload {
  action: InputAction;
  timestamp: number;
}

// client/src/network/client.ts
export class GameClient {
  private ws: WebSocket;
  private localPlayer: Player | null = null;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("Connected to game server");
        resolve();
      };

      this.ws.onmessage = (event) => {
        const state: GameState = JSON.parse(event.data);
        this.handleGameState(state);
      };

      this.ws.onerror = (error) => {
        reject(error);
      };
    });
  }

  sendInput(action: InputAction): void {
    const payload: InputPayload = {
      action,
      timestamp: Date.now()
    };
    this.ws.send(JSON.stringify(payload));
  }

  private handleGameState(state: GameState): void {
    // 게임 상태 업데이트
    Object.values(state.players).forEach(player => {
      this.renderPlayer(player);
    });
  }

  private renderPlayer(player: Player): void {
    // 렌더링 로직
  }
}
```

---

## 면접 질문

### 1. `const`, `let`, `var`의 차이는?
**답변**: `var`는 함수 스코프, `const`/`let`은 블록 스코프입니다. `const`는 재할당 불가능하지만 객체/배열 내부는 변경 가능합니다. 호이스팅 동작도 다릅니다.

### 2. Promise와 async/await의 차이는?
**답변**: `async/await`는 Promise를 기반으로 한 문법 설탕입니다. 비동기 코드를 동기 코드처럼 작성할 수 있어 가독성이 높습니다. `try/catch`로 에러 핸들링이 가능합니다.

### 3. TypeScript의 장점은?
**답변**: 정적 타입 검사로 런타임 에러를 컴파일 시점에 발견할 수 있습니다. IDE 자동완성, 리팩토링이 쉽고, 대규모 프로젝트에서 유지보수성이 높습니다.

### 4. `interface`와 `type`의 차이는?
**답변**: `interface`는 확장(extends) 가능하고 선언 병합이 됩니다. `type`은 유니온/인터섹션 등 더 복잡한 타입 표현이 가능합니다. 객체 구조는 `interface`, 유니온/원시 타입은 `type`을 주로 사용합니다.

### 5. 제네릭은 언제 사용하나요?
**답변**: 타입을 매개변수화하여 재사용 가능한 컴포넌트를 만들 때 사용합니다. 예를 들어 API 응답 래퍼, 배열 유틸리티 함수 등에서 타입 안전성을 유지하면서 다양한 타입을 지원할 수 있습니다.

---

## 다음 단계

✅ **T01 완료 후**:
- Node.js 백엔드 → [T02: Node HTTP + ffmpeg](./T02-node-http-ffmpeg.md) 또는 [T03: NestJS](./T03-nest-bootstrap.md)
- React 프론트 → [T06: React/Vite 기본](./T06-react-vite-basics.md)
- C++ 게임 서버 → [T10: C++ 기초](./T10-cpp-basics.md), [T11: Modern C++17](./T11-cpp-raii-tcp.md)

---

## 8. 공통 오류와 해결

- **TypeScript 컴파일 에러**: 타입 미지정 → 명시적 타입 추가.
- **Promise 체이닝**: 중첩 콜백 → async/await 사용.
- **스코프 혼동**: var 사용 → const/let으로 변경.
- **모듈 import**: 경로 틀림 → 절대/상대 경로 확인.
- **제네릭 오버헤드**: 불필요한 복잡성 → 간단한 타입으로 시작.

---

## 9. 퀴즈 및 다음 단계

**퀴즈**:
1. const와 let 차이? (재할당 가능성)
2. Promise.all? (병렬 실행)
3. interface vs type? (확장성 vs 유연성)
4. 제네릭 예시? (Array<T>)
5. Arrow function의 this 바인딩 특징?
6. Destructuring의 주요 장점?
7. Spread operator의 용도?
8. Template literals의 특징?
9. async/await의 장점?
10. Type narrowing의 예시?

**완료 조건**: 프로젝트 적용 코드 실행, 퀴즈 80% 정답.

**다음**: T02/T03/T06 선택!

---

## 10. 추가 리소스

### 공식 문서
- [MDN JavaScript](https://developer.mozilla.org/ko/docs/Web/JavaScript): JS 레퍼런스.
- [TypeScript Handbook](https://www.typescriptlang.org/docs/): TS 공식 가이드.
- [Node.js Docs](https://nodejs.org/en/docs/): Node.js 공식 문서.

### 튜토리얼
- [JavaScript.info](https://ko.javascript.info/): 무료 JS 튜토리얼 (한글).
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/): 심화 TS.
- [Eloquent JavaScript](https://eloquentjavascript.net/): 무료 책 (영문).

### 비디오
- [Traversy Media JS/TS](https://www.youtube.com/c/TraversyMedia): YouTube 시리즈.
- [Academind TS](https://www.youtube.com/c/Academind): TS 코스.
- [freeCodeCamp JS](https://www.youtube.com/watch?v=PkZNo7MFNFg): 무료 JS 코스.

### 실습 플랫폼
- [LeetCode](https://leetcode.com/): 알고리즘 문제 풀이.
- [CodeSandbox](https://codesandbox.io/): 온라인 코드 에디터.
- [TypeScript Playground](https://www.typescriptlang.org/play): TS 실험.

### 커뮤니티
- [Stack Overflow JS/TS](https://stackoverflow.com/questions/tagged/javascript+typescript): Q&A.
- [Reddit r/javascript](https://www.reddit.com/r/javascript/): JS 커뮤니티.
- [Dev.to](https://dev.to/): 개발자 블로그.

---

**튜토리얼 완료 체크리스트**:
- [ ] ES6+ 문법 이해
  - [ ] const/let과 블록 스코프
  - [ ] Arrow function과 this 바인딩
  - [ ] Destructuring (구조 분해 할당)
  - [ ] Spread/Rest Operator
  - [ ] Template Literals
- [ ] Promise와 async/await
  - [ ] Promise 기본 사용
  - [ ] async/await 문법
  - [ ] 에러 핸들링
- [ ] TypeScript 타입 시스템
  - [ ] 기본 타입 (string, number, boolean 등)
  - [ ] 인터페이스와 타입 별칭
  - [ ] 유니온과 인터섹션 타입
- [ ] 고급 타입 패턴
  - [ ] 제네릭
  - [ ] 타입 좁히기
  - [ ] 유틸리티 타입 (Partial, Pick, Omit 등)
- [ ] 모듈 시스템
  - [ ] ES Modules import/export
  - [ ] CommonJS require/module.exports
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 프로젝트 적용
  - [ ] 실전 코드 작성
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: _____
