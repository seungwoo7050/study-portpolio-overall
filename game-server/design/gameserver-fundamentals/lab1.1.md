# TCP 에코 서버 설계 일지 (C++ / 멀티스레드)
> 이 글은 TCP 에코 서버를 C++로 구현하기 전에, 설계 과정을 기록해 둔 메모이다
## 1. 문제 정의 & 요구사항
### 1.1 목표
- TCP 기반 에코 서버를 C++로 구현한다
- 여러 클라이언트가 보낸 데이터를 그대로 돌려준다
- 두 가지 종료 방식이 있다:
    - 특정 클라이언트 연결만 종료(`exit`)
    - 서버 전체 종료 (`shutdown`)
- 실행 시 인자를 받는다:
    - 포트 번호 (필수 또는 기본값)
    - prefix (선택)
        - 있으면 응답 앞에 `"[prefix] "`를 붙인다
### 1.2 기능 요구사항
1. 서버는 지정된 포트에서 `listen()` 한다
2. 여러 클라이언트의 접속을 동시에 처리할 수 있다
3. 각 클라이언트에 대해:
    - 데이터를 읽어서
    - prefix가 있으면 `"[prefix] "`를 앞에 붙이고
    - 그대로 돌려준다
4. 클라이언트가 연결을 끊으면 해당 연결만 정리한다
5. 서버는 다음 조건에서 **정상 종료**할 수 있어야 한다
    - `SIGINT` / `SIGTERM` 시그널 수신
    - 어떤 클라이언트가 `shutdown` 명령을 보냄
### 1.3 비기능 요구사항
- C++ RAII로 소켓을 감싸서 리소스 누수를 방지한다
- 에러 처리는 예외 기반으로 간다 (`SocketError`)
- 구조는 이후에 프로토콜/기능을 확장할 수 있게 레이어링한다
- 과제/학습 규모이므로, 수천/수만 연결에 대한 성능 뉴팅은 고려하지 않는다
## 2. 동작 시나리오
### 2.1 서버 전체 시나리오
1. `./echo_server [port] [prefix]` 실행
2. main에서:
    - 포트 인자 파싱 (없으면 기본 값, 예: 8080)
    - prefix 인자 파싱 (없으면 빈 문자열)
    - `EchoServer` 객체 생성
    - 시그널 핸들러 등록 (`SIGINT` / `SIGTERM`)
    - `server.run()` 호출
3. `EchoServer::run()`에서:
    - TCP 소켓 생성
    - `SO_REUSEADDR` 설정
    - `bind(port)`
    - `listen()`
    - `accept_loop()` 진입
4. `accept_loop()`에서:
    - `running_` 플래그가 `true`인 동안 `accept()` 반복
    - 새 유입 연결마다:
        - 새 `Socket` 객체 생성
        - `handle_client(Socket)` 을 처리하는 스레드 생성
        - 스레드 포인터를 내부 백터에 보관
5. 종료 트리거 발생 시:
    - `stop()`이 호출되어 `running_` = `false`, 서버 소켓 shutdown/close
    - `accept()`가 에러로 깨지면서 루프 종료
    - `wait_for_clients()`에서 클라이언트 스레드 join
6. `run()` 리턴 후 main에서 프로그램 종료
### 2.2 클라이언트 연결 시나리오
1. 클라이언트가 `connect()` 호출 → 서버 `accept()`에서 새 소켓 반환
2. 서버는 이 소켓으로 `handle_client` 스레드를 하나 만든다.
3. `handle_client`에서:
    - 내부 버퍼로 데이터를 읽는다 (receive)
    - `receive == 0` 이면 클라이언트 종료로 보고 루프 탈출
    - 읽은 바이트를 문자열/뷰로 해석.
    - 명령어인지 확인:
        - `exit` 계열이면 → **이 연결만 종료**
        - `shutdown` 계열이면 → `server.stop()` 호출 후 종료
    - 명령어가 아니면:
        - prefix가 비어 있으면 그대로 echo
        - prefix가 있으면 `"[prefix] " + message` 형태로 echo
