#include "websocket_session.h"

#include <boost/asio/error.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core/buffers_to_string.hpp>
#include <boost/beast/http.hpp>

#include <atomic>
#include <cctype>
#include <initializer_list>
#include <iostream>
#include <unordered_map>
#include <vector>

namespace ws {

namespace {
std::atomic<std::uint64_t> next_session_id{1};
} // namespace

WebSocketSession::WebSocketSession(boost::asio::ip::tcp::socket socket, WebSocketServer &server)
    : ws_(std::move(socket)), server_(server), open_(false) {
    const auto id = next_session_id.fetch_add(1);
    session_id_ = "user-" + std::to_string(id);
    nickname_ = session_id_;
}

void WebSocketSession::run() {
    ws_.set_option(boost::beast::websocket::stream_base::timeout::suggested(boost::beast::role_type::server));
    ws_.set_option(boost::beast::websocket::stream_base::decorator([](boost::beast::websocket::response_type &res) {
        res.set(boost::beast::http::field::server, "Milestone1.3-WebSocket-Server");
    }));
    auto self = shared_from_this();
    ws_.async_accept(boost::asio::bind_executor(ws_.get_executor(), [self](boost::beast::error_code ec) {
        self->on_accept(ec);
    }));
}

void WebSocketSession::send(std::string message) {
    boost::asio::post(ws_.get_executor(), [self = shared_from_this(), message = std::move(message)]() mutable {
        if (!self->open_) {
            return;
        }
        self->write_queue_.push_back(std::move(message));
        if (self->write_queue_.size() > 1) {
            return;
        }
        self->ws_.text(true);
        self->ws_.async_write(boost::asio::buffer(self->write_queue_.front()),
            boost::asio::bind_executor(self->ws_.get_executor(), [self](boost::beast::error_code ec, std::size_t bytes_transferred) {
                self->on_write(ec, bytes_transferred);
            }));
    });
}

void WebSocketSession::close() {
    boost::asio::post(ws_.get_executor(), [self = shared_from_this()] {
        if (!self->open_) {
            return;
        }
        self->ws_.async_close(boost::beast::websocket::close_code::normal,
            boost::asio::bind_executor(self->ws_.get_executor(), [self](boost::beast::error_code ec) {
                self->on_close(ec);
            }));
    });
}

void WebSocketSession::on_accept(boost::beast::error_code ec) {
    if (ec) {
        fail("accept", ec);
        return;
    }
    open_ = true;
    server_.register_session(shared_from_this());
    send(make_payload("INFO", {{"message", "Welcome to the WebSocket chat!"}}));
    send(make_payload("INFO", {{"message", "Connected as " + session_id_}}));
    do_read();
}

void WebSocketSession::do_read() {
    auto self = shared_from_this();
    ws_.async_read(buffer_, boost::asio::bind_executor(ws_.get_executor(), [self](boost::beast::error_code ec, std::size_t bytes_transferred) {
        self->on_read(ec, bytes_transferred);
    }));
}

void WebSocketSession::on_read(boost::beast::error_code ec, std::size_t) {
    if (ec == boost::beast::websocket::error::closed || ec == boost::asio::error::operation_aborted || ec == boost::asio::error::eof) {
        on_close(ec);
        return;
    }
    if (ec) {
        fail("read", ec);
        on_close(ec);
        return;
    }
    auto message = boost::beast::buffers_to_string(buffer_.data());
    buffer_.consume(buffer_.size());
    handle_command(message);
    do_read();
}

void WebSocketSession::on_write(boost::beast::error_code ec, std::size_t) {
    if (ec == boost::asio::error::operation_aborted) {
        return;
    }
    if (ec) {
        fail("write", ec);
        on_close(ec);
        return;
    }
    write_queue_.pop_front();
    if (!write_queue_.empty()) {
        auto self = shared_from_this();
        ws_.async_write(boost::asio::buffer(write_queue_.front()),
            boost::asio::bind_executor(self->ws_.get_executor(), [self](boost::beast::error_code write_ec, std::size_t bytes_transferred) {
                self->on_write(write_ec, bytes_transferred);
            }));
    }
}

void WebSocketSession::on_close(boost::beast::error_code ec) {
    if (!open_) {
        return;
    }
    open_ = false;
    auto self = shared_from_this();
    leave_all_rooms();
    server_.unregister_session(self);
    if (ec && ec != boost::beast::websocket::error::closed && ec != boost::asio::error::eof && ec != boost::asio::error::operation_aborted) {
        std::cerr << "Close error: " << ec.message() << std::endl;
    }
}

void WebSocketSession::fail(const char *where, boost::beast::error_code ec) {
    if (ec == boost::asio::error::operation_aborted || ec == boost::asio::error::eof || ec == boost::asio::error::connection_reset) {
        return;
    }
    std::cerr << "WebSocketSession " << where << " error: " << ec.message() << std::endl;
}

void WebSocketSession::handle_command(const std::string &payload) {
    bool ok = false;
    auto fields = parse_json_object(payload, ok);
    if (!ok) {
        send(make_payload("ERROR", {{"message", "Invalid JSON payload"}}));
        return;
    }
    auto cmd_it = fields.find("cmd");
    if (cmd_it == fields.end()) {
        send(make_payload("ERROR", {{"message", "Missing cmd field"}}));
        return;
    }
    const auto &cmd = cmd_it->second;
    if (cmd == "JOIN") {
        auto room_it = fields.find("room");
        if (room_it == fields.end()) {
            send(make_payload("ERROR", {{"message", "JOIN requires room"}}));
            return;
        }
        handle_join(room_it->second);
    } else if (cmd == "LEAVE") {
        auto room_it = fields.find("room");
        if (room_it == fields.end()) {
            send(make_payload("ERROR", {{"message", "LEAVE requires room"}}));
            return;
        }
        handle_leave(room_it->second);
    } else if (cmd == "MSG") {
        auto room_it = fields.find("room");
        auto text_it = fields.find("text");
        if (room_it == fields.end() || text_it == fields.end()) {
            send(make_payload("ERROR", {{"message", "MSG requires room and text"}}));
            return;
        }
        handle_message(room_it->second, text_it->second);
    } else if (cmd == "NICK") {
        auto name_it = fields.find("name");
        if (name_it == fields.end()) {
            send(make_payload("ERROR", {{"message", "NICK requires name"}}));
            return;
        }
        handle_nick(name_it->second);
    } else if (cmd == "LIST_ROOMS") {
        handle_list_rooms();
    } else if (cmd == "LIST_MEMBERS") {
        auto room_it = fields.find("room");
        if (room_it == fields.end()) {
            send(make_payload("ERROR", {{"message", "LIST_MEMBERS requires room"}}));
            return;
        }
        handle_list_members(room_it->second);
    } else {
        send(make_payload("ERROR", {{"message", "Unknown command"}}));
    }
}

void WebSocketSession::handle_join(const std::string &room_id) {
    if (room_id.empty()) {
        send(make_payload("ERROR", {{"message", "Room cannot be empty"}}));
        return;
    }
    bool inserted = false;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        auto result = joined_rooms_.insert(room_id);
        inserted = result.second;
    }
    if (!inserted) {
        send(make_payload("ERROR", {{"message", "Already joined room"}}));
        return;
    }
    auto self = shared_from_this();
    server_.join_room(self, room_id);
    send(make_payload("JOINED", {{"room", room_id}}));
    server_.broadcast_to_room(room_id, make_payload("MSG", {{"room", room_id}, {"from", "server"}, {"text", nickname_ + " joined the room"}}), self);
}

