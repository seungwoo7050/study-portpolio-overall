"""Entry point for milestone 1.1 HTTP server."""
from __future__ import annotations

import json
import logging
import signal
import sys
from threading import Event

from .http_server import HttpResponse, HttpServer
from .http_parser import HttpRequest
from .router import Router

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")


def create_router() -> Router:
    router = Router()

    def health_handler(_request: HttpRequest) -> HttpResponse:
        return HttpResponse.ok('{"status":"up"}')

    def get_user_handler(request: HttpRequest) -> HttpResponse:
        user_id = request.get_path_param("id", "unknown")
        return HttpResponse.ok(json.dumps({"id": user_id}))

    def create_user_handler(request: HttpRequest) -> HttpResponse:
        body = request.body or "{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return HttpResponse(status_code=400, body='{"error":"invalid_json"}', headers={"Content-Type": "application/json"})
        response_payload = json.dumps({"received": payload})
        return HttpResponse.ok(response_payload)

    router.add_route("GET", "/health", health_handler)
    router.add_route("GET", "/api/users/:id", get_user_handler)
    router.add_route("POST", "/api/users", create_user_handler)

    return router


def main(port: int = 8080) -> None:
    router = create_router()
    server = HttpServer(port=port, router=router)
    shutdown_event = Event()

    def handle_signal(_signum, _frame):
        shutdown_event.set()
        server.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        server.start()
    except KeyboardInterrupt:
        pass
    finally:
        shutdown_event.set()


if __name__ == "__main__":
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Port must be an integer", file=sys.stderr)
            sys.exit(1)
    main(port)
