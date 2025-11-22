#pragma once

#include "websocket_server.h"

#include <boost/asio/bind_executor.hpp>
#include <boost/asio/dispatch.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core/flat_buffer.hpp>
#include <boost/beast/websocket.hpp>

#include <deque>
#include <initializer_list>
#include <memory>
#include <mutex>
#include <set>
#include <string>
#include <unordered_map>
#include <utility>

namespace ws {

class WebSocketSession : public std::enable_shared_from_this<WebSocketSession> {
public:
    using websocket_stream = boost::beast::websocket::stream<boost::asio::ip::tcp::socket>;

    WebSocketSession(boost::asio::ip::tcp::socket socket, WebSocketServer &server);

    void run();
    void send(std::string message);
    void close();
    const std::string& nickname() const;

private:
    void on_accept(boost::beast::error_code ec);
    void do_read();
    void on_read(boost::beast::error_code ec, std::size_t bytes_transferred);
    void on_write(boost::beast::error_code ec, std::size_t bytes_transferred);
    void on_close(boost::beast::error_code ec);
    void fail(const char *where, boost::beast::error_code ec);

    void handle_command(const std::string &payload);
    void handle_join(const std::string &room_id);
    void handle_leave(const std::string &room_id);
    void handle_message(const std::string &room_id, const std::string &text);
    void handle_nick(const std::string &new_nick);
    void handle_list_rooms();
    void handle_list_members(const std::string &room_id);
    void leave_all_rooms();

    static std::string escape_json(const std::string &value);
    static std::string make_payload(const std::string &type, std::initializer_list<std::pair<std::string, std::string>> fields);
    static std::unordered_map<std::string, std::string> parse_json_object(const std::string &payload, bool &ok);

    websocket_stream ws_;
    boost::beast::flat_buffer buffer_;
    WebSocketServer &server_;
    std::deque<std::string> write_queue_;
    bool open_;

    std::mutex rooms_mutex_;
    std::set<std::string> joined_rooms_;
    std::string session_id_;
    std::string nickname_;
};

} // namespace ws

