"""Middleware used by the integrated mini-spring application."""
from __future__ import annotations

import logging
from typing import Callable

from pathlib import Path

if __package__ in (None, ""):
    import sys

    PACKAGE_ROOT = Path(__file__).resolve().parent
    SRC_ROOT = PACKAGE_ROOT.parent
    for candidate in (PACKAGE_ROOT, SRC_ROOT / "milestone-1.2", SRC_ROOT / "milestone-1.3"):
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.append(candidate_str)
    import _compat  # type: ignore  # noqa: F401
else:
    from . import _compat  # noqa: F401

from framework.request import Request
from framework.response import Response

LOGGER = logging.getLogger(__name__)

MiddlewareFn = Callable[[Request, Callable[[Request], Response]], Response]


def logging_middleware(request: Request, next_handler: Callable[[Request], Response]) -> Response:
    """Log the incoming request and the resulting status code."""

    LOGGER.info("%s %s", request.method, request.path)
    response = next_handler(request)
    LOGGER.info("%s %s -> %s", request.method, request.path, response.status)
    return response


def auth_required(request: Request, next_handler: Callable[[Request], Response]) -> Response:
    """Require a static bearer token for demonstration purposes."""

    header = request.get_header("authorization") or ""
    if not header.startswith("Bearer "):
        return Response.error("unauthorised", status=401)
    token = header.split(" ", 1)[1]
    if token != "secrettoken":
        return Response.error("forbidden", status=403)
    return next_handler(request)


__all__ = ["logging_middleware", "auth_required"]
