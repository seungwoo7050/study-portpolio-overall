# T02: Node.js HTTP + ffmpeg CLI

> **목표**: Node.js로 파일 업로드 서버 구축 및 ffmpeg CLI 명령어 실행
> **예상 시간**: 6-8시간 (주 3-4시간)
> **난이도**: 🟢 기초
> **선행 요구사항**: [T01: JS/TS 코어](./T01-js-ts-core.md)
> **적용 프로젝트**: video-editor v1.0-v1.2
> **퀄리티 보장**: 실행 서버, ffmpeg 통합, 에러 핸들링
> **효율성 보장**: 핵심 모듈만, 실습 프로젝트, 트러블슈팅

---

## 목차

1. [Node.js 코어 모듈](#1-nodejs-코어-모듈)
2. [HTTP 서버 구축](#2-http-서버-구축)
3. [파일 업로드 처리](#3-파일-업로드-처리)
4. [ffmpeg CLI 기초](#4-ffmpeg-cli-기초)
5. [프로세스 관리](#5-프로세스-관리)
6. [트러블슈팅](#6-트러블슈팅)
7. [프로젝트 적용](#7-프로젝트-적용)
8. [공통 오류와 해결](#8-공통-오류와-해결)
9. [퀴즈 및 다음 단계](#9-퀴즈-및-다음-단계)
10. [추가 리소스](#10-추가-리소스)

---

## 1. Node.js 코어 모듈

### 1.1 fs (File System)

**개념**:
- 파일 시스템 작업을 위한 모듈
- 동기/비동기 API 제공 (비동기 우선 사용)

```typescript
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';

// 파일 읽기 (비동기 Promise)
async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('File read error:', error);
    throw error;
  }
}

// 파일 쓰기
async function writeFile(filePath: string, content: string): Promise<void> {
  await fsPromises.writeFile(filePath, content, 'utf-8');
}

// 파일 존재 확인
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// 디렉터리 생성 (재귀적)
async function ensureDir(dirPath: string): Promise<void> {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

// 파일 삭제
async function deleteFile(filePath: string): Promise<void> {
  await fsPromises.unlink(filePath);
}

// 디렉터리 내 파일 목록
async function listFiles(dirPath: string): Promise<string[]> {
  const files = await fsPromises.readdir(dirPath);
  return files;
}

// 파일 정보 (크기, 수정 시간 등)
async function getFileInfo(filePath: string) {
  const stats = await fsPromises.stat(filePath);
  return {
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory()
  };
}

// 실전 패턴: 임시 파일 생성
import { randomUUID } from 'crypto';

async function createTempFile(ext: string = '.tmp'): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'tmp');
  await ensureDir(tmpDir);

  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(tmpDir, filename);

  await fsPromises.writeFile(filePath, '');
  return filePath;
}

// Stream API (대용량 파일)
import { createReadStream, createWriteStream } from 'fs';

function copyFileLarge(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(src);
    const writeStream = createWriteStream(dest);

    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);

    readStream.pipe(writeStream);
  });
}
```

**실전 가이드**:
- 비동기 API(`fs.promises` 또는 `fs/promises`) 사용
- 대용량 파일은 Stream API 사용
- 경로 조작은 `path` 모듈 사용 (OS 독립적)

---

### 1.2 path (경로 조작)

```typescript
import path from 'path';

// 경로 결합 (OS 독립적)
const filePath = path.join('uploads', 'videos', 'file.mp4');
// macOS/Linux: 'uploads/videos/file.mp4'
// Windows: 'uploads\\videos\\file.mp4'

// 절대 경로 생성
const absolutePath = path.resolve('uploads', 'file.mp4');
// /Users/user/project/uploads/file.mp4

// 경로 정보 추출
const parsed = path.parse('/uploads/videos/file.mp4');
console.log(parsed);
// {
//   root: '/',
//   dir: '/uploads/videos',
//   base: 'file.mp4',
//   ext: '.mp4',
//   name: 'file'
// }

// 확장자 추출
const ext = path.extname('file.mp4'); // '.mp4'

// 파일명 (확장자 제외)
const name = path.basename('file.mp4', '.mp4'); // 'file'

// 디렉터리 경로
const dir = path.dirname('/uploads/videos/file.mp4'); // '/uploads/videos'

// 상대 경로 계산
const relative = path.relative('/uploads/videos', '/uploads/images/photo.jpg');
// '../images/photo.jpg'

// 실전 패턴: 안전한 파일명 생성
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
}

function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  const sanitized = sanitizeFilename(nameWithoutExt);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return `${sanitized}_${timestamp}_${random}${ext}`;
}
```

---

### 1.3 child_process (프로세스 실행)

**개념**:
- 외부 명령어(ffmpeg, ffprobe 등)를 실행

```typescript
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// exec: 간단한 명령어 실행 (버퍼에 출력 저장)
async function runCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      console.error('stderr:', stderr);
    }
    return stdout;
  } catch (error) {
    console.error('Command execution error:', error);
    throw error;
  }
}

// 예제: 파일 목록
async function listFilesWithExec(): Promise<string> {
  const output = await runCommand('ls -la');
  return output;
}

// spawn: 스트리밍 출력, 대용량 데이터
function runCommandWithSpawn(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

// 실전 패턴: 진행률 추적
interface ProgressCallback {
  (progress: number): void;
}

function runWithProgress(
  command: string,
  args: string[],
  onProgress?: ProgressCallback
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);

    process.stderr.on('data', (data) => {
      const output = data.toString();

      // ffmpeg 진행률 파싱 예제
      const match = output.match(/time=(\d+:\d+:\d+\.\d+)/);
      if (match && onProgress) {
        const time = match[1];
        // 시간을 초로 변환하여 진행률 계산
        const progress = parseTimeToSeconds(time);
        onProgress(progress);
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      } else {
        resolve();
      }
    });

    process.on('error', reject);
  });
}

function parseTimeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
}
```

---

## 2. HTTP 서버 구축

### 2.1 Express 기본

```typescript
import express, { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = 3000;

// 미들웨어: JSON 파싱
app.use(express.json());

// 미들웨어: URL-encoded 파싱
app.use(express.urlencoded({ extended: true }));

// 미들웨어: CORS
import cors from 'cors';
app.use(cors());

// 미들웨어: 로깅
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 라우트: GET
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 라우트: POST
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // 사용자 생성 로직
  const user = { id: 1, name, email };

  res.status(201).json(user);
});

// 라우트: 경로 매개변수
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  // 사용자 조회 로직
  const user = { id: parseInt(id), name: 'Alice' };

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// 라우트: 쿼리 매개변수
app.get('/api/search', (req, res) => {
  const { q, limit = '10' } = req.query;

  res.json({
    query: q,
    limit: parseInt(limit as string),
    results: []
  });
});

// 에러 핸들링 미들웨어
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
```

---

### 2.2 Fastify (대안, 더 빠름)

```typescript
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// 라우트 정의
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() };
});

fastify.post<{ Body: { name: string; email: string } }>(
  '/api/users',
  async (request, reply) => {
    const { name, email } = request.body;

    if (!name || !email) {
      reply.code(400);
      return { error: 'Name and email are required' };
    }

    const user = { id: 1, name, email };
    reply.code(201);
    return user;
  }
);

// 서버 시작
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Server is running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

---

## 3. 파일 업로드 처리

### 3.1 multer (Express 미들웨어)

```typescript
import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';

const app = express();

// 저장소 설정
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = generateUniqueFilename(file.originalname);
    cb(null, uniqueName);
  }
});

// 파일 필터 (확장자 검증)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExts = ['.mp4', '.avi', '.mov', '.mkv'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${ext}. Allowed: ${allowedExts.join(', ')}`));
  }
};

// multer 인스턴스
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  }
});

// 단일 파일 업로드
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    path: req.file.path,
    mimetype: req.file.mimetype
  };

  res.json({
    message: 'File uploaded successfully',
    file: fileInfo
  });
});

