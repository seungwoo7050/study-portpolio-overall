"""Mini-framework application core for milestone 1.2."""
from __future__ import annotations

import logging
import socket
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from .container import DependencyContainer
from .decorators import Middleware
from .request import RawHttpRequest, Request
from .response import Response

LOGGER = logging.getLogger(__name__)


@dataclass
class Route:
    """Representation of a registered route."""

    path: str
    methods: Tuple[str, ...]
    handler: Callable[..., Any]
    middleware: Sequence[Middleware] = field(default_factory=tuple)
    segments: Tuple[str, ...] = field(init=False)

    def __post_init__(self) -> None:
        cleaned = self.path.strip("/")
        if not cleaned:
            self.segments = ("",)
        else:
            self.segments = tuple(segment for segment in cleaned.split("/") if segment)

    def matches(self, method: str, path: str) -> Optional[Dict[str, str]]:
        if method not in self.methods:
            return None
        target_segments = tuple(segment for segment in path.strip("/").split("/") if segment)
        if self.segments == ("",) and target_segments:
            return None
        if self.segments != ("",) and len(target_segments) != len(self.segments):
            return None
        params: Dict[str, str] = {}
        for pattern, value in zip(self.segments, target_segments):
            if pattern.startswith("{") and pattern.endswith("}"):
                params[pattern[1:-1]] = value
            elif pattern != value:
                return None
        return params


class App:
    """Core application class orchestrating routing, middleware and DI."""

    def __init__(self, *, host: str = "0.0.0.0", port: int = 8080, max_workers: int = 100) -> None:
        self.host = host
        self.port = port
        self.max_workers = max_workers
        self.container = DependencyContainer()
        self._routes: List[Route] = []
        self._global_middleware: List[Middleware] = []
        self._executor: Optional[ThreadPoolExecutor] = None
        self._is_running = False

    # ------------------------------------------------------------------
    # Dependency injection helpers
    # ------------------------------------------------------------------
    def register_instance(self, name: str, instance: Any) -> None:
        self.container.register_instance(name, instance)

    def register_factory(self, name: str, factory: Callable[[DependencyContainer], Any], *, singleton: bool = True) -> None:
        self.container.register_factory(name, factory, singleton=singleton)

    def resolve(self, name: str) -> Any:
        return self.container.resolve(name)

    # ------------------------------------------------------------------
    # Routing and middleware configuration
    # ------------------------------------------------------------------
    def route(
        self,
        path: str,
        *,
        methods: Optional[Iterable[str]] = None,
        middleware: Optional[Sequence[Middleware]] = None,
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator used to register request handlers."""

        methods_tuple = tuple(method.upper() for method in (methods or ("GET",)))
        middleware_seq = tuple(middleware or ())

        def decorator(function: Callable[..., Any]) -> Callable[..., Any]:
            route = Route(path=path, methods=methods_tuple, handler=function, middleware=middleware_seq)
            self._routes.append(route)
            LOGGER.debug("Registered route %s %s", methods_tuple, path)
            return function

        return decorator

    def use(self, middleware: Middleware) -> None:
        """Register global middleware executed for every request."""

        self._global_middleware.append(middleware)

    # ------------------------------------------------------------------
    # Server lifecycle
    # ------------------------------------------------------------------
    def listen(self, port: Optional[int] = None) -> None:
        if port is not None:
            self.port = port
        self._is_running = True
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server_socket:
            server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_socket.bind((self.host, self.port))
            server_socket.listen()
            server_socket.settimeout(1.0)
            LOGGER.info("mini-spring listening on %s:%s", self.host, self.port)
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

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _handle_connection(self, client_socket: socket.socket, address: Tuple[str, int]) -> None:
        with client_socket:
            try:
                raw_request = self._parse_request(client_socket)
            except ValueError as exc:
                LOGGER.warning("Malformed request from %s: %s", address, exc)
                self._send_response(client_socket, Response.error("bad_request", status=400))
                return
            if raw_request is None:
                return
            route, params = self._match_route(raw_request.method, raw_request.path)
            if route is None:
                self._send_response(client_socket, Response.error("not_found", status=404))
                return
            raw_request.path_params = params
            request = Request(raw=raw_request, app=self)
            try:
                response = self._execute_route(route, request)
            except Exception:  # noqa: BLE001 - educational project, log and return 500
                LOGGER.exception("Unhandled error while processing %s %s", raw_request.method, raw_request.path)
                response = Response.error("internal_server_error", status=500)
            self._send_response(client_socket, response)

    def _parse_request(self, conn: socket.socket) -> Optional[RawHttpRequest]:
        buffer = conn.makefile("rb")
        try:
            request_line = buffer.readline().decode("iso-8859-1").strip()
            if not request_line:
                return None
            parts = request_line.split()
            if len(parts) != 3:
                raise ValueError(f"Malformed request line: {request_line!r}")
            method, target, version = parts
            path = target.split("?")[0]
            headers: Dict[str, str] = {}
            while True:
                raw_line = buffer.readline().decode("iso-8859-1")
                if raw_line in ("\r\n", "\n", ""):
                    break
                if ":" not in raw_line:
                    raise ValueError(f"Malformed header line: {raw_line!r}")
                name, value = raw_line.split(":", 1)
                headers[name.strip().lower()] = value.strip()
            body = ""
            content_length = headers.get("content-length")
            if content_length:
                length = int(content_length)
                body_bytes = buffer.read(length)
                body = body_bytes.decode("utf-8", errors="replace")
            return RawHttpRequest(method=method.upper(), path=path, version=version, headers=headers, body=body)
        finally:
            buffer.close()

    def _match_route(self, method: str, path: str) -> Tuple[Optional[Route], Dict[str, str]]:
        for route in self._routes:
            params = route.matches(method, path)
            if params is not None:
                return route, params
        return None, {}

    def _execute_route(self, route: Route, request: Request) -> Response:
        pipeline = self._build_pipeline(route)
        result = pipeline(request)
        return Response.from_result(result)

    def _build_pipeline(self, route: Route) -> Callable[[Request], Any]:
        def call_handler(req: Request) -> Any:
            kwargs = dict(req.path_params)
            return route.handler(req, **kwargs)

        pipeline = call_handler
        for middleware in reversed([*self._global_middleware, *route.middleware]):
            next_fn = pipeline

            def make_step(mw: Middleware, nxt: Callable[[Request], Any]) -> Callable[[Request], Any]:
                def step(req: Request) -> Any:
                    return mw(req, nxt)

                return step

            pipeline = make_step(middleware, next_fn)
        return pipeline

    def _send_response(self, conn: socket.socket, response: Response) -> None:
        status, headers, payload = response.to_http_response()
        reason = _HTTP_STATUS_MESSAGES.get(status, "OK")
        header_lines = "\r\n".join(f"{name}: {value}" for name, value in headers.items())
        http_response = f"HTTP/1.1 {status} {reason}\r\n{header_lines}\r\n\r\n".encode("utf-8") + payload
        with suppress(BrokenPipeError):
            conn.sendall(http_response)


_HTTP_STATUS_MESSAGES = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
}


__all__ = ["App", "Route"]
