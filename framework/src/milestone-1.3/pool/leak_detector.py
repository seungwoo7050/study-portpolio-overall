"""Leak detection utilities for milestone 1.3."""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Dict

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class LeakDetector:
    """Simple leak detector that tracks connection hold times."""

    threshold_seconds: float
    _acquired_at: Dict[object, float] = field(default_factory=dict, init=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False)

    def record_acquisition(self, connection: object) -> None:
        """Register the moment a connection is checked out of the pool."""

        with self._lock:
            self._acquired_at[connection] = time.monotonic()

    def record_release(self, connection: object) -> None:
        """Remove tracking for a connection returned to the pool."""

        with self._lock:
            self._acquired_at.pop(connection, None)

    def check_for_leaks(self) -> None:
        """Emit a warning for connections held longer than ``threshold_seconds``."""

        now = time.monotonic()
        with self._lock:
            for connection, acquired_at in list(self._acquired_at.items()):
                held_for = now - acquired_at
                if held_for > self.threshold_seconds:
                    LOGGER.warning(
                        "Connection %s appears to be leaked (held %.2fs)",
                        connection,
                        held_for,
                    )


__all__ = ["LeakDetector"]
