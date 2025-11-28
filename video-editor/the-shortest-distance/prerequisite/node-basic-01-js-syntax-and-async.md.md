# 글 3 — JavaScript / Node 기초: 서버 코드 읽기 전에 꼭 알아야 할 최소 문법

목표:
**“Node로 된 간단한 스크립트/서버 코드를 읽고, 직접 돌리고, 조금 고칠 수 있는 상태”** 만들기.
프론트 지식은 필요 없다고 보고, **Node 기준**으로만 설명한다.

---

## 1. Node로 JS 실행하는 기본

파일 하나 만든다고 치자: `app.js`

```js
console.log('hello node');
```

터미널에서:

```bash
node app.js
```

* 여기까지 되면 “Node로 JS 돌릴 수 있는 상태”는 된 거다.

---

## 2. `let`, `const` 기본

옛날 JS는 `var`만 있었는데, 지금은 거의 `let`, `const`만 쓴다고 보면 된다.

```js
let count = 0;      // 값 변경 가능
const PI = 3.14;    // 재할당 불가

count = count + 1;  // OK
// PI = 3.15;       // 에러
```

* `const`는 “변수 바인딩 재할당 불가”지, 객체 내부 값 불변은 아니다.

```js
const user = { name: 'kim' };
user.name = 'park'; // 이건 됨 (객체 안의 프로퍼티 변경)
```

---

## 3. 함수 & 화살표 함수(arrow function)

### 기본 함수 선언

```js
function add(a, b) {
  return a + b;
}

const sum = add(1, 2); // 3
```

### 화살표 함수

```js
const add = (a, b) => {
  return a + b;
};

const mul = (a, b) => a * b; // 한 줄이면 return 생략 가능
```

실무에서 자주 보는 패턴:

```js
const log = (msg) => {
  console.log(msg);
};
```

여기서는 `this` 차이 같은 건 신경 안 써도 된다.
서버 코드에서 초반에 보는 화살표 함수는 대부분 콜백/핸들러용이다.

---

## 4. 객체 / 배열 기본

### 객체 literal

```js
const user = {
  id: 1,
  name: 'kim',
};

console.log(user.name);   // 'kim'
console.log(user['id']);  // 1

user.age = 30;            // 필드 추가
```

### 배열 literal

```js
const nums = [10, 20, 30];

console.log(nums[0]);     // 10
console.log(nums.length); // 3

nums.push(40);            // [10, 20, 30, 40]
```

### JSON과 거의 동일

Node에서 자주 쓰는 JSON 변환:

```js
const obj = { a: 1, b: 2 };

const jsonStr = JSON.stringify(obj); // 객체 -> JSON 문자열
const parsed = JSON.parse(jsonStr);  // JSON 문자열 -> 객체
```

---

## 5. 구조분해 할당(destructuring) / 스프레드(spread)

### 객체 구조분해

```js
const user = { id: 1, name: 'kim', age: 30 };

const { id, name } = user;

console.log(id);   // 1
console.log(name); // 'kim'
```

* 서버 코드에서 파라미터 뽑을 때 많이 나온다.

```js
const config = { host: 'localhost', port: 3000 };

function startServer({ host, port }) {
  console.log(`listen on ${host}:${port}`);
}

startServer(config);
```

### 배열 구조분해

```js
const arr = [10, 20, 30];
const [a, b] = arr;

console.log(a); // 10
console.log(b); // 20
```

### 스프레드(`...`)

객체:

```js
const base = { a: 1, b: 2 };
const extra = { b: 3, c: 4 };

const merged = { ...base, ...extra };
// { a: 1, b: 3, c: 4 }
```

배열:

```js
const a1 = [1, 2];
const a2 = [3, 4];

const all = [...a1, ...a2]; // [1, 2, 3, 4]
```

---

## 6. Promise 기본

비동기 작업을 표현하는 객체.

가장 단순한 예시:

```js
const p = new Promise((resolve, reject) => {
  setTimeout(() => {
    const ok = true;
    if (ok) {
      resolve('success');
    } else {
      reject(new Error('fail'));
    }
  }, 1000);
});

p.then((result) => {
  console.log('result:', result);
}).catch((err) => {
  console.error('err:', err);
});
```