void WebSocketSession::handle_leave(const std::string &room_id) {
    bool was_member = false;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        auto it = joined_rooms_.find(room_id);
        if (it != joined_rooms_.end()) {
            joined_rooms_.erase(it);
            was_member = true;
        }
    }
    if (!was_member) {
        send(make_payload("ERROR", {{"message", "Not a member of room"}}));
        return;
    }
    auto self = shared_from_this();
    server_.leave_room(self, room_id);
    send(make_payload("LEFT", {{"room", room_id}}));
    server_.broadcast_to_room(room_id, make_payload("MSG", {{"room", room_id}, {"from", "server"}, {"text", nickname_ + " left the room"}}), self);
}

void WebSocketSession::handle_message(const std::string &room_id, const std::string &text) {
    if (room_id.empty()) {
        send(make_payload("ERROR", {{"message", "Room cannot be empty"}}));
        return;
    }
    bool member = false;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        member = joined_rooms_.find(room_id) != joined_rooms_.end();
    }
    if (!member) {
        send(make_payload("ERROR", {{"message", "Join room before sending"}}));
        return;
    }
    const auto payload = make_payload("MSG", {{"room", room_id}, {"from", nickname_}, {"text", text}});
    send(payload);
    server_.broadcast_to_room(room_id, payload, shared_from_this());
}

