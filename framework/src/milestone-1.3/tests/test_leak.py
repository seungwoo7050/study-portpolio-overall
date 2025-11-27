"""Leak detection tests for milestone 1.3."""
from __future__ import annotations

import logging
import time
import unittest

if __package__ in {None, ""}:
    import importlib.util
    import pathlib
    import sys

    def ensure_package_loaded() -> None:
        package_name = "milestone_1_3"
        if package_name in sys.modules:
            return
        package_path = pathlib.Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location(
            package_name,
            package_path / "__init__.py",
            submodule_search_locations=[str(package_path)],
        )
        if spec is None or spec.loader is None:  # pragma: no cover - defensive
            raise ImportError("Unable to load milestone_1_3 package")
        module = importlib.util.module_from_spec(spec)
        sys.modules[package_name] = module
        spec.loader.exec_module(module)
else:
    from . import ensure_package_loaded

ensure_package_loaded()

from milestone_1_3.pool import ConnectionPool, PoolConfig


class SlowClosingConnection:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


class LeakDetectionTest(unittest.TestCase):
    def setUp(self) -> None:
        logging.basicConfig(level=logging.DEBUG)
        self.pool = ConnectionPool(
            PoolConfig(
                min_connections=0,
                max_connections=2,
                acquisition_timeout=0.2,
                leak_detection_threshold=0.05,
                connection_factory=SlowClosingConnection,
            )
        )

    def test_leak_warning_emitted(self) -> None:
        connection = self.pool.acquire()
        time.sleep(0.1)
        with self.assertLogs(level="WARNING") as logs:
            self.pool.leak_detector().check_for_leaks()
        self.assertTrue(any("leaked" in message for message in logs.output))
        connection.close()


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
