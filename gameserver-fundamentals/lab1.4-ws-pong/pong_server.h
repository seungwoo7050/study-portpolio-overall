#pragma once

#include "pong_game.h"

#include <boost/asio/bind_executor.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/post.hpp>
#include <boost/asio/signal_set.hpp>
#include <boost/asio/strand.hpp>
#include <boost/beast/core/buffers_to_string.hpp>
#include <boost/beast/core/flat_buffer.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/json.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cerrno>
#include <deque>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <pthread.h>
#include <sched.h>
#include <string>
#include <thread>
#include <time.h>
#include <vector>

namespace pong {

class PongServer : public std::enable_shared_from_this<PongServer> {
public:
    using tcp = boost::asio::ip::tcp;
    using Clock = std::chrono::steady_clock;

    PongServer(boost::asio::io_context &ioc, const tcp::endpoint &endpoint);
    ~PongServer();

    void run();
    void stop();
    GameSnapshot current_snapshot() const;

private:
    class Session;
    friend class Session;

    void do_accept();
    void on_accept(boost::beast::error_code ec, tcp::socket socket);

    PlayerSide register_session(const std::shared_ptr<Session> &session,
                                const std::string &optional_player_id,
                                std::string &assigned_player_id,
                                bool &reconnected);
    void unregister_session(const std::shared_ptr<Session> &session, PlayerSide role);
    void handle_input(const std::shared_ptr<Session> &session, PlayerSide side, int direction, std::uint64_t seq);
    void broadcast_state(const GameSnapshot &snapshot);
    void notify_roles();
    void record_input_latency(double latency_ms);
    void send_metrics(const std::shared_ptr<Session> &session, const std::string &match_id);
    boost::json::object metrics_snapshot() const;
    std::string generate_player_id();
    void cleanup_reconnect_timeouts();
    static std::int64_t get_server_time_ms();
    static void precise_sleep_until(const Clock::time_point &target);

    void game_loop();

    boost::asio::io_context &ioc_;
    tcp::acceptor acceptor_;
    PongGame game_;

    mutable std::mutex session_mutex_;

    struct PlayerSlot {
        std::string player_id;
        std::weak_ptr<Session> session;
        enum class Status { Empty, Active, Reconnecting } status = Status::Empty;
        Clock::time_point disconnected_at;
    };

    std::vector<std::weak_ptr<Session>> sessions_;
    PlayerSlot left_slot_;
    PlayerSlot right_slot_;
    std::chrono::milliseconds reconnect_timeout_{10000};

    struct PendingAck {
        std::weak_ptr<Session> session;
        Clock::time_point requested_at{};
        std::uint64_t target_tick{0};
        std::uint64_t seq{0};
        int direction{0};
        bool pending{false};
    };

    PendingAck pending_left_ack_;
    PendingAck pending_right_ack_;

    mutable std::mutex metrics_mutex_;
    Clock::time_point last_tick_time_{};
    bool have_last_tick_time_{false};
    double total_tick_ms_{0.0};
    double min_tick_ms_{std::numeric_limits<double>::max()};
    double max_tick_ms_{0.0};
    std::size_t tick_samples_{0};
    double total_input_latency_ms_{0.0};
    double min_input_latency_ms_{std::numeric_limits<double>::max()};
    double max_input_latency_ms_{0.0};
    std::size_t input_latency_samples_{0};

    std::atomic<bool> running_;
    std::thread loop_thread_;
};

class PongServer::Session : public std::enable_shared_from_this<PongServer::Session> {
public:
    using websocket_stream = boost::beast::websocket::stream<boost::asio::ip::tcp::socket>;

    Session(boost::asio::ip::tcp::socket socket, PongServer &server);

    void run();
    void send(const std::string &message);
    void close();
    PlayerSide role() const { return role_; }

private:
    void on_accept(boost::beast::error_code ec);
    void do_read();
    void on_read(boost::beast::error_code ec, std::size_t bytes_transferred);
    void on_write(boost::beast::error_code ec, std::size_t bytes_transferred);
    void on_close(boost::beast::error_code ec);
    void fail(const char *where, boost::beast::error_code ec);

    void handle_message(const std::string &payload);
    void handle_input_command(const boost::json::object &obj);
    void handle_hello(const boost::json::object &obj);
    
