"""HTTP server implementation for milestone 1.1."""
from __future__ import annotations

import logging
import socket
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Dict, Optional

from .http_parser import HttpRequest
from .router import RouteNotFound, Router

LOGGER = logging.getLogger(__name__)

_STATUS_REASONS: Dict[int, str] = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
}


@dataclass
class HttpResponse:
    """Representation of an HTTP response."""

    status_code: int
    body: str = ""
    headers: Dict[str, str] = field(default_factory=dict)

    def to_bytes(self) -> bytes:
        reason = _STATUS_REASONS.get(self.status_code, "Unknown")
        body_bytes = self.body.encode("utf-8")
        headers = {
            "Content-Length": str(len(body_bytes)),
            "Content-Type": self.headers.get("Content-Type", "application/json" if self.body else "text/plain"),
            **{k: v for k, v in self.headers.items() if k.lower() != "content-length"},
        }
        header_lines = "\r\n".join(f"{name}: {value}" for name, value in headers.items())
        response = f"HTTP/1.1 {self.status_code} {reason}\r\n{header_lines}\r\n\r\n".encode("utf-8")
        return response + body_bytes

    @classmethod
    def json(cls, status_code: int, payload: str) -> "HttpResponse":
        return cls(status_code=status_code, body=payload, headers={"Content-Type": "application/json"})

    @classmethod
    def ok(cls, payload: str = "") -> "HttpResponse":
        return cls.json(200, payload)

    @classmethod
    def not_found(cls, message: str = "") -> "HttpResponse":
        return cls(status_code=404, body=message, headers={"Content-Type": "application/json"})

    @classmethod
    def server_error(cls, message: str = "") -> "HttpResponse":
        return cls(status_code=500, body=message or "{\"error\":\"internal\"}", headers={"Content-Type": "application/json"})


class HttpServer:
    """Minimal HTTP/1.1 server with a fixed thread pool."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8080, router: Optional[Router] = None, max_workers: int = 100) -> None:
        self.host = host
        self.port = port
        self.router = router or Router()
        self.max_workers = max_workers
        self._executor: Optional[ThreadPoolExecutor] = None
        self._is_running = False

    def start(self) -> None:
        self._is_running = True
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
            server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_socket.bind((self.host, self.port))
            server_socket.listen()
            server_socket.settimeout(1.0)
            LOGGER.info("HTTP server listening on %s:%s", self.host, self.port)
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                self._executor = executor
                while self._is_running:
                    try:
                        client_socket, address = server_socket.accept()
                    except socket.timeout:
                        continue
                    except OSError:
                        break
                    executor.submit(self._handle_connection, client_socket, address)

    def stop(self) -> None:
        self._is_running = False
        if self._executor:
            self._executor.shutdown(wait=True)

    def _handle_connection(self, client_socket: socket.socket, address) -> None:
        with client_socket:
            try:
                request = HttpRequest.from_socket(client_socket)
                if request is None:
                    return
                try:
                    handler, params = self.router.resolve(request.method, request.path)
                    request.path_params = params
                    response = handler(request)
                    if not isinstance(response, HttpResponse):
                        raise TypeError("Handler must return HttpResponse")
                except RouteNotFound:
                    response = HttpResponse.not_found('{"error":"not_found"}')
                except Exception as exc:  # noqa: BLE001 - educational project, log and return 500
                    LOGGER.exception("Error handling request from %s: %s", address, exc)
                    response = HttpResponse.server_error()
                client_socket.sendall(response.to_bytes())
            except ValueError as exc:
                LOGGER.warning("Bad request from %s: %s", address, exc)
                client_socket.sendall(HttpResponse(status_code=400, body='{"error":"bad_request"}').to_bytes())
            except Exception as exc:  # noqa: BLE001
                LOGGER.exception("Unexpected error handling connection from %s: %s", address, exc)


__all__ = ["HttpServer", "HttpResponse"]
