# TCP 턴제 전투 서버 설계 일지 (C++ / 멀티스레드)
> 이 글은 **2인 턴제 전투 게임 서버**의 설계 과정을 정리한 메모다  
> 기반 소켓 레이어는 기존 `src/lab-1.1-tcp-echo-server/socket.h` 를 그대로 재사용한다
## 1. 문제 정의 & 요구사항
### 1.1 목표
* TCP 기반 **2인 턴제 텍스트 전투 서버**를 C++로 구현한다
* 클라이언트는 텍스트 명령을 전송한다:
  * `ATTACK` : 내 차례일 때 상대를 공격 (5 - 15 랜덤 데미지)
  * `STATUS` : 간단한 상태 안내 메시지
  * `QUIT`   : 해당 플레이어 연결 종료 + 서버 전체 종료
* 서버는 **고정 틱 레이트(10 TPS)** 로 게임 루프를 돌리면서:
  * 큐에 쌓인 명령을 처리하고
  * 게임 상태를 업데이트하고
  * 전체 플레이어에게 상태를 브로드캐스트한다
### 1.2 기능 요구사항
1. 서버는 지정된 포트에서 `listen()` 한다
   * 기본 포트: `9100`
   * 실행 인자: `./game_server [port]`
2. 최대 **2명의 플레이어**만 지원한다
   * 0번 접속: `Player 1`
   * 1번 접속: `Player 2`
3. 두 플레이어가 모두 접속하면:
   * 각 플레이어 HP = 100으로 초기화
   * 턴 순서: `Player 1` → `Player 2` → `Player 1` → … 순환
   * 게임 루프 스레드를 생성해서 틱을 돌린다
4. 각 틱마다:
   * 명령 큐를 비우면서 `ATTACK` 명령을 처리 (턴 체크 포함)
   * 게임 상태를 점검(모두 죽음 / 한 명만 생존 / 연결 끊김 등)
   * 현재 스냅샷을 모든 플레이어에게 텍스트로 브로드캐스트
5. 게임 종료 조건:
   * 공격으로 상대 HP가 0 이하가 됨 → 공격한 플레이어 승리
   * 누군가 연결 끊김 → 남은 연결된 플레이어 승리
   * 모든 플레이어 사망 → 무승부(`winner_id` 없음)
6. 서버 종료 조건:
   * `SIGINT` / `SIGTERM` 수신.
   * 누군가 `QUIT` 명령 전송.
   * (현 구현 기준) 한 판만 플레이하고 `run()` 종료
### 1.3 비기능 요구사항
* 소켓은 기존 RAII 래퍼 `net::Socket` 사용
* 멀티스레드 환경에서 자료구조를 보호:
  * 플레이어 목록: `players_mutex_`
  * 게임 상태: `GameState` 내부 `mutex_`
  * 명령 큐: `GameLoop` 내부 `command_mutex_`
* 서버 스레드 모델:
  * 메인 스레드: `accept()` 루프
  * **클라이언트별 스레드**: 입력 처리
  * **게임 루프 스레드**: 틱 처리 + 브로드캐스트
* 복잡한 확장(매치메이킹, 여러 방, 수만 연결)은 고려하지 않는다
  **목표는 “턴제 게임 서버 기본 패턴" 학습.**
## 2. 동작 시나리오
### 2.1 서버 전체 시나리오
1. 실행:
   `./game_server` 또는 `./game_server 9100`
2. `main`:
   * 포트 인자 파싱 (검증: `0 < port <= UINT16_MAX`).
   * `game::GameServer server(port);`
   * `SignalHandler::register_server([&server]{ server.stop(); });`
   * `SignalHandler::install();` 로 `SIGINT` / `SIGTERM` 등록
   * `server.run();` 호출
3. `GameServer::run()`:
   * `listener_` 소켓에 대해:
     * `create_tcp()` → `set_reuse_address(true)` → `bind(port_)` → `listen()`
   * `running_ = true`
   * 접속 대기: `while (running_ && players_.size() < 2)`:
     * `accept()` 로 새 연결 수락
     * `players_.size()` 를 기반으로 플레이어 ID 할당 (0 또는 1)
     * 이름은 `"Player " + (id+1)`
     * `PlayerSession`을 만들어 `players_` 벡터에 추가
     * `GameState::add_or_update_player(id, name)` 호출
     * 환영 메시지 전송
     * `handle_client()` 를 처리하는 클라이언트 스레드 생성
     * 두 번째 플레이어가 들어오면:
       * `state_.start_if_ready();`
       * 게임 루프 스레드를 만들어 `loop_.run()` 실행