// 다중 파일 업로드
app.post('/api/upload-multiple', upload.array('videos', 10), async (req, res) => {
  if (!req.files || !Array.isArray(req.files)) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const filesInfo = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size
  }));

  res.json({
    message: `${filesInfo.length} files uploaded successfully`,
    files: filesInfo
  });
});

// 에러 핸들링
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 500MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    }
  }

  res.status(500).json({ error: err.message });
});
```

---

### 3.2 파일 업로드 진행률 추적

```typescript
import { Request, Response } from 'express';
import busboy from 'busboy';
import fs from 'fs';
import path from 'path';

app.post('/api/upload-with-progress', (req: Request, res: Response) => {
  const bb = busboy({ headers: req.headers });

  let uploadedBytes = 0;
  let totalBytes = 0;

  bb.on('file', (fieldname, file, info) => {
    const { filename, encoding, mimeType } = info;
    const savePath = path.join('uploads', generateUniqueFilename(filename));

    totalBytes = parseInt(req.headers['content-length'] || '0');

    const writeStream = fs.createWriteStream(savePath);

    file.on('data', (data) => {
      uploadedBytes += data.length;
      const progress = Math.round((uploadedBytes / totalBytes) * 100);

      // WebSocket 또는 Server-Sent Events로 진행률 전송
      console.log(`Upload progress: ${progress}%`);
    });

    file.pipe(writeStream);

    writeStream.on('finish', () => {
      console.log(`File ${filename} uploaded`);
    });
  });

  bb.on('finish', () => {
    res.json({ message: 'Upload complete' });
  });

  req.pipe(bb);
});
```

---

## 4. ffmpeg CLI 기초

### 4.1 ffprobe (메타데이터 추출)

```typescript
import { spawn } from 'child_process';

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
}

