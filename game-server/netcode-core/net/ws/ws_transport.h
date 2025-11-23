#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace net::ws {

class IWebSocketSession {
public:
    virtual ~IWebSocketSession() = default;
    virtual void send(const std::string &message) = 0;
    virtual void close() = 0;
};

class IWebSocketServer {
public:
    using SessionPtr = std::shared_ptr<IWebSocketSession>;
    using ConnectHandler = std::function<void(const SessionPtr &)>;

    virtual ~IWebSocketServer() = default;
    virtual void start() = 0;
    virtual void stop() = 0;
    virtual void broadcast(const std::string &message) = 0;
    virtual void for_each_session(const std::function<void(const SessionPtr &)> &fn) = 0;
};

} // namespace net::ws