    std::string match_id_;

    websocket_stream ws_;
    boost::beast::flat_buffer buffer_;
    PongServer &server_;
    std::deque<std::string> write_queue_;
    bool open_;
    PlayerSide role_;
};

inline PongServer::PongServer(boost::asio::io_context &ioc, const tcp::endpoint &endpoint)
    : ioc_(ioc), acceptor_(ioc), running_(false) {
    boost::beast::error_code ec;
    acceptor_.open(endpoint.protocol(), ec);
    if (ec) {
        throw boost::beast::system_error{ec};
    }
    acceptor_.set_option(boost::asio::socket_base::reuse_address(true), ec);
    if (ec) {
        throw boost::beast::system_error{ec};
    }
    acceptor_.bind(endpoint, ec);
    if (ec) {
        throw boost::beast::system_error{ec};
    }
    acceptor_.listen(boost::asio::socket_base::max_listen_connections, ec);
    if (ec) {
        throw boost::beast::system_error{ec};
    }
    last_tick_time_ = Clock::now();
}

inline PongServer::~PongServer() {
    running_.store(false);
    if (loop_thread_.joinable()) {
        loop_thread_.join();
    }
}

inline void PongServer::run() {
    running_.store(true);
    auto self = shared_from_this();
    loop_thread_ = std::thread([self] { self->game_loop(); });
    do_accept();
}

inline void PongServer::stop() {
    bool expected = true;
    if (!running_.compare_exchange_strong(expected, false)) {
        running_.store(false);
    }
    if (loop_thread_.joinable()) {
        loop_thread_.join();
    }

    std::vector<std::shared_ptr<Session>> sessions;
    {
        std::lock_guard<std::mutex> lock(session_mutex_);
        for (auto &weak : sessions_) {
            if (auto session = weak.lock()) {
                sessions.push_back(session);
            }
        }
        sessions_.clear();
        left_player_.reset();
        right_player_.reset();
    }

    boost::beast::error_code ec;
    acceptor_.close(ec);
    for (auto &session : sessions) {
        session->close();
    }
}

inline GameSnapshot PongServer::current_snapshot() const {
    return game_.snapshot();
}

inline void PongServer::do_accept() {
    acceptor_.async_accept(boost::asio::make_strand(ioc_),
        [self = shared_from_this()](boost::beast::error_code ec, tcp::socket socket) {
            self->on_accept(ec, std::move(socket));
        });
}

inline void PongServer::on_accept(boost::beast::error_code ec, tcp::socket socket) {
    if (ec) {
        return;
    }
    auto session = std::make_shared<Session>(std::move(socket), *this);
    session->run();
    do_accept();
}

inline std::string PongServer::generate_player_id() {
    static std::atomic<std::uint64_t> counter{0};
    return "player_" + std::to_string(++counter);
}

inline std::int64_t PongServer::get_server_time_ms() {
    auto now = std::chrono::system_clock::now();
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()).count();
}

inline PlayerSide PongServer::register_session(const std::shared_ptr<Session> &session,
                                               const std::string &optional_player_id,
                                               std::string &assigned_player_id,
                                               bool &reconnected) {

    std::lock_guard<std::mutex> lock(session_mutex_);
    sessions_.push_back(session);
    reconnected = false;
    PlayerSide role = PlayerSide::Spectator;
    // Check for reconnection
    if (!optional_player_id.empty()) {
        // Try to reconnect to left slot
        if (left_slot_.status == PlayerSlot::Status::Reconnecting && 
            left_slot_.player_id == optional_player_id) {
            left_slot_.session = session;
            left_slot_.status = PlayerSlot::Status::Active;
            assigned_player_id = left_slot_.player_id;
            reconnected = true;
            return PlayerSide::Left;
        }
        
        // Try to reconnect to right slot
        if (right_slot_.status == PlayerSlot::Status::Reconnecting && 
            right_slot_.player_id == optional_player_id) {
            right_slot_.session = session;
            right_slot_.status = PlayerSlot::Status::Active;
            assigned_player_id = right_slot_.player_id;
            reconnected = true;
            return PlayerSide::Right;
        }
    }
    
    // Assign new player_id
    if (optional_player_id.empty()) {
        assigned_player_id = generate_player_id();
    } else {
        assigned_player_id = optional_player_id;
    }
    
    // Assign to empty slot
    if (left_slot_.status == PlayerSlot::Status::Empty) {
        left_slot_.player_id = assigned_player_id;
        left_slot_.session = session;
        left_slot_.status = PlayerSlot::Status::Active;

        role = PlayerSide::Left;
    } else if (right_slot_.status == PlayerSlot::Status::Empty) {
        right_slot_.player_id = assigned_player_id;
        right_slot_.session = session;
        right_slot_.status = PlayerSlot::Status::Active;
        role = PlayerSide::Right;
    }
    return role;
}