4. `players_.size() == 2` 가 되는 순간 `accept` 루프 종료
5. 이후:
   * 클라이언트 스레드들이 종료될 때까지 조인
   * 게임 루프 스레드 조인
   * 리스너 소켓 닫기
   * `running_ = false`
   * (signal 발생 시) `"Signal received. Server shut down."` 출력
   * `run()` 종료 → `main` 반환
### 2.2 전투 시나리오
* 클라 A, B 가 각각 접속:
  1. 서버는 둘 다 로비에 추가하고 `"Battle started."` 로그를 상태로 남긴다
  2. 틱마다 서버는 현재 상태를 브로드캐스트:
     * 틱 번호, 상태(RUNNING/FINISHED/WAITING), 마지막 행동, 승자 등
     * 각 플레이어의 HP/온라인 상태/턴 여부
* 플레이어 입력 흐름:
  1. 클라는 `ATTACK\n` 등 텍스트를 보낸다
  2. 서버는 각 클라이언트 스레드에서 라인 단위로 읽어서 처리
  3. `ATTACK` 이면 `GameLoop::enqueue_command()` 로 명령 큐에 적재
  4. 다음 틱에서 게임 루프가 이 명령을 꺼내 실제 데미지 적용
* 종료:
  * 상대 HP가 0이 되면 `GameState`가 `game_over_ = true`, `winner_id_` 세팅
  * 게임 루프는 `state_.is_game_over()` 를 보고 루프 탈출, 마지막 틱 브로드캐스트
## 3. 동시성 모델
* **I/O**: `net::Socket` 기반 **blocking I/O**
* **접속 처리**:
  * 메인 스레드에서 `accept()` 루프 (최대 2명까지)
* **클라이언트 처리**:
  * 플레이어당 **1 스레드** (`GameServer::handle_client`)
  * 각 스레드는 해당 소켓에서 블로킹 `receive()` 호출
* **게임 루프**:
  * 별도 스레드 1개에서 `GameLoop::run()` 실행
  * 내부에서:
    * 명령 큐 소비 (입력 처리)
    * `GameState` 수정
    * 스냅샷 브로드캐스트
* **시그널 처리**:
  * `SignalHandler::handle()` 는 전역에서 호출되며, 등록된 `stop()` 콜백 호출
  * `stop()` 는 `running_ = false`, 리스너 닫기, 게임 루프 중단, 클라 소켓 종료

멀티스레드에서 공유 데이터 보호:
* `GameState`: 내부 `mutex_`.
* 플레이어 세션 목록(`players_`): `players_mutex_`.
* 명령 큐(`GameLoop::commands_`): `command_mutex_`.
* 서버 실행 상태: `std::atomic<bool> running_`.
## 4. 레이어 설계
### 4.1 Socket 레이어 (`src/lab-1.1-tcp-echo-server/socket.h`)
* 역할: OS 소켓에 대한 RAII 래퍼
* 책임:
  * 소켓 생성/파괴, `bind`, `listen`, `accept`, `send_all`, `receive`, `shutdown`, `close`
  * 예외 기반 에러 처리 (`SocketError` 등)
* 이 프로젝트에서는 **이미 완성된 레이어**로 가정하고 사용만 한다
### 4.2 Domain: Player / GameState / Snapshot
#### Player (`player.h`)
* 역할: 한 플레이어의 상태 표현
* 핵심 속성:
  * `int id_;`
  * `std::string name_;`
  * `int health_;` (기본 100)
  * `bool connected_;`
* 주요 동작:
  * `reset_health(int)` : HP 재설정
  * `apply_damage(int)` : HP 감소, 0 미만으로 내려가지 않게 clamp
  * `is_alive()` / `is_connected()` 로 생존/접속 여부 확인
#### GameState (`game_state.h`)
* 역할: **게임 룰과 상태**를 관리하는 순수 도메인 레이어
* 주요 상태:
  * `std::vector<Player> players_;`
  * `int current_turn_index_;`
  * `bool running_;`
  * `bool game_over_;`
  * `std::optional<int> winner_id_;`
  * `std::string last_action_;`
