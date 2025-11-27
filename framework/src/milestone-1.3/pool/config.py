"""Configuration objects for the milestone 1.3 connection pool."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol


class SupportsClose(Protocol):
    """Protocol representing the minimal interface of a connection."""

    def close(self) -> None:  # pragma: no cover - protocol definition
        """Close the underlying resource."""


class SupportsValidation(Protocol):
    """Protocol describing the optional ``is_valid`` hook."""

    def is_valid(self, timeout: float) -> bool:  # pragma: no cover - protocol definition
        """Return ``True`` when the connection is considered healthy."""


@dataclass(slots=True)
class PoolConfig:
    """Configuration for :class:`~milestone_1_3.pool.connection_pool.ConnectionPool`.

    Parameters
    ----------
    min_connections:
        Minimum number of connections to eagerly create when the pool starts.
    max_connections:
        Upper bound of concurrent connections managed by the pool.
    acquisition_timeout:
        Seconds to wait for a connection before raising ``PoolExhaustedError``.
    leak_detection_threshold:
        Seconds a connection may stay checked-out before a warning is emitted.
    connection_factory:
        Callable used to create new connections. The callable must return an
        object implementing :class:`SupportsClose`.
    """

    min_connections: int = 1
    max_connections: int = 10
    acquisition_timeout: float = 5.0
    leak_detection_threshold: float = 300.0
    connection_factory: Callable[[], SupportsClose] | None = None

    def __post_init__(self) -> None:
        if self.min_connections < 0:
            raise ValueError("min_connections must be >= 0")
        if self.max_connections <= 0:
            raise ValueError("max_connections must be > 0")
        if self.min_connections > self.max_connections:
            raise ValueError("min_connections cannot exceed max_connections")
        if self.acquisition_timeout <= 0:
            raise ValueError("acquisition_timeout must be positive")
        if self.connection_factory is None:
            raise ValueError("connection_factory must be provided")


__all__ = ["PoolConfig", "SupportsClose", "SupportsValidation"]
