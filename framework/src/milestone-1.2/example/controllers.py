"""Example controllers showcasing the milestone 1.2 framework."""
from __future__ import annotations

from typing import Any, Dict

try:  # pragma: no cover - fallback when executed as a script package
    from ..framework.app import App
    from ..framework.decorators import inject
    from ..framework.request import Request
    from ..framework.response import Response
except ImportError:  # pragma: no cover - script execution path
    from framework.app import App  # type: ignore
    from framework.decorators import inject  # type: ignore
    from framework.request import Request  # type: ignore
    from framework.response import Response  # type: ignore

from .middleware import auth_required
from .database import Database, User


def _serialise_user(user: User) -> Dict[str, Any]:
    return {"id": user.id, "name": user.name, "email": user.email}


def register(app: App) -> None:
    """Register example routes on ``app``."""

    @app.route("/health", methods=["GET"])
    def health(_request: Request) -> Response:
        return Response.ok({"status": "up"})

    @app.route("/users", methods=["GET"])
    @inject("database")
    def list_users(_request: Request, *, service: Database) -> Response:
        users = [_serialise_user(user) for user in service.list_users()]
        return Response.ok({"users": users, "count": len(users)})

    @app.route("/users/{user_id}", methods=["GET"])
    @inject("database")
    def get_user(_request: Request, user_id: str, *, service: Database) -> Response:
        user = service.get_user(user_id)
        if not user:
            return Response.error("user_not_found", status=404)
        return Response.ok(_serialise_user(user))

    @app.route("/users", methods=["POST"], middleware=[auth_required])
    @inject("database")
    def create_user(request: Request, *, service: Database) -> Response:
        payload = request.json({}) or {}
        name = payload.get("name")
        email = payload.get("email")
        if not name or not email:
            return Response.error("invalid_payload", status=400)
        user = service.create_user(name=name, email=email)
        return Response.created(_serialise_user(user))


__all__ = ["register"]
