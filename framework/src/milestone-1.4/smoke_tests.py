"""Lightweight smoke tests for the integrated milestone 1.4 application."""
from __future__ import annotations

import http.client
import json
import socket
import threading
import time
from contextlib import closing
from pathlib import Path

if __package__ in (None, ""):
    import sys

    PACKAGE_ROOT = Path(__file__).resolve().parent
    SRC_ROOT = PACKAGE_ROOT.parent
    for candidate in (PACKAGE_ROOT, SRC_ROOT / "milestone-1.2", SRC_ROOT / "milestone-1.3"):
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.append(candidate_str)
    from application import create_app  # type: ignore
    import _compat  # noqa: F401  # type: ignore
else:
    from . import _compat  # noqa: F401
    from .application import create_app

def _find_free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_for_port(port: int, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            try:
                sock.connect(("127.0.0.1", port))
            except OSError:
                time.sleep(0.05)
                continue
        return
    raise TimeoutError(f"Server did not start listening on port {port}")


def run_smoke_tests() -> None:
    port = _find_free_port()
    app = create_app(host="127.0.0.1", port=port)
    server_thread = threading.Thread(target=lambda: app.listen(port), daemon=True)
    server_thread.start()
    _wait_for_port(port)

    def perform(method: str, url: str, *, headers: dict | None = None, body: str | None = None) -> tuple[int, bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        try:
            connection.request(method, url, body=body, headers=headers or {})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    status, payload = perform("GET", "/health")
    assert status == 200, status
    assert json.loads(payload) == {"status": "up"}

    headers = {"Content-Type": "application/json", "Authorization": "Bearer secrettoken"}
    body = json.dumps({"name": "Alice", "email": "alice@example.com"})
    status, payload = perform("POST", "/api/users", headers=headers, body=body)
    assert status == 201, status
    created_user = json.loads(payload)
    user_id = created_user["id"]

    status, payload = perform("GET", "/api/users")
    assert status == 200, status
    users_payload = json.loads(payload)
    assert users_payload["count"] >= 1

    status, payload = perform("GET", f"/api/users/{user_id}", headers=headers)
    assert status == 200, status
    user_payload = json.loads(payload)
    assert user_payload["email"] == "alice@example.com"

    status, _ = perform("GET", f"/api/users/{user_id}")
    assert status == 401, status

    status, _ = perform("GET", "/api/users/999", headers=headers)
    assert status == 404, status

    app.stop()
    server_thread.join(timeout=2)

    print("Smoke tests completed successfully.")


if __name__ == "__main__":
    run_smoke_tests()
