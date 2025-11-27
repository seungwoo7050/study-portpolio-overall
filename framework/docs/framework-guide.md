# mini-spring Framework Guide

## Overview
mini-spring is a lightweight web framework built from scratch to understand how production-ready platforms such as Spring Boot or Django orchestrate networking, dependency injection, and resource management.

## Architecture

### HTTP Server (Milestone 1.1)
The HTTP layer is a raw TCP server that binds to a configurable port, accepts connections via a 100-worker thread pool, parses HTTP/1.1 request lines and headers manually, and formats compliant responses. The server exposes a router that supports path parameters and basic error handling.

### Framework Core (Milestone 1.2)
On top of the socket server lives a mini-framework that offers declarative routing decorators, a simple dependency injection container, and a middleware pipeline. Requests are normalised into a high-level object that exposes helpers for headers, JSON bodies, and path parameters. Responses unify different handler return types into HTTP responses.

### Connection Pool (Milestone 1.3)
The data-access layer introduces a thread-safe connection pool with bounded resources, health checks, and leak detection. Connections are wrapped so that closing them returns the resource to the pool, enabling safe sharing across concurrent handlers.

## How Frameworks Work

### Problem: Boilerplate
Without framework:
```python
import socket

server = socket.socket()
server.bind(("0.0.0.0", 8080))
server.listen()
while True:
    client, _ = server.accept()
    data = client.recv(1024)
    # Parse HTTP manually for each endpoint
```

With framework:
```python
@app.route("/users/{id}")
def get_user(request, id):
    return {"id": id}
```

### Dependency Injection
**Problem**: Manual object wiring becomes tangled as applications grow.
**Solution**: A container stores factories or singletons and resolves them for handlers, enabling loose coupling and easier testing.

### Middleware
**Problem**: Cross-cutting concerns such as logging, authentication, or timing require repetitive code.
**Solution**: Middleware composes handlers into a pipeline where each concern wraps the next, centralising shared behaviour.

## Comparison: mini-spring vs Spring Boot

| Feature | Implementation Complexity | LOC |
|---------|--------------------------|-----|
| HTTP Server | Manual socket programming | ~200 |
| Routing | Decorator registration | ~150 |
| DI Container | Map-backed singleton factories | ~100 |
| Connection Pool | Thread-safe queue + leak detection | ~250 |
| **Total** | | **~700** |

Spring Boot: ~100,000+ LOC (framework + dependencies)

## Trade-offs

### Manual Implementation
**Pros**: Deep understanding, minimal dependencies, fine-grained control.
**Cons**: Time-consuming, more room for bugs, missing production-grade features.

### Framework
**Pros**: Rapid development, large ecosystems, batteries-included features.
**Cons**: Steeper learning curve, implicit behaviour, heavier footprint.

## Key Learnings
1. HTTP is a text-based protocol layered on top of TCP.
2. Dependency injection simplifies wiring and encourages modular design.
3. Middleware provides a clean abstraction for cross-cutting concerns.
4. Connection pooling preserves scarce resources and improves latency.
5. Understanding internals demystifies framework "magic" and aids debugging.
