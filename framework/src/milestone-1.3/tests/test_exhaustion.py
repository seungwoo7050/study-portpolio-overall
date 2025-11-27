"""Pool exhaustion tests for milestone 1.3."""
from __future__ import annotations

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

from milestone_1_3.pool import ConnectionPool, PoolConfig, PoolExhaustedError


class FakeConnection:
    """Fake connection used for unit testing."""

    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True

    def is_valid(self, timeout: float) -> bool:
        return not self.closed


class ConnectionPoolExhaustionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pool = ConnectionPool(
            PoolConfig(
                min_connections=1,
                max_connections=3,
                acquisition_timeout=0.1,
                leak_detection_threshold=60.0,
                connection_factory=FakeConnection,
            )
        )

    def test_acquire_until_exhausted(self) -> None:
        connections = [self.pool.acquire() for _ in range(3)]
        with self.assertRaises(PoolExhaustedError):
            self.pool.acquire()
        connections[0].close()
        replacement = self.pool.acquire()
        self.assertFalse(replacement._raw.closed)
        replacement.close()
        for connection in connections[1:]:
            connection.close()


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    unittest.main()
