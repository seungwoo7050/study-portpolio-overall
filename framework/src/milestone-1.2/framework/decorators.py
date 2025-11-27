"""Decorator helpers for the milestone 1.2 mini-framework."""
from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Protocol, TypeVar

from .request import Request

ReturnType = TypeVar("ReturnType")
Handler = Callable[..., ReturnType]


class NextHandler(Protocol):
    def __call__(self, request: Request) -> Any:  # pragma: no cover - protocol
        ...


Middleware = Callable[[Request, NextHandler], Any]


def middleware(func: Callable[[Request, NextHandler], Any]) -> Middleware:
    """Mark ``func`` as middleware.

    The decorator mainly preserves the original ``__name__`` and ``__doc__`` to
    aid debugging when printing middleware chains.
    """

    @wraps(func)
    def wrapper(request: Request, next_handler: NextHandler) -> Any:
        return func(request, next_handler)

    return wrapper


def inject(service_name: str) -> Callable[[Handler], Handler]:
    """Inject a dependency resolved from the application's container."""

    def decorator(function: Handler) -> Handler:
        @wraps(function)
        def wrapper(request: Request, *args: Any, **kwargs: Any):
            service = request.app.container.resolve(service_name)
            return function(request, *args, service=service, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


__all__ = ["Middleware", "NextHandler", "inject", "middleware"]