inline void PongServer::unregister_session(const std::shared_ptr<Session> &session, PlayerSide role) {
    std::lock_guard<std::mutex> lock(session_mutex_);
    sessions_.erase(std::remove_if(sessions_.begin(), sessions_.end(), [&](const std::weak_ptr<Session> &candidate) {
                       auto locked = candidate.lock();
                       return !locked || locked == session;
                   }),
        sessions_.end());
    if (role == PlayerSide::Left) {
        if (auto current = left_slot_.session.lock(); current == session) {
            left_slot_.session.reset();
            left_slot_.status = PlayerSlot::Status::Reconnecting;
            left_slot_.disconnected_at = Clock::now();
        }
        pending_left_ack_.pending = false;
        pending_left_ack_.session.reset();
    } else if (role == PlayerSide::Right) {
        if (auto current = right_slot_.session.lock(); current == session) {
            right_slot_.session.reset();
            right_slot_.status = PlayerSlot::Status::Reconnecting;
            right_slot_.disconnected_at = Clock::now();
        }
        pending_right_ack_.pending = false;
        pending_right_ack_.session.reset();
    }
}

inline void PongServer::cleanup_reconnect_timeouts() {
    std::lock_guard<std::mutex> lock(session_mutex_);
    const auto now = Clock::now();
    
    if (left_slot_.status == PlayerSlot::Status::Reconnecting) {
        if (now - left_slot_.disconnected_at > reconnect_timeout_) {
            left_slot_.status = PlayerSlot::Status::Empty;
            left_slot_.player_id.clear();
        }
    }
    
    if (right_slot_.status == PlayerSlot::Status::Reconnecting) {
        if (now - right_slot_.disconnected_at > reconnect_timeout_) {
            right_slot_.status = PlayerSlot::Status::Empty;
            right_slot_.player_id.clear();
        }
    }
}

inline void PongServer::handle_input(const std::shared_ptr<Session> &session, PlayerSide side, int direction, std::uint64_t seq) {
    if (side == PlayerSide::Spectator || !session) {
        return;
    }
    const int clamped = std::clamp(direction, -1, 1);
    game_.set_player_direction(side, clamped);
    const auto snapshot = game_.snapshot();
    const auto now = Clock::now();

    std::lock_guard<std::mutex> lock(session_mutex_);
    auto &pending = side == PlayerSide::Left ? pending_left_ack_ : pending_right_ack_;
    pending.session = session;
    pending.requested_at = now;
    pending.target_tick = snapshot.tick + 1;
    pending.seq = seq;
    pending.direction = clamped;
    pending.pending = true;
}

