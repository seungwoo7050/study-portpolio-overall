# T0: 개발 환경 설정 (macOS)

> **목표**: 포트폴리오 프로젝트 개발에 필요한 도구 설치 및 사용법 완전 정복
> **예상 시간**: 3-5시간
> **난이도**: 🟢 기초
> **선행 요구사항**: 없음 (macOS 설치만 되어 있으면 됨)
> **적용 대상**: 전체 프로젝트 (video-editor, backend-nestjs, e-commerce, game-server)

---

## 목차

1. [Homebrew 패키지 관리자](#1-homebrew-패키지-관리자)
2. [JavaScript/TypeScript 환경](#2-javascripttypescript-환경)
3. [React/Vite 프로젝트](#3-reactvite-프로젝트)
4. [Node.js/NestJS 프로젝트](#4-nodejsnestjs-프로젝트)
5. [C++ 개발 환경](#5-c-개발-환경)
6. [Git & GitHub](#6-git--github)
7. [VS Code 설정](#7-vs-code-설정)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. Homebrew 패키지 관리자

### 1.1 Homebrew 설치

**Homebrew**는 macOS의 패키지 관리자입니다. 개발 도구를 쉽게 설치/관리할 수 있습니다.

```bash
# Homebrew 설치 (터미널에서 실행)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 설치 확인
brew --version
# 출력 예시: Homebrew 4.2.0
```

**M1/M2/M3 Mac (Apple Silicon) 사용자 주의사항**:
설치 후 다음 명령어를 실행해야 합니다:

```bash
# Apple Silicon Mac의 경우 PATH 추가 필요
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 1.2 기본 명령어

```bash
# 패키지 검색
brew search node

# 패키지 설치
brew install node

# 설치된 패키지 목록
brew list

# 패키지 업데이트
brew upgrade node

# 패키지 제거
brew uninstall node

# Homebrew 자체 업데이트
brew update
```

---

## 2. JavaScript/TypeScript 환경

### 2.1 Node.js 설치 (nvm 사용)

**nvm**(Node Version Manager)으로 Node.js 버전을 관리합니다.

```bash
# nvm 설치
brew install nvm

# nvm 디렉터리 생성
mkdir ~/.nvm

# zsh 설정 파일에 추가
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && \. "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"' >> ~/.zshrc

# 터미널 재시작 또는
source ~/.zshrc

# nvm 설치 확인
nvm --version
```

**Node.js 설치**:

```bash
# LTS 버전 설치 (추천)
nvm install --lts

# 특정 버전 설치
nvm install 20.10.0

# 설치된 버전 확인
nvm list

# 버전 전환
nvm use 20

# 기본 버전 설정
nvm alias default 20

# Node.js 버전 확인
node --version
# 출력 예시: v20.10.0

npm --version
# 출력 예시: 10.2.3
```

### 2.2 npm vs yarn vs pnpm

**npm** (기본 제공):
```bash
npm install express
npm run dev
```

**yarn** (더 빠름):
```bash
brew install yarn
yarn add express
yarn dev
```

**pnpm** (디스크 효율적):
```bash
brew install pnpm
pnpm add express
pnpm dev
```

**권장**: 이 포트폴리오에서는 **npm** 사용 (Node.js와 함께 설치됨)

### 2.3 TypeScript 설치 및 사용

```bash
# TypeScript 전역 설치
npm install -g typescript

# 버전 확인
tsc --version
# 출력 예시: Version 5.3.3

# ts-node (TypeScript를 직접 실행)
npm install -g ts-node
```

### 2.4 첫 TypeScript 프로그램

```bash
# 프로젝트 폴더 생성
mkdir hello-ts && cd hello-ts

# package.json 생성
npm init -y

# TypeScript 로컬 설치
npm install --save-dev typescript @types/node

# tsconfig.json 생성
npx tsc --init
```

**tsconfig.json** 기본 설정:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**src/index.ts** 작성:

```typescript
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return `Hello, ${user.name}! You are ${user.age} years old.`;
}

const user: User = { name: "Alice", age: 25 };
console.log(greet(user));
```

**컴파일 및 실행**:

```bash
# TypeScript → JavaScript 컴파일
npx tsc

# 컴파일된 JS 실행
node dist/index.js
# 출력: Hello, Alice! You are 25 years old.

# 또는 ts-node로 직접 실행
npx ts-node src/index.ts
```

### 2.5 디버깅

**console.log 디버깅**:

```typescript
// src/debug-example.ts
function calculate(a: number, b: number): number {
  console.log('Input values:', { a, b });
  const result = a + b;
  console.log('Result:', result);
  return result;
}

calculate(5, 10);
```

**VS Code 디버거 설정** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug TypeScript",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/index.ts"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

**사용 방법**:
1. VS Code에서 브레이크포인트 설정 (줄번호 왼쪽 클릭)
2. F5 키 또는 Debug 메뉴에서 "Start Debugging"
3. 변수 값 확인, Step Over (F10), Step Into (F11)

---

## 3. React/Vite 프로젝트

### 3.1 Vite 프로젝트 생성

```bash
# Vite + React + TypeScript 프로젝트 생성
npm create vite@latest my-react-app -- --template react-ts

# 프로젝트 폴더로 이동
cd my-react-app

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
# 출력: Local: http://localhost:5173/
```

브라우저에서 `http://localhost:5173` 열기 → React 로고와 카운터 앱 확인

### 3.2 프로젝트 구조

```
my-react-app/
├── src/
│   ├── App.tsx          # 메인 컴포넌트
│   ├── main.tsx         # 진입점
│   ├── App.css
│   └── index.css
├── public/              # 정적 파일
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts       # Vite 설정
```

### 3.3 개발 명령어

```bash
# 개발 서버 (핫 리로드)
npm run dev

# 프로덕션 빌드
npm run build
# 결과물: dist/ 폴더

# 빌드 결과 미리보기
npm run preview
```

### 3.4 컴포넌트 작성 예시

**src/components/Counter.tsx**:

```tsx
import { useState } from 'react';

interface CounterProps {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount(count - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

**src/App.tsx**에서 사용:

```tsx
import { Counter } from './components/Counter';

function App() {
  return (
    <div className="App">
      <h1>My React App</h1>
      <Counter initialCount={10} />
    </div>
  );
}

export default App;
```

### 3.5 React DevTools

```bash
# Chrome 확장 프로그램 설치
# https://chrome.google.com/webstore → "React Developer Tools" 검색 후 설치
```

**사용 방법**:
1. 개발 서버 실행 (`npm run dev`)
2. Chrome 개발자 도구 열기 (F12)
3. "Components" 탭: 컴포넌트 트리, props, state 확인
4. "Profiler" 탭: 렌더링 성능 측정

---

## 4. Node.js/NestJS 프로젝트

### 4.1 간단한 Express 서버

```bash
# 프로젝트 생성
mkdir my-node-server && cd my-node-server
npm init -y

# Express 설치
npm install express
npm install --save-dev @types/express typescript ts-node nodemon

# TypeScript 설정
npx tsc --init
```

**src/server.ts**:

```typescript
import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Express!' });
});

app.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ id, name: 'Alice', email: 'alice@example.com' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**package.json** 스크립트:

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

**실행**:

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 다른 터미널에서 테스트
curl http://localhost:3000
# 출력: {"message":"Hello from Express!"}

curl http://localhost:3000/users/123
# 출력: {"id":"123","name":"Alice","email":"alice@example.com"}
```

### 4.2 NestJS 프로젝트

```bash
# Nest CLI 전역 설치
npm install -g @nestjs/cli

# 프로젝트 생성
nest new my-nest-app

# 프로젝트 폴더로 이동
cd my-nest-app

# 개발 서버 실행
npm run start:dev
# 출력: Application is running on: http://[::1]:3000
```

**컨트롤러 생성**:

```bash
# users 모듈 생성 (controller + service + module)
nest g resource users
```

**테스트**:

```bash
curl http://localhost:3000/users
```

### 4.3 VS Code 디버거 (Node.js)

**.vscode/launch.json**:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["src/main.ts"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector",
      "restart": true,
      "console": "integratedTerminal"
    }
  ]
}
```

**사용법**:
1. 브레이크포인트 설정
2. F5로 디버깅 시작
3. API 호출 시 브레이크포인트에서 멈춤

---

## 5. C++ 개발 환경

### 5.1 컴파일러 설치

```bash
# Xcode Command Line Tools (clang++ 포함)
xcode-select --install

# 설치 확인
clang++ --version
# 출력: Apple clang version 15.0.0

# 또는 GCC 설치 (선택)
brew install gcc
g++-13 --version
```

### 5.2 CMake 설치

```bash
# CMake 설치
brew install cmake

# 버전 확인
cmake --version
# 출력: cmake version 3.28.0
```

### 5.3 첫 C++ 프로젝트

**프로젝트 구조**:

```
hello-cpp/
├── CMakeLists.txt
├── src/
│   └── main.cpp
└── include/
    └── hello.h
```

**CMakeLists.txt**:

```cmake
cmake_minimum_required(VERSION 3.15)
project(HelloCpp)

# C++17 표준 사용
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 컴파일 옵션
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -g")

# include 디렉터리 추가
include_directories(include)

# 실행 파일 생성
add_executable(hello src/main.cpp)
```

**include/hello.h**:

```cpp
#ifndef HELLO_H
#define HELLO_H

#include <string>

class Greeter {
public:
    Greeter(const std::string& name);
    std::string greet() const;

private:
    std::string name_;
};

#endif // HELLO_H
```

**src/main.cpp**:

```cpp
#include "hello.h"
#include <iostream>

Greeter::Greeter(const std::string& name) : name_(name) {}

std::string Greeter::greet() const {
    return "Hello, " + name_ + "!";
}

int main() {
    Greeter greeter("World");
    std::cout << greeter.greet() << std::endl;

    std::cout << "Enter your name: ";
    std::string name;
    std::getline(std::cin, name);

    Greeter custom_greeter(name);
    std::cout << custom_greeter.greet() << std::endl;

    return 0;
}
```

### 5.4 빌드 및 실행

```bash
# 빌드 디렉터리 생성 (out-of-source build)
mkdir build && cd build

# CMake 실행 (Makefile 생성)
cmake ..

# 컴파일
make

# 또는 더 빠른 병렬 빌드
make -j8

# 실행
./hello
# 출력: Hello, World!
# Enter your name: Alice
# Hello, Alice!
```

**빌드 정리**:

```bash
# build 폴더 전체 삭제 후 재빌드
cd .. && rm -rf build
mkdir build && cd build
cmake .. && make
```

### 5.5 디버깅 (lldb)

```bash
# 디버거로 실행
lldb ./hello

# lldb 명령어
(lldb) breakpoint set --name main    # main 함수에 브레이크포인트
(lldb) run                             # 프로그램 시작
(lldb) next                            # 다음 줄 실행 (Step Over)
(lldb) step                            # 함수 안으로 들어가기 (Step Into)
(lldb) print name                      # 변수 출력
(lldb) continue                        # 계속 실행
(lldb) quit                            # 종료
```

**VS Code 디버거** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "C++ Debug (lldb)",
      "type": "cppdbg",
      "request": "launch",
      "program": "${workspaceFolder}/build/hello",
      "args": [],
      "stopAtEntry": false,
      "cwd": "${workspaceFolder}",
      "environment": [],
      "externalConsole": false,
      "MIMode": "lldb",
      "preLaunchTask": "build"
    }
  ]
}
```

**.vscode/tasks.json** (빌드 태스크):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "shell",
      "command": "cmake --build ${workspaceFolder}/build",
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

### 5.6 CMake 고급 예제

**여러 소스 파일**:

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(MyProject)

set(CMAKE_CXX_STANDARD 17)

# 모든 소스 파일 자동 수집
file(GLOB_RECURSE SOURCES "src/*.cpp")

# 실행 파일 생성
add_executable(myapp ${SOURCES})
target_include_directories(myapp PRIVATE include)

# 외부 라이브러리 링크 (예: pthread)
target_link_libraries(myapp pthread)
```

**Boost 라이브러리 사용**:

```bash
# Boost 설치
brew install boost
```

```cmake
# CMakeLists.txt
find_package(Boost 1.75 REQUIRED COMPONENTS system)

add_executable(myapp src/main.cpp)
target_link_libraries(myapp Boost::system)
```

---

## 6. Git & GitHub

### 6.1 Git 설치 및 설정

```bash
# Git 설치 (Xcode Command Line Tools에 포함되지만 최신 버전 설치)
brew install git

# 버전 확인
git --version
# 출력: git version 2.43.0

# 사용자 정보 설정
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 설정 확인
git config --list
```

### 6.2 기본 Git 워크플로우

```bash
# 새 프로젝트 초기화
mkdir my-project && cd my-project
git init

# 파일 추가
echo "# My Project" > README.md
git add README.md

# 커밋
git commit -m "Initial commit"

# GitHub 원격 저장소 연결
git remote add origin https://github.com/yourusername/my-project.git

# 푸시
git push -u origin main
```

### 6.3 일상적인 Git 명령어

```bash
# 상태 확인
git status

# 변경 사항 확인
git diff

# 모든 변경사항 스테이징
git add .

# 커밋
git commit -m "Add new feature"

# 푸시
git push

# 풀 (원격 변경사항 가져오기)
git pull

# 브랜치 생성 및 전환
git checkout -b feature/new-feature

# 브랜치 목록
git branch

# 브랜치 병합
git checkout main
git merge feature/new-feature
```

### 6.4 .gitignore 설정

**Node.js 프로젝트**:

```gitignore
# Node.js
node_modules/
npm-debug.log
yarn-error.log
.env
dist/

# macOS
.DS_Store

# IDE
.vscode/
.idea/
```

**C++ 프로젝트**:

```gitignore
# Build files
build/
cmake-build-*/
*.o
*.out

# IDE
.vscode/
.idea/

# macOS
.DS_Store
```

---

## 7. VS Code 설정

### 7.1 VS Code 설치

```bash
# Homebrew Cask로 설치
brew install --cask visual-studio-code

# 또는 https://code.visualstudio.com 에서 다운로드
```

### 7.2 필수 확장 프로그램

**JavaScript/TypeScript**:
- ESLint
- Prettier - Code formatter
- JavaScript (ES6) code snippets

**React**:
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag

**Node.js**:
- npm Intellisense
- Path Intellisense

**C++**:
- C/C++ (Microsoft)
- CMake Tools
- CodeLLDB (디버깅)

**공통**:
- GitLens
- Error Lens
- Bracket Pair Colorizer (VS Code 기본 내장됨)

### 7.3 VS Code 설정 (settings.json)

**Command Palette** (⌘+Shift+P) → "Preferences: Open Settings (JSON)"

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [80, 120],
  "files.autoSave": "onFocusChange",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "javascript.updateImportsOnFileMove.enabled": "always",
  "[cpp]": {
    "editor.tabSize": 4
  },
  "C_Cpp.default.cppStandard": "c++17",
  "cmake.configureOnOpen": true
}
```

### 7.4 유용한 단축키 (macOS)

| 기능 | 단축키 |
|------|--------|
| 명령 팔레트 | ⌘+Shift+P |
| 파일 검색 | ⌘+P |
| 전체 검색 | ⌘+Shift+F |
| 터미널 토글 | ⌃+` |
| 사이드바 토글 | ⌘+B |
| 정의로 이동 | F12 |
| 참조 찾기 | Shift+F12 |
| 이름 바꾸기 | F2 |
| 포맷팅 | Option+Shift+F |
| 디버깅 시작 | F5 |

