"""Response utilities for the milestone 1.2 framework."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, Tuple, Union

StatusBody = Union[str, bytes]


@dataclass
class Response:
    """High-level HTTP response representation."""

    status: int = 200
    body: StatusBody = ""
    headers: Dict[str, str] = field(default_factory=dict)

    def ensure_serialised(self) -> Tuple[bytes, Dict[str, str]]:
        """Return the body as bytes along with headers."""

        if isinstance(self.body, bytes):
            payload = self.body
        else:
            payload = self.body.encode("utf-8")
        headers = {"Content-Length": str(len(payload)), **self.headers}
        if "content-type" not in {k.lower() for k in headers}:
            headers["Content-Type"] = "application/json" if payload else "text/plain"
        return payload, headers

    def to_http_response(self) -> Tuple[int, Dict[str, str], bytes]:
        payload, headers = self.ensure_serialised()
        return self.status, headers, payload

    @classmethod
    def json(cls, data: Any, status: int = 200) -> "Response":
        body = json.dumps(data)
        return cls(status=status, body=body, headers={"Content-Type": "application/json"})

    @classmethod
    def ok(cls, data: Any = None) -> "Response":
        if data is None:
            return cls(status=200, body="")
        if isinstance(data, (dict, list)):
            return cls.json(data, status=200)
        return cls(status=200, body=str(data))

    @classmethod
    def created(cls, data: Any) -> "Response":
        if isinstance(data, (dict, list)):
            return cls.json(data, status=201)
        return cls(status=201, body=str(data))

    @classmethod
    def error(cls, message: str, status: int = 400) -> "Response":
        return cls.json({"error": message}, status=status)

    @staticmethod
    def from_result(result: Any) -> "Response":
        """Normalise various handler return types into :class:`Response`."""

        if isinstance(result, Response):
            return result
        if isinstance(result, tuple):
            body, status = result
            if isinstance(body, Response):
                response = body
                response.status = status
                return response
            if isinstance(body, (dict, list)):
                return Response.json(body, status=status)
            return Response(status=status, body=str(body))
        if isinstance(result, (dict, list)):
            return Response.json(result)
        if result is None:
            return Response(status=204, body="")
        return Response(status=200, body=str(result))


__all__ = ["Response"]
