#include "game_loop.h"

#include "../milestone-1.1/socket.h"

#include <algorithm>
#include <atomic>
#include <array>
#include <cctype>
#include <csignal>
#include <cstddef>
#include <cstdlib>
#include <exception>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

namespace {

class SignalHandler {
public:
    static void install();
    static void register_server(std::function<void()> stop_fn);

private:
    static void handle(int);
};

std::atomic<bool> g_signal_received{false};
std::function<void()> g_stop_callback;
std::mutex g_signal_mutex;

void SignalHandler::install() {
    std::signal(SIGINT, handle);
    std::signal(SIGTERM, handle);
}

void SignalHandler::register_server(std::function<void()> stop_fn) {
    std::lock_guard<std::mutex> lock(g_signal_mutex);
    g_stop_callback = std::move(stop_fn);
}

void SignalHandler::handle(int) {
    g_signal_received.store(true);
    std::function<void()> callback;
    {
        std::lock_guard<std::mutex> lock(g_signal_mutex);
        callback = g_stop_callback;
    }
    if (callback) {
        callback();
    }
}

std::string trim(const std::string &input) {
    const auto begin = std::find_if_not(input.begin(), input.end(), [](unsigned char ch) {
        return std::isspace(ch) != 0;
    });
    if (begin == input.end()) {
        return std::string{};
    }
    const auto end = std::find_if_not(input.rbegin(), input.rend(), [](unsigned char ch) {
        return std::isspace(ch) != 0;
    }).base();
    return std::string(begin, end);
}

std::string to_upper(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::toupper(ch));
    });
    return value;
}

} // namespace

namespace game {

class GameServer {
public:
    explicit GameServer(std::uint16_t port);
    ~GameServer();

    void run();
    void stop();

private:
    struct PlayerSession {
        PlayerSession(int id, std::string name, net::Socket socket);

        void send(const std::string &message);

        int id;
        std::string name;
        net::Socket socket;
        std::mutex send_mutex;
    };

    void broadcast_state(StateSnapshot snapshot);
    void handle_client(const std::shared_ptr<PlayerSession> &session);
    void handle_command(const std::shared_ptr<PlayerSession> &session, const std::string &command);
    void announce_to_player(const std::shared_ptr<PlayerSession> &session, const std::string &message);