inline void PongServer::broadcast_state(const GameSnapshot &snapshot) {
    boost::json::object state;
    state["type"] = "state";
    state["match_id"] = "default";
     state["tick"] = snapshot.tick;
    state["server_time_ms"] = get_server_time_ms();
    boost::json::object ball;
    ball["x"] = snapshot.ball_x;
    ball["y"] = snapshot.ball_y;
    ball["vx"] = snapshot.ball_vx;
    ball["vy"] = snapshot.ball_vy;
    state["ball"] = ball;
    boost::json::object left_paddle;
    left_paddle["y"] = snapshot.left_paddle_y;
    left_paddle["dir"] = snapshot.left_direction;
    boost::json::object right_paddle;
    right_paddle["y"] = snapshot.right_paddle_y;
    right_paddle["dir"] = snapshot.right_direction;
    paddles["left"] = left_paddle;
    paddles["right"] = right_paddle;
    state["paddles"] = paddles;
    boost::json::object scores;
    scores["left"] = snapshot.left_score;
    scores["right"] = snapshot.right_score;
    state["scores"] = scores;

    const std::string message = boost::json::serialize(state);

    struct AckDispatch {
        std::shared_ptr<Session> session;
        std::uint64_t seq{0};
        int direction{0};
        double latency_ms{0.0};
        std::uint64_t tick{0};
    };

    std::vector<std::shared_ptr<Session>> active_sessions;
    std::vector<AckDispatch> ack_messages;
    {
        std::lock_guard<std::mutex> lock(session_mutex_);
        sessions_.erase(std::remove_if(sessions_.begin(), sessions_.end(), [](const std::weak_ptr<Session> &candidate) {
                           return candidate.expired();
                       }),
            sessions_.end());
        for (auto &weak_session : sessions_) {
            if (auto session = weak_session.lock()) {
                active_sessions.push_back(session);
            }
        }

        const auto now = Clock::now();
        if (pending_left_ack_.pending && snapshot.tick >= pending_left_ack_.target_tick) {
            if (auto session = pending_left_ack_.session.lock()) {
                ack_messages.push_back({session, pending_left_ack_.seq, pending_left_ack_.direction,
                    std::chrono::duration<double, std::milli>(now - pending_left_ack_.requested_at).count(), snapshot.tick});
            }
            pending_left_ack_.pending = false;
        }
        if (pending_right_ack_.pending && snapshot.tick >= pending_right_ack_.target_tick) {
            if (auto session = pending_right_ack_.session.lock()) {
                ack_messages.push_back({session, pending_right_ack_.seq, pending_right_ack_.direction,
                    std::chrono::duration<double, std::milli>(now - pending_right_ack_.requested_at).count(), snapshot.tick});
            }
            pending_right_ack_.pending = false;
        }
    }

    for (auto &session : active_sessions) {
        session->send(message);
    }

    for (const auto &ack : ack_messages) {
        record_input_latency(ack.latency_ms);
        boost::json::object ack_payload;
        ack_payload["type"] = "input-ack";
        ack_payload["match_id"] = "default";
        ack_payload["seq"] = ack.seq;
        ack_payload["applied_direction"] = ack.direction;
        ack_payload["applied_tick"] = ack.tick;
        ack_payload["latency_ms"] = ack.latency_ms;
        ack_payload["server_time_ms"] = get_server_time_ms();

        ack.session->send(boost::json::serialize(ack_payload));
    }
}

inline void PongServer::notify_roles() {
    boost::json::object payload;
    payload["type"] = "roles";
    payload["match_id"] = "default";
    
    boost::json::object slots;
    
    boost::json::object left_slot;
    if (left_slot_.status == PlayerSlot::Status::Empty) {
        left_slot["status"] = "empty";
    } else if (left_slot_.status == PlayerSlot::Status::Active) {
        left_slot["status"] = "active";
    } else {
        left_slot["status"] = "reconnecting";
    }
    
    boost::json::object right_slot;
    if (right_slot_.status == PlayerSlot::Status::Empty) {
        right_slot["status"] = "empty";
    } else if (right_slot_.status == PlayerSlot::Status::Active) {
        right_slot["status"] = "active";
    } else {
        right_slot["status"] = "reconnecting";
    }
    
    slots["left"] = left_slot;
    slots["right"] = right_slot;
    payload["slots"] = slots;
    const std::string message = boost::json::serialize(payload);

    std::vector<std::shared_ptr<Session>> active_sessions;
    {
        std::lock_guard<std::mutex> lock(session_mutex_);
        for (auto &weak : sessions_) {
            if (auto session = weak.lock()) {
                active_sessions.push_back(session);
            }
        }
    }

    for (auto &session : active_sessions) {
        session->send(message);
    }
}

