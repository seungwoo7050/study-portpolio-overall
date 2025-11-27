"""In-memory data store used by the milestone 1.2 example application."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class User:
    """Simple user model."""

    id: str
    name: str
    email: str


@dataclass
class Database:
    """Very small in-memory database used for the example routes."""

    _users: Dict[str, User] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self._users:
            self.create_user(name="Alice", email="alice@example.com")

    def list_users(self) -> List[User]:
        return list(self._users.values())

    def get_user(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)

    def create_user(self, name: str, email: str) -> User:
        user_id = str(len(self._users) + 1)
        user = User(id=user_id, name=name, email=email)
        self._users[user_id] = user
        return user


__all__ = ["Database", "User"]
