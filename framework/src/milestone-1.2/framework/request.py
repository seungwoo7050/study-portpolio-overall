"""Request abstraction used by the milestone 1.2 mini-framework."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

if False:  # pragma: no cover - for type checking only
    from .app import App


@dataclass
class RawHttpRequest:
    """Minimal representation of an HTTP request."""

    method: str
    path: str
    version: str
    headers: Dict[str, str]
    body: str
    path_params: Dict[str, str] = field(default_factory=dict)

    def get_header(self, name: str, default: Optional[str] = None) -> Optional[str]:
        return self.headers.get(name.lower(), default)


@dataclass
class Request:
    """High-level HTTP request wrapper."""

    raw: RawHttpRequest
    app: "App"

    @property
    def method(self) -> str:
        return self.raw.method

    @property
    def path(self) -> str:
        return self.raw.path

    @property
    def headers(self) -> Dict[str, str]:
        return self.raw.headers

    @property
    def body(self) -> str:
        return self.raw.body

    @property
    def path_params(self) -> Dict[str, str]:
        return self.raw.path_params

    def json(self, default: Optional[Any] = None) -> Any:
        if not self.body:
            return default
        try:
            return json.loads(self.body)
        except json.JSONDecodeError:
            return default

    def get_header(self, name: str, default: Optional[str] = None) -> Optional[str]:
        return self.raw.get_header(name, default)

    def get_path_param(self, name: str, default: Optional[str] = None) -> Optional[str]:
        return self.raw.path_params.get(name, default)


__all__ = ["Request", "RawHttpRequest"]