---

## 8. 트러블슈팅

### 8.1 Homebrew 관련

**문제**: `brew` 명령어를 찾을 수 없음

**해결**:
```bash
# Intel Mac
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"

# Apple Silicon Mac
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 8.2 Node.js 관련

**문제**: `nvm: command not found`

**해결**:
```bash
# ~/.zshrc에 다음 추가
export NVM_DIR="$HOME/.nvm"
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"

# 터미널 재시작
source ~/.zshrc
```

**문제**: npm 패키지 설치 시 권한 오류 (EACCES)

**해결** (권장):
```bash
# npm 기본 디렉터리를 사용자 홈으로 변경
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

**절대 하지 말 것**: `sudo npm install -g` (보안 위험)

### 8.3 TypeScript 관련

**문제**: `Cannot find module '@types/node'`

**해결**:
```bash
npm install --save-dev @types/node
```

**문제**: `tsconfig.json`의 `moduleResolution` 오류

**해결**:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### 8.4 C++/CMake 관련

**문제**: `cmake: command not found`

**해결**:
```bash
brew install cmake
# 터미널 재시작
```

**문제**: `#include <iostream>` 오류 (헤더 파일을 찾을 수 없음)

**해결**:
```bash
# Xcode Command Line Tools 재설치
xcode-select --install
```

