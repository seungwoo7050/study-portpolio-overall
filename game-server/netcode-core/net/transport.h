#pragma once

#include <boost/asio/ip/udp.hpp>

#include <cstdint>
#include <functional>
#include <vector>

namespace net {

class ITransport {
public:
    using Endpoint = boost::asio::ip::udp::endpoint;
    using ReceiveHandler = std::function<void(const Endpoint &, std::vector<std::uint8_t> &&)>;

    virtual ~ITransport() = default;

    virtual void start(ReceiveHandler handler) = 0;
    virtual void stop() = 0;
    virtual void send(const Endpoint &endpoint, std::vector<std::uint8_t> data, bool reliable) = 0;
    virtual void update() = 0;

    struct Counters {
        std::uint64_t reliable_retries_total{0};
        std::uint64_t reliable_timeouts_total{0};
        std::uint64_t dropped_duplicates_total{0};
        std::uint64_t dropped_old_total{0};
        std::uint64_t dropped_window_total{0};
    };

    virtual void set_metrics_enabled(bool /*enabled*/) {}
    virtual Counters sample_counters() const { return {}; }
};

} // namespace net
