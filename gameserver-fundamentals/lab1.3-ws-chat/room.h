#pragma once

#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace ws {

class WebSocketSession;

class Room {
public:
    explicit Room(std::string id);

    void join(std::shared_ptr<WebSocketSession> session);
    void leave(std::shared_ptr<WebSocketSession> session);
    void broadcast(const std::string &message, const std::shared_ptr<WebSocketSession> &sender);

    std::string id() const;
    std::size_t member_count() const;
    std::vector<std::shared_ptr<WebSocketSession>> members_snapshot() const;

private:
    void cleanup_locked() const;

    std::string id_;
    mutable std::mutex members_mutex_;
    mutable std::vector<std::weak_ptr<WebSocketSession>> members_;
};

} // namespace ws

