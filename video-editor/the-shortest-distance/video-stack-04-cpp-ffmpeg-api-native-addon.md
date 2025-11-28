# 문서 4. C++ / FFmpeg C API / 네이티브 애드온 (선택, 고급편)

> 이 문서는 **Stage 3** 용이다.
> 전제:
>
> * Stage 2까지 (FFmpeg CLI + Node 연동) 구현 완료
> * 이제 **C++ 레벨에서 FFmpeg C API를 직접 쓰고**, 필요하면 **네이티브 애드온**까지 갈 준비가 된 상태

---

## 0. 전제 / 목표

### 전제

* C 경험 있음
* C++ 문법을 아주 조금이라도 본 적은 있음 (완벽히 익숙하진 않아도 됨)
* FFmpeg CLI 기본 사용 가능: `ffmpeg -i input.mp4 ...`
* Node + Express + FFmpeg CLI 연동 경험 있음 (자체 서버에서 썸네일/클립 정도는 빼봤다)

### 이 문서의 목표

1. C 개발자 기준으로, **C++에서 꼭 필요한 문법만 정리**
2. FFmpeg C API를 **RAII + 스마트 포인터**로 안전하게 다루는 패턴 이해
3. C++로 영상 메타데이터(해상도, 길이, codec 이름 등) 읽는 `VideoInfoReader` 구현
4. CMake로 FFmpeg를 링크해서 **CLI 바이너리(`video_info`)** 빌드
5. Node에서 `child_process.spawn`으로 이 바이너리 호출 → JSON 파싱
6. (선택) N-API 네이티브 애드온 개념 + 예외 → JS Error 브리지 패턴
7. (선택) FFmpeg 버전 분기, 벤치마크 스크립트 패턴

---

## 1. C++ 기초 (C 개발자용 요약)

C만 해본 상태에서 C++ 코드 읽을 때 막히는 지점들만 정리한다.

### 1.1 참조자 (reference)

```cpp
void increment(int& x) {
  x += 1;
}

int main() {
  int a = 10;
  increment(a);
  // a == 11
}
```

* `int& x` = “null이 될 수 없는 포인터" 느낌
* 호출 시 `&a` 같은 건 안 붙이고 그냥 `increment(a);`
* 함수 안에서 `x`를 수정하면 원본 `a`가 수정됨

읽기 전용 참조:

```cpp
void print(const std::string& s) {
  std::cout << s << "\n";
}
```

* 복사 없이, 읽기만 할 때 이런 형태를 많이 쓴다.

---

### 1.2 RAII (생성자 / 소멸자로 자원 관리)

C에서:

* `open` / `close`, `malloc` / `free`, `avformat_open_input` / `avformat_close_input` 같이 **쌍으로 관리해야 할 자원**이 많다.
* C++에서는 이걸 **“객체의 생명주기"에 붙여 놓는 패턴**을 쓴다.

```cpp
class FileHandle {
public:
  explicit FileHandle(const std::string& path)
      : file_(std::fopen(path.c_str(), "rb")) {
    if (!file_) {
      throw std::runtime_error("Failed to open file");
    }
  }

  ~FileHandle() {
    if (file_) {
      std::fclose(file_);
    }
  }

  FILE* get() const { return file_; }

private:
  FILE* file_;
};

void example() {
  FileHandle f("test.bin");
  // 여기서 예외가 나거나, return 되거나 상관 없이,
  // f가 스코프를 벗어날 때 ~FileHandle() 자동 호출 → fclose
}
```

FFmpeg 리소스(`AVFormatContext*`, `AVFrame*` 등)도 같은 방식으로 감싼다.

---

### 1.3 `std::string`, `std::vector`

```cpp
#include <string>
#include <vector>

std::string s = "hello";
s += " world";
std::size_t len = s.size();

std::vector<int> nums;
nums.push_back(10);
nums.push_back(20);

for (std::size_t i = 0; i < nums.size(); ++i) {
  std::cout << nums[i] << "\n";
}
```

* `std::string` = `char*` + 길이 + 메모리 관리까지 포함된 객체
* `std::vector<T>` = 동적 배열 (자동 `realloc`)

---

### 1.4 `std::unique_ptr` 기본