**문제**: CMake가 컴파일러를 찾지 못함

**해결**:
```bash
# CMake에 컴파일러 명시
cmake -DCMAKE_C_COMPILER=/usr/bin/clang -DCMAKE_CXX_COMPILER=/usr/bin/clang++ ..
```

**문제**: `fatal error: 'boost/asio.hpp' file not found`

**해결**:
```bash
# Boost 설치
brew install boost

# CMakeLists.txt에서 include 경로 추가
include_directories(/opt/homebrew/include)
```

### 8.5 Git 관련

**문제**: `Permission denied (publickey)` - GitHub push 실패

**해결**:
```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your.email@example.com"

# SSH 키를 ssh-agent에 추가
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 공개 키 복사
pbcopy < ~/.ssh/id_ed25519.pub

# GitHub → Settings → SSH and GPG keys → New SSH key → 붙여넣기
```

**문제**: 커밋 후 `author identity unknown` 오류

**해결**:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 8.6 VS Code 관련

**문제**: TypeScript 자동완성이 작동하지 않음

**해결**:
1. VS Code 재시작
2. Command Palette (⌘+Shift+P) → "TypeScript: Restart TS Server"
3. `node_modules` 삭제 후 `npm install` 재실행

**문제**: C++ IntelliSense가 작동하지 않음

