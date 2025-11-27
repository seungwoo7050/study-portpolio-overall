"""Simple dependency injection container for milestone 1.2."""
from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Any, Callable, Dict, Optional

Factory = Callable[["DependencyContainer"], Any]


@dataclass
class _Registration:
    """Internal registration record."""

    value: Any
    factory: Optional[Factory] = None
    singleton: bool = True


class DependencyContainer:
    """Very small dependency injection container.

    The container supports registering either ready-made instances or factory
    callables.  Factories are executed lazily the first time ``resolve`` is
    called and the resulting instance is cached when ``singleton=True``.  This
    behaviour mimics the default of popular frameworks while keeping the
    implementation understandable for the milestone.
    """

    def __init__(self) -> None:
        self._registrations: Dict[str, _Registration] = {}
        self._lock = RLock()

    def register_instance(self, name: str, instance: Any) -> None:
        """Register a concrete instance under ``name``."""

        with self._lock:
            self._registrations[name] = _Registration(value=instance, singleton=True)

    def register_factory(self, name: str, factory: Factory, *, singleton: bool = True) -> None:
        """Register a factory that lazily produces the dependency."""

        with self._lock:
            self._registrations[name] = _Registration(value=None, factory=factory, singleton=singleton)

    def resolve(self, name: str) -> Any:
        """Return the dependency registered under ``name``.

        Raises
        ------
        KeyError
            If no dependency has been registered for ``name``.
        """

        with self._lock:
            if name not in self._registrations:
                raise KeyError(f"Dependency '{name}' is not registered")
            registration = self._registrations[name]
            if registration.factory is None:
                return registration.value
            if registration.singleton and registration.value is not None:
                return registration.value
            instance = registration.factory(self)
            if registration.singleton:
                registration.value = instance
            return instance

    def clear(self) -> None:
        """Remove all registrations (useful for tests)."""

        with self._lock:
            self._registrations.clear()


__all__ = ["DependencyContainer"]