    std::uint16_t port_;
    net::Socket listener_;
    std::atomic<bool> running_;
    GameState state_;
    GameLoop loop_;
    std::thread loop_thread_;
    std::mutex players_mutex_;
    std::vector<std::shared_ptr<PlayerSession>> players_;
    std::vector<std::thread> client_threads_;
};

GameServer::PlayerSession::PlayerSession(int id, std::string name, net::Socket socket)
    : id(id), name(std::move(name)), socket(std::move(socket)) {}

void GameServer::PlayerSession::send(const std::string &message) {
    std::lock_guard<std::mutex> lock(send_mutex);
    socket.send_all(message.data(), message.size());
}

GameServer::GameServer(std::uint16_t port)
    : port_(port), listener_(net::Socket::create_tcp()), running_(false),
      loop_(state_, [this](StateSnapshot snapshot) { broadcast_state(std::move(snapshot)); }) {}

GameServer::~GameServer() {
    stop();
    for (auto &thread : client_threads_) {
        if (thread.joinable()) {
            thread.join();
        }
    }
    if (loop_thread_.joinable()) {
        loop_thread_.join();
    }
}

void GameServer::run() {
    listener_.set_reuse_address(true);
    listener_.bind(port_);
    listener_.listen();

    running_.store(true);

    std::cout << "Turn-based combat server listening on port " << port_ << '\n';
    std::cout << "Waiting for two players..." << std::endl;

    try {
        while (running_.load()) {
            {
                std::lock_guard<std::mutex> lock(players_mutex_);
                if (players_.size() >= 2) {
                    break;
                }
            }

            net::Socket client = listener_.accept();

            int player_id;
            {
                std::lock_guard<std::mutex> lock(players_mutex_);
                player_id = static_cast<int>(players_.size());
            }
            std::string player_name = "Player " + std::to_string(player_id + 1);
            auto session =
                std::make_shared<PlayerSession>(player_id, player_name, std::move(client));

            {
                std::lock_guard<std::mutex> lock(players_mutex_);
                players_.push_back(session);
            }

            state_.add_or_update_player(player_id, session->name);
            announce_to_player(session,
                               "Welcome, " + session->name +
                                   "! Type ATTACK on your turn. First to reduce opponent to 0 wins.\n");
            client_threads_.emplace_back(&GameServer::handle_client, this, session);

            std::size_t player_count_after_connect;
            {
                std::lock_guard<std::mutex> lock(players_mutex_);
                player_count_after_connect = players_.size();
            }

            if (player_count_after_connect == 2) {
                state_.start_if_ready();
                if (!loop_thread_.joinable()) {
                    loop_thread_ = std::thread([this]() { loop_.run(); });
                }
                std::cout << "Both players connected. Battle commencing!" << std::endl;
            }
        }
    } catch (const std::exception &ex) {
        if (running_.load()) {
            throw;
        }
        std::cerr << "Server stopped accepting connections: " << ex.what() << std::endl;
    }

    for (auto &thread : client_threads_) {
        if (thread.joinable()) {
            thread.join();
        }
    }
    client_threads_.clear();

    if (loop_thread_.joinable()) {
        loop_thread_.join();
    }

    listener_.close();
    running_.store(false);

    if (g_signal_received.load()) {
        std::cout << "Signal received. Server shut down." << std::endl;
    }
}

void GameServer::stop() {
    const bool was_running = running_.exchange(false);
    if (!was_running) {
        return;
    }
    loop_.stop();
    listener_.close();
    std::lock_guard<std::mutex> lock(players_mutex_);
    for (auto &session : players_) {
        if (session->socket.is_valid()) {
            session->socket.shutdown();
            session->socket.close();
        }
    }
}

void GameServer::broadcast_state(StateSnapshot snapshot) {
    std::ostringstream message;
    message << "TICK " << snapshot.tick << " | ";
    message << (snapshot.running ? "RUNNING" : (snapshot.game_over ? "FINISHED" : "WAITING"));
    if (!snapshot.last_action.empty()) {
        message << " | " << snapshot.last_action;
    }
    if (snapshot.game_over && snapshot.winner_id) {
        message << " | Winner: Player " << (*snapshot.winner_id + 1);
    }
    message << "\n";
    for (const PlayerSnapshot &player : snapshot.players) {
        message << " - " << player.name << " (HP: " << player.health << ")";
        message << (player.connected ? " [online]" : " [offline]");
        if (player.is_turn) {
            message << " <-- Your Turn!";        }
        message << "\n";
    }
    const std::string payload = message.str();

    std::lock_guard<std::mutex> lock(players_mutex_);
    for (const auto &session : players_) {
        if (!session->socket.is_valid()) {
            continue;
        }
        try {
            session->send(payload);
        } catch (const std::exception &ex) {
            std::cerr << "Failed to send update to " << session->name << ": " << ex.what() << std::endl;
        }
    }
}

void GameServer::handle_client(const std::shared_ptr<PlayerSession> &session) {
    try {
        std::array<std::byte, 512> buffer{};
        std::string pending;
        while (running_.load()) {
            const std::size_t received = session->socket.receive(buffer.data(), buffer.size());
            if (received == 0) {
                break;
            }
            pending.append(reinterpret_cast<const char *>(buffer.data()), received);
            std::size_t newline_pos = std::string::npos;
            while ((newline_pos = pending.find('\n')) != std::string::npos) {
                std::string line = pending.substr(0, newline_pos);
                pending.erase(0, newline_pos + 1);
                line = trim(line);
                if (line.empty()) {
                    continue;
                }
                handle_command(session, line);
            }
        }
    } catch (const std::exception &ex) {
        std::cerr << "Connection error with " << session->name << ": " << ex.what() << std::endl;
    }

    state_.mark_player_disconnected(session->id);
}

void GameServer::handle_command(const std::shared_ptr<PlayerSession> &session, const std::string &command) {
    const std::string upper = to_upper(command);
    if (upper == "ATTACK") {
        loop_.enqueue_command(Command{session->id, CommandType::Attack});
        announce_to_player(session, "Queued ATTACK command.\n");
    } else if (upper == "STATUS") {
        announce_to_player(session, "Waiting for next tick...\n");
    } else if (upper == "QUIT") {
        announce_to_player(session, "Goodbye!\n");
        state_.mark_player_disconnected(session->id);
        stop();
    } else {
        announce_to_player(session, "Unknown command. Try ATTACK or STATUS.\n");
    }
}

void GameServer::announce_to_player(const std::shared_ptr<PlayerSession> &session, const std::string &message) {
    try {
        session->send(message);
    } catch (const std::exception &ex) {
        std::cerr << "Failed to send message to " << session->name << ": " << ex.what() << std::endl;
    }
}

} // namespace game

int main(int argc, char *argv[]) {
    std::uint16_t port = 9100;
    if (argc > 1) {
        char *end = nullptr;
        unsigned long value = std::strtoul(argv[1], &end, 10);
        if (!end || *end != '\0' || value == 0 ||
            value > std::numeric_limits<std::uint16_t>::max()) {
            std::cerr << "Invalid port number: " << (argv[1] ? argv[1] : "") << std::endl;
            return EXIT_FAILURE;
        }
        port = static_cast<std::uint16_t>(value);
    }

    try {
        game::GameServer server(port);
        SignalHandler::register_server([&server]() { server.stop(); });
        SignalHandler::install();
        server.run();
    } catch (const std::exception &ex) {
        std::cerr << "Fatal error: " << ex.what() << std::endl;
        return EXIT_FAILURE;
    }

    return EXIT_SUCCESS;
}
