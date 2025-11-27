"""Thread-safe connection pool for milestone 1.3."""
from __future__ import annotations

import logging
import queue
import threading
import time
from typing import Set

from .config import PoolConfig, SupportsClose
from .leak_detector import LeakDetector
from .pooled_connection import PooledConnection

LOGGER = logging.getLogger(__name__)


class PoolExhaustedError(RuntimeError):
    """Raised when the connection pool cannot serve a request in time."""


class ConnectionPool:
    """Manage a bounded set of reusable connections with health checks."""

    def __init__(self, config: PoolConfig) -> None:
        self._config = config
        self._available: "queue.Queue[SupportsClose]" = queue.Queue()
        self._in_use: Set[SupportsClose] = set()
        self._lock = threading.Lock()
        self._total_connections = 0
        self._leak_detector = LeakDetector(config.leak_detection_threshold)

        for _ in range(config.min_connections):
            self._available.put(self._create_connection())

    def _create_connection(self) -> SupportsClose:
        connection = self._config.connection_factory()
        self._total_connections += 1
        LOGGER.debug("Created new connection %s (total=%s)", connection, self._total_connections)
        return connection

    def _dispose_connection(self, connection: SupportsClose) -> None:
        try:
            connection.close()
        finally:
            self._total_connections -= 1
            LOGGER.debug("Disposed connection %s (total=%s)", connection, self._total_connections)

    def acquire(self) -> PooledConnection:
        """Acquire a connection, waiting up to ``acquisition_timeout`` seconds."""

        deadline = time.monotonic() + self._config.acquisition_timeout
        while True:
            try:
                connection = self._available.get_nowait()
                LOGGER.debug("Reusing connection %s from pool", connection)
            except queue.Empty:
                with self._lock:
                    if self._total_connections < self._config.max_connections:
                        connection = self._create_connection()
                    else:
                        connection = None
                if connection is None:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise PoolExhaustedError("Connection pool exhausted")
                    try:
                        connection = self._available.get(timeout=remaining)
                    except queue.Empty as exc:  # pragma: no cover - defensive
                        raise PoolExhaustedError("Connection pool exhausted") from exc
            if not self._is_healthy(connection):
                LOGGER.warning("Discarding unhealthy connection %s", connection)
                self._dispose_connection(connection)
                continue
            with self._lock:
                self._in_use.add(connection)
            self._leak_detector.record_acquisition(connection)
            return PooledConnection(connection, self)

    def release(self, connection: SupportsClose) -> None:
        """Return a connection to the pool or dispose it if unhealthy."""

        with self._lock:
            if connection not in self._in_use:
                LOGGER.debug("Ignoring release of unknown connection %s", connection)
                return
            self._in_use.remove(connection)
        self._leak_detector.record_release(connection)
        if self._is_healthy(connection):
            self._available.put(connection)
        else:
            LOGGER.warning("Closing unhealthy connection on release %s", connection)
            self._dispose_connection(connection)

    def _is_healthy(self, connection: SupportsClose) -> bool:
        if hasattr(connection, "is_valid"):
            validator = getattr(connection, "is_valid")
            try:
                return bool(validator(1.0))
            except Exception:  # noqa: BLE001 - health checks should not crash the pool
                LOGGER.exception("Health check failed for %s", connection)
                return False
        return True

    def total_connections(self) -> int:
        return self._total_connections

    def in_use(self) -> int:
        with self._lock:
            return len(self._in_use)

    def available(self) -> int:
        return self._available.qsize()

    def leak_detector(self) -> LeakDetector:
        return self._leak_detector


__all__ = ["ConnectionPool", "PoolExhaustedError"]