**해결**:
```bash
# compile_commands.json 생성
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..

# VS Code 설정에 추가
{
  "C_Cpp.default.compileCommands": "${workspaceFolder}/build/compile_commands.json"
}
```

---

## 프로젝트 적용 체크리스트

### ✅ JavaScript/TypeScript 프로젝트

- [ ] Node.js 설치 완료 (`node --version` 확인)
- [ ] TypeScript 설치 완료 (`tsc --version` 확인)
- [ ] `package.json` 생성 (`npm init`)
- [ ] `tsconfig.json` 설정
- [ ] `npm run dev` 스크립트 작동 확인

### ✅ React/Vite 프로젝트

- [ ] Vite 프로젝트 생성 (`npm create vite@latest`)
- [ ] `npm run dev` 실행 확인
- [ ] `http://localhost:5173` 접속 확인
- [ ] React DevTools 설치

### ✅ Node.js/NestJS 프로젝트

- [ ] NestJS CLI 설치 (`npm install -g @nestjs/cli`)
- [ ] `nest new` 프로젝트 생성
- [ ] `npm run start:dev` 실행 확인
- [ ] `curl http://localhost:3000` 응답 확인

### ✅ C++ 프로젝트

- [ ] CMake 설치 완료 (`cmake --version`)
- [ ] 컴파일러 설치 확인 (`clang++ --version`)
- [ ] `CMakeLists.txt` 작성
- [ ] `mkdir build && cd build && cmake .. && make` 빌드 성공
- [ ] 실행 파일 실행 확인

