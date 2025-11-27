"""Transaction isolation illustration tests for milestone 1.3."""
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

from milestone_1_3.pool import ConnectionPool, PoolConfig


class FakeDatabase:
    def __init__(self) -> None:
        self.data = {"balance": 50}


class TransactionalConnection:
    def __init__(self, database: FakeDatabase) -> None:
        self._database = database
        self._snapshot = database.data.copy()
        self._pending = {}
        self.closed = False

    def close(self) -> None:
        self.closed = True

    def is_valid(self, timeout: float) -> bool:
        return not self.closed

    def begin(self) -> None:
        self._snapshot = self._database.data.copy()
        self._pending.clear()

    def read(self, key: str) -> int:
        if key in self._pending:
            return self._pending[key]
        return self._snapshot[key]

    def write(self, key: str, value: int) -> None:
        self._pending[key] = value

    def commit(self) -> None:
        self._database.data.update(self._pending)
        self._pending.clear()

    def rollback(self) -> None:
        self._pending.clear()


class IsolationTest(unittest.TestCase):
    def setUp(self) -> None:
        database = FakeDatabase()

        def factory() -> TransactionalConnection:
            return TransactionalConnection(database)

        self.pool = ConnectionPool(
            PoolConfig(
                min_connections=2,
                max_connections=5,
                acquisition_timeout=0.5,
                leak_detection_threshold=1.0,
                connection_factory=factory,
            )
        )

    def test_repeatable_reads_simulation(self) -> None:
        with self.pool.acquire() as writer, self.pool.acquire() as reader:
            writer.begin()
            reader.begin()

            self.assertEqual(reader.read("balance"), 50)
            writer.write("balance", 100)
            self.assertEqual(reader.read("balance"), 50, "Reader should not see uncommitted change")

            writer.commit()
            self.assertEqual(reader.read("balance"), 50, "Snapshot remains stable during transaction")

            reader.rollback()
            reader.begin()
            self.assertEqual(reader.read("balance"), 100)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