* 주요 메서드:
  * `add_or_update_player(int id, std::string name);`
    * 플레이어 추가/갱신, HP = 100, `connected = true`
  * `mark_player_disconnected(int id);`
    * 해당 플레이어를 `connected = false`.
    * 진행 중인 게임이면 즉시 게임 종료 + 남은 플레이어를 승자로 설정
  * `start_if_ready();`
    * 플레이어 수가 2명 이상이고, 모두 유효/연결 상태면:
      * `running_ = true`, `game_over_ = false`, 승자 초기화
      * 모든 플레이어 HP = 100
      * 턴은 플레이어 인덱스 0부터 시작
  * `apply_attack(int attacker_id);`
    * 게임이 진행 중이고, 공격자가 현재 턴인지 검사
    * 다음 플레이어를 방어자로 선택 (2인 기준 상대 플레이어)
    * 방어자에 5 - 15 랜덤 데미지 적용
    * 방어자 사망 시: `game_over_ = true`, 승자 = 공격자
    * 아니면 턴을 방어자에게 넘김
  * `advance_tick();`
    * 매 틱마다 호출
    * 연결/생존 플레이어 상태를 체크:
      * 모든 조건을 만족하지 못하면 게임 종료 및 승자 결정
  * `snapshot() const;`
    * 현재 상태를 `StateSnapshot` 구조체로 추출
    * 각 플레이어에 대해 HP/연결 여부/턴 여부 담기
  * `is_active()`, `is_game_over()`:
    * 게임 루프에서 종료 판단용
### 4.3 GameLoop (`game_loop.h`)
* 역할: **고정 틱 레이트 게임 루프** + 명령 큐 처리 + 브로드캐스트 트리거
* 주요 구성:
  * `GameState &state_;`
  * `BroadcastFn broadcaster_;  // void(StateSnapshot)>`
  * `std::queue<Command> commands_;`
  * `std::mutex command_mutex_;`
  * `std::atomic<bool> running_;`
  * `std::uint64_t tick_counter_;`
* 상수:
  * `TARGET_TPS = 10`
  * `TICK_DURATION = 100ms`
* 메서드:
  * `enqueue_command(const Command &command);`
    * 외부(클라 스레드)에서 안전하게 명령 추가
  * `run();`
    * `running_ = true`
    * 루프:
      1. 틱 시작 시간 기록
      2. `process_inputs()`로 명령 큐 비우며 처리
      3. `update()` → `state_.advance_tick()`
      4. `tick_counter_++`
      5. `broadcast_tick()` → 스냅샷 생성 후 브로드캐스트 콜백 호출
      6. 남은 시간만큼 `sleep_for`
      7. `state_.is_game_over()` 이면 `running_ = false`
    * 루프 종료 후 마지막으로 한 번 더 `broadcast_tick()` 호출 (최종 상태 전송)
  * `stop();`
    * `running_ = false`로 설정해 루프 종료 유도
### 4.4 GameServer (`game_server.cpp` 내부)
* 역할: **네트워크 I/O + 세션 관리 + 게임 루프 연결**
* 주요 상태:
  * `std::uint16_t port_;`
  * `net::Socket listener_;`
  * `std::atomic<bool> running_;`
  * `GameState state_;`
  * `GameLoop loop_;`
  * `std::thread loop_thread_;`
  * `std::mutex players_mutex_;`
  * `std::vector<std::shared_ptr<PlayerSession>> players_;`
  * `std::vector<std::thread> client_threads_;`
* `PlayerSession`:
  * `int id;`
  * `std::string name;`
  * `net::Socket socket;`
  * `std::mutex send_mutex;` (송신 동기화)
  * `send(const std::string&)`:
    * `send_mutex` 잡고 `socket.send_all()` 호출
* 핵심 메서드:
  * `run();`
    * 앞에서 설명한 수명 전체 관리
  * `stop();`
    * `running_` 플래그 끄고:
      * `loop_.stop();`
      * 리스너 소켓 닫기.
      * 각 플레이어 소켓을 `shutdown()`, `close()`
  * `broadcast_state(StateSnapshot snapshot);`
    * 스냅샷 → 텍스트로 직렬화 → 모든 세션에 전송
  * `handle_client(const std::shared_ptr<PlayerSession> &session);`
    * 무한 루프:
      * `receive()` 로 바이트 읽기 → `pending` 문자열에 추가
      * `'\n'` 기준으로 라인 분리
      * 공백 제거(`trim`) 후 비어 있지 않으면 `handle_command()` 호출
    * 예외 발생 시 로그 출력 후 종료
    * 루프 탈출 시 `state_.mark_player_disconnected(session->id);`
  * `handle_command(...)`
    * 명령어를 대문자로 변환 후 분기 처리 (ATTACK / STATUS / QUIT / 기타)
  * `announce_to_player(...)`
    * 개별 플레이어에게 안내 메시지 전송
