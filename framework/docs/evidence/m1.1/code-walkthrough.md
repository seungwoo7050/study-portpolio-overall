# Milestone 1.1 Code Walkthrough

## `http_parser.py`
- Implements `HttpRequest` dataclass.
- Reads raw bytes from the socket using a buffered file object.
- Parses request line, headers, and optional body (respecting `Content-Length`).
- Exposes helper methods `get_header` and `get_path_param` used by handlers.

## `router.py`
- Provides an in-memory router with support for dynamic segments using `:name` syntax.
- `Router.add_route` registers handlers for method/path combinations.
- `Router.resolve` matches incoming requests and extracts path parameters.

## `http_server.py`
- Defines `HttpResponse` with helpers for JSON responses and serialization.
- `HttpServer.start` creates a TCP socket, listens on configurable port, and dispatches connections to a 100-worker thread pool.
- `_handle_connection` parses requests, runs the matching handler, and writes serialized responses back to the client.
- Handles malformed requests and internal errors gracefully with appropriate status codes.

## `main.py`
- Configures logging and builds the router with health, user lookup, and user creation endpoints.
- Instantiates the `HttpServer` and installs signal handlers for graceful shutdown.
- Allows custom port via command-line argument (default 8080).

## Key Design Choices
- UTF-8 decoding with replacement to tolerate imperfect clients while keeping server responsive.
- Lowercase header storage to simplify lookups.
- Simple thread pool ensures we can handle 100+ concurrent clients without spawning unbounded threads.