async function extractMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration,bit_rate:stream=width,height,codec_name,r_frame_rate',
      '-of', 'json',
      videoPath
    ];

    const process = spawn('ffprobe', args);

    let stdout = '';
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('ffprobe failed'));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const stream = data.streams[0];
        const format = data.format;

        resolve({
          duration: parseFloat(format.duration),
          width: stream.width,
          height: stream.height,
          codec: stream.codec_name,
          bitrate: parseInt(format.bit_rate),
          fps: eval(stream.r_frame_rate) // "30/1" -> 30
        });
      } catch (error) {
        reject(error);
      }
    });

    process.on('error', reject);
  });
}
```

---

### 4.2 ffmpeg 기본 명령어

**Trim (특정 구간 자르기)**:

```typescript
interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTime: number; // 초
  duration: number;  // 초
}

async function trimVideo(options: TrimOptions): Promise<void> {
  const { inputPath, outputPath, startTime, duration } = options;

  const args = [
    '-ss', startTime.toString(),
    '-i', inputPath,
    '-t', duration.toString(),
    '-c', 'copy', // 재인코딩 없이 복사 (빠름)
    '-avoid_negative_ts', 'make_zero',
    outputPath
  ];

  await runCommandWithSpawn('ffmpeg', args);
}

// 사용 예제
await trimVideo({
  inputPath: 'input.mp4',
  outputPath: 'output.mp4',
  startTime: 10,  // 10초부터
  duration: 30    // 30초 동안
});
```

**Split (여러 구간으로 분할)**:

```typescript
interface SplitSegment {
  startTime: number;
  duration: number;
  outputPath: string;
}

async function splitVideo(
  inputPath: string,
  segments: SplitSegment[]
): Promise<void> {
  const promises = segments.map(segment =>
    trimVideo({
      inputPath,
      outputPath: segment.outputPath,
      startTime: segment.startTime,
      duration: segment.duration
    })
  );

  await Promise.all(promises);
}

// 사용 예제
await splitVideo('input.mp4', [
  { startTime: 0, duration: 10, outputPath: 'part1.mp4' },
  { startTime: 10, duration: 10, outputPath: 'part2.mp4' },
  { startTime: 20, duration: 10, outputPath: 'part3.mp4' }
]);
```

**속도 조절 (Speed up/down)**:

```typescript
interface SpeedOptions {
  inputPath: string;
  outputPath: string;
  speed: number; // 0.5 = 0.5배속, 2.0 = 2배속
}

async function changeSpeed(options: SpeedOptions): Promise<void> {
  const { inputPath, outputPath, speed } = options;

  const videoFilter = `setpts=${1 / speed}*PTS`;
  const audioFilter = `atempo=${speed}`;

  const args = [
    '-i', inputPath,
    '-filter:v', videoFilter,
    '-filter:a', audioFilter,
    '-c:v', 'libx264',
    '-preset', 'fast',
    outputPath
  ];

  await runCommandWithSpawn('ffmpeg', args);
}

// 사용 예제
await changeSpeed({
  inputPath: 'input.mp4',
  outputPath: 'output_2x.mp4',
  speed: 2.0 // 2배속
});
```

**자막 추가 (Subtitles)**:

```typescript
interface SubtitleOptions {
  inputPath: string;
  outputPath: string;
  subtitlePath: string; // .srt 파일
}

async function addSubtitles(options: SubtitleOptions): Promise<void> {
  const { inputPath, outputPath, subtitlePath } = options;

  const args = [
    '-i', inputPath,
    '-vf', `subtitles=${subtitlePath}`,
    '-c:a', 'copy',
    outputPath
  ];

  await runCommandWithSpawn('ffmpeg', args);
}