4. 예외 발생 시:
    - 로그 출력 후 해당 연결 종료
## 3. 동시성 모델 선택
후보: 
1. blocking I/O + connection per thread
2. select/poll 기반 event loop
3. epoll/kqueue + thread pool
과제/학습 목적 + 코드 단순성 기준으로:
> **blocking I/O + connection per thread** 모델을 선택
- 장점: 구현 직관적, 코드 이해 쉬움
- 단점: 많은 수의 동시 연결에서 스레드 오버헤드
이번 목표는 "규모 있는 서버의 기본 패턴 익히기" 이므로 충분하다 판단
## 4. 레이어 설계
레이어를 **"역할"** 기준으로 나눈다.
### 4.1 Socket 레이어
- **책임**: OS 소켓을 C++ RAII 객체로 감싸고, 저수준 TCP API 제공
- **역할**:
    - 소켓 생성/파괴 책임
    - `bind`, `listen`, `accept`, `send`, `recv` 래핑
    - 에러를 `SocketError` 예외로 전달
    - 주소/옵션 설정(like `set_reuse_address`)
**핵심 인터페이스 (개념)**:
```cpp
class Socket {
public:
    Socket();
    explicit Socket(int fd);
    Socket(const Socket&) = delete;
    Socket& operator=(const Socket&) = delete;
    Socket(Socket&& other) noexcept;
    Socket& operator=(Socket&& other) noexcept;
    ~Socket();

    static Socket create_tcp();

    void set_reuse_address(bool enable);
    void bind(uint16_t port);
    void listen(int backlog);
    Socket accept();

    ssize_t receive(uint8_t* buffer, size_t length);
    void send_all(const uint8_t* data, size_t length);

    void shutdown();
    void close();
};
```
- **동작 포인트**:
    - 생성자: `fd_`를 -1로 초기화
        - `explicit` 키워드를 사용해 정수→소켓 암시적 변환 방지
    - 이동 생성자/대입 연산자: 소유권 이전
    - 소멸자: `close()` 호출
    - `create_tcp()`: `socket()` 호출, 실패 시 예외 던짐
    - `bind()`, `listen()`, `accept()`: 각각 대응하는 시스템콜 래핑
    - `receive()`: `recv()` 래핑, 반환값은 읽은 바이트 수
    - `send_all()`: 내부 루프에서 `send()` 호출, 모든 바이트 전송 보장
    - `shutdown()`, `close()`: 소켓 종료/닫기
### 4.2 EchoServer 레이어
- **책임**: 서버 라이프사이클 관리, 클라이언트 스레드, 종료 정책 관리.
- **상태**:
    - `uint16_t port_`
    - `std::string prefix_`
    - `int backlog_`
    - `std::atomic<bool> running_`
    - `Socket server_socket_`
    - `std::vector<std::thread> client_threads_`
    - `std::mutex threads_mutex_`
**핵심 인터페이스 (개념)**:
```cpp
class EchoServer {
public:
    EchoServer(uint16_t port,
               std::string prefix = {},
               int backlog = SOMAXCONN);
    
    ~EchoServer();

    void run();
    void stop();

private:
    void accept_loop();
    void handle_client(Socket client_socket);
    void wait_for_clients();

    uint16_t port_;
    std::string prefix_;
    int backlog_;
    std::atomic<bool> running_;
    Socket server_socket_;

    std::vector<std::thread> client_threads_;
    std::mutex threads_mutex_;
};
```
**동작 포인트**:
- `run()`:
    - `running_` 플래그 세팅
    - 서버 소켓 `create_tcp` → `set_reuse_address(true)` → `bind` → `listen`
    - `accept_loop()` 호출
    - 종료 후 `wait_for_clients()`
- `stop()`:
    - `running_`를 `false`로 (CAS)
    - `server_socket_.shutdown()` / `close()` 로 accept를 깨운다.
- `accept_loop()`:
    - `while (running_)` 루프
    - `accept()` 성공 시, 새 스레드 생성 → `handle_client` 호출
    - 예외 발생 시, `running_` 상태에 따라 종료/로그 처리
