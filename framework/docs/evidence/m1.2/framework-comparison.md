# Framework Comparison: mini-spring vs Spring Boot

## Feature Comparison

| Feature | mini-spring | Spring Boot |
|---------|-------------|-------------|
| Routing | Explicit decorator registration | Component scanning with annotations |
| DI Container | Map-based container with lazy factories | Bean factory with scopes and lifecycle management |
| Middleware | Ordered middleware chain | Servlet filters + interceptors + AOP |
| Request Handling | Manual JSON parsing helpers | Jackson auto-binding and validation |
| LOC | ~350 | ~10,000s |

## Complexity Analysis

### Routing
**mini-spring**: Routes are registered via `@app.route` which stores handlers and converts path parameters on demand. Simple tuple comparison keeps the implementation readable.
**Spring Boot**: Uses classpath scanning to detect annotations, builds handler mappings, and integrates with the Servlet API.

### Dependency Injection
**mini-spring**: A few dozen lines store singletons or factory functions behind a dictionary protected by a lock.
**Spring Boot**: Bean definitions support scopes, profiles, post-processors, conditional configuration, and lifecycle callbacks.

## Key Insights
- Frameworks hide a significant amount of plumbing to improve developer ergonomics.
- Even a tiny DI container eliminates repetitive wiring.
- Middleware pipelines encourage separation of concerns for logging, authentication, and metrics.
