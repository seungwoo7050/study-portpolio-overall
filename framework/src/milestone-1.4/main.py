"""Entry point for running the integrated mini-spring application."""
from __future__ import annotations

import logging
import signal
import sys
from typing import Optional

from pathlib import Path

if __package__ in (None, ""):
    import sys

    PACKAGE_ROOT = Path(__file__).resolve().parent
    SRC_ROOT = PACKAGE_ROOT.parent
    for candidate in (PACKAGE_ROOT, SRC_ROOT / "milestone-1.2", SRC_ROOT / "milestone-1.3"):
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.append(candidate_str)
    from application import create_app, graceful_shutdown  # type: ignore
    import _compat  # noqa: F401  # type: ignore
else:
    from .application import create_app, graceful_shutdown


logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")


def main(port: Optional[int] = None) -> None:
    app = create_app(port=port or 8080)
    handler = graceful_shutdown(app)
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    try:
        app.listen(port)
    except KeyboardInterrupt:  # pragma: no cover - interactive usage
        handler(signal.SIGINT, None)


if __name__ == "__main__":
    chosen_port: Optional[int] = None
    if len(sys.argv) > 1:
        try:
            chosen_port = int(sys.argv[1])
        except ValueError:
            print("Port must be an integer", file=sys.stderr)
            sys.exit(1)
    main(chosen_port or 8080)