패턴만 보면 된다:

* `new Promise((resolve, reject) => { ... })`
* 성공: `resolve(value)`
* 실패: `reject(error)`
* 소비: `promise.then(...).catch(...)`

실제 Node 코드에서 I/O 함수가 Promise를 반환하면 이런 식으로 이어 쓴다.

---

## 7. `async/await` 기본

`then/catch` 체인이 길어지면 코드가 지저분해진다.
`async/await`는 Promise를 **동기 코드처럼** 보이게 만든다.

### 예시: Promise 반환 함수

```js
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(ms), ms);
  });
}
```

### `async/await`로 사용

```js
async function run() {
  console.log('start');
  const t = await delay(1000); // 1초 대기
  console.log('after', t, 'ms');
}

run().catch((err) => {
  console.error(err);
});
```

패턴:

* 함수 선언 앞에 `async` 붙인다.
* Promise를 반환하는 함수 호출 앞에 `await` 사용.
* 예외 처리는 `try/catch`로 감싼다.

```js
async function main() {
  try {
    const r = await delay(500);
    console.log(r);
  } catch (err) {
    console.error('error:', err);
  }
}
```

실무 Express 코드에서도:

```js
app.get('/api', async (req, res, next) => {
  try {
    const data = await service.getData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
```

이 패턴을 계속 쓰게 된다.

---

## 8. `npm init`, `npm install`, `node app.js`

Node 프로젝트 초기화 흐름만 알면 된다.

### 1) 새 디렉터리 만들고 진입 (이 부분은 이미 안다고 가정)

### 2) `npm init`

```bash
npm init -y
```

* `package.json` 생성
* 프로젝트 메타데이터/의존성 관리 파일

### 3) 라이브러리 설치

예: HTTP 호출용 `axios` 설치

```bash
npm install axios
```

그러면 `package.json`에 `dependencies`가 추가되고,
`node_modules/` 디렉터리가 생긴다.

### 4) 코드에서 사용 (CommonJS 기준)

`app.js`:

```js
const axios = require('axios');

async function main() {
  const res = await axios.get('https://example.com');
  console.log(res.status);
  console.log(res.data);
}

main().catch((err) => {
  console.error(err);
});
```

실행:

```bash
node app.js
```

---

## 9. 아주 간단한 CLI 스크립트 예시

**목표**:

* 인자를 받아서
* HTTP GET을 날리고
* 상태코드만 출력

`cli.js`:

```js
const axios = require('axios');

async function main() {
  const args = process.argv.slice(2); // ['https://...']
  const url = args[0];

  if (!url) {
    console.error('Usage: node cli.js <url>');
    process.exit(1);
  }

  try {
    const res = await axios.get(url);
    console.log('Status:', res.status);
  } catch (err) {
    console.error('Request failed:', err.message);
    process.exit(1);
  }
}

main();
```

실행:

```bash
node cli.js https://example.com
```

이 정도면:

* `process.argv`로 인자 받는 법
* `require`로 모듈 불러오는 법
* `async/await` + `try/catch` 패턴
* `process.exit(code)` 사용

전부 한 번에 본다.

---

## 10. 정리

JS/Node 코드 읽을 때 최소로 필요한 건 이 정도다:

1. **`let` / `const`** – 재할당 가능/불가, 객체는 참조라 내부 값은 바뀔 수 있음
2. **화살표 함수** – `const fn = () => {}` 형태
3. **객체/배열 literal** – `{}`, `[]`, `.` / `[]`로 접근
4. **구조분해 / 스프레드** – 파라미터 뽑기, 옵션 병합할 때 매일 나옴
5. **Promise / async/await** – 비동기 흐름은 거의 이 조합
6. **npm init / npm install / node app.js** – 프로젝트 초기화·의존성·실행 패턴

여기까지 잡히면, 다음 글(Express + `child_process` + ffmpeg)에서 나오는 코드들을 “문법 때문에 막히는 구간 없이” 볼 수 있다.
