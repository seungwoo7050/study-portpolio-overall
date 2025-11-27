"""Test utilities for milestone 1.3."""
from __future__ import annotations

import importlib.util
import pathlib
import sys


def ensure_package_loaded() -> None:
    """Ensure ``milestone_1_3`` namespace is available for absolute imports."""

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


__all__ = ["ensure_package_loaded"]