```cpp
#include <memory>
#include <iostream>

class Foo {
public:
  Foo() { std::cout << "Foo()\n"; }
  ~Foo() { std::cout << "~Foo()\n"; }
};

void example() {
  std::unique_ptr<Foo> ptr = std::make_unique<Foo>();
  // 스코프 벗어나면 자동으로 delete
}
```

특징:

* “소유자는 딱 한 명"이라는 뜻
* 복사 불가(`=`, 복사 생성자 금지), 이동(`std::move`)만 가능
* FFmpeg 포인터를 RAII로 감쌀 때 **“+ 커스텀 deleter"**와 함께 많이 사용

---

### 1.5 `using` 타입 별칭

긴 템플릿 타입에 별명을 붙인다.

```cpp
#include <map>
#include <string>

using StringMap = std::map<std::string, std::string>;

StringMap metadata;
```

FFmpeg 리소스에도 사용:

```cpp
using FormatContextPtr =
    std::unique_ptr<AVFormatContext, decltype(&avformat_close_input)>;
```

예전 C 스타일 `typedef`보다 훨씬 읽기 편하다.

---

### 1.6 `std::move`

소유권 이전을 표현.

```cpp
std::unique_ptr<Foo> makeFoo();

void takeOwnership(std::unique_ptr<Foo> ptr);

void example() {
  auto ptr = makeFoo();
  takeOwnership(std::move(ptr));  // 여기서 ptr의 소유권 이동
  // 이후 ptr은 더 이상 유효하다고 기대하면 안 됨 (보통 null)
}
```

* 복사가 아니라 “**이건 이제 저쪽이 가진다**"는 의미
* 특히 `unique_ptr` 같이 “소유자 1개"인 타입에 필수

---

### 1.7 `auto` + range-based for + `std::map`

```cpp
#include <map>
#include <string>
#include <iostream>

int main() {
  std::map<std::string, std::string> metadata;
  metadata["title"]  = "My Video";
  metadata["artist"] = "Someone";

  for (const auto& pair : metadata) {
    const std::string& key   = pair.first;
    const std::string& value = pair.second;
    std::cout << key << " = " << value << "\n";
  }
}
```

* `auto` : 타입 추론. 템플릿 타입을 일일이 안 써도 된다.
* `const auto&` : 복사 없이 읽기 전용으로 순회

---

### 1.8 예외

```cpp
double divide(double a, double b) {
  if (b == 0.0) {
    throw std::runtime_error("division by zero");
  }
  return a / b;
}

int main() {
  try {
    std::cout << divide(10, 0) << "\n";
  } catch (const std::exception& e) {
    std::cerr << "Error: " << e.what() << "\n";
  }
}
```

이걸 **FFmpeg 오류 코드 → `std::runtime_error`**로 바꿔 던지는 데 쓴다.

---

### 1.9 namespace (짧게)

```cpp
namespace vrewcraft {
  struct VideoInfo { /* ... */ };
}

vrewcraft::VideoInfo info;
```

* 전역 심볼 충돌 방지용
* 라이브러리/애드온 코드에 적당한 네임스페이스를 하나 두고 시작하는 게 안전하다.

---

## 2. FFmpeg C API 셋업

### 2.1 `extern "C"` + 헤더 include

```cpp
extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
}
```

* FFmpeg 헤더는 C용이기 때문에, C++에서 사용할 때 `extern "C"`로 감싸줘야 링킹 문제가 안 생긴다.

### 2.2 FFmpeg 초기화 (요약)

FFmpeg 5.x 기준:

* 옛날에는 `av_register_all()` 같은 걸 직접 호출했지만,
* 지금은 대부분 자동 초기화되는 구간이 많다.

여기선 **간단한 메타데이터 읽기**만 할 거라 별도 초기화 코드는 생략해도 된다.

---

## 3. FFmpeg 리소스를 RAII로 감싸기

### 3.1 스마트 포인터 타입 정의

```cpp
#include <memory>

using FormatContextPtr =
    std::unique_ptr<AVFormatContext, decltype(&avformat_close_input)>;

using CodecContextPtr =
    std::unique_ptr<AVCodecContext, decltype(&avcodec_free_context)>;

using FramePtr =
    std::unique_ptr<AVFrame, decltype(&av_frame_free)>;

using PacketPtr =
    std::unique_ptr<AVPacket, decltype(&av_packet_free)>;
```

