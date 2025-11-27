# mini-spring – Framework from Scratch

**Status**: ✅ Phase 1 Complete  
**Completion Date**: 2025-10-31

A lightweight web framework built from scratch to understand how Spring Boot, Django, and other frameworks work internally.

## Verification

```bash
# Clone and run
git clone https://github.com/your-username/mini-spring.git
cd mini-spring
./build.sh
./run_sample.sh

# Test
curl http://localhost:8080/api/users
```

## Demo

Sample walkthrough screenshots and recordings are available in `docs/evidence/m1.4/`.

## Evidence

All validation reports available in `docs/evidence/`.

## Next Phase

Ready for Phase 2: sagaline (production e-commerce platform)

## Contact

Email: your.email@example.com  
LinkedIn: https://www.linkedin.com/in/your-profile

## Features Implemented
- [x] HTTP/1.1 Server (raw sockets)
- [x] Routing with decorators
- [x] Middleware pipeline
- [x] Dependency injection container
- [x] Thread-safe connection pooling
- [x] Transaction isolation exploration (documentation)

## Architecture
```
HTTP Layer (Milestone 1.1)
    ↓
Framework Core (Milestone 1.2)
    ↓
Data Access (Milestone 1.3)
    ↓
Integrated Sample App (Milestone 1.4)
```

## Demo Commands
```bash
# Start server
./run_sample.sh

# Test API
curl http://localhost:8080/health
curl -H "Authorization: Bearer secrettoken" http://localhost:8080/api/users
```

## Key Learnings
- HTTP is a text-based protocol over TCP sockets.
- Frameworks abstract common patterns such as routing and middleware.
- Dependency injection manages object lifecycles and promotes modularity.
- Connection pooling prevents resource exhaustion under concurrent load.
- Isolation levels trade consistency for performance; documentation captures experiments.

## Comparison: mini-spring vs Spring Boot
| Feature | mini-spring | Spring Boot |
|---------|-------------|-------------|
| LOC | ~700 | ~100,000+ |
| Learning Curve | Low (you built it) | High (implicit behaviour) |
| Features | Focused essentials | Comprehensive ecosystem |
| Production-Ready | No | Yes |

## Portfolio Value
**Interview Topics**:
- "I implemented a web framework from scratch."
- "I can explain dependency injection internals."
- "I understand connection pooling and leak detection trade-offs."

**Skills Demonstrated**:
- Network programming (sockets, HTTP parsing)
- Concurrency (thread pools, synchronisation)
- Design patterns (middleware, dependency injection, object pooling)
- Resource management (graceful shutdown, leak detection)

## Next Steps
Phase 2: Use Spring Boot to build the production e-commerce platform (sagaline).

## Timeline
- Milestone 1.1 (HTTP Server): 1 week
- Milestone 1.2 (Framework): 2 weeks
- Milestone 1.3 (Connection Pool): 2 weeks
- Milestone 1.4 (Integration): 1 week

**Total**: 6 weeks
