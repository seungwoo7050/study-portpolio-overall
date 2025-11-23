/**
 * Matcher Service - Matchmaking service for mini-gameserver
 *
 * This service:
 * - Accepts player match requests
 * - Manages the match queue using Redis
 * - Pairs players with similar MMR
 * - Assigns matched players to available room servers
 */

#include "../../match/matchmaker.h"
#include "../../match/room_manager.h"
#include <iostream>
#include <thread>
#include <chrono>
#include <csignal>
#include <atomic>
#include <cstring>

namespace {
    std::atomic<bool> g_running{true};

    void signal_handler(int signal) {
        if (signal == SIGINT || signal == SIGTERM) {
            std::cout << "\nReceived signal " << signal << ", shutting down..." << std::endl;
            g_running = false;
        }
    }
}

void print_usage(const char* program_name) {
    std::cout << "Usage: " << program_name << " [options]\n"
              << "Options:\n"
              << "  --redis-host <host>     Redis host (default: 127.0.0.1)\n"
              << "  --redis-port <port>     Redis port (default: 6379)\n"
              << "  --tick-rate <hz>        Processing tick rate (default: 10)\n"
              << "  --help                  Show this help\n";
}

int main(int argc, char* argv[]) {
    std::string redis_host = "127.0.0.1";
    int redis_port = 6379;
    int tick_rate = 10;  // Process queue 10 times per second

    // Parse command line arguments
    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--redis-host") == 0 && i + 1 < argc) {
            redis_host = argv[++i];
        } else if (std::strcmp(argv[i], "--redis-port") == 0 && i + 1 < argc) {
            redis_port = std::stoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--tick-rate") == 0 && i + 1 < argc) {
            tick_rate = std::stoi(argv[++i]);
        } else if (std::strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        } else {
            std::cerr << "Unknown option: " << argv[i] << std::endl;
            print_usage(argv[0]);
            return 1;
        }
    }

    // Install signal handlers
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::cout << "=== Matcher Service ===" << std::endl;
    std::cout << "Redis: " << redis_host << ":" << redis_port << std::endl;
    std::cout << "Tick rate: " << tick_rate << " Hz" << std::endl;

    try {
        // Create matchmaker and room manager
        mini::Matchmaker matchmaker(redis_host, redis_port);
        mini::RoomManager room_manager(redis_host, redis_port);

        std::cout << "Connected to Redis successfully" << std::endl;
        std::cout << "Matcher service running (Ctrl+C to stop)" << std::endl;

        const auto tick_duration = std::chrono::milliseconds(1000 / tick_rate);
        std::size_t tick_count = 0;
        std::size_t total_matches = 0;

        while (g_running) {
            auto tick_start = std::chrono::steady_clock::now();

            // Process match queue
            auto assignments = matchmaker.process_queue();

            if (!assignments.empty()) {
                std::cout << "[Tick " << tick_count << "] Matched " << assignments.size()
                         << " pair(s):" << std::endl;

                for (const auto& assignment : assignments) {
                    std::cout << "  Room " << assignment.room_id << ": "
                             << assignment.player_id << " vs " << assignment.opponent_id
                             << " @ " << assignment.addr << std::endl;
                    total_matches++;
                }
            }

            // Print queue status every 10 seconds (100 ticks at 10 Hz)
            if (tick_count % 100 == 0) {
                auto queue_size = matchmaker.queue_size();
                std::cout << "[Tick " << tick_count << "] Queue size: " << queue_size
                         << ", Total matches: " << total_matches << std::endl;
            }

            tick_count++;

            // Sleep to maintain tick rate
            auto elapsed = std::chrono::steady_clock::now() - tick_start;
            if (elapsed < tick_duration) {
                std::this_thread::sleep_for(tick_duration - elapsed);
            }
        }

        std::cout << "\nMatcher service stopped" << std::endl;
        std::cout << "Total ticks: " << tick_count << std::endl;
        std::cout << "Total matches created: " << total_matches << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Fatal error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