각각 생성 함수:

```cpp
FormatContextPtr make_format_context(const std::string& path) {
  AVFormatContext* raw = nullptr;
  if (avformat_open_input(&raw, path.c_str(), nullptr, nullptr) < 0) {
    throw std::runtime_error("Could not open input file: " + path);
  }
  return FormatContextPtr(raw, &avformat_close_input);
}

CodecContextPtr make_codec_context(const AVCodecParameters* codecpar) {
  const AVCodec* codec = avcodec_find_decoder(codecpar->codec_id);
  if (!codec) {
    throw std::runtime_error("Could not find decoder");
  }

  AVCodecContext* raw_ctx = avcodec_alloc_context3(codec);
  if (!raw_ctx) {
    throw std::runtime_error("Could not allocate codec context");
  }

  if (avcodec_parameters_to_context(raw_ctx, codecpar) < 0) {
    avcodec_free_context(&raw_ctx);
    throw std::runtime_error("Could not copy codec parameters");
  }

  if (avcodec_open2(raw_ctx, codec, nullptr) < 0) {
    avcodec_free_context(&raw_ctx);
    throw std::runtime_error("Could not open codec");
  }

  return CodecContextPtr(raw_ctx, &avcodec_free_context);
}

FramePtr make_frame() {
  AVFrame* raw = av_frame_alloc();
  if (!raw) {
    throw std::runtime_error("Could not allocate frame");
  }
  return FramePtr(raw, &av_frame_free);
}

PacketPtr make_packet() {
  AVPacket* raw = av_packet_alloc();
  if (!raw) {
    throw std::runtime_error("Could not allocate packet");
  }
  return PacketPtr(raw, &av_packet_free);
}
```

이렇게 해두면:

* 예외 나도 자동 정리
* 스코프 벗어나면 바로 `avformat_close_input`, `avcodec_free_context` 등 호출

---

### 3.2 오류 코드 → 예외 변환 헬퍼

FFmpeg 함수 대부분이 `< 0`이면 에러, 아니면 성공.

```cpp
inline void check_ffmpeg(int err, const std::string& msg) {
  if (err < 0) {
    char buf[256];
    av_strerror(err, buf, sizeof(buf));
    throw std::runtime_error(msg + ": " + std::string(buf));
  }
}
```

사용 예:

```cpp
check_ffmpeg(avformat_find_stream_info(fmt_ctx.get(), nullptr),
             "Could not find stream info");
```

---

## 4. VideoInfoReader: 영상 기본 정보 읽기

### 4.1 VideoInfo 구조체

```cpp
// VideoInfo.h
#pragma once

#include <string>

namespace vrewcraft {

struct VideoInfo {
  int width        = 0;
  int height       = 0;
  double duration  = 0.0;      // seconds
  double fps       = 0.0;
  std::string codec_name;
};

class VideoInfoReader {
public:
  VideoInfo read(const std::string& path);
};

}  // namespace vrewcraft
```

### 4.2 구현