inline void PongServer::precise_sleep_until(const Clock::time_point &target) {
    const auto now = Clock::now();
    if (target <= now) {
        return;
    }
    const auto ns = std::chrono::duration_cast<std::chrono::nanoseconds>(target.time_since_epoch());
    timespec ts{};
    ts.tv_sec = static_cast<time_t>(ns.count() / 1'000'000'000);
    ts.tv_nsec = static_cast<long>(ns.count() % 1'000'000'000);
    while (true) {
        const int rc = ::clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &ts, nullptr);
        if (rc == 0) {
            break;
        }
        if (rc != EINTR) {
            break;
        }
    }
}

inline void PongServer::game_loop() {
    const double dt = 1.0 / 60.0;
    const auto frame_duration = std::chrono::nanoseconds(16'666'667);
    auto next_tick = Clock::now();

#ifdef __linux__
    {
        sched_param param{};
        param.sched_priority = 10;
        ::pthread_setschedparam(pthread_self(), SCHED_FIFO, &param);
    }
#endif

    {
        std::lock_guard<std::mutex> lock(metrics_mutex_);
        have_last_tick_time_ = false;
        total_tick_ms_ = 0.0;
        min_tick_ms_ = std::numeric_limits<double>::max();
        max_tick_ms_ = 0.0;
        tick_samples_ = 0;
        total_input_latency_ms_ = 0.0;
        min_input_latency_ms_ = std::numeric_limits<double>::max();
        max_input_latency_ms_ = 0.0;
        input_latency_samples_ = 0;
        last_tick_time_ = Clock::now();
    }

    while (running_.load()) {
        auto now = Clock::now();
        if (now < next_tick) {
            precise_sleep_until(next_tick);
            now = Clock::now();
        }
        if (!running_.load()) {
            break;
        }
        // Cleanup reconnect timeouts every 60 ticks
        if (snapshot.tick % 60 == 0) {
            cleanup_reconnect_timeouts();
        }

        const auto snapshot = game_.update(dt);
        broadcast_state(snapshot);
        next_tick += frame_duration;

        now = Clock::now();
        {
            std::lock_guard<std::mutex> lock(metrics_mutex_);
            if (have_last_tick_time_) {
                const double interval_ms = std::chrono::duration<double, std::milli>(now - last_tick_time_).count();
                total_tick_ms_ += interval_ms;
                if (interval_ms < min_tick_ms_) {
                    min_tick_ms_ = interval_ms;
                }
                if (interval_ms > max_tick_ms_) {
                    max_tick_ms_ = interval_ms;
                }
                ++tick_samples_;
            } else {
                have_last_tick_time_ = true;
            }
            last_tick_time_ = now;
        }
        if (now > next_tick + frame_duration) {
            next_tick = now;
        }
    }
}

inline PongServer::Session::Session(boost::asio::ip::tcp::socket socket, PongServer &server)
    : ws_(std::move(socket)), server_(server), open_(false), role_(PlayerSide::Spectator) {}

inline void PongServer::Session::run() {
    ws_.set_option(boost::beast::websocket::stream_base::timeout::suggested(boost::beast::role_type::server));
    ws_.set_option(boost::beast::websocket::stream_base::decorator([](boost::beast::websocket::response_type &res) {
        res.set(boost::beast::http::field::server, "Milestone1.4-Pong-Server");
    }));
    boost::beast::error_code ec;
    ws_.next_layer().set_option(boost::asio::ip::tcp::no_delay(true), ec);
    auto self = shared_from_this();
    ws_.async_accept(boost::asio::bind_executor(ws_.get_executor(), [self](boost::beast::error_code ec) {
        self->on_accept(ec);
    }));
}

inline void PongServer::Session::send(const std::string &message) {
    auto self = shared_from_this();
    boost::asio::dispatch(ws_.get_executor(), [self, message] {
        if (!self->open_) {
            return;
        }
        self->write_queue_.push_back(message);
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

inline void PongServer::Session::close() {
    auto self = shared_from_this();
    boost::asio::post(ws_.get_executor(), [self] {
        if (!self->open_) {
            return;
        }
        self->ws_.async_close(boost::beast::websocket::close_code::normal,
            boost::asio::bind_executor(self->ws_.get_executor(), [self](boost::beast::error_code ec) {
                self->on_close(ec);
            }));
    });
}

inline void PongServer::Session::on_accept(boost::beast::error_code ec) {
    if (ec) {
        fail("accept", ec);
        return;
    }
    open_ = true;
    // Wait for hello message instead of sending welcome immediately
    do_read();
}

inline void PongServer::Session::handle_hello(const boost::json::object &obj) {
    // Extract player_id if provided
    std::string player_id;
    if (auto *pid = obj.if_contains("player_id")) {
        if (pid->is_string() && !pid->as_string().empty()) {
            player_id = std::string(pid->as_string().c_str());
        }
    }
    
    // Extract match_id (default to "default")
    std::string match_id = "default";
    if (auto *mid = obj.if_contains("match_id")) {
        if (mid->is_string() && !mid->as_string().empty()) {
            match_id = std::string(mid->as_string().c_str());
        }
    }
    
    match_id_ = match_id;
    
    // Register session and get role
    bool reconnected = false;
    std::string assigned_player_id;
    role_ = server_.register_session(shared_from_this(), player_id, assigned_player_id, reconnected);
    
    // Send welcome message
    boost::json::object welcome;
    welcome["type"] = "welcome";
    welcome["match_id"] = match_id_;
    welcome["player_id"] = assigned_player_id;
    welcome["reconnected"] = reconnected;
    welcome["tick_rate"] = 60;
    
    auto snapshot = server_.current_snapshot();
    welcome["tick"] = snapshot.tick;
    welcome["server_time_ms"] = PongServer::get_server_time_ms();
    
    if (role_ == PlayerSide::Left) {
        welcome["role"] = "left";
    } else if (role_ == PlayerSide::Right) {
        welcome["role"] = "right";
    } else {
        welcome["role"] = "spectator";
    }
    
    send(boost::json::serialize(welcome));
    
    server_.notify_roles();
    
    // Send initial state
    boost::json::object initial;
    initial["type"] = "state";
    initial["match_id"] = match_id_;
    initial["tick"] = snapshot.tick;
    initial["server_time_ms"] = PongServer::get_server_time_ms();
    
    boost::json::object ball;
    ball["x"] = snapshot.ball_x;
    ball["y"] = snapshot.ball_y;
    ball["vx"] = snapshot.ball_vx;
    ball["vy"] = snapshot.ball_vy;
    initial["ball"] = ball;
    
    boost::json::object paddles;
    boost::json::object left_paddle;
    left_paddle["y"] = snapshot.left_paddle_y;
    left_paddle["dir"] = snapshot.left_direction;
    boost::json::object right_paddle;
    right_paddle["y"] = snapshot.right_paddle_y;
    right_paddle["dir"] = snapshot.right_direction;
    paddles["left"] = left_paddle;
    paddles["right"] = right_paddle;
    initial["paddles"] = paddles;
    
    boost::json::object scores;
    scores["left"] = snapshot.left_score;
    scores["right"] = snapshot.right_score;
    initial["scores"] = scores;
    
    send(boost::json::serialize(initial));
}

inline void PongServer::Session::do_read() {
    auto self = shared_from_this();
    ws_.async_read(buffer_, boost::asio::bind_executor(ws_.get_executor(), [self](boost::beast::error_code ec, std::size_t bytes_transferred) {
        self->on_read(ec, bytes_transferred);
    }));
}

inline void PongServer::Session::on_read(boost::beast::error_code ec, std::size_t) {
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
    handle_message(message);
    do_read();
}

inline void PongServer::Session::on_write(boost::beast::error_code ec, std::size_t) {
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

inline void PongServer::Session::on_close(boost::beast::error_code ec) {
    if (!open_) {
        return;
    }
    open_ = false;
    server_.unregister_session(shared_from_this(), role_);
    server_.notify_roles();
    if (ec && ec != boost::asio::error::operation_aborted && ec != boost::asio::error::eof && ec != boost::beast::websocket::error::closed) {
        fail("close", ec);
    }
}

inline void PongServer::Session::fail(const char *where, boost::beast::error_code ec) {
    if (ec == boost::asio::error::operation_aborted || ec == boost::asio::error::eof || ec == boost::asio::error::connection_reset) {
        return;
    }
    std::cerr << "Session " << where << " error: " << ec.message() << std::endl;
}

inline void PongServer::Session::handle_message(const std::string &payload) {
    boost::json::error_code ec;
    boost::json::value value = boost::json::parse(payload, ec);
    if (ec || !value.is_object()) {
        return;
    }
    const auto &obj = value.as_object();
    auto type_it = obj.if_contains("type");
    if (!type_it || !type_it->is_string()) {
        return;
    }
    const std::string type = type_it->as_string().c_str();
    if (type == "hello") {
        handle_hello(obj);
    } else if (type == "input") {
        handle_input_command(obj);
    } else if (type == "ping") {
        boost::json::object pong_msg;
        pong_msg["type"] = "pong";
        pong_msg["match_id"] = match_id_;
        pong_msg["tick"] = server_.current_snapshot().tick;
        pong_msg["server_time_ms"] = PongServer::get_server_time_ms();
        send(boost::json::serialize(pong_msg));
    } else if (type == "metrics-request") {
        server_.send_metrics(shared_from_this(), match_id_);
    }
}

inline void PongServer::Session::handle_input_command(const boost::json::object &obj) {
    auto dir_it = obj.if_contains("direction");
    if (!dir_it || !(dir_it->is_int64() || dir_it->is_double())) {
        return;
    }
    // Extract seq
    std::uint64_t seq = 0;
    if (auto *seq_it = obj.if_contains("seq")) {
        if (seq_it->is_uint64()) {
            seq = seq_it->as_uint64();
        } else if (seq_it->is_int64()) {
            seq = static_cast<std::uint64_t>(seq_it->as_int64());
        }
    }
    int direction = 0;
    if (dir_it->is_int64()) {
        direction = static_cast<int>(dir_it->as_int64());
    } else {
        direction = static_cast<int>(std::round(dir_it->as_double()));
    }
    direction = std::clamp(direction, -1, 1);
    if (role_ == PlayerSide::Spectator) {
        return;
    }
    server_.handle_input(shared_from_this(), role_, direction, seq);
}

inline void PongServer::record_input_latency(double latency_ms) {
    std::lock_guard<std::mutex> lock(metrics_mutex_);
    if (input_latency_samples_ == 0) {
        min_input_latency_ms_ = latency_ms;
        max_input_latency_ms_ = latency_ms;
    } else {
        if (latency_ms < min_input_latency_ms_) {
            min_input_latency_ms_ = latency_ms;
        }
        if (latency_ms > max_input_latency_ms_) {
            max_input_latency_ms_ = latency_ms;
        }
    }
    total_input_latency_ms_ += latency_ms;
    ++input_latency_samples_;
}

inline boost::json::object PongServer::metrics_snapshot() const {
    boost::json::object metrics;
    boost::json::object ticks;
    boost::json::object latency;

    std::lock_guard<std::mutex> lock(metrics_mutex_);
    ticks["samples"] = static_cast<std::uint64_t>(tick_samples_);
    if (tick_samples_ > 0) {
        ticks["min_ms"] = min_tick_ms_;
        ticks["max_ms"] = max_tick_ms_;
        ticks["avg_ms"] = total_tick_ms_ / static_cast<double>(tick_samples_);
    } else {
        ticks["min_ms"] = 0.0;
        ticks["max_ms"] = 0.0;
        ticks["avg_ms"] = 0.0;
    }

    latency["samples"] = static_cast<std::uint64_t>(input_latency_samples_);
    if (input_latency_samples_ > 0) {
        latency["min_ms"] = min_input_latency_ms_;
        latency["max_ms"] = max_input_latency_ms_;
        latency["avg_ms"] = total_input_latency_ms_ / static_cast<double>(input_latency_samples_);
    } else {
        latency["min_ms"] = 0.0;
        latency["max_ms"] = 0.0;
        latency["avg_ms"] = 0.0;
    }

    metrics["ticks"] = ticks;
    metrics["input_latency"] = latency;
    return metrics;
}

inline void PongServer::send_metrics(const std::shared_ptr<Session> &session, const std::string &match_id) {
    if (!session) {
        return;
    }
    boost::json::object payload;
    payload["type"] = "metrics";
    payload["match_id"] = match_id;
    payload["server_time_ms"] = get_server_time_ms();
    auto metrics = metrics_snapshot();
    payload["ticks"] = metrics["ticks"];
    payload["input_latency"] = metrics["input_latency"];
    session->send(boost::json::serialize(payload));
}

} // namespace pong

