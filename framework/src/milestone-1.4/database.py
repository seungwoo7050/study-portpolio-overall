"""In-memory database utilities for the integrated sample application."""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Dict, List, Optional

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

@dataclass(slots=True)
class User:
    """Simple representation of a user record."""

    id: str
    name: str
    email: str

    def to_dict(self) -> Dict[str, str]:
        return {"id": self.id, "name": self.name, "email": self.email}


class InMemoryDatabase:
    """Thread-safe in-memory store backing the connection pool."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._users: Dict[str, User] = {}
        self._sequence = 1

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------
    def create_connection(self) -> "DatabaseConnection":
        return DatabaseConnection(self)

    # ------------------------------------------------------------------
    # Internal helpers (protected by ``self._lock``)
    # ------------------------------------------------------------------
    def _list_users(self) -> List[User]:
        with self._lock:
            return list(self._users.values())

    def _get_user(self, user_id: str) -> Optional[User]:
        with self._lock:
            return self._users.get(user_id)

    def _create_user(self, name: str, email: str) -> User:
        with self._lock:
            identifier = str(self._sequence)
            self._sequence += 1
            user = User(id=identifier, name=name, email=email)
            self._users[identifier] = user
            return user


class DatabaseConnection:
    """Lightweight connection object used by the connection pool."""

    def __init__(self, database: InMemoryDatabase) -> None:
        self._database = database
        self._closed = False

    def close(self) -> None:
        self._closed = True

    # Optional health-check hook consumed by ``ConnectionPool``.
    def is_valid(self, _timeout: float) -> bool:
        return not self._closed

    # ------------------------------------------------------------------
    # User operations
    # ------------------------------------------------------------------
    def list_users(self) -> List[User]:
        return self._database._list_users()

    def get_user(self, user_id: str) -> Optional[User]:
        return self._database._get_user(user_id)

    def create_user(self, name: str, email: str) -> User:
        return self._database._create_user(name=name, email=email)

    def __repr__(self) -> str:  # pragma: no cover - for debug logs
        return f"DatabaseConnection(closed={self._closed})"


__all__ = ["User", "InMemoryDatabase", "DatabaseConnection"]