void WebSocketSession::handle_nick(const std::string &name) {
    // 최소한의 검증만: 빈 문자열만 거른다.
    if (name.empty()) {
        send(make_payload("ERROR", {{"message", "Invalid nickname"}}));
        return;
    }

    auto self = shared_from_this();
    if (!server_.is_nickname_available(name, self)) {
        send(make_payload("ERROR", {{"message", "Nickname already in use"}}));
        return;
    }

    const std::string old = nickname_;
    nickname_ = name;

    // 자기 자신에게 성공 알림
    send(make_payload("NICK_OK", {{"name", nickname_}}));

    // 이미 가입한 모든 룸에 시스템 메시지
    std::vector<std::string> rooms;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        rooms.assign(joined_rooms_.begin(), joined_rooms_.end());
    }
    for (const auto &room_id : rooms) {
        const std::string text = old + " is now known as " + nickname_;
        server_.broadcast_to_room(
            room_id,
            make_payload("MSG", {{"room", room_id}, {"from", "server"}, {"text", text}}),
            nullptr);
    }
}

void WebSocketSession::handle_list_rooms() {
    const std::string rooms = server_.build_room_list();
    send(make_payload("ROOM_LIST", {{"rooms", rooms}}));
}

void WebSocketSession::handle_list_members(const std::string &room_id) {
    if (room_id.empty()) {
        send(make_payload("ERROR", {{"message", "LIST_MEMBERS requires room"}}));
        return;
    }
    std::string members;
    if (!server_.build_member_list(room_id, members)) {
        send(make_payload("ERROR", {{"message", "Room not found"}}));
        return;
    }
    send(make_payload("MEMBER_LIST", {{"room", room_id}, {"members", members}}));
}

void WebSocketSession::leave_all_rooms() {
    std::vector<std::string> rooms;
    {
        std::lock_guard<std::mutex> lock(rooms_mutex_);
        rooms.assign(joined_rooms_.begin(), joined_rooms_.end());
        joined_rooms_.clear();
    }
    auto self = shared_from_this();
    for (const auto &room : rooms) {
        server_.leave_room(self, room);
        server_.broadcast_to_room(room, make_payload("MSG", {{"room", room}, {"from", "server"}, {"text", nickname_ + " left the room"}}), self);
    }
}

std::string WebSocketSession::make_payload(const std::string &type, std::initializer_list<std::pair<std::string, std::string>> fields) {
    std::string json = "{\"type\":\"";
    json += escape_json(type);
    json += "\"";
    for (const auto &field : fields) {
        json += ",\"";
        json += escape_json(field.first);
        json += "\":\"";
        json += escape_json(field.second);
        json += "\"";
    }
    json += "}";
    return json;
}

