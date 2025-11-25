# T13: UDP 넷코드 + 권위 서버

> **목표**: 실전 게임 서버 넷코드 완전 정복 (스냅샷/델타, 예측/리컨실리에이션)
> **예상 시간**: 25-35시간
> **난이도**: 🔴 전문가
> **선행 요구사항**: [T11: Modern C++17 + RAII + TCP](./T11-cpp-raii-tcp.md), [T12: Asio + WebSocket](./T12-asio-websocket-gameloop.md)
> **적용 프로젝트**: netcode-core 프로젝트 (1.0-1.3) - gameserver-fundamentals와 별도 독립 프로젝트

---

## 목차

1. [UDP 소켓 기초](#1-udp-소켓-기초)
2. [신뢰성 계층 구현](#2-신뢰성-계층-구현)
3. [권위 서버 패턴](#3-권위-서버-패턴)
4. [스냅샷/델타 동기화](#4-스냅샷델타-동기화)
5. [클라이언트 예측](#5-클라이언트-예측)
6. [서버 리컨실리에이션](#6-서버-리컨실리에이션)
7. [엔티티 보간](#7-엔티티-보간)
8. [60 TPS 게임 루프](#8-60-tps-게임-루프)
9. [네트워크 시뮬레이션](#9-네트워크-시뮬레이션)
10. [트러블슈팅](#10-트러블슈팅)
11. [프로젝트 적용](#11-프로젝트-적용)
12. [공통 오류와 해결](#12-공통-오류와-해결)
13. [퀴즈 및 다음 단계](#13-퀴즈-및-다음-단계)
14. [추가 리소스](#14-추가-리소스)

---

## 1. UDP 소켓 기초

### 1.1 TCP vs UDP

| 특징 | TCP | UDP |
|------|-----|-----|
| 연결 | Connection-oriented | Connectionless |
| 신뢰성 | 패킷 순서 보장, 재전송 | 보장 없음 |
| 속도 | 느림 (오버헤드) | 빠름 |
| 용도 | 웹, 파일 전송 | 게임, 스트리밍 |

**왜 게임에서 UDP를 사용하나?**
- 낮은 지연 (latency)
- 오래된 데이터는 의미 없음 (재전송 불필요)
- 커스텀 신뢰성 계층으로 필요한 부분만 보장

---

### 1.2 UDP 소켓 생성 (C++)

```cpp
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <stdexcept>

class UDPSocket {
public:
    UDPSocket(uint16_t port) {
        // 소켓 생성
        sockfd_ = socket(AF_INET, SOCK_DGRAM, 0);
        if (sockfd_ < 0) {
            throw std::runtime_error("Failed to create socket");
        }

        // Non-blocking 모드 설정
        int flags = fcntl(sockfd_, F_GETFL, 0);
        fcntl(sockfd_, F_SETFL, flags | O_NONBLOCK);

        // 주소 바인딩 (서버만)
        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = INADDR_ANY;
        addr.sin_port = htons(port);

        if (bind(sockfd_, (sockaddr*)&addr, sizeof(addr)) < 0) {
            close(sockfd_);
            throw std::runtime_error("Failed to bind socket");
        }
    }

    ~UDPSocket() {
        if (sockfd_ >= 0) {
            close(sockfd_);
        }
    }

    // 데이터 전송
    ssize_t sendTo(const void* data, size_t size, const sockaddr_in& dest) {
        return sendto(sockfd_, data, size, 0,
                      (sockaddr*)&dest, sizeof(dest));
    }

    // 데이터 수신
    ssize_t receiveFrom(void* buffer, size_t bufferSize, sockaddr_in& sender) {
        socklen_t senderLen = sizeof(sender);
        return recvfrom(sockfd_, buffer, bufferSize, 0,
                        (sockaddr*)&sender, &senderLen);
    }

    int getFd() const { return sockfd_; }

private:
    int sockfd_ = -1;
};

// 사용 예제
int main() {
    UDPSocket socket(12345);

    uint8_t buffer[1024];
    sockaddr_in sender{};

    while (true) {
        ssize_t received = socket.receiveFrom(buffer, sizeof(buffer), sender);

        if (received > 0) {
            std::cout << "Received " << received << " bytes from "
                      << inet_ntoa(sender.sin_addr) << ":"
                      << ntohs(sender.sin_port) << std::endl;

            // Echo back
            socket.sendTo(buffer, received, sender);
        } else if (received < 0 && errno != EWOULDBLOCK) {
            std::cerr << "Receive error: " << strerror(errno) << std::endl;
        }

        // Non-blocking이므로 다른 작업 가능
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }

    return 0;
}
```

---

### 1.3 패킷 직렬화/역직렬화

```cpp
#include <vector>
#include <cstdint>
#include <cstring>

class PacketWriter {
public:
    void writeUint8(uint8_t value) {
        data_.push_back(value);
    }

    void writeUint16(uint16_t value) {
        uint8_t bytes[2];
        bytes[0] = (value >> 8) & 0xFF;
        bytes[1] = value & 0xFF;
        data_.insert(data_.end(), bytes, bytes + 2);
    }

    void writeUint32(uint32_t value) {
        uint8_t bytes[4];
        bytes[0] = (value >> 24) & 0xFF;
        bytes[1] = (value >> 16) & 0xFF;
        bytes[2] = (value >> 8) & 0xFF;
        bytes[3] = value & 0xFF;
        data_.insert(data_.end(), bytes, bytes + 4);
    }

    void writeFloat(float value) {
        uint32_t intValue;
        std::memcpy(&intValue, &value, sizeof(float));
        writeUint32(intValue);
    }

    void writeString(const std::string& str) {
        writeUint16(str.size());
        data_.insert(data_.end(), str.begin(), str.end());
    }

    const std::vector<uint8_t>& getData() const { return data_; }
    size_t getSize() const { return data_.size(); }

private:
    std::vector<uint8_t> data_;
};

class PacketReader {
public:
    PacketReader(const uint8_t* data, size_t size)
        : data_(data), size_(size), offset_(0) {}

    uint8_t readUint8() {
        if (offset_ + 1 > size_) throw std::runtime_error("Read overflow");
        return data_[offset_++];
    }

    uint16_t readUint16() {
        if (offset_ + 2 > size_) throw std::runtime_error("Read overflow");
        uint16_t value = (data_[offset_] << 8) | data_[offset_ + 1];
        offset_ += 2;
        return value;
    }

    uint32_t readUint32() {
        if (offset_ + 4 > size_) throw std::runtime_error("Read overflow");
        uint32_t value = (data_[offset_] << 24) |
                         (data_[offset_ + 1] << 16) |
                         (data_[offset_ + 2] << 8) |
                         data_[offset_ + 3];
        offset_ += 4;
        return value;
    }

    float readFloat() {
        uint32_t intValue = readUint32();
        float floatValue;
        std::memcpy(&floatValue, &intValue, sizeof(float));
        return floatValue;
    }

    std::string readString() {
        uint16_t length = readUint16();
        if (offset_ + length > size_) throw std::runtime_error("Read overflow");
        std::string str(reinterpret_cast<const char*>(data_ + offset_), length);
        offset_ += length;
        return str;
    }

private:
    const uint8_t* data_;
    size_t size_;
    size_t offset_;
};

// 사용 예제
struct PlayerPosition {
    uint32_t playerId;
    float x, y, z;
};

// 직렬화
PacketWriter writer;
writer.writeUint8(0x01); // 패킷 타입
writer.writeUint32(player.playerId);
writer.writeFloat(player.x);
writer.writeFloat(player.y);
writer.writeFloat(player.z);

const auto& data = writer.getData();
socket.sendTo(data.data(), data.size(), dest);

// 역직렬화
PacketReader reader(buffer, received);
uint8_t packetType = reader.readUint8();

if (packetType == 0x01) {
    PlayerPosition pos;
    pos.playerId = reader.readUint32();
    pos.x = reader.readFloat();
    pos.y = reader.readFloat();
    pos.z = reader.readFloat();
}
```

---

## 2. 신뢰성 계층 구현

### 2.1 Sequence Number + Ack

**개념**:
- 각 패킷에 sequence number 부여
- 수신측은 받은 패킷의 sequence를 ack로 응답
- ack_bits로 최근 32개 패킷 수신 여부 표시

```cpp
#include <cstdint>
#include <queue>
#include <chrono>

struct PacketHeader {
    uint32_t sequence;
    uint32_t ack;
    uint32_t ackBits;
};

class ReliabilitySystem {
public:
    ReliabilitySystem() : localSequence_(0), remoteSequence_(0), ackBits_(0) {}

    // 패킷 전송 시 헤더 생성
    PacketHeader generateHeader() {
        PacketHeader header;
        header.sequence = localSequence_++;
        header.ack = remoteSequence_;
        header.ackBits = ackBits_;
        return header;
    }

    // 패킷 수신 시 처리
    void processHeader(const PacketHeader& header) {
        // 수신한 sequence 업데이트
        if (isMoreRecent(header.sequence, remoteSequence_)) {
            uint32_t diff = header.sequence - remoteSequence_;

            // ackBits 시프트
            if (diff < 32) {
                ackBits_ = (ackBits_ << diff) | 1;
            } else {
                ackBits_ = 1;
            }

            remoteSequence_ = header.sequence;
        } else {
            // 오래된 패킷이지만 ackBits에 반영
            uint32_t diff = remoteSequence_ - header.sequence;
            if (diff < 32) {
                ackBits_ |= (1 << diff);
            }
        }

        // 상대방이 받은 패킷 확인
        if (header.ack < localSequence_) {
            for (uint32_t i = 0; i < 32; ++i) {
                uint32_t seq = header.ack - i;
                bool acked = (i == 0) || ((header.ackBits & (1 << (i - 1))) != 0);

                if (acked) {
                    onPacketAcked(seq);
                }
            }
        }
    }

private:
    uint32_t localSequence_;  // 내가 보낸 마지막 sequence
    uint32_t remoteSequence_; // 상대방이 보낸 마지막 sequence
    uint32_t ackBits_;        // 최근 32개 패킷 수신 비트마스크

    bool isMoreRecent(uint32_t s1, uint32_t s2) {
        return ((s1 > s2) && (s1 - s2 <= 0x7FFFFFFF)) ||
               ((s1 < s2) && (s2 - s1 > 0x7FFFFFFF));
    }

    void onPacketAcked(uint32_t sequence) {
        // 패킷이 확인됨 (재전송 큐에서 제거 등)
        std::cout << "Packet " << sequence << " acked" << std::endl;
    }
};
```

---

### 2.2 재전송 메커니즘

```cpp
#include <map>
#include <chrono>

struct SentPacket {
    uint32_t sequence;
    std::vector<uint8_t> data;
    std::chrono::steady_clock::time_point sentTime;
    uint8_t retryCount;
};

class ReliableChannel {
public:
    static constexpr uint32_t MAX_RETRIES = 3;
    static constexpr std::chrono::milliseconds RETRY_TIMEOUT{200};

    void send(const std::vector<uint8_t>& data, UDPSocket& socket, const sockaddr_in& dest) {
        auto header = reliability_.generateHeader();

        // 헤더 + 데이터 패킷 생성
        PacketWriter writer;
        writer.writeUint32(header.sequence);
        writer.writeUint32(header.ack);
        writer.writeUint32(header.ackBits);
        writer.getData().insert(writer.getData().end(), data.begin(), data.end());

        // 전송
        socket.sendTo(writer.getData().data(), writer.getData().size(), dest);

        // 재전송 큐에 추가
        SentPacket sent;
        sent.sequence = header.sequence;
        sent.data = data;
        sent.sentTime = std::chrono::steady_clock::now();
        sent.retryCount = 0;

        sentPackets_[header.sequence] = sent;
    }

    void update(UDPSocket& socket, const sockaddr_in& dest) {
        auto now = std::chrono::steady_clock::now();

        for (auto it = sentPackets_.begin(); it != sentPackets_.end();) {
            auto& [seq, packet] = *it;

            auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                now - packet.sentTime
            );

            if (elapsed > RETRY_TIMEOUT) {
                if (packet.retryCount < MAX_RETRIES) {
                    // 재전송
                    std::cout << "Retrying packet " << seq << " (attempt "
                              << (packet.retryCount + 1) << ")" << std::endl;

                    send(packet.data, socket, dest);
                    packet.sentTime = now;
                    packet.retryCount++;
                    ++it;
                } else {
                    // 최대 재시도 초과, 포기
                    std::cout << "Packet " << seq << " lost after "
                              << MAX_RETRIES << " retries" << std::endl;
                    it = sentPackets_.erase(it);
                }
            } else {
                ++it;
            }
        }
    }

    void onPacketAcked(uint32_t sequence) {
        sentPackets_.erase(sequence);
    }

private:
    ReliabilitySystem reliability_;
    std::map<uint32_t, SentPacket> sentPackets_;
};
```

---

## 3. 권위 서버 패턴

**개념**:
- 클라이언트는 **입력만** 전송 (위치/속도 X)
- 서버가 입력을 검증하고 시뮬레이션
- 서버 상태가 진실의 원천 (source of truth)
- 치팅 방지

```cpp
// 클라이언트 입력
struct PlayerInput {
    uint32_t sequence;
    bool moveForward;
    bool moveBackward;
    bool moveLeft;
    bool moveRight;
    bool jump;
    float deltaTime;
};

// 서버: 입력 처리
class GameServer {
public:
    void processPlayerInput(uint32_t playerId, const PlayerInput& input) {
        auto& player = players_[playerId];

        // 입력 검증
        if (input.deltaTime > 0.1f) {
            // 비정상적인 deltaTime (치팅?)
            return;
        }

        // 이동 벡터 계산
        glm::vec3 direction(0.0f);
        if (input.moveForward) direction.z += 1.0f;
        if (input.moveBackward) direction.z -= 1.0f;
        if (input.moveLeft) direction.x -= 1.0f;
        if (input.moveRight) direction.x += 1.0f;

        if (glm::length(direction) > 0.0f) {
            direction = glm::normalize(direction);
        }

        // 속도 계산
        const float MOVE_SPEED = 5.0f;
        player.velocity = direction * MOVE_SPEED;

        // 점프
        if (input.jump && player.isGrounded) {
            player.velocity.y = 10.0f;
            player.isGrounded = false;
        }

        // 물리 시뮬레이션
        updatePlayerPhysics(player, input.deltaTime);

        // 충돌 검사
        checkCollisions(player);
    }

private:
    void updatePlayerPhysics(Player& player, float dt) {
        // 중력 적용
        const float GRAVITY = -9.8f;
        player.velocity.y += GRAVITY * dt;

        // 위치 업데이트
        player.position += player.velocity * dt;

        // 지면 충돌
        if (player.position.y <= 0.0f) {
            player.position.y = 0.0f;
            player.velocity.y = 0.0f;
            player.isGrounded = true;
        }
    }

    void checkCollisions(Player& player) {
        // 맵 경계, 다른 플레이어와의 충돌 등
    }

    std::unordered_map<uint32_t, Player> players_;
};
```

---

## 4. 스냅샷/델타 동기화

### 4.1 Snapshot (키프레임)

```cpp
struct PlayerSnapshot {
    uint32_t playerId;
    glm::vec3 position;
    glm::vec3 velocity;
    float rotation;
    uint8_t health;
};

struct WorldSnapshot {
    uint32_t frameNumber;
    uint64_t timestamp;
    std::vector<PlayerSnapshot> players;
};

class SnapshotManager {
public:
    WorldSnapshot captureSnapshot(uint32_t frameNumber) {
        WorldSnapshot snapshot;
        snapshot.frameNumber = frameNumber;
        snapshot.timestamp = getCurrentTimestamp();

        for (const auto& [id, player] : players_) {
            PlayerSnapshot ps;
            ps.playerId = id;
            ps.position = player.position;
            ps.velocity = player.velocity;
            ps.rotation = player.rotation;
            ps.health = player.health;
            snapshot.players.push_back(ps);
        }

        return snapshot;
    }

    // 스냅샷 직렬화
    std::vector<uint8_t> serializeSnapshot(const WorldSnapshot& snapshot) {
        PacketWriter writer;

        writer.writeUint8(0x10); // Snapshot 패킷 타입
        writer.writeUint32(snapshot.frameNumber);
        writer.writeUint32(snapshot.players.size());

        for (const auto& player : snapshot.players) {
            writer.writeUint32(player.playerId);
            writer.writeFloat(player.position.x);
            writer.writeFloat(player.position.y);
            writer.writeFloat(player.position.z);
            writer.writeFloat(player.velocity.x);
            writer.writeFloat(player.velocity.y);
            writer.writeFloat(player.velocity.z);
            writer.writeFloat(player.rotation);
            writer.writeUint8(player.health);
        }

        return writer.getData();
    }

    // 스냅샷 역직렬화
    WorldSnapshot deserializeSnapshot(const uint8_t* data, size_t size) {
        PacketReader reader(data, size);

        WorldSnapshot snapshot;
        uint8_t packetType = reader.readUint8();
        snapshot.frameNumber = reader.readUint32();
        uint32_t playerCount = reader.readUint32();

        for (uint32_t i = 0; i < playerCount; ++i) {
            PlayerSnapshot ps;
            ps.playerId = reader.readUint32();
            ps.position.x = reader.readFloat();
            ps.position.y = reader.readFloat();
            ps.position.z = reader.readFloat();
            ps.velocity.x = reader.readFloat();
            ps.velocity.y = reader.readFloat();
            ps.velocity.z = reader.readFloat();
            ps.rotation = reader.readFloat();
            ps.health = reader.readUint8();
            snapshot.players.push_back(ps);
        }

        return snapshot;
    }

private:
    std::unordered_map<uint32_t, Player> players_;

    uint64_t getCurrentTimestamp() {
        auto now = std::chrono::system_clock::now();
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        ).count();
    }
};
```

---

### 4.2 Delta (차분)

**개념**:
- 매 프레임 전체 스냅샷 전송은 비효율적
- 이전 프레임 대비 **변경된 부분만** 전송
- 대역폭 50% 이상 절감

```cpp
struct PlayerDelta {
    uint32_t playerId;
    uint8_t changedFields; // 비트마스크

    // 변경된 필드만 포함
    std::optional<glm::vec3> position;
    std::optional<glm::vec3> velocity;
    std::optional<float> rotation;
    std::optional<uint8_t> health;
};

enum PlayerField : uint8_t {
    FIELD_POSITION = 1 << 0,
    FIELD_VELOCITY = 1 << 1,
    FIELD_ROTATION = 1 << 2,
    FIELD_HEALTH   = 1 << 3,
};

class DeltaCompressor {
public:
    PlayerDelta computeDelta(const PlayerSnapshot& prev, const PlayerSnapshot& current) {
        PlayerDelta delta;
        delta.playerId = current.playerId;
        delta.changedFields = 0;

        // 위치 변화 감지 (임계값 기반)
        if (glm::distance(prev.position, current.position) > 0.01f) {
            delta.position = current.position;
            delta.changedFields |= FIELD_POSITION;
        }

        // 속도 변화 감지
        if (glm::distance(prev.velocity, current.velocity) > 0.01f) {
            delta.velocity = current.velocity;
            delta.changedFields |= FIELD_VELOCITY;
        }

        // 회전 변화 감지
        if (std::abs(prev.rotation - current.rotation) > 0.01f) {
            delta.rotation = current.rotation;
            delta.changedFields |= FIELD_ROTATION;
        }

        // 체력 변화 감지
        if (prev.health != current.health) {
            delta.health = current.health;
            delta.changedFields |= FIELD_HEALTH;
        }

        return delta;
    }

    std::vector<uint8_t> serializeDelta(const PlayerDelta& delta) {
        PacketWriter writer;

        writer.writeUint8(0x11); // Delta 패킷 타입
        writer.writeUint32(delta.playerId);
        writer.writeUint8(delta.changedFields);

        if (delta.changedFields & FIELD_POSITION) {
            writer.writeFloat(delta.position->x);
            writer.writeFloat(delta.position->y);
            writer.writeFloat(delta.position->z);
        }

        if (delta.changedFields & FIELD_VELOCITY) {
            writer.writeFloat(delta.velocity->x);
            writer.writeFloat(delta.velocity->y);
            writer.writeFloat(delta.velocity->z);
        }

        if (delta.changedFields & FIELD_ROTATION) {
            writer.writeFloat(*delta.rotation);
        }

        if (delta.changedFields & FIELD_HEALTH) {
            writer.writeUint8(*delta.health);
        }

        return writer.getData();
    }

    void applyDelta(Player& player, const PlayerDelta& delta) {
        if (delta.changedFields & FIELD_POSITION) {
            player.position = *delta.position;
        }

        if (delta.changedFields & FIELD_VELOCITY) {
            player.velocity = *delta.velocity;
        }

        if (delta.changedFields & FIELD_ROTATION) {
            player.rotation = *delta.rotation;
        }

        if (delta.changedFields & FIELD_HEALTH) {
            player.health = *delta.health;
        }
    }
};

// 서버: 10프레임마다 Snapshot, 나머지는 Delta
class NetworkManager {
public:
    void sendWorldState(uint32_t frameNumber) {
        if (frameNumber % 10 == 0) {
            // 키프레임 (Snapshot)
            auto snapshot = snapshotManager_.captureSnapshot(frameNumber);
            auto data = snapshotManager_.serializeSnapshot(snapshot);
            broadcastToClients(data);

            lastSnapshot_ = snapshot;
        } else {
            // 델타 프레임
            auto currentSnapshot = snapshotManager_.captureSnapshot(frameNumber);

            for (size_t i = 0; i < currentSnapshot.players.size(); ++i) {
                auto delta = deltaCompressor_.computeDelta(
                    lastSnapshot_.players[i],
                    currentSnapshot.players[i]
                );

                if (delta.changedFields != 0) {
                    auto data = deltaCompressor_.serializeDelta(delta);
                    broadcastToClients(data);
                }
            }

            lastSnapshot_ = currentSnapshot;
        }
    }

private:
    SnapshotManager snapshotManager_;
    DeltaCompressor deltaCompressor_;
    WorldSnapshot lastSnapshot_;
};
```

---

## 5. 클라이언트 예측

**개념**:
- 클라이언트는 **자신의 입력**을 즉시 시뮬레이션
- 서버 응답을 기다리지 않음 (지연 감소)
- 입력 버퍼에 최근 N개 입력 저장

```cpp
class ClientPrediction {
public:
    static constexpr size_t INPUT_BUFFER_SIZE = 1024;

    void processInput(const PlayerInput& input) {
        // 1. 입력 버퍼에 저장
        inputBuffer_[input.sequence % INPUT_BUFFER_SIZE] = input;

        // 2. 로컬 시뮬레이션 (즉시 실행)
        localPlayer_.applyInput(input);

        // 3. 서버에 입력 전송
        sendInputToServer(input);
    }

    void onServerUpdate(uint32_t serverSequence, const PlayerSnapshot& serverState) {
        // 서버가 처리한 마지막 입력 sequence
        auto& lastProcessedInput = inputBuffer_[serverSequence % INPUT_BUFFER_SIZE];

        // 서버 상태와 로컬 상태 비교
        if (glm::distance(localPlayer_.position, serverState.position) > 0.1f) {
            // 불일치 발견! 리컨실리에이션 필요
            std::cout << "Prediction mismatch detected!" << std::endl;

            // 1. 서버 상태로 롤백
            localPlayer_.position = serverState.position;
            localPlayer_.velocity = serverState.velocity;

            // 2. 서버가 처리하지 않은 입력들을 재시뮬레이션
            for (uint32_t seq = serverSequence + 1; seq < currentInputSequence_; ++seq) {
                auto& input = inputBuffer_[seq % INPUT_BUFFER_SIZE];
                localPlayer_.applyInput(input);
            }
        }
    }

private:
    Player localPlayer_;
    std::array<PlayerInput, INPUT_BUFFER_SIZE> inputBuffer_;
    uint32_t currentInputSequence_ = 0;
};
```

---

## 6. 서버 리컨실리에이션

```cpp
// 서버: 클라이언트 상태 검증
class ServerReconciliation {
public:
    void processClientInput(uint32_t clientId, const PlayerInput& input) {
        auto& client = clients_[clientId];

        // 1. 클라이언트가 보낸 예측 상태 (옵션)
        if (input.predictedPosition.has_value()) {
            // 서버 시뮬레이션 결과와 비교
            float error = glm::distance(client.player.position, *input.predictedPosition);

            if (error > 0.5f) {
                // 불일치 심각 -> 강제 동기화
                sendFullStateUpdate(clientId);
            }
        }

        // 2. 입력 처리
        client.player.applyInput(input);

        // 3. 물리 시뮬레이션
        updatePhysics(client.player, input.deltaTime);

        // 4. 결과 전송
        PlayerSnapshot snapshot;
        snapshot.playerId = clientId;
        snapshot.position = client.player.position;
        snapshot.velocity = client.player.velocity;
        snapshot.rotation = client.player.rotation;

        sendToClient(clientId, snapshot);
    }

private:
    struct ClientState {
        Player player;
        uint32_t lastProcessedInput;
    };

    std::unordered_map<uint32_t, ClientState> clients_;
};
```

---

## 7. 엔티티 보간

**개념**:
- 다른 플레이어는 **과거 상태**로 렌더링
- 2-3 프레임 지연 버퍼 유지
- 보간(interpolation)으로 부드러운 이동

```cpp
class EntityInterpolation {
public:
    static constexpr size_t SNAPSHOT_HISTORY_SIZE = 10;

    void addSnapshot(const PlayerSnapshot& snapshot) {
        snapshotHistory_.push_back(snapshot);

        if (snapshotHistory_.size() > SNAPSHOT_HISTORY_SIZE) {
            snapshotHistory_.pop_front();
        }
    }

    PlayerSnapshot interpolate(uint64_t renderTime) {
        // 렌더링 시간보다 조금 과거 (100ms)
        uint64_t interpolationTime = renderTime - 100;

        // 두 스냅샷 찾기
        auto it1 = snapshotHistory_.begin();
        auto it2 = it1;

        for (auto it = snapshotHistory_.begin(); it != snapshotHistory_.end(); ++it) {
            if (it->timestamp <= interpolationTime) {
                it1 = it;
                it2 = std::next(it);

                if (it2 == snapshotHistory_.end()) {
                    it2 = it1;
                }
            }
        }

        if (it1 == it2) {
            // 보간할 스냅샷이 하나뿐
            return *it1;
        }

        // 선형 보간
        float t = static_cast<float>(interpolationTime - it1->timestamp) /
                  static_cast<float>(it2->timestamp - it1->timestamp);

        t = std::clamp(t, 0.0f, 1.0f);

        PlayerSnapshot result;
        result.playerId = it1->playerId;
        result.position = glm::mix(it1->position, it2->position, t);
        result.velocity = glm::mix(it1->velocity, it2->velocity, t);
        result.rotation = glm::mix(it1->rotation, it2->rotation, t);
        result.health = it1->health; // 보간하지 않음

        return result;
    }

private:
    std::deque<PlayerSnapshot> snapshotHistory_;
};
```

---

## 8. 60 TPS 게임 루프

```cpp
class GameServer {
public:
    static constexpr int TARGET_TPS = 60;
    static constexpr auto TICK_DURATION = std::chrono::microseconds(1000000 / TARGET_TPS);

    void run() {
        auto nextTickTime = std::chrono::steady_clock::now();

        while (running_) {
            auto startTime = std::chrono::steady_clock::now();

            // 1. 입력 수신 (non-blocking)
            processIncomingPackets();

            // 2. 게임 로직 업데이트
            updateGameState();

            // 3. 상태 브로드캐스트
            broadcastGameState();

            // 4. 다음 틱까지 대기
            nextTickTime += TICK_DURATION;
            auto endTime = std::chrono::steady_clock::now();
            auto elapsed = endTime - startTime;

            if (elapsed < TICK_DURATION) {
                std::this_thread::sleep_until(nextTickTime);
            } else {
                // 틱 시간 초과 경고
                auto overrun = std::chrono::duration_cast<std::chrono::microseconds>(
                    elapsed - TICK_DURATION
                ).count();

                std::cerr << "Tick overrun: " << overrun << " us" << std::endl;

                // 다음 틱 시간 재조정
                nextTickTime = std::chrono::steady_clock::now();
            }

            frameNumber_++;
        }
    }

private:
    bool running_ = true;
    uint32_t frameNumber_ = 0;
};
```

---

## 9. 네트워크 시뮬레이션

```bash
# Linux tc-netem으로 지연/손실 주입
sudo tc qdisc add dev lo root netem delay 100ms 20ms loss 5%

# 지연 100ms ± 20ms, 패킷 손실 5%

# 제거
sudo tc qdisc del dev lo root
```

```cpp
// 코드 내 시뮬레이션
class NetworkSimulator {
public:
    NetworkSimulator(float packetLoss = 0.0f, int latencyMs = 0)
        : packetLoss_(packetLoss), latencyMs_(latencyMs) {}

    void send(const std::vector<uint8_t>& data, UDPSocket& socket, const sockaddr_in& dest) {
        // 패킷 손실 시뮬레이션
        if (shouldDropPacket()) {
            std::cout << "Packet dropped (simulated)" << std::endl;
            return;
        }

        if (latencyMs_ > 0) {
            // 지연 시뮬레이션
            DelayedPacket delayed;
            delayed.data = data;
            delayed.dest = dest;
            delayed.deliverTime = std::chrono::steady_clock::now() +
                                  std::chrono::milliseconds(latencyMs_);

            delayedPackets_.push(delayed);
        } else {
            // 즉시 전송
            socket.sendTo(data.data(), data.size(), dest);
        }
    }

    void update(UDPSocket& socket) {
        auto now = std::chrono::steady_clock::now();

        while (!delayedPackets_.empty() &&
               delayedPackets_.top().deliverTime <= now) {
            auto& packet = delayedPackets_.top();
            socket.sendTo(packet.data.data(), packet.data.size(), packet.dest);
            delayedPackets_.pop();
        }
    }

private:
    float packetLoss_;
    int latencyMs_;

    struct DelayedPacket {
        std::vector<uint8_t> data;
        sockaddr_in dest;
        std::chrono::steady_clock::time_point deliverTime;

        bool operator<(const DelayedPacket& other) const {
            return deliverTime > other.deliverTime; // min-heap
        }
    };

    std::priority_queue<DelayedPacket> delayedPackets_;

    bool shouldDropPacket() {
        return (rand() / static_cast<float>(RAND_MAX)) < packetLoss_;
    }
};
```

---

## 10. 트러블슈팅

### 10.1 Jitter (불규칙한 지연)

**해결**: Interpolation buffer 크기 조정

### 10.2 패킷 손실로 인한 워프

**해결**: Snapshot 빈도 증가 (10프레임 → 5프레임)

### 10.3 서버 틱 오버런

**해결**: 프로파일링 후 병목 제거, 멀티스레딩

---

## 11. 프로젝트 적용

**netcode-core 프로젝트 완성 구조 (1.0-1.3)**:
- 1.0: UDP 신뢰성 계층 + 권위 서버 패턴 ✅
- 1.1: 스냅샷/델타 동기화 ✅
- 1.2: 클라이언트 예측 + 서버 리컨실리에이션 ✅
- 1.3: 60 TPS 게임 루프 안정화 + 네트워크 시뮬레이션 테스트 ✅

**참고**: 이 프로젝트는 gameserver-fundamentals (lab1.1-1.4)와 별도로 진행되는 독립 프로젝트입니다.

---

## 면접 질문

1. **UDP를 게임에 사용하는 이유는?**
2. **클라이언트 예측이란 무엇인가?**
3. **스냅샷과 델타의 차이는?**
4. **서버 리컨실리에이션은 언제 발생하나?**
5. **60 TPS 게임 루프를 안정적으로 유지하는 방법은?**
6. **엔티티 보간의 목적은?**
7. **NAT 홀펀칭의 원리는?**
8. **패킷 시퀀스 번호의 역할은?**
9. **ACK 비트의 장점은?**
10. **권위 서버 패턴의 장점은?**

---

**완료 체크리스트**:
- [ ] UDP 소켓 기초
  - [ ] UDP vs TCP 차이점
  - [ ] UDP 소켓 생성과 바인딩
  - [ ] Non-blocking 모드
- [ ] 신뢰성 계층 구현
  - [ ] 시퀀스 번호와 ACK
  - [ ] 재전송 로직
  - [ ] 패킷 버퍼링
- [ ] 권위 서버 패턴
  - [ ] 서버 최종 결정권
  - [ ] 클라이언트 예측
  - [ ] 서버 리컨실리에이션
- [ ] 스냅샷/델타 동기화
  - [ ] 스냅샷 전송
  - [ ] 델타 압축
  - [ ] 상태 동기화
- [ ] 클라이언트 예측
  - [ ] 로컬 시뮬레이션
  - [ ] 입력 버퍼링
  - [ ] 예측 보정
- [ ] 서버 리컨실리에이션
  - [ ] 서버 상태 검증
  - [ ] 클라이언트 상태 맞춤
  - [ ] 롤백 처리
- [ ] 엔티티 보간
  - [ ] 위치 보간
  - [ ] 회전 보간
  - [ ] 부드러운 이동
- [ ] 60 TPS 게임 루프
  - [ ] 고정 타임스텝
  - [ ] 프레임 드랍 처리
  - [ ] 성능 모니터링
- [ ] 네트워크 시뮬레이션
  - [ ] 지연 시뮬레이션
  - [ ] 패킷 손실
  - [ ] 재정렬
- [ ] 트러블슈팅
  - [ ] 공통 오류 해결
- [ ] 프로젝트 적용
  - [ ] netcode-core 통합
- [ ] 퀴즈 80% 이상 정답

**학습 시간**: _____ 시간 소요

---

## 12. 공통 오류와 해결

- **패킷 손실**: UDP 비신뢰 → 재전송 로직 추가.
- **순서 역전**: 시퀀스 번호 → 버퍼링 후 정렬.
- **지연 변동**: jitter → 보간 사용.
- **예측 오류**: 리컨실리에이션 → 서버 상태 동기화.
- **NAT 문제**: 홀펀칭 → STUN/TURN.

---

## 13. 퀴즈 및 다음 단계

**퀴즈**:
1. UDP vs TCP? (비신뢰 vs 신뢰)
2. 스냅샷? (전체 상태 전송)
3. 예측? (클라이언트 로컬 시뮬)
4. 리컨실리에이션? (서버 상태 맞춤)
5. 엔티티 보간? (부드러운 이동)
6. 시퀀스 번호? (패킷 순서)
7. ACK 비트? (신뢰성 확인)
8. 홀펀칭? (NAT 우회)
9. 60 TPS? (초당 60 업데이트)
10. 권위 서버? (서버 최종 결정권)

**완료 조건**: 넷코드 서버 실행, 클라이언트 동기화.

**다음**: 실전 프로젝트!

---

## 14. 추가 리소스

### 넷코드
- [Gaffer On Games](https://gafferongames.com/): 넷코드 블로그.
- [Valve Source](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking): 소스 엔진 넷코드.
- [Glenn Fiedler](https://gafferongames.com/post/): 저자 블로그.

### UDP
- [Beej's Guide](https://beej.us/guide/bgnet/html/): 네트워크 프로그래밍.
- [RFC 768](https://tools.ietf.org/html/rfc768): UDP 스펙.
- [UDP Hole Punching](https://en.wikipedia.org/wiki/UDP_hole_punching): NAT 우회.

### 예측/리컨실리에이션
- [Client-Side Prediction](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html): 상세 설명.
- [Entity Interpolation](https://www.gabrielgambetta.com/entity-interpolation.html): 보간 가이드.
- [Networked Physics](https://gafferongames.com/post/networked-physics/): 물리 동기화.

### 튜토리얼
- [Netcode Tutorial](https://github.com/networkprotocol/netcode): 샘플 코드.
- [Game Networking](https://developer.valvesoftware.com/wiki/Game_Network_Programming): Valve 가이드.
- [Multiplayer Game Programming](https://www.gabrielgambetta.com/client-server-game-architecture.html): 아키텍처 가이드.

### 비디오
- [Overwatch Netcode](https://www.youtube.com/watch?v=W3aLlN4BRjE): 오버워치 넷코드.
- [Fortnite Netcode](https://www.youtube.com/results?search_query=fortnite+netcode): 포트나이트 발표.
- [GDC Talks](https://www.youtube.com/results?search_query=gdc+netcode): 게임 개발 컨퍼런스.

### 실습 플랫폼
- [Compiler Explorer](https://godbolt.org/): C++ 온라인 컴파일러.
- [Networking Test Tools](https://www.clumsyapp.com/): 네트워크 시뮬레이션.

### 커뮤니티
- [Reddit r/gamedev](https://www.reddit.com/r/gamedev/): 게임 개발 토론.
- [Stack Overflow Networking](https://stackoverflow.com/questions/tagged/networking): 네트워크 Q&A.

**학습 시간**: _____ 시간 소요