```cpp
// VideoInfoReader.cpp
#include "VideoInfoReader.h"

#include <stdexcept>
#include <memory>
#include <iostream>

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
}

using FormatContextPtr =
    std::unique_ptr<AVFormatContext, decltype(&avformat_close_input)>;

namespace vrewcraft {

static FormatContextPtr open_input(const std::string& path) {
  AVFormatContext* raw = nullptr;
  if (avformat_open_input(&raw, path.c_str(), nullptr, nullptr) < 0) {
    throw std::runtime_error("Could not open input file: " + path);
  }
  return FormatContextPtr(raw, &avformat_close_input);
}

VideoInfo VideoInfoReader::read(const std::string& path) {
  VideoInfo info;

  // 1. 입력 파일 열기
  FormatContextPtr fmt_ctx = open_input(path);

  // 2. 스트림 정보 읽기
  if (avformat_find_stream_info(fmt_ctx.get(), nullptr) < 0) {
    throw std::runtime_error("Could not find stream info");
  }

  // 3. 비디오 스트림 찾기
  int video_stream_index = av_find_best_stream(
      fmt_ctx.get(), AVMEDIA_TYPE_VIDEO, -1, -1, nullptr, 0);
  if (video_stream_index < 0) {
    throw std::runtime_error("Could not find video stream");
  }

  AVStream* video_stream = fmt_ctx->streams[video_stream_index];
  AVCodecParameters* codecpar = video_stream->codecpar;

  // 4. 해상도
  info.width  = codecpar->width;
  info.height = codecpar->height;

  // 5. codec 이름
  const AVCodec* codec = avcodec_find_decoder(codecpar->codec_id);
  if (codec && codec->name) {
    info.codec_name = codec->name;
  } else {
    info.codec_name = "unknown";
  }

  // 6. duration (초 단위)
  if (fmt_ctx->duration != AV_NOPTS_VALUE) {
    info.duration = fmt_ctx->duration / static_cast<double>(AV_TIME_BASE);
  } else if (video_stream->duration != AV_NOPTS_VALUE) {
    AVRational tb = video_stream->time_base;
    info.duration = video_stream->duration * av_q2d(tb);
  } else {
    info.duration = 0.0;
  }

  // 7. FPS (대략적인 값)
  AVRational fr =
      av_guess_frame_rate(fmt_ctx.get(), video_stream, nullptr);
  if (fr.num != 0 && fr.den != 0) {
    info.fps = av_q2d(fr);
  } else {
    info.fps = 0.0;
  }

  return info;
}

}  // namespace vrewcraft
```

---

### 4.3 main.cpp: JSON 출력 CLI

Node에서 쓰기 쉽도록, C++ 측에서 JSON 한 줄을 출력한다고 가정한다.
(실제로는 제대로 된 JSON 인코더를 쓰는 게 안전하지만, 예제라 단순하게 간다.)

```cpp
// main.cpp
#include "VideoInfoReader.h"

#include <iostream>
#include <iomanip>  // std::setprecision
#include <exception>

using vrewcraft::VideoInfo;
using vrewcraft::VideoInfoReader;

int main(int argc, char** argv) {
  if (argc < 2) {
    std::cerr << "Usage: video_info <input>\n";
    return 1;
  }

  const std::string path = argv[1];
  VideoInfoReader reader;

  try {
    VideoInfo info = reader.read(path);

    // 아주 단순한 JSON 출력 (문자열 이스케이프 등은 생략)
    std::cout << std::fixed << std::setprecision(3);
    std::cout << "{";
    std::cout << "\"width\":"      << info.width      << ",";
    std::cout << "\"height\":"     << info.height     << ",";
    std::cout << "\"duration\":"   << info.duration   << ",";
    std::cout << "\"fps\":"        << info.fps        << ",";
    std::cout << "\"codec_name\":\"" << info.codec_name << "\"";
    std::cout << "}\n";

    return 0;
  } catch (const std::exception& e) {
    std::cerr << "Error: " << e.what() << "\n";
    return 1;
  }
}
```

이 상태에서:

```bash
./video_info sample.mp4
# {"width":1920,"height":1080,"duration":123.456,"fps":29.970,"codec_name":"h264"}
```

형태의 JSON이 stdout으로 나온다고 가정한다.

---

## 5. CMake로 빌드하기

### 5.1 기본 CMakeLists.txt

FFmpeg가 pkg-config로 설치되어 있다고 가정하면, 이런 형태를 사용할 수 있다.

```cmake
cmake_minimum_required(VERSION 3.20)
project(video_info LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# pkg-config로 FFmpeg 찾기 (환경에 따라 조정 필요)
find_package(PkgConfig REQUIRED)
pkg_check_modules(FFMPEG REQUIRED IMPORTED_TARGET
  libavformat
  libavcodec
  libavutil
)

add_executable(video_info
  src/main.cpp
  src/VideoInfoReader.cpp
)

target_include_directories(video_info
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(video_info
  PRIVATE
    PkgConfig::FFMPEG
)
```

만약 pkg-config를 쓰지 않고 직접 경로를 적어야 한다면, 더 단순하게:

