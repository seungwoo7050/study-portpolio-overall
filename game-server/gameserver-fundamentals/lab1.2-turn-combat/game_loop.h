#pragma once

#include "game_state.h"

#include <atomic>
#include <chrono>
#include <functional>
#include <mutex>
#include <queue>
#include <thread>

namespace game {

class GameLoop {
public:
    using Clock = std::chrono::steady_clock;
    using BroadcastFn = std::function<void(StateSnapshot)>;

    static constexpr int TARGET_TPS = 10;
    static constexpr std::chrono::milliseconds TICK_DURATION{100};

    GameLoop(GameState &state, BroadcastFn broadcaster);

    void enqueue_command(const Command &command);
    void run();
    void stop();

private:
    void process_inputs();
    void update();
    void broadcast_tick();

    GameState &state_;
    BroadcastFn broadcaster_;
    std::queue<Command> commands_;
    mutable std::mutex command_mutex_;
    std::atomic<bool> running_;
    std::uint64_t tick_counter_;
};

inline GameLoop::GameLoop(GameState &state, BroadcastFn broadcaster)
    : state_(state), broadcaster_(std::move(broadcaster)), running_(false), tick_counter_(0) {}

inline void GameLoop::enqueue_command(const Command &command) {
    std::lock_guard<std::mutex> lock(command_mutex_);
    commands_.push(command);
}

inline void GameLoop::run() {
    running_.store(true);
    while (running_.load()) {
        const auto tick_start = Clock::now();

        process_inputs();
        update();
        ++tick_counter_;
        broadcast_tick();

        const auto elapsed = Clock::now() - tick_start;
        if (elapsed < TICK_DURATION) {
            std::this_thread::sleep_for(TICK_DURATION - elapsed);
        }
        if (state_.is_game_over()) {
            running_.store(false);
        }
    }
    broadcast_tick();
}

inline void GameLoop::stop() {
    running_.store(false);
}

inline void GameLoop::process_inputs() {
    std::queue<Command> local_queue;
    {
        std::lock_guard<std::mutex> lock(command_mutex_);
        std::swap(local_queue, commands_);
    }
    while (!local_queue.empty()) {
        const Command &command = local_queue.front();
        switch (command.type) {
        case CommandType::Attack:
            state_.apply_attack(command.player_id);
            break;
        }
        local_queue.pop();
    }
}

inline void GameLoop::update() {
    state_.advance_tick();
}

inline void GameLoop::broadcast_tick() {
    if (!broadcaster_) {
        return;
    }
    StateSnapshot snapshot = state_.snapshot();
    snapshot.tick = tick_counter_;
    broadcaster_(std::move(snapshot));
}

} // namespace game
