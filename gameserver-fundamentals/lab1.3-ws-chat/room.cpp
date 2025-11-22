#include "room.h"
#include "websocket_session.h"

#include <algorithm>
#include <utility>

namespace ws {

Room::Room(std::string id)
    : id_(std::move(id)) {}

void Room::join(std::shared_ptr<WebSocketSession> session) {
    if (!session) {
        return;
    }
    std::lock_guard<std::mutex> lock(members_mutex_);
    cleanup_locked();
    members_.erase(std::remove_if(members_.begin(), members_.end(), [&](const std::weak_ptr<WebSocketSession> &candidate) {
                        auto existing = candidate.lock();
                        return !existing || existing == session;
                    }),
        members_.end());
    members_.push_back(session);
}

void Room::leave(std::shared_ptr<WebSocketSession> session) {
    std::lock_guard<std::mutex> lock(members_mutex_);
    members_.erase(std::remove_if(members_.begin(), members_.end(), [&](const std::weak_ptr<WebSocketSession> &candidate) {
                        auto existing = candidate.lock();
                        return !existing || existing == session;
                    }),
        members_.end());
}

void Room::broadcast(const std::string &message, const std::shared_ptr<WebSocketSession> &sender) {
    std::vector<std::shared_ptr<WebSocketSession>> recipients;
    {
        std::lock_guard<std::mutex> lock(members_mutex_);
        cleanup_locked();
        recipients.reserve(members_.size());
        for (auto &weak_member : members_) {
            if (auto member = weak_member.lock()) {
                if (!sender || member != sender) {
                    recipients.push_back(std::move(member));
                }
            }
        }
    }
    for (auto &recipient : recipients) {
        recipient->send(message);
    }
}

std::string Room::id() const {
    return id_;
}

std::size_t Room::member_count() const {
    std::lock_guard<std::mutex> lock(members_mutex_);
    cleanup_locked();
    std::size_t count = 0;
    for (const auto &member : members_) {
        if (!member.expired()) {
            ++count;
        }
    }
    return count;
}

std::vector<std::shared_ptr<WebSocketSession>> Room::members_snapshot() const {
    std::vector<std::shared_ptr<WebSocketSession>> result;
    std::lock_guard<std::mutex> lock(members_mutex_);
    cleanup_locked();
    result.reserve(members_.size());
    for (auto &weak_member : members_) {
        if (auto member = weak_member.lock()) {
            result.push_back(std::move(member));
        }
    }
    return result;
}

void Room::cleanup_locked() const {
    members_.erase(std::remove_if(members_.begin(), members_.end(), [](const std::weak_ptr<WebSocketSession> &candidate) {
                        return candidate.expired();
                    }),
        members_.end());
}

} // namespace ws