// 사용 예제
await addSubtitles({
  inputPath: 'input.mp4',
  outputPath: 'output_with_subs.mp4',
  subtitlePath: 'subtitles.srt'
});
```

---

## 5. 프로세스 관리

### 5.1 작업 큐 (Bull)

```typescript
import Queue from 'bull';
import { promises as fs } from 'fs';

interface VideoProcessingJob {
  videoId: string;
  inputPath: string;
  operation: 'trim' | 'speed' | 'subtitle';
  options: any;
}

// Redis 연결 설정
const videoQueue = new Queue<VideoProcessingJob>('video-processing', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// 작업 처리
videoQueue.process(async (job) => {
  const { videoId, inputPath, operation, options } = job.data;

  console.log(`Processing video ${videoId}, operation: ${operation}`);

  job.progress(0);

  try {
    switch (operation) {
      case 'trim':
        await trimVideo({
          inputPath,
          outputPath: options.outputPath,
          startTime: options.startTime,
          duration: options.duration
        });
        break;

      case 'speed':
        await changeSpeed({
          inputPath,
          outputPath: options.outputPath,
          speed: options.speed
        });
        break;

      case 'subtitle':
        await addSubtitles({
          inputPath,
          outputPath: options.outputPath,
          subtitlePath: options.subtitlePath
        });
        break;
    }

    job.progress(100);

    return { success: true, videoId };
  } catch (error) {
    console.error('Processing error:', error);
    throw error;
  }
});

// 작업 추가
app.post('/api/process', async (req, res) => {
  const { videoId, inputPath, operation, options } = req.body;

  const job = await videoQueue.add({
    videoId,
    inputPath,
    operation,
    options
  });

  res.json({
    jobId: job.id,
    message: 'Job added to queue'
  });
});

// 작업 상태 조회
app.get('/api/jobs/:jobId', async (req, res) => {
  const job = await videoQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress();

  res.json({
    jobId: job.id,
    state,
    progress,
    data: job.data
  });
});
```

---

## 6. 트러블슈팅

### 6.1 파일 업로드 실패

**문제**: 대용량 파일 업로드 시 타임아웃

**해결**:
```typescript
// Express 타임아웃 설정
app.use((req, res, next) => {
  req.setTimeout(300000); // 5분
  res.setTimeout(300000);
  next();
});

// multer limits 설정
const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
    files: 1
  }
});
```

---

### 6.2 ffmpeg 프로세스 좀비화

**문제**: ffmpeg 프로세스가 종료되지 않음

**해결**:
```typescript
let ffmpegProcess: ReturnType<typeof spawn> | null = null;

function killFfmpegProcess() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGKILL');
    ffmpegProcess = null;
  }
}

// 타임아웃 설정
async function runFfmpegWithTimeout(
  args: string[],
  timeout: number = 300000
): Promise<void> {
  return Promise.race([
    runCommandWithSpawn('ffmpeg', args),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        killFfmpegProcess();
        reject(new Error('ffmpeg timeout'));
      }, timeout)
    )
  ]);
}

// 프로세스 종료 시 정리
process.on('SIGTERM', () => {
  killFfmpegProcess();
  process.exit(0);
});
```

---

## 7. 프로젝트 적용

### video-editor v1.0-v1.2 전체 구조

```typescript
// src/app.ts
import express from 'express';
import multer from 'multer';
import path from 'path';
import { VideoService } from './services/video.service';

const app = express();
const videoService = new VideoService();

// 파일 업로드 설정
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }
});

