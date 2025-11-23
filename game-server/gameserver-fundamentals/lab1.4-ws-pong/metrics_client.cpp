#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast/core/buffers_to_string.hpp>
#include <boost/beast/core/flat_buffer.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/json.hpp>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <exception>
#include <iostream>
#include <stdexcept>
#include <numeric>
#include <optional>
#include <string>
#include <vector>

namespace {
using Clock = std::chrono::steady_clock;

struct MetricsResult {
    std::vector<double> tick_intervals_ms;
    std::vector<double> input_latencies_ms;
    boost::json::object server_metrics;
};

boost::json::value parse_json(const std::string &payload) {
    boost::json::error_code ec;
    auto value = boost::json::parse(payload, ec);
    if (ec) {
        throw std::runtime_error("failed to parse JSON message: " + payload);
    }
    return value;
}

std::string make_hello_command(const std::string &player_id) {
    boost::json::object obj;
    obj["type"] = "hello";
    obj["player_id"] = player_id;
    obj["match_id"] = "default";
    obj["client_time_ms"] = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    return boost::json::serialize(obj);
}

std::string make_input_command(int direction, std::uint64_t seq) {
    boost::json::object obj;
    obj["type"] = "input";
    obj["match_id"] = "default";
    obj["seq"] = seq;
    obj["direction"] = direction;
    obj["client_time_ms"] = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    return boost::json::serialize(obj);
}

std::string make_metrics_request() {
    boost::json::object obj;
    obj["type"] = "metrics-request";
    obj["match_id"] = "default";
    return boost::json::serialize(obj);
}

double extract_double(const boost::json::object &obj, const char *key) {
    if (auto *value = obj.if_contains(key)) {
        if (value->is_double()) {
            return value->as_double();
        }
        if (value->is_int64()) {
            return static_cast<double>(value->as_int64());
        }
        if (value->is_uint64()) {
            return static_cast<double>(value->as_uint64());
        }
    }
    return 0.0;
}

std::uint64_t extract_uint(const boost::json::object &obj, const char *key) {
    if (auto *value = obj.if_contains(key)) {
        if (value->is_uint64()) {
            return static_cast<std::uint64_t>(value->as_uint64());
        }
        if (value->is_int64()) {
            return static_cast<std::uint64_t>(value->as_int64());
        }
    }
    return 0;
}

double percentile(std::vector<double> data, double fraction) {
    if (data.empty()) {
        return 0.0;
    }
    std::sort(data.begin(), data.end());
    const double position = fraction * static_cast<double>(data.size() - 1);
    const auto lower = static_cast<std::size_t>(std::floor(position));
    const auto upper = static_cast<std::size_t>(std::ceil(position));
    const double weight = position - static_cast<double>(lower);
    if (upper >= data.size()) {
        return data.back();
    }
    return data[lower] * (1.0 - weight) + data[upper] * weight;
}

void print_stats(const MetricsResult &result) {
    const auto &intervals = result.tick_intervals_ms;
    if (intervals.size() < 2) {
        std::cout << "Not enough tick samples collected" << std::endl;
    } else {
        const auto [min_it, max_it] = std::minmax_element(intervals.begin(), intervals.end());
        const double sum = std::accumulate(intervals.begin(), intervals.end(), 0.0);
        const double avg = sum / static_cast<double>(intervals.size());
        const double avg_tps = 1000.0 / avg;
        std::cout << "Tick samples: " << intervals.size() << "\n";
        std::cout << "Average interval: " << avg << " ms" << "\n";
        std::cout << "Average TPS: " << avg_tps << "\n";
        std::cout << "Min interval: " << *min_it << " ms" << "\n";
        std::cout << "Max interval: " << *max_it << " ms" << "\n";
        std::cout << "Tick interval percentiles (ms): p50=" << percentile(intervals, 0.5) << " p95="
                  << percentile(intervals, 0.95) << " p99=" << percentile(intervals, 0.99) << "\n";
    }

    const auto &latencies = result.input_latencies_ms;
    if (latencies.empty()) {
        std::cout << "No input latency samples collected" << std::endl;
    } else {
        const auto [min_it, max_it] = std::minmax_element(latencies.begin(), latencies.end());
        const double sum = std::accumulate(latencies.begin(), latencies.end(), 0.0);
        const double avg = sum / static_cast<double>(latencies.size());
        std::cout << "Input latency samples: " << latencies.size() << "\n";
        std::cout << "Average latency: " << avg << " ms" << "\n";
        std::cout << "Min latency: " << *min_it << " ms" << "\n";
        std::cout << "Max latency: " << *max_it << " ms" << "\n";
        std::cout << "Input latency percentiles (ms): p50=" << percentile(latencies, 0.5) << " p95="
                  << percentile(latencies, 0.95) << " p99=" << percentile(latencies, 0.99) << "\n";
    }

    if (!result.server_metrics.empty()) {
        std::cout << "Server-reported tick metrics:" << std::endl;
        if (auto *ticks = result.server_metrics.if_contains("ticks"); ticks && ticks->is_object()) {
            const auto &tick_obj = ticks->as_object();
            std::cout << "  Samples: " << extract_uint(tick_obj, "samples") << "\n";
            std::cout << "  Avg: " << extract_double(tick_obj, "avg_ms") << " ms" << "\n";
            std::cout << "  Min: " << extract_double(tick_obj, "min_ms") << " ms" << "\n";
            std::cout << "  Max: " << extract_double(tick_obj, "max_ms") << " ms" << "\n";
        }
        if (auto *lat = result.server_metrics.if_contains("input_latency"); lat && lat->is_object()) {
            const auto &lat_obj = lat->as_object();
            std::cout << "Server-reported input latency:" << std::endl;
            std::cout << "  Samples: " << extract_uint(lat_obj, "samples") << "\n";
            std::cout << "  Avg: " << extract_double(lat_obj, "avg_ms") << " ms" << "\n";
            std::cout << "  Min: " << extract_double(lat_obj, "min_ms") << " ms" << "\n";
            std::cout << "  Max: " << extract_double(lat_obj, "max_ms") << " ms" << "\n";
        }
    }
}

MetricsResult capture_metrics(const std::string &host, const std::string &port, std::size_t tick_samples,
    std::size_t latency_samples) {
    using websocket = boost::beast::websocket::stream<boost::asio::ip::tcp::socket>;

    boost::asio::io_context ioc;
    boost::asio::ip::tcp::resolver resolver{ioc};
    websocket ws{ioc};

    auto const results = resolver.resolve(host, port);
    boost::asio::connect(ws.next_layer(), results);
    const std::string host_header = host + ":" + port;
    ws.set_option(boost::beast::websocket::stream_base::timeout::suggested(boost::beast::role_type::client));
    ws.handshake(host_header, "/");
    ws.text(true);

    boost::beast::flat_buffer buffer;

    std::optional<Clock::time_point> last_state_time;
    std::uint64_t input_seq = 0;
    MetricsResult result;
    result.tick_intervals_ms.reserve(tick_samples);
    result.input_latencies_ms.reserve(latency_samples);

    std::string role = "spectator";
    bool awaiting_ack = false;
    std::size_t command_index = 0;
    const std::vector<int> command_cycle = {-1, 0, 1, 0};
    bool hello_sent = false;

    auto send_next_command = [&]() {
        if (!hello_sent) {
            return;
        }
        if (awaiting_ack || result.input_latencies_ms.size() >= latency_samples || role == "spectator") {
            return;
        }
        const int direction = command_cycle[command_index % command_cycle.size()];
        ++command_index;
        ws.write(boost::asio::buffer(make_input_command(direction, ++input_seq)));
        awaiting_ack = true;
    };

    // Send hello message first
    {
        std::string player_id = "metrics_client_" + std::to_string(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count());
        ws.write(boost::asio::buffer(make_hello_command(player_id)));
    }

    while (result.tick_intervals_ms.size() < tick_samples || result.input_latencies_ms.size() < latency_samples) {
        ws.read(buffer);
        const auto payload = boost::beast::buffers_to_string(buffer.data());
        buffer.consume(buffer.size());

        auto json = parse_json(payload);
        if (!json.is_object()) {
            continue;
        }
        auto &obj = json.as_object();
        auto *type_value = obj.if_contains("type");
        if (!type_value || !type_value->is_string()) {
            continue;
        }
        const std::string type = type_value->as_string().c_str();
        if (type == "welcome") {
            if (auto *role_value = obj.if_contains("role"); role_value && role_value->is_string()) {
                role = role_value->as_string().c_str();
                hello_sent = true;
            }
            if (role != "spectator") {
                if (hello_sent) {
                send_next_command();
                }
            }
        } else if (type == "roles") {
            if (auto *role_value = obj.if_contains("role"); role_value && role_value->is_string()) {
                role = role_value->as_string().c_str();
            }
        } else if (type == "state") {
            const auto now = Clock::now();
            if (last_state_time && result.tick_intervals_ms.size() < tick_samples) {
                const double interval_ms = std::chrono::duration<double, std::milli>(now - *last_state_time).count();
                result.tick_intervals_ms.push_back(interval_ms);
            }
            last_state_time = now;
        } else if (type == "input-ack") {
            awaiting_ack = false;
            if (result.input_latencies_ms.size() < latency_samples) {
                if (auto *latency = obj.if_contains("latency_ms"); latency && latency->is_double()) {
                    result.input_latencies_ms.push_back(latency->as_double());
                } else if (auto *latency_int = obj.if_contains("latency_ms"); latency_int && latency_int->is_int64()) {
                    result.input_latencies_ms.push_back(static_cast<double>(latency_int->as_int64()));
                }
            }
        }

        if (role != "spectator") {
            send_next_command();
        }
    }

    ws.write(boost::asio::buffer(make_metrics_request()));

    boost::json::object server_metrics;
    while (true) {
        ws.read(buffer);
        const auto payload = boost::beast::buffers_to_string(buffer.data());
        buffer.consume(buffer.size());
        auto json = parse_json(payload);
        if (!json.is_object()) {
            continue;
        }
        auto &obj = json.as_object();
        auto *type_value = obj.if_contains("type");
        if (!type_value || !type_value->is_string()) {
            continue;
        }
        if (type_value->as_string() == "metrics") {
            // Protocol changed: metrics fields are at top level, not in "data"
            server_metrics["ticks"] = obj["ticks"];
            server_metrics["input_latency"] = obj["input_latency"];
            break;
        }
    }

    ws.close(boost::beast::websocket::close_code::normal);
    result.server_metrics = std::move(server_metrics);
    return result;
}
} // namespace

int main(int argc, char **argv) {
    try {
        std::string host = "127.0.0.1";
        std::string port = "8081";
        std::size_t tick_samples = 600;
        std::size_t latency_samples = 20;

        if (argc > 1) {
            host = argv[1];
        }
        if (argc > 2) {
            port = argv[2];
        }
        if (argc > 3) {
            tick_samples = static_cast<std::size_t>(std::stoul(argv[3]));
        }
        if (argc > 4) {
            latency_samples = static_cast<std::size_t>(std::stoul(argv[4]));
        }

        auto result = capture_metrics(host, port, tick_samples, latency_samples);
        print_stats(result);
        return 0;
    } catch (const std::exception &ex) {
        std::cerr << "Error: " << ex.what() << std::endl;
        return 1;
    }
}
