"""Compatibility helpers for importing previous milestone modules."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure the milestone 1.2 and 1.3 packages can be imported even though their
# directories contain hyphens (``-``) which are not valid Python identifiers.
# By appending their directories to ``sys.path`` we can import their internal
# modules (``framework`` and ``pool``) using regular absolute imports.
_PACKAGE_ROOT = Path(__file__).resolve().parent
_SRC_ROOT = _PACKAGE_ROOT.parent

for dependency in ("milestone-1.1", "milestone-1.2", "milestone-1.3"):
    candidate = _SRC_ROOT / dependency
    if candidate.is_dir():
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.append(candidate_str)

__all__ = []
