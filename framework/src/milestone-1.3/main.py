"""Demonstration entry point for the milestone 1.3 connection pool."""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass

from .pool import ConnectionPool, PoolConfig

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger(__name__)


@dataclass
class FakeConnection:
    """Simple in-memory connection used to demonstrate pooling."""

    identifier: int
    closed: bool = False

    def close(self) -> None:
        self.closed = True

    def is_valid(self, timeout: float) -> bool:
        return not self.closed

    def execute(self, query: str) -> str:
        time.sleep(0.01)
        return f"Connection {self.identifier}: {query}"


class FakeConnectionFactory:
    """Factory producing connections with incrementing identifiers."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_id = 1

    def __call__(self) -> FakeConnection:
        with self._lock:
            identifier = self._next_id
            self._next_id += 1
        return FakeConnection(identifier)


def run_demo() -> None:
    factory = FakeConnectionFactory()
    pool = ConnectionPool(
        PoolConfig(
            min_connections=2,
            max_connections=5,
            acquisition_timeout=1.0,
            leak_detection_threshold=2.0,
            connection_factory=factory,
        )
    )

    def worker(name: str, query: str) -> None:
        with pool.acquire() as connection:
            LOGGER.info("%s -> %s", name, connection.execute(query))
            time.sleep(0.05)

    threads = [
        threading.Thread(target=worker, args=(f"worker-{i}", f"SELECT {i}")) for i in range(6)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    pool.leak_detector().check_for_leaks()


if __name__ == "__main__":
    run_demo()
