"""Middleware used by the milestone 1.2 example application."""
from __future__ import annotations

import logging
from typing import Any

try:  # pragma: no cover - allow running as script
    from ..framework.decorators import middleware
    from ..framework.request import Request
    from ..framework.response import Response
except ImportError:  # pragma: no cover - script execution path
    from framework.decorators import middleware  # type: ignore
    from framework.request import Request  # type: ignore
    from framework.response import Response  # type: ignore

LOGGER = logging.getLogger(__name__)


@middleware
def logging_middleware(request: Request, next_handler) -> Any:
    """Log incoming requests and resulting status codes."""

    LOGGER.info("Incoming %s %s", request.method, request.path)
    response = next_handler(request)
    if isinstance(response, Response):
        LOGGER.info("Response %s", response.status)
    return response


@middleware
def auth_required(request: Request, next_handler) -> Any:
    """Ensure the Authorization header is present before continuing."""

    if not request.get_header("authorization"):
        return Response.error("unauthorized", status=401)
    return next_handler(request)


__all__ = ["auth_required", "logging_middleware"]