std::string WebSocketSession::escape_json(const std::string &value) {
    std::string escaped;
    escaped.reserve(value.size());
    for (char ch : value) {
        switch (ch) {
        case '\\':
            escaped += "\\\\";
            break;
        case '"':
            escaped += "\\\"";
            break;
        case '\n':
            escaped += "\\n";
            break;
        case '\r':
            escaped += "\\r";
            break;
        case '\t':
            escaped += "\\t";
            break;
        default:
            escaped.push_back(ch);
            break;
        }
    }
    return escaped;
}

std::unordered_map<std::string, std::string> WebSocketSession::parse_json_object(const std::string &payload, bool &ok) {
    std::unordered_map<std::string, std::string> result;
    ok = false;

    enum class State {
        ExpectObjectStart,
        ExpectKeyOrEnd,
        ExpectColon,
        ExpectValue,
        ExpectCommaOrEnd
    };

    auto parse_string = [](const std::string &input, std::size_t &pos, bool &success) -> std::string {
        std::string value;
        success = false;
        if (pos >= input.size() || input[pos] != '"') {
            return value;
        }
        ++pos;
        while (pos < input.size()) {
            char ch = input[pos++];
            if (ch == '"') {
                success = true;
                break;
            }
            if (ch == '\\') {
                if (pos >= input.size()) {
                    return {};
                }
                char esc = input[pos++];
                switch (esc) {
                case '\\':
                case '"':
                case '/':
                    value.push_back(esc);
                    break;
                case 'b':
                    value.push_back('\b');
                    break;
                case 'f':
                    value.push_back('\f');
                    break;
                case 'n':
                    value.push_back('\n');
                    break;
                case 'r':
                    value.push_back('\r');
                    break;
                case 't':
                    value.push_back('\t');
                    break;
                default:
                    return {};
                }
            } else {
                value.push_back(ch);
            }
        }
        return value;
    };

    auto skip_ws = [](const std::string &input, std::size_t &pos) {
        while (pos < input.size() && std::isspace(static_cast<unsigned char>(input[pos]))) {
            ++pos;
        }
    };

    State state = State::ExpectObjectStart;
    std::size_t pos = 0;
    std::string key;
    while (pos < payload.size()) {
        skip_ws(payload, pos);
        if (pos >= payload.size()) {
            break;
        }
        switch (state) {
        case State::ExpectObjectStart:
            if (payload[pos] != '{') {
                return result;
            }
            ++pos;
            state = State::ExpectKeyOrEnd;
            break;
        case State::ExpectKeyOrEnd:
            skip_ws(payload, pos);
            if (pos < payload.size() && payload[pos] == '}') {
                ++pos;
                ok = true;
                return result;
            }
            {
                bool success = false;
                key = parse_string(payload, pos, success);
                if (!success) {
                    return result;
                }
                state = State::ExpectColon;
            }
            break;
        case State::ExpectColon:
            skip_ws(payload, pos);
            if (pos >= payload.size() || payload[pos] != ':') {
                return result;
            }
            ++pos;
            state = State::ExpectValue;
            break;
        case State::ExpectValue: {
            skip_ws(payload, pos);
            bool success = false;
            auto value = parse_string(payload, pos, success);
            if (!success) {
                return result;
            }
            result[key] = value;
            state = State::ExpectCommaOrEnd;
            break;
        }
        case State::ExpectCommaOrEnd:
            skip_ws(payload, pos);
            if (pos >= payload.size()) {
                return result;
            }
            if (payload[pos] == ',') {
                ++pos;
                state = State::ExpectKeyOrEnd;
            } else if (payload[pos] == '}') {
                ++pos;
                ok = true;
                return result;
            } else {
                return result;
            }
            break;
        }
    }

    skip_ws(payload, pos);
    if (state == State::ExpectCommaOrEnd && pos == payload.size()) {
        ok = true;
    }
    return result;
}

const std::string &WebSocketSession::nickname() const {
    return nickname_;
}

} // namespace ws
