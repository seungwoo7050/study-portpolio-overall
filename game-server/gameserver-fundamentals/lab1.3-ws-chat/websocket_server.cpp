#include "websocket_server.h"
#include "room.h"
#include "websocket_session.h"

#include <boost/asio/dispatch.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core.hpp>

#include <algorithm>
#include <iostream>

namespace ws {

namespace {
void throw_if_error(boost::beast::error_code ec, const char *context) {
    if (ec) {
        throw boost::beast::system_error{ec, context};
    }
}
} // namespace

WebSocketServer::WebSocketServer(boost::asio::io_context &ioc, const tcp::endpoint &endpoint)
    : ioc_(ioc), acceptor_(ioc), stopping_(false) {
    boost::beast::error_code ec;
    acceptor_.open(endpoint.protocol(), ec);
    throw_if_error(ec, "acceptor.open");
    acceptor_.set_option(boost::asio::socket_base::reuse_address(true), ec);
    throw_if_error(ec, "acceptor.set_option");
    acceptor_.bind(endpoint, ec);
    throw_if_error(ec, "acceptor.bind");
    acceptor_.listen(boost::asio::socket_base::max_listen_connections, ec);
    throw_if_error(ec, "acceptor.listen");
}

void WebSocketServer::run() {
    do_accept();
}

void WebSocketServer::stop() {
    boost::asio::dispatch(ioc_, [self = shared_from_this()] {
        self->stopping_ = true;
        boost::beast::error_code ec;
        self->acceptor_.close(ec);
        std::vector<std::shared_ptr<WebSocketSession>> active_sessions;
        {
            std::lock_guard<std::mutex> lock(self->sessions_mutex_);
            for (auto &weak_session : self->sessions_) {
                if (auto session = weak_session.lock()) {
                    active_sessions.push_back(std::move(session));
                }
            }
            self->sessions_.clear();
        }
        {
            std::lock_guard<std::mutex> rooms_lock(self->rooms_mutex_);
            self->rooms_.clear();
        }
        for (auto &session : active_sessions) {
            session->close();
        }
    });
}

void WebSocketServer::register_session(const std::shared_ptr<WebSocketSession> &session) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    sessions_.push_back(session);
}

void WebSocketServer::unregister_session(const std::shared_ptr<WebSocketSession> &session) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    sessions_.erase(std::remove_if(sessions_.begin(), sessions_.end(), [&](const std::weak_ptr<WebSocketSession> &candidate) {
                        auto locked = candidate.lock();
                        return !locked || locked == session;
                    }),
        sessions_.end());
}

bool WebSocketServer::is_nickname_available(const std::string &name, const std::shared_ptr<WebSocketSession> &self) {
    std::lock_guard<std::mutex> lock(sessions_mutex_);
    for (auto &weak_session : sessions_) {
        if (auto session = weak_session.lock()) {
            if (session != self && session->nickname() == name) {
                return false;
            }
        }
    }
    return true;
}

std::string WebSocketServer::build_room_list() {
    std::vector<std::pair<std::string, std::size_t>> snapshot;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        snapshot.reserve(rooms_.size());
        for (auto &entry : rooms_) {
            if (entry.second && entry.second->member_count() > 0) {
                snapshot.emplace_back(entry.first, entry.second->member_count());
            }
        }
    }
    std::string result;
    for (std::size_t i = 0; i < snapshot.size(); ++i) {
        if (i > 0) {
            result += ",";
        }
        result += snapshot[i].first;
        result += ":";
        result += std::to_string(snapshot[i].second);
    }
    return result;
}

bool WebSocketServer::build_member_list(const std::string &room_id, std::string &out_members) {
    std::shared_ptr<Room> room;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        auto it = rooms_.find(room_id);
        if (it == rooms_.end()) {
            return false;
        }
        room = it->second;
    }

    auto members = room->members_snapshot();
    std::vector<std::string> names;
    names.reserve(members.size());
    for (auto &session : members) {
        if (session) {
            names.push_back(session->nickname());
        }
    }

    out_members.clear();
    for (std::size_t i = 0; i < names.size(); ++i) {
        if (i > 0) {
            out_members += ",";
        }
        out_members += names[i];
    }
    return true;
}

void WebSocketServer::join_room(const std::shared_ptr<WebSocketSession> &session, const std::string &room_id) {
    auto room = get_or_create_room(room_id);
    room->join(session);
}

void WebSocketServer::leave_room(const std::shared_ptr<WebSocketSession> &session, const std::string &room_id) {
    std::shared_ptr<Room> room;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        auto it = rooms_.find(room_id);
        if (it == rooms_.end()) {
            return;
        }
        room = it->second;
    }
    room->leave(session);
    remove_room_if_empty(room);
}

void WebSocketServer::broadcast_to_room(const std::string &room_id, const std::string &message, const std::shared_ptr<WebSocketSession> &sender) {
    std::shared_ptr<Room> room;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        auto it = rooms_.find(room_id);
        if (it == rooms_.end()) {
            return;
        }
        room = it->second;
    }
    room->broadcast(message, sender);
}

std::shared_ptr<Room> WebSocketServer::get_or_create_room(const std::string &room_id) {
    std::lock_guard<std::mutex> lock(rooms_mutex_);
    auto it = rooms_.find(room_id);
    if (it != rooms_.end()) {
        return it->second;
    }
    auto room = std::make_shared<Room>(room_id);
    rooms_.emplace(room_id, room);
    return room;
}

void WebSocketServer::remove_room_if_empty(const std::shared_ptr<Room> &room) {
    if (!room) {
        return;
    }
    const bool empty = (room->member_count() == 0);
    if (!empty) {
        return;
    }
    const std::string room_id = room->id();
    std::lock_guard<std::mutex> lock(rooms_mutex_);
    auto it = rooms_.find(room_id);
    if (it != rooms_.end() && it->second == room && empty) {
        rooms_.erase(it);
    }
}

void WebSocketServer::do_accept() {
    acceptor_.async_accept(boost::asio::make_strand(ioc_),
        [self = shared_from_this()](boost::beast::error_code ec, tcp::socket socket) {
            self->on_accept(ec, std::move(socket));
        });
}

void WebSocketServer::on_accept(boost::beast::error_code ec, tcp::socket socket) {
    if (stopping_) {
        return;
    }
    if (ec) {
        std::cerr << "Accept error: " << ec.message() << std::endl;
    } else {
        auto session = std::make_shared<WebSocketSession>(std::move(socket), *this);
        session->run();
    }
    if (acceptor_.is_open()) {
        do_accept();
    }
}

} // namespace ws

