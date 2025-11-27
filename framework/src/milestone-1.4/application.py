"""Factory functions that compose the final mini-spring application."""
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

from framework.app import App
from pool.config import PoolConfig
from pool.connection_pool import ConnectionPool

if __package__ in (None, ""):
    from controllers import register  # type: ignore
    from database import InMemoryDatabase  # type: ignore
    from middleware import logging_middleware  # type: ignore
else:
    from .controllers import register
    from .database import InMemoryDatabase
    from .middleware import logging_middleware

LOGGER = logging.getLogger(__name__)


def create_connection_pool(database: InMemoryDatabase) -> ConnectionPool:
    """Create a connection pool configured for the in-memory database."""

    config = PoolConfig(
        min_connections=2,
        max_connections=8,
        acquisition_timeout=2.0,
        leak_detection_threshold=30.0,
        connection_factory=database.create_connection,
    )
    pool = ConnectionPool(config)
    LOGGER.info(
        "Initialised connection pool (min=%s, max=%s)",
        config.min_connections,
        config.max_connections,
    )
    return pool


def create_app(*, host: str = "0.0.0.0", port: int = 8080) -> App:
    """Compose the HTTP server, framework, and connection pool."""

    app = App(host=host, port=port)
    database = InMemoryDatabase()
    pool = create_connection_pool(database)

    app.register_instance("database", database)
    app.register_instance("connection_pool", pool)
    app.use(logging_middleware)

    register(app)
    return app


def graceful_shutdown(app: App) -> Callable[[int, object], None]:
    """Return a signal handler that stops the application cleanly."""

    def _handler(_signum: int, _frame: object) -> None:
        LOGGER.info("Received shutdown signal")
        app.stop()

    return _handler


__all__ = ["create_app", "create_connection_pool", "graceful_shutdown"]
