# 글 4 — Express + child_process로 FFmpeg 연동: “HTTP 요청 → Node → FFmpeg → 응답” 최소 구현

목표는 단순하다.
**Express로 HTTP 요청을 받고 → ffmpeg를 외부 프로세스로 실행해서 → 결과를 파일/버퍼로 돌려주는 흐름을 직접 만들 수 있게 하는 것.**

불필요한 이론은 제외하고, 서버 코드에서 실전으로 쓰는 패턴만 정리한다.

---

# 1. Express 기본 라우팅 패턴

프로젝트 준비:

```bash
npm init -y
npm install express multer
```

가장 단순한 Express 서버:

```js
const express = require('express');
const app = express();

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(3000, () => console.log('server started'));
```

실행:

```bash
node app.js
```

브라우저에서 `http://localhost:3000/ping` 접속 → "pong"

---

# 2. GET / POST 라우팅 + req / res 활용

### GET 파라미터 읽기

```
GET /sum?a=10&b=20
```

```js
app.get('/sum', (req, res) => {
  const { a, b } = req.query;
  res.json({ result: Number(a) + Number(b) });
});
```

### POST JSON 바디 읽기

Express 4.16+는 body-parser가 내장되어 있다.

```js
app.use(express.json());

app.post('/echo', (req, res) => {
  res.json({ youSent: req.body });
});
```

핵심:

* `req.query` → GET 쿼리 파라미터
* `req.body` → JSON 바디
* `req.headers` → 헤더
* `req.params` → URL 파라미터(`/user/:id` 같은 경우)

---

# 3. 미들웨어 + 에러 핸들러

Express 미들웨어는 “(req, res, next)” 서명.

```js
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});
```

### 에러 핸들러 (서명에 **err** 포함)

```js
app.use((err, req, res, next) => {
  console.error('ERR:', err);
  res.status(500).json({ error: err.message });
});
```

이 패턴은 ffmpeg 처리 도중 예외가 발생했을 때 필요하다.

---

# 4. 파일 업로드: multer로 단일 파일 받기

```js
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // 임시 저장 경로
```

단일 파일 받기:

```js
app.post('/upload', upload.single('video'), (req, res) => {
  console.log(req.file); // { path: 'uploads/xxxx', originalname: '...' }
  res.json({ ok: true });
});
```

폼에서 `video`라는 필드명으로 전송해야 한다.

여기까지는 ffmpeg와 연결 가능해진 상태.

---

# 5. child_process.spawn 기본 사용

Node에서 외부 프로그램 실행 핵심은 `spawn`.

```js
const { spawn } = require('child_process');

const proc = spawn('ffmpeg', ['-i', 'in.mp4', 'out.mp4']);
```

### 로그 읽기

```js
proc.stdout.on('data', (chunk) => {
  console.log(`stdout: ${chunk}`);
});

proc.stderr.on('data', (chunk) => {
  console.error(`stderr: ${chunk}`);
});
```

ffmpeg는 대부분 로그를 **stderr**로 출력한다. stdout은 거의 안 쓴다.

### 종료 코드 확인

```js
proc.on('close', (code) => {
  console.log('ffmpeg exit:', code);
});
```

* `0`이면 성공
* 그 외는 실패

에러 처리 필수:

```js
proc.on('error', (err) => {
  console.error('spawn error:', err);
});
```

---

# 6. Express + spawn으로 “영상 → 썸네일” 만들기

**전체 플로우**

1. 사용자가 영상 업로드
2. 서버가 uploads/ 폴더에 임시 저장
3. ffmpeg 실행해서 thumb.jpg 생성
4. 생성된 파일을 클라이언트로 반환

### 예시 코드(app.js)

```js
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/thumbnail', upload.single('video'), (req, res, next) => {
  const input = req.file.path;
  const output = `${input}.jpg`;

  const args = [
    '-ss', '3',
    '-i', input,
    '-frames:v', '1',
    output,
  ];

  const proc = spawn('ffmpeg', args);

  proc.stderr.on('data', (chunk) => {
    console.log(`ffmpeg: ${chunk}`);
  });

  proc.on('error', (err) => {
    return next(err);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      return next(new Error(`ffmpeg failed with code ${code}`));
    }

    // 결과 파일 전송
    fs.readFile(output, (err, buf) => {
      if (err) return next(err);

      res.setHeader('Content-Type', 'image/jpeg');
      res.send(buf);

      // 임시 파일 정리
      fs.unlink(input, () => {});
      fs.unlink(output, () => {});
    });
  });
});

app.use((err, req, res, next) => {
  console.error('ERR:', err);
  res.status(500).json({ error: err.message });
});

app.listen(3000, () => console.log('server started'));
```

### 핵심 포인트

* `upload.single('video')` → `req.file.path`에 임시 파일이 생긴다.
* spawn 인자는 배열로 넘긴다:

  ```js
  spawn('ffmpeg', ['-ss', '3', '-i', input, ...])
  ```
* 로그는 `stderr`에서 읽어야 한다.
* 종료 코드 체크 필수.
* 작업 성공하면 파일 읽어서 바로 응답.
* 업로드 + 결과 파일 모두 지워서 누적 방지.

---

# 7. “출력 파일 없이 pipe로 받기” (조금 고급)

파일을 디스크에 쓰지 않고, ffmpeg 결과를 바로 메모리로 받고 싶을 때:

```
ffmpeg -i in.mp4 -f mjpeg -
```

뒤의 `-` = stdout으로 내보내기.

Node에서:

```js
const proc = spawn('ffmpeg', [
  '-i', input,
  '-f', 'mjpeg',
  '-'
]);

let chunks = [];

proc.stdout.on('data', (c) => chunks.push(c));

proc.on('close', (code) => {
  if (code !== 0) return next(new Error('ffmpeg fail'));
  const buf = Buffer.concat(chunks);
  res.setHeader('Content-Type', 'image/jpeg');
  res.send(buf);
});
```

* 디스크 접근 없이 빠르다.
* 영상 길거나 고해상도면 메모리 부담이 생길 수 있음.

---

# 8. 타임아웃 처리 (spawn은 반드시 필요)

ffmpeg가 멈추거나 입력이 이상하면 서버가 영원히 대기한다. 방지 필수.

```js
const timer = setTimeout(() => {
  proc.kill('SIGKILL');
}, 10_000); // 10초

proc.on('close', (code) => {
  clearTimeout(timer);
  // ...
});
```

실무에서 놓치기 쉬운 부분이지만 필수 패턴이다.

---

# 9. 실전 Express + FFmpeg 서버 구성 요약

최소한 다음 조합만 기억하면 된다:

1. **Express 라우팅**

   * `app.get`, `app.post`, `req.query`, `req.body`, `req.file`

2. **Multer 업로드**

   * 이미지를/영상을 임시 파일로 받는다

3. **child_process.spawn**

   * 인자 배열로 ffmpeg 호출
   * stderr 로그 출력
   * 종료 코드 체크
   * 에러/타임아웃 처리

4. **결과 반환**

   * 파일 읽어서 res.send
   * 또는 ffmpeg stdout을 직접 pipe

5. **임시 파일 정리**

   * `fs.unlink`로 업로드/출력 파일 제거

이게 되면 “Node → 외부 도구 조합해서 기능 만들기” 전체 그림을 스스로 조립할 수 있게 된다.
이후에는 구간 추출, 해상도 변경, 포맷 변환 등 ffmpeg 명령만 바꿔서 기능을 확장하면 된다.