```cmake
cmake_minimum_required(VERSION 3.20)
project(video_info LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(video_info
  src/main.cpp
  src/VideoInfoReader.cpp
)

target_include_directories(video_info
  PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${FFMPEG_INCLUDE_DIRS}
)

target_link_libraries(video_info
  PRIVATE
    ${FFMPEG_LIBRARIES}
)
```

핵심만 정리하면:

* `add_executable(video_info ...)`

  * “빌드 결과물 하나" 정의
* `target_include_directories`

  * 이 타겟 컴파일 시 사용할 `-I` 경로 지정
* `target_link_libraries`

  * 링크할 라이브러리 (`avformat`, `avcodec`, `avutil`, …) 지정

---

## 6. Node에서 CLI 실행해서 JSON 사용하기

Stage 2에서 사용한 `child_process.spawn` 패턴을 그대로 쓴다.

```ts
// video-info.ts
import { spawn } from "child_process";

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec_name: string;
}

export function getVideoInfo(path: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const child = spawn("video_info", [path]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`video_info exited with ${code}: ${stderr}`)
        );
      }

      try {
        const json = JSON.parse(stdout);
        resolve(json as VideoInfo);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse video_info output as JSON. stdout=${stdout}`
          )
        );
      }
    });
  });
}
```

Express 라우트 예:

```ts
// routes/video-info.ts
import type { Request, Response, NextFunction } from "express";
import { getVideoInfo } from "../video-info";

export async function handleGetVideoInfo(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const path = req.query.path;
    if (typeof path !== "string") {
      return res.status(400).json({ ok: false, message: "path is required" });
    }

    const info = await getVideoInfo(path);
    res.json({ ok: true, info });
  } catch (err) {
    next(err);
  }
}
```

이렇게 하면:

* C++에서 FFmpeg 메타데이터를 읽고,
* Node에서 CLI 한 번 호출해서 JSON으로 받아,
* Express에서 그대로 프론트에 전달하는 구조가 된다.

---

## 7. (선택) N-API 네이티브 애드온 개요

Stage 3에서 “성능/지연 줄이기"가 필요해지면, CLI 대신 **네이티브 애드온**을 고려하게 된다.

### 7.1 구조 개념

대략적인 구성:

* C++ 코드:

  * `VideoInfoReader` (위에서 만든 것 그대로 사용)
  * N-API 바인딩 코드 (`binding.cpp` 등)
* Node:

  * `node-addon-api` 또는 N-API를 직접 사용해서 `.node` 바이너리 로드

### 7.2 C++ 예외 → JS Error 브리지

바인딩 함수에서:

```cpp
#include <napi.h>
#include "VideoInfoReader.h"

using vrewcraft::VideoInfoReader;
using vrewcraft::VideoInfo;

Napi::Object to_js_object(Napi::Env env, const VideoInfo& info) {
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("width",      Napi::Number::New(env, info.width));
  obj.Set("height",     Napi::Number::New(env, info.height));
  obj.Set("duration",   Napi::Number::New(env, info.duration));
  obj.Set("fps",        Napi::Number::New(env, info.fps));
  obj.Set("codec_name", Napi::String::New(env, info.codec_name));
  return obj;
}

