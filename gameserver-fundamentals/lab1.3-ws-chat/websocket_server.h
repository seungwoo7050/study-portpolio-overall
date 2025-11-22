#pragma once

#include "room.h"

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core/error.hpp>

#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace ws {

class WebSocketSession;

class WebSocketServer : public std::enable_shared_from_this<WebSocketServer> {
public:
    using tcp = boost::asio::ip::tcp;

    WebSocketServer(boost::asio::io_context &ioc, const tcp::endpoint &endpoint);

    void run();
    void stop();

    void register_session(const std::shared_ptr<WebSocketSession> &session);
    void unregister_session(const std::shared_ptr<WebSocketSession> &session);

    void join_room(const std::shared_ptr<WebSocketSession> &session, const std::string &room_id);
    void leave_room(const std::shared_ptr<WebSocketSession> &session, const std::string &room_id);
    void broadcast_to_room(const std::string &room_id, const std::string &message, const std::shared_ptr<WebSocketSession> &sender);

    bool is_nickname_available(const std::string &name, const std::shared_ptr<WebSocketSession> &self);
    std::string build_room_list();
    bool build_member_list(const std::string &room_id, std::string &out_members);

private:
    std::shared_ptr<Room> get_or_create_room(const std::string &room_id);
    void remove_room_if_empty(const std::shared_ptr<Room> &room);

    void do_accept();
    void on_accept(boost::beast::error_code ec, tcp::socket socket);

    boost::asio::io_context &ioc_;
    tcp::acceptor acceptor_;

    std::mutex sessions_mutex_;
    std::vector<std::weak_ptr<WebSocketSession>> sessions_;

    std::mutex rooms_mutex_;
    std::map<std::string, std::shared_ptr<Room>> rooms_;

    bool stopping_;
};

} // namespace ws