- `handle_client()`:
    - `while (true)` 또는 `while (running_)` 루프에서 `receive()`
    - 명령어 판별
    - prefix 포함 응답 생성 및 `send_all`
    - 예외/0바이트 시 종료
- `wait_for_clients()`:
    - 클라이언트 스레드 벡터를 swap 해서 안전하게 join
### 4.3 main / 엔트리포인트 레이어
- **책임**: 실행 인자 파싱, 서버 인스턴스 구성, 시그널 처리, 전체 예외 처리
- **핵심 흐름**:
    1. `argc`/`argv` 로 `port`/`prefix` 파싱
    2. EchoServer server(port, prefix);
    3. global/atomic 포인터에 &server 저장 (시그널 핸들러에서 `stop()` 호출 용)
    4. `SININT`/`SIGTERM` → `signal_handler` 설정
    5. `server.run()` 호출
    6. 최상위 예외 캐치해서 에러 메시지 출력 후 종료 코드 반환
## 5. 프로토콜 & 명령 설계
### 5.1 데이터 처리
- TCP는 스트림이므로, "한 번의 recv가 한 줄" 이라는 보장은 없다
- 실무 정석은 버퍼를 누적하고 `\n` 단위로 문자열을 잘라 명령을 파싱하는 것
- 과제 규모에서:
    - 최소한 `"\r\n"` / `"\n"` 의 변형은 허용
    - 필요하다면 누적 버퍼 기반 라인 파싱으로 확장 가능
### 5.2 명령어
- `exit` 계열:
    - `"exit"`, `"exit\n"`, `"exit\r\n"`
    - 의미: 해당 클라이언트 연결만 종료
- `shutdown` 계열:
    - `"shutdown"`, `"shutdown\n"`, `"shutdown\r\n"`
    - 의미: 서버 전체 종료
        - `server.stop()` 호출 → `accept_loop` 종료 → 전체 서버 종료
### 5.3 prefix
- 서버 실행 인자에서 prefix를 문자열로 받는다
- prefix가 비어 있지 않다면:
    - 응답은 항상 `"[prefix] " + 원본 메시지` 형식
- 명령 판별은 prefix 붙이기 **이전에** 한다
    - 즉, 명령 문자열은 클라이언트가 보낸 원본 기준
## 6. 에러/종료 정책
### 6.1 에러 처리
- 소켓 관련 에러는 `SocketError` 예외로 표현
- `accept_loop()`:
    - `running_ == false` 이면, 예외가 나도 조용히 루프 종료
    - 그렇지 않으면 로그 출력 후 계속/종료 판단
- `handle_client()`:
    - 예외 발생 시 해당 연결만 종료
    - 로그만 남기고 서버 전체에는 영향 주지 않는다
### 6.2 종료 시나리오
1. 시그널 종료:
    - `SIGINT` / `SIGTERM` → `signal_handler` → `server.stop()`
    - `accepct` 깨짐 → `accept_loop` 종료 → `wait_for_clients` → `run()` 종료
2. 클라이언트 `shutdown` 명령:
    - `handle_client` 에서 `shutdown` 감지 → `server.stop()` → 해당 연결 종료
3. 클라이언트 `exit` 명령:
    - 현재 연결만 종료, 서버는 계속 동작
## 7. 테스트 전략
1. 기본 에코 동작
    - `nc localhost 8080` 접속
    - 여러 문자열 입력 → 그대로 돌아오는지 확인
2. prefix 동작
    - `./echo_server 8080 TEST` 실행
    - `nc localhost 8080` 접속
    - 문자열 입력 → `"[TEST] " + 원본` 형태로 돌아오는지
3. `exit`
    클라이언트에서 `exit\n` 전송 → 연결만 끊기는지 확인 (서버는 계속)
4. `shutdown`
    - 클라이언트에서 `shutdown\n` 전송 → 서버 전체 종료 확인
5. 동시성 테스트
    - 여러 클라이언트에서 동시에 `echo` / `exit` / `shutdown` 테스트