### ✅ Git & VS Code

- [ ] Git 설치 및 설정 완료 (`git config --list`)
- [ ] GitHub SSH 키 등록 완료
- [ ] VS Code 설치 및 확장 프로그램 설치
- [ ] `.gitignore` 파일 생성

---

## 다음 단계

환경 설정이 완료되었다면 다음 튜토리얼로 진행하세요:

- **JavaScript/TypeScript 학습**: [T01 - JS/TS 코어 →](./T01-js-ts-core.md)
- **React 학습**: [T06 - React/Vite 기본 →](./T06-react-vite-basics.md)
- **Node.js 학습**: [T02 - Node HTTP + ffmpeg →](./T02-node-http-ffmpeg.md)
- **C++ 학습**: [T10 - Modern C++ + TCP 소켓 →](./T10-cpp-raii-tcp.md)

---

## 면접 질문

### 1. npm, yarn, pnpm의 차이는?
**답변**:
- **npm**: Node.js 기본 패키지 관리자. 가장 널리 사용됨.
- **yarn**: Facebook 개발. 더 빠른 설치 속도, `yarn.lock`으로 버전 고정.
- **pnpm**: 디스크 효율적 (하드링크 사용). 모노레포에 유리.

**실전 경험**: "이 포트폴리오에서는 npm 사용. 팀 프로젝트에서는 통일된 패키지 관리자 사용이 중요."

