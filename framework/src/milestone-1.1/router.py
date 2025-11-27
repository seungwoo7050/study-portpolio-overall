"""Simple routing utilities for milestone 1.1."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable, Dict, List, Tuple

from .http_parser import HttpRequest

if TYPE_CHECKING:  # pragma: no cover - only used for type checkers
    from .http_server import HttpResponse

Handler = Callable[[HttpRequest], "HttpResponse"]


@dataclass
class Route:
    method: str
    pattern: str
    segments: List[str]
    handler: Handler


class RouteNotFound(Exception):
    """Raised when no route matches a request."""


class Router:
    """Minimal HTTP router supporting path parameters.

    Parameters are defined using the ``:name`` syntax, e.g. ``/users/:id``.  The
    router stores all routes in memory because we only need a handful for this
    educational project.
    """

    def __init__(self) -> None:
        self._routes: List[Route] = []

    def add_route(self, method: str, pattern: str, handler: Handler) -> None:
        segments = [segment for segment in pattern.strip("/").split("/") if segment]
        route = Route(method=method.upper(), pattern=pattern, segments=segments, handler=handler)
        self._routes.append(route)

    def resolve(self, method: str, path: str) -> Tuple[Handler, Dict[str, str]]:
        search_segments = [segment for segment in path.strip("/").split("/") if segment]
        for route in self._routes:
            if route.method != method.upper():
                continue
            params: Dict[str, str] = {}
            if self._match_segments(route.segments, search_segments, params):
                return route.handler, params
        raise RouteNotFound(f"No route for {method} {path}")

    @staticmethod
    def _match_segments(route_segments: List[str], request_segments: List[str], params: Dict[str, str]) -> bool:
        if len(route_segments) != len(request_segments):
            return False
        for pattern, value in zip(route_segments, request_segments):
            if pattern.startswith(":"):
                params[pattern[1:]] = value
            elif pattern != value:
                return False
        return True