### 4.5 main / 엔트리포인트
* 역할:
  * 포트 인자 파싱
  * `GameServer` 인스턴스 생성
  * 시그널 핸들러에 `server.stop()` 등록
  * 예외 캐치 후 에러 코드 반환
## 5. 프로토콜 & 명령 설계
### 5.1 전송 단위
* **TCP 스트림** 위에서 **라인 단위 텍스트 프로토콜** 사용
* 클라 → 서버:
  * `"\n"` 기준으로 명령 구분
  * 각 라인은 `trim` 으로 양 끝 공백 제거
  * 완전히 빈 라인은 무시
  * 명령 비교는 대소문자 무시 (내부에서 `to_upper` 사용)
* 서버 → 클라:
  * 틱마다 전체 상태를 **사람이 읽을 수 있는 텍스트**로 브로드캐스트
  * 추가로 명령 처리 결과를 개별 클라에 메시지로 전송
### 5.2 클라이언트 명령어
* `ATTACK`
  * 의미: **현재 턴인 경우** 상대에게 공격 명령
  * 처리:
    * `GameServer::handle_command()` → `loop_.enqueue_command({id, CommandType::Attack})`
    * 즉시 `"Queued ATTACK command.\n"` 안내
    * 실제 데미지 적용은 **다음 틱**에서 이뤄진다
* `STATUS`
  * 의미: 간단 상태 요청.
  * 처리:
    * `"Waiting for next tick...\n"` 응답만 보냄
    * 게임 상태 변화 없음
* `QUIT`
  * 의미: 플레이어가 게임/서버를 종료하고 싶음
  * 처리:
    * `"Goodbye!\n"` 전송
    * `state_.mark_player_disconnected(id);`
    * `server.stop();` 호출 → 서버 전체 종료 흐름 진입
* 기타 문자열:
  * `"Unknown command. Try ATTACK or STATUS.\n"` 응답
### 5.3 서버 브로드캐스트 포맷
* `broadcast_state(StateSnapshot snapshot)` 에서 생성하는 메시지 형식:
```text
TICK <tick> | <status> [ | <last_action> [ | Winner: Player N ]]
 - Player 1 (HP: 90) [online] <- your turn
 - Player 2 (HP: 100) [online]
...
```
* `<status>`:
  * `RUNNING`   : 게임 진행 중 (`snapshot.running == true`)
  * `FINISHED`  : 게임 종료 (`snapshot.game_over == true`)
  * `WAITING`   : 두 플레이어 모두 안들어온 상태 등
* `<last_action>`:
  * 예: `"Battle started."`, `"Player 1 attacked Player 2 (HP -val)."`, `"Player 1 defeated Player 2!"`, `"Player 2 disconnected."` 등
* `Winner: Player N`:
  * `snapshot.game_over == true` 이고 `winner_id` 가 있는 경우에만 표시 (`winner_id+1`)
## 6. 에러 / 종료 정책
### 6.1 에러 처리
* 소켓 단에서 에러 발생 시 예외(`std::exception` 계열)로 전달된다고 가정
* `GameServer::run()`:
  * `accept` 루프에서 예외 발생:
    * `running_ == true` 이면 예외를 다시 던져 상위에서 처리
    * 이미 `running_ == false` (stop 이후)이면:
      * `"Server stopped accepting connections: <what>"` 로그 후 정상 종료 방향
* `handle_client()`:
  * `receive()`/`send_all()` 에서 예외 발생 시:
    * `"Connection error with <name>: <what>"` 로그
    * 루프 종료 후 `mark_player_disconnected`
* 브로드캐스트 중 실패:
  * 개별 플레이어 전송 실패 시:
    * `"Failed to send update to <name>: <what>"` 로그
    * 다른 플레이어 전송은 계속 시도
### 6.2 종료 시나리오
1. **시그널 종료 (`SIGINT` / `SIGTERM`)**
   * OS → `SignalHandler::handle()`
   * `g_signal_received = true;` 설정
   * 등록된 콜백 `server.stop()` 호출
   * `GameServer::stop()`:
     * `running_ = false`
     * `loop_.stop();`
     * 리스너/플레이어 소켓 shutdown/close
   * `GameServer::run()` 루프 탈출, 스레드 조인, `"Signal received. Server shut down."` 출력 후 종료
