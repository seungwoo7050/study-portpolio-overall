"""Wrapper returning connections to the pool when closed."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any


class PooledConnection:
    """Proxy connection that returns the resource to the pool on ``close``."""

    def __init__(self, raw: Any, pool: "ConnectionPool") -> None:
        self._raw = raw
        self._pool = pool
        self._closed = False

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            self._pool.release(self._raw)

    def __getattr__(self, item: str) -> Any:
        return getattr(self._raw, item)

    def __enter__(self) -> "PooledConnection":
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        self.close()

    def __repr__(self) -> str:
        return f"PooledConnection({self._raw!r})"


if TYPE_CHECKING:  # pragma: no cover - only for type checking
    from .connection_pool import ConnectionPool

__all__ = ["PooledConnection"]