Napi::Value GetVideoInfo(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  try {
    if (info.Length() < 1 || !info[0].IsString()) {
      Napi::TypeError::New(env, "path(string) is required")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();

    VideoInfoReader reader;
    VideoInfo vi = reader.read(path);

    return to_js_object(env, vi);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getVideoInfo", Napi::Function::New(env, GetVideoInfo));
  return exports;
}

NODE_API_MODULE(video_info, Init)
```

요약:

* C++ 내부에서는 **예외 기반**으로 에러 전파
* 바인딩 층에서 `try/catch`로 잡고, `Napi::Error`로 변환해 JS에 던짐
* JS에서는 일반 함수처럼 `await addon.getVideoInfo(path)` 호출

빌드 시스템(CMake + node-addon-api 설정)은 별도 문서에서 다룬다고 보면 된다.

---

## 8. (선택) FFmpeg 버전 분기

FFmpeg 버전마다 API가 조금씩 다른 부분이 있다. 예:

```cpp
#if LIBAVUTIL_VERSION_INT >= AV_VERSION_INT(57, 24, 100)
  // 새로운 API: 채널 레이아웃 구조체 기반
  audio_info.channels = codecpar->ch_layout.nb_channels;
#else
  // 예전 API
  audio_info.channels = codecpar->channels;
#endif
```

포인트:

* 컴파일 시점에 버전에 따라 다른 코드를 컴파일
* 여러 버전의 FFmpeg를 지원해야 할 때 이런 패턴이 필요

---

## 9. (선택) Node 벤치마크 스크립트 패턴

메타데이터 분석 애드온/CLI가 충분히 빠른지 확인하고 싶을 때:

```ts
// scripts/benchmark-metadata.ts
import { performance } from "perf_hooks";
import { getVideoInfo } from "../dist/video-info"; // 또는 애드온

async function run() {
  const samples = 200;
  const durations: number[] = [];

  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    await getVideoInfo("test.mp4");
    const t1 = performance.now();
    durations.push(t1 - t0);
  }

  durations.sort((a, b) => a - b);

  const p95 = durations[Math.floor(samples * 0.95)];
  const p99 = durations[Math.floor(samples * 0.99)];

  console.log("p95:", p95, "ms");
  console.log("p99:", p99, "ms");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

이런 식으로 **p95 / p99 지연**을 숫자로 확인해두면, “애드온으로 갈지, CLI로도 충분한지" 판단하는 근거가 생긴다.

---

## 10. Stage 3 관점 체크리스트

이 문서 기준으로, 아래를 스스로 구현/설명할 수 있으면 Stage 3의 “C++ / FFmpeg / 네이티브" 초입은 통과라고 봐도 된다.

* [ ] C++에서 참조자, RAII, `std::string` / `std::vector`, `std::unique_ptr`, `using`, `std::move`, `auto` / range-for 개념을 예제 코드 수준에서 이해했다.
* [ ] FFmpeg C API를 C++에서 호출하고, `AVFormatContext`, `AVStream`, `AVCodecParameters`를 이용해 비디오 스트림의 해상도/길이/codec 이름/FPS를 읽을 수 있다.
* [ ] FFmpeg 포인터를 `std::unique_ptr` + 커스텀 deleter로 감싸서, 예외 발생 시에도 리소스가 자동으로 정리되게 만들 수 있다.
* [ ] CMake로 C++ 프로젝트를 구성하고, FFmpeg 라이브러리를 링크한 뒤 `video_info` 같은 CLI 바이너리를 만들 수 있다.
* [ ] Node에서 `child_process.spawn`으로 이 바이너리를 호출하고, stdout JSON을 파싱해서 TypeScript 타입(`VideoInfo`)으로 사용 가능하다.
* [ ] (선택) N-API 바인딩에서 C++ 예외를 JS Error로 변환하는 패턴을 이해했다.
* [ ] (선택) FFmpeg 버전 분기, 벤치마크 스크립트 패턴을 어느 정도 읽고 응용할 수 있다.

여기까지면:

* **React + Node + FFmpeg CLI**로 기본 웹 서비스
* **C++ + FFmpeg C API**로 커스텀 메타데이터/프레임 처리
* 필요하면 **네이티브 애드온**으로 한 단계 더 성능/구조 개선

까지 전체 그림이 연결된 상태라고 보면 된다.

---

## 11. High-Class Check: 네이티브 코드 안정성, 디버깅, 보안

C++ / FFmpeg C API / N-API 애드온 레벨에서 진짜로 터지는 부분만 다룬다. 

---

### 11.1 Segfault → Node 전체 크래시를 막는 최소 예외 처리

N-API 애드온에서 **C++ 예외 / segfault**는 Node 프로세스 전체를 날려버린다.

패턴:

```cpp
Napi::Value ExtractMetadata(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  try {
    // 1. 인자 검증
    // 2. 실제 C++ 로직 호출
    // 3. JS 객체로 변환 후 return
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Null();
  } catch (...) {
    Napi::Error::New(env, "Unknown native error").ThrowAsJavaScriptException();
    return env.Null();
  }
}
```

**규칙:**

* N-API 엔트리 포인트 바깥으로 예외가 절대 나가지 않게 한다.
* 모든 public entry 함수는 `try/catch` 블록으로 감싸고, JS 예외로 변환한다.
* C API 에러 코드는 **반드시** `std::runtime_error` 등으로 래핑 후 던진다.

---

### 11.2 Segfault 디버깅 플로우 (LLDB / GDB)

1. **Node를 디버거로 실행**

```bash
lldb node
(lldb) run dist/server.js
# 또는
gdb --args node dist/server.js
```

2. 크래시가 발생하면, `bt` / `backtrace` 로 C++ 스택을 확인

* FFmpeg 함수 호출 이후 어디에서 터지는지 확인
* RAII 포인터 해제 시점에서 잘못된 포인터가 쓰였는지 확인

3. 가능하면 **core dump** 설정해서, 운영 환경에서 재현

---

### 11.3 메모리 누수 방지: RAII + Valgrind

RAII로 대부분 막을 수 있지만, FFmpeg C API는 구조체 안에 또 다른 포인터를 들고 있어서 실수하기 쉽다. 

* `AVFormatContext` → `avformat_close_input`
* `AVCodecContext` → `avcodec_free_context`
* `AVFrame` → `av_frame_free`
* `AVPacket` → `av_packet_free`
* `SwsContext` → `sws_freeContext`

**RAII 타입으로 고정해두고, 직접 free를 호출하지 않는다.**

```cpp
using AVFramePtr = std::unique_ptr<AVFrame, AVFrameDeleter>;
```

추가로, 주기적으로 **Valgrind**로 전체를 한 번씩 돌려본다.

```bash
valgrind --leak-check=full --show-leak-kinds=all node dist/server.js
```

메모리 누수가 나오면:

* 해당 포인터를 감싸는 RAII 래퍼가 있는지 확인
* 예외 발생 시 코드 경로에서도 destructor가 호출되는지 확인

---

### 11.4 입력 검증: “JS가 준 값이라서 안전하다"는 착각 버리기

JS에서 넘어오는 인자는 전부 **외부 입력**으로 취급해야 한다.

```cpp
if (info.Length() < 1 || !info[0].IsString()) {
  Napi::TypeError::New(env, "Expected video path string").ThrowAsJavaScriptException();
  return env.Null();
}
std::string path = info[0].As<Napi::String>().Utf8Value();

if (path.size() > 4096) {
  Napi::Error::New(env, "Path too long").ThrowAsJavaScriptException();
  return env.Null();
}
```

기본 방어선:

* 타입 체크 (`IsString`, `IsNumber`, `IsArray` 등)
* 길이 제한 (path, codec name 등)
* 음수/NaN/무한대 값 필터
* 파일 경로 내 `..`, `\0` 포함 여부 검사 (Path Traversal 방지)

---

### 11.5 ABI / 빌드 호환성 고려

Native Addon은 **Node.js / OS / FFmpeg 버전**에 민감하다.

* N-API를 쓰는 이유는 ABI를 어느 정도 안정화하려는 것
* 그래도 빌드 타깃 Node 버전, FFmpeg 버전은 명시적으로 맞춰야 한다.

실무 체크포인트:

* addon이 로드 실패하면 (`require(...)` 시 에러)
  → JS Fallback(예: fluent-ffmpeg, ffprobe)으로 자동 전환하는 코드 경로를 준비.
* FFmpeg 버전에 따라 구조체/필드가 다른 경우
  → `#if LIBAVUTIL_VERSION_INT >= ...` 형태로 분기 (이미 설계 문서에 있음). 

---

### 11.6 Crash 시 서비스 전체가 죽지 않게 하기

아무리 방어해도, 네이티브 크래시는 언젠가 터질 수 있다.

전략:

1. **네이티브 기능을 “옵션"으로 취급**

* 서버 시작 시, 애드온 로드에 실패하면 “네이티브 기능 비활성화 모드"로 전환
* 해당 모드에서는 모든 메타데이터/썸네일 요청을 JS/CLI 구현으로 처리

2. **Health Check에 Native 상태 포함**

```json
{
  "status": "ok",
  "native": {
    "available": true,
    "version": "2.0.0"
  }
}
```

3. **Feature Flag**

* 환경 변수 또는 설정으로 “네이티브 경로 사용 여부"를 토글 가능하게 해둔다.
* 문제 발생 시 재배포 없이 플래그만 내려서 JS 경로로 우회.