2. **클라이언트 `QUIT` 명령**
   * 해당 플레이어에 `"Goodbye!"` 전송
   * `state_.mark_player_disconnected(id)` 로 상태 업데이트
   * `stop()` 호출 → 위와 동일한 종료 흐름
3. **일반적인 게임 종료 (HP 0 혹은 연결 끊김)**
   * `GameState`가 `game_over_ = true`, 승자를 세팅
   * `GameLoop::run()` 에서 `state_.is_game_over()` 를 보고 루프 종료
   * 마지막 스냅샷 브로드캐스트 (`FINISHED` + Winner)
   * 서버 프로세스는 **바로 종료되지 않고**:
     * 클라이언트들이 소켓을 닫거나 `QUIT`/시그널 등이 올 때까지 유지
     * 현 구현은 한 판만 돌고 `run()` 이 끝나면 프로세스 종료
## 7. 테스트 전략
1. **기본 접속 / 안내 메시지**
   * `nc localhost 9100` 두 개 띄워서 접속
   * 각 클라에 환영 문구와 간단한 안내가 오는지 확인
2. **전투 진행**
   * Player 1 → `ATTACK\n` 입력
   * 브로드캐스트 로그에서:
     * Player 2 HP가 90으로 감소
     * 턴 표시가 Player 2로 넘어가는지 확인
   * 몇 번 반복해서 HP 0으로 만들고, 승자/FINISHED 상태가 찍히는지 확인
3. **턴 규칙 검증**
   * 내 턴이 아닐 때 `ATTACK` 연속 입력:
     * 명령은 큐에 들어가지만, `apply_attack` 에서 턴 체크로 무시되는지 확인 (실제 HP 변화 없음)
4. **STATUS 명령**
   * 아무 시점에서 `STATUS\n`:
     * `"Waiting for next tick...\n"` 응답만 오고, 상태 브로드캐스트는 기존 틱 리듬대로 유지되는지 확인
5. **QUIT / 종료 동작**
   * 한 플레이어에서 `QUIT\n`:
     * `"Goodbye!"` 응답
     * 브로드캐스트에서 해당 플레이어가 offline 처리 + 승자 지정
     * 서버가 더 이상 새 접속을 받지 않고 종료 흐름으로 가는지 확인
6. **비정상 종료 / 네트워크 끊김**
   * 클라이언트에서 소켓 강제 종료 (nc 종료 등)
   * 서버 로그에 에러 메시지 후, `mark_player_disconnected` 호출의 효과(승자 처리, FINISHED 상태)를 확인
7. **시그널 종료**
   * 서버 실행 중 `Ctrl+C`:
     * `SignalHandler` → `server.stop()` 호출
     * 리스너, 클라이언트 소켓이 정리되고, 최종 메시지 출력 후 프로세스 종료되는지 확인
## 8. 설계 ↔ 코드 매핑
### 8.1 파일 구조
* **소켓 레이어**
  * `src/lab-1.1-tcp-echo-server/socket.h`
    → `net::Socket` RAII 래퍼 (M1.1에서 만든 것 재사용)
* **도메인 레이어**
  * `player.h`
    → 플레이어 모델 (`Player`, `CommandType`, `Command`)
  * `game_state.h`
    → 게임 규칙/상태/스냅샷 관리 (`GameState`, `StateSnapshot`, `PlayerSnapshot`)
* **게임 루프**
  * `game_loop.h`
    → 고정 틱 게임 루프 (`GameLoop`)
* **서버 / 엔트리포인트**
  * `game_server.cpp`
    → `GameServer` 구현 + `main()` + `SignalHandler`
### 8.2 설계 항목별 대응
* **동시성 모델**
  * 설계 3장 → `GameServer::run`, `GameServer::handle_client`, `GameLoop::run` 스레드 생성/종료 로직
* **프로토콜/명령**
  * 설계 5장 → `handle_client`(라인 파싱, `trim`), `handle_command`(ATTACK/STATUS/QUIT), `broadcast_state`(텍스트 포맷).
* **게임 규칙**
  * 설계 4.2/2.2/6.2 → `GameState::start_if_ready`, `apply_attack`, `advance_tick`, `mark_player_disconnected`, `snapshot`
* **에러/종료 정책**
  * 설계 6장 → `GameServer::run` 의 try-catch, `handle_client` 예외 처리, `SignalHandler` + `GameServer::stop`