### 2. tsconfig.json의 strict 옵션은 무엇인가?
**답변**:
- `"strict": true`는 모든 엄격한 타입 체크 옵션을 활성화합니다.
- 포함 옵션: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` 등
- **장점**: 런타임 오류를 컴파일 타임에 잡을 수 있음

**실전 경험**: "프로젝트 초기부터 strict 모드 사용 권장. 나중에 적용하면 수정 작업이 많음."

### 3. CMake의 out-of-source build가 무엇인가?
**답변**:
- **In-source build**: 소스 디렉터리에 빌드 파일 생성 (권장하지 않음)
- **Out-of-source build**: 별도 `build/` 디렉터리에 빌드 파일 생성

**장점**:
- 소스 코드와 빌드 산출물 분리
- `.gitignore`에 `build/` 추가하면 깔끔
- `rm -rf build` 후 재빌드 가능

**실전 예시**:
```bash
mkdir build && cd build
cmake ..
make
```

### 4. VS Code의 디버거와 console.log의 차이는?
**답변**:
- **console.log**: 간단하고 빠름. 하지만 매번 로그 추가/제거 필요.
- **디버거**: 브레이크포인트로 실행 중단, 변수 검사, 스택 추적 가능.

**사용 시점**:
- 간단한 값 확인 → console.log
- 복잡한 버그 추적, 실행 흐름 분석 → 디버거

**실전 경험**: "프로덕션 코드에 console.log 남기지 않도록 주의. ESLint 규칙으로 방지 가능."

### 5. Homebrew의 brew install과 brew install --cask의 차이는?
**답변**:
- **brew install**: CLI 도구, 라이브러리 (예: `node`, `cmake`, `git`)
- **brew install --cask**: GUI 애플리케이션 (예: `visual-studio-code`, `google-chrome`)

**예시**:
```bash
brew install node          # CLI 도구
brew install --cask vscode # GUI 앱
```

---

**마지막 업데이트**: 2025년 1월
**다음 튜토리얼**: 필요한 튜토리얼 선택 (T01, T02, T06, T10)
