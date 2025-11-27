"""Example application for milestone 1.2."""

from .controllers import register  # noqa: F401
from .database import Database, User  # noqa: F401
from .middleware import auth_required, logging_middleware  # noqa: F401

__all__ = [
    "register",
    "Database",
    "User",
    "auth_required",
    "logging_middleware",
]
