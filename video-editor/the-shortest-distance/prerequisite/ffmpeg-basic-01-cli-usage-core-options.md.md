아래는 **글 1**(쉘·툴 + FFmpeg 최소 사용) 초안이다.
요구한 대로 `cd, ls, pwd, mkdir, rm, mv, cp`는 완전히 제외했다.

---

# 글 1 — FFmpeg를 터미널에서 바로 다루기 위한 최소한의 기초

이 글의 목표는 단 하나다.
**“터미널에서 ffmpeg 명령어 한 줄을 직접 치고, 결과 파일을 확인할 수 있는 상태 만들기.”**
딱 여기에 필요한 내용만 넣었다.

---

## 1. CLI에서 프로그램 실행 기본

터미널에서 프로그램을 실행하는 기본 형태는 단순하다:

```
프로그램이름 [옵션] [인자...]
```

예:

```
node app.js
ffmpeg -version
```

* 시스템 PATH에 등록된 실행 파일은 그냥 이름만 쳐도 실행된다.
* ffmpeg, node 모두 설치되면 다음이 동작해야 한다:

```
ffmpeg -h
node -v
```

둘 중 하나라도 안 되면 PATH 문제거나 설치 자체가 안 된 상태다.

---

## 2. FFmpeg 입출력 기본 형태

가장 기본 구조는 다음 한 줄로 표현된다:

```
ffmpeg -i 입력파일 출력파일
```

예:

```
ffmpeg -i in.mp4 out.mp4
```

이게 전부다.
입력·출력만 지정하면 기본 설정으로 컨테이너/코덱을 자동으로 선택해 변환한다.

---

## 3. 코덱 지정(영상/음성)

기본값 그대로 두지 않고 명확히 코덱을 선언하려면 다음 옵션 사용:

```
-c:v <비디오코덱>   (영상)
-c:a <오디오코덱>   (음성)
```

예:

```
ffmpeg -i in.mp4 -c:v libx264 -c:a aac out.mp4
```

일반적인 조합:

* 영상: `libx264`
* 음성: `aac`

---

## 4. 품질 관련 핵심 옵션: CRF / preset

### 🔹 CRF(Constant Rate Factor)

* 영상 품질을 결정하는 핵심 값
* 숫자가 낮을수록 화질 ↑, 파일 크기 ↑
* 보통 `18~23` 범위 사용

예:

```
ffmpeg -i in.mp4 -c:v libx264 -crf 20 out.mp4
```

### 🔹 preset

* 인코딩 속도와 압축 효율 트레이드오프
* 느릴수록 파일 크기 줄고, 빠를수록 크기 커짐

주요값: `ultrafast`, `fast`, `medium(기본)`, `slow`

예:

```
ffmpeg -i in.mp4 -c:v libx264 -preset slow out.mp4
```

---

## 5. 리사이즈(scale) / FPS 변경

### 🔹 리사이즈

```
-vf scale=<가로>:<세로>
```

세로를 자동 비율로 맞추려면 `-1` 사용:

```
ffmpeg -i in.mp4 -vf scale=1280:-1 out.mp4
```

### 🔹 FPS 변경

```
-r 30
```

```
ffmpeg -i in.mp4 -r 30 out.mp4
```

---

## 6. 구간 추출(시작/길이/끝 지정)

### 🔹 특정 시점부터 시작

```
-ss <시간>
```

### 🔹 길이 지정

```
-t <초 or hh:mm:ss>
```

### 🔹 끝지점 지정

```
-to <시간>
```

예: 10초 지점부터 5초만 추출

```
ffmpeg -ss 10 -i in.mp4 -t 5 out.mp4
```

예: 1분 30초까지 자르기

```
ffmpeg -i in.mp4 -to 00:01:30 out.mp4
```

---

## 7. 썸네일(프레임 1장 추출)

### 가장 흔한 형태

```
ffmpeg -ss <시간> -i in.mp4 -frames:v 1 thumb.jpg
```

예:

```
ffmpeg -ss 3 -i in.mp4 -frames:v 1 thumb.jpg
```

### thumbnail 필터 버전

```
-vf thumbnail
```

```
ffmpeg -i in.mp4 -vf thumbnail -frames:v 1 thumb.jpg
```

---

## 8. 핵심 요약

* 프로그램은 `이름 + 옵션 + 인자` 형태로 실행한다.
* FFmpeg 기본 실행: `ffmpeg -i 입력 출력`
* 자주 쓰는 옵션:

  * 코덱: `-c:v libx264 -c:a aac`
  * 품질: `-crf`, `-preset`
  * 리사이즈: `-vf scale=1280:-1`
  * FPS: `-r 30`
  * 구간 추출: `-ss`, `-t`, `-to`
  * 썸네일: `-frames:v 1`

이 정도면 실전에서 Node·Express와 연결할 때 바로 `spawn`으로 호출 가능하다.
