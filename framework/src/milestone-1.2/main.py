"""Entry point for running the milestone 1.2 example application."""
from __future__ import annotations

import logging
import signal
import sys
from typing import Optional

if __package__ in (None, ""):
    import os

    PACKAGE_ROOT = os.path.dirname(__file__)
    sys.path.insert(0, PACKAGE_ROOT)
    from framework.app import App  # type: ignore
    from example import controllers  # type: ignore
    from example.database import Database  # type: ignore
    from example.middleware import logging_middleware  # type: ignore
else:
    from .framework.app import App
    from .example import controllers
    from .example.database import Database
    from .example.middleware import logging_middleware

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")


def create_app() -> App:
    app = App()
    app.register_instance("database", Database())
    app.use(logging_middleware)
    controllers.register(app)
    return app


def main(port: int = 8080) -> None:
    app = create_app()

    def handle_signal(_signum, _frame) -> None:
        app.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        app.listen(port)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    chosen_port: Optional[int] = None
    if len(sys.argv) > 1:
        try:
            chosen_port = int(sys.argv[1])
        except ValueError:
            print("Port must be an integer", file=sys.stderr)
            sys.exit(1)
    main(chosen_port or 8080)