// 업로드 엔드포인트
app.post('/api/videos/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const video = await videoService.processUpload(req.file);
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Trim 엔드포인트
app.post('/api/videos/:id/trim', async (req, res) => {
  const { id } = req.params;
  const { startTime, duration } = req.body;

  try {
    const result = await videoService.trimVideo(id, startTime, duration);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Trim failed' });
  }
});

// src/services/video.service.ts
export class VideoService {
  async processUpload(file: Express.Multer.File) {
    const metadata = await extractMetadata(file.path);

    return {
      id: generateId(),
      filename: file.originalname,
      path: file.path,
      ...metadata
    };
  }

  async trimVideo(videoId: string, startTime: number, duration: number) {
    const video = await this.findVideoById(videoId);

    const outputPath = path.join('outputs', `${videoId}_trimmed.mp4`);

    await trimVideo({
      inputPath: video.path,
      outputPath,
      startTime,
      duration
    });

    return {
      videoId,
      outputPath,
      status: 'completed'
    };
  }

  private async findVideoById(id: string) {
    // DB 조회
    return { id, path: 'uploads/video.mp4' };
  }
}
```

---

## 면접 질문

1. **Node.js의 이벤트 루프는 어떻게 동작하나요?**
2. **fs 모듈의 동기 API와 비동기 API의 차이는?**
3. **대용량 파일을 처리할 때 Stream을 사용하는 이유는?**
4. **child_process의 exec와 spawn의 차이는?**
5. **ffmpeg에서 -c copy 옵션의 의미는?**
6. **Express 미들웨어의 역할은 무엇인가요?**
7. **multer로 파일 업로드를 처리할 때 주의할 점은?**
8. **HTTP 서버에서 CORS를 설정하는 이유는?**
9. **비동기 프로세스 실행 시 에러 핸들링은 어떻게 하나요?**
10. **ffmpeg 명령어에서 -ss와 -t 옵션의 차이는?**

---

## 다음 단계

- WebSocket 실시간 진행률 → [T04: DB + Redis + WebSocket](./T04-db-redis-websocket.md)
- NestJS로 전환 → [T03: NestJS 기본](./T03-nest-bootstrap.md)

---

## 8. 공통 오류와 해결

- **포트 충돌**: EADDRINUSE → 다른 포트 사용.
- **ffmpeg 설치**: 명령어 없음 → PATH 확인, 설치.
- **파일 권한**: EACCES → 권한 설정.
- **메모리 부족**: 대용량 파일 → 스트림 사용.
- **타임아웃**: 긴 처리 → 프로세스 모니터링.

---

## 9. 퀴즈 및 다음 단계

**퀴즈**:
1. fs.readFile vs fs.createReadStream? (메모리 vs 스트림)
2. multer dest? (업로드 폴더)
3. child_process exec? (단순 명령)
4. ffmpeg -ss? (시작 시간)
5. path.join의 장점? (OS 독립적 경로)
6. HTTP 서버에서 CORS란? (교차 출처 리소스 공유)
7. ffmpeg에서 -c copy 옵션의 의미? (코덱 복사)
8. 프로세스 관리에서 stdio 옵션? (입출력 스트림)
9. 파일 업로드 시 멀티파트란? (바이너리 데이터 전송)
10. 이벤트 루프의 역할? (비동기 작업 처리)

**완료 조건**: 서버 실행, 비디오 트림 성공.

**다음**: T03/T04 선택!

---

## 10. 추가 리소스

### Node.js
- [Node.js 공식 문서](https://nodejs.org/docs/): API 레퍼런스.
- [Express 가이드](https://expressjs.com/): 웹 프레임워크.
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices): 가이드.

### ffmpeg
- [ffmpeg 위키](https://trac.ffmpeg.org/wiki/): 튜토리얼.
- [ffmpeg CLI](https://ffmpeg.org/ffmpeg.html): 명령어 옵션.
- [FFmpeg Cheat Sheet](https://gist.github.com/steven2358/8c36d77b6f9e2b2b0b8b): 명령어 요약.

### 튜토리얼
- [Multer Docs](https://github.com/expressjs/multer): 업로드 라이브러리.
- [Node.js File Upload](https://www.npmjs.com/package/multer): 실습 예제.

### 비디오
- [Traversy Media Node](https://www.youtube.com/c/TraversyMedia): YouTube 시리즈.
- [Academind Node.js](https://www.youtube.com/c/Academind): 심화 튜토리얼.

### 실습 플랫폼
- [Node.js Playground](https://nodejs.org/en/docs/guides/): 온라인 테스트.
- [Glitch](https://glitch.com/): 웹 앱 실습.

### 커뮤니티
- [Stack Overflow Node.js](https://stackoverflow.com/questions/tagged/node.js): Q&A.
- [Reddit r/node](https://www.reddit.com/r/node/): 커뮤니티.

---

**튜토리얼 완료 체크리스트**:
- [ ] Node.js 코어 모듈 이해
  - [ ] fs 모듈로 파일 시스템 작업
  - [ ] path 모듈로 경로 조작
  - [ ] child_process로 외부 명령 실행
- [ ] HTTP 서버 구축
  - [ ] Express 서버 설정
  - [ ] 미들웨어 구성
  - [ ] 라우팅 구현
- [ ] 파일 업로드 처리
  - [ ] multer로 파일 업로드
  - [ ] 파일 검증 및 저장
- [ ] ffmpeg CLI 기초
  - [ ] 비디오 정보 추출
  - [ ] 비디오 트림 및 변환
- [ ] 프로세스 관리
  - [ ] 비동기 프로세스 실행
  - [ ] 에러 핸들링
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 프로젝트 적용
  - [ ] 실전 서버 구축
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요
**다음 튜토리얼**: _____
