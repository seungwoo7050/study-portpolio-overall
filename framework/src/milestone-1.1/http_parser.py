"""HTTP request parsing utilities for milestone 1.1.

This module contains the :class:`HttpRequest` class which is responsible for
parsing raw HTTP/1.1 requests received over a TCP socket.  The goal of this
milestone is educational, therefore the implementation favours readability and
explicitness over micro-optimisations.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional

CRLF = "\r\n"
DEFAULT_ENCODING = "utf-8"


@dataclass
class HttpRequest:
    """Representation of an HTTP/1.1 request.

    Attributes
    ----------
    method:
        The HTTP method (GET, POST, ...).
    path:
        The request path, excluding query parameters.
    version:
        HTTP version string (e.g. ``HTTP/1.1``).
    headers:
        Mapping of header names (lowercase) to values.
    body:
        Raw request body decoded as text.  For milestone 1.1 we only need to
        support textual payloads, so bytes are decoded using UTF-8 with
        replacement for invalid sequences.
    path_params:
        Populated by the router once a matching route is found.
    """

    method: str
    path: str
    version: str
    headers: Dict[str, str] = field(default_factory=dict)
    body: str = ""
    path_params: Dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_socket(cls, conn) -> Optional["HttpRequest"]:
        """Parse a request from a client socket.

        Parameters
        ----------
        conn:
            A ``socket.socket`` instance representing the accepted connection.

        Returns
        -------
        Optional[HttpRequest]
            A populated request object or ``None`` if the client closed the
            connection without sending data.
        """

        buffer = conn.makefile("rb")
        try:
            request_line = buffer.readline().decode("iso-8859-1").strip()
            if not request_line:
                return None

            parts = request_line.split()
            if len(parts) != 3:
                raise ValueError(f"Malformed request line: {request_line!r}")

            method, target, version = parts
            path = target.split("?")[0]

            headers: Dict[str, str] = {}
            while True:
                raw_line = buffer.readline().decode("iso-8859-1")
                if raw_line in ("\r\n", "\n", ""):
                    break
                if ":" not in raw_line:
                    raise ValueError(f"Malformed header line: {raw_line!r}")
                name, value = raw_line.split(":", 1)
                headers[name.strip().lower()] = value.strip()

            body = b""
            content_length = headers.get("content-length")
            if content_length:
                length = int(content_length)
                body = buffer.read(length)

            return cls(
                method=method.upper(),
                path=path,
                version=version,
                headers=headers,
                body=body.decode(DEFAULT_ENCODING, errors="replace"),
            )
        finally:
            buffer.close()

    def get_header(self, name: str, default: Optional[str] = None) -> Optional[str]:
        """Return a header value using case-insensitive lookup."""

        return self.headers.get(name.lower(), default)

    def get_path_param(self, name: str, default: Optional[str] = None) -> Optional[str]:
        """Access path parameters extracted by the router."""

        return self.path_params.get(name, default)
