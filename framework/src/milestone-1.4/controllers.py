"""Route registrations for the integrated application."""
from __future__ import annotations

import logging
from typing import Dict

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
    from framework.app import App
    from framework.request import Request
    from framework.response import Response
    from pool.connection_pool import ConnectionPool
    from database import User  # type: ignore
    from middleware import auth_required  # type: ignore
else:
    from . import _compat  # noqa: F401
    from framework.app import App
    from framework.request import Request
    from framework.response import Response
    from pool.connection_pool import ConnectionPool
    from .database import User
    from .middleware import auth_required

LOGGER = logging.getLogger(__name__)


def _serialise_user(user: User) -> Dict[str, str]:
    return user.to_dict()


def register(app: App) -> None:
    """Register API routes on the provided ``app`` instance."""

    @app.route("/health", methods=["GET"])
    def health(_request: Request) -> Response:
        return Response.ok({"status": "up"})

    @app.route("/api/users", methods=["GET"])
    def list_users(request: Request) -> Response:
        pool: ConnectionPool = request.app.resolve("connection_pool")
        with pool.acquire() as connection:
            users = [_serialise_user(user) for user in connection.list_users()]
        return Response.ok({"users": users, "count": len(users)})

    @app.route("/api/users/{user_id}", methods=["GET"], middleware=[auth_required])
    def get_user(request: Request, user_id: str) -> Response:
        pool: ConnectionPool = request.app.resolve("connection_pool")
        with pool.acquire() as connection:
            user = connection.get_user(user_id)
        if not user:
            return Response.error("user_not_found", status=404)
        return Response.ok(_serialise_user(user))

    @app.route("/api/users", methods=["POST"], middleware=[auth_required])
    def create_user(request: Request) -> Response:
        pool: ConnectionPool = request.app.resolve("connection_pool")
        payload = request.json({}) or {}
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        if not name or not email:
            return Response.error("invalid_payload", status=400)
        with pool.acquire() as connection:
            user = connection.create_user(name=name, email=email)
        LOGGER.info("Created user %s", user.id)
        return Response.created(_serialise_user(user))


__all__ = ["register"]
