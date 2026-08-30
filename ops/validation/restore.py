"""
Restore mechanism — return the app to the last known-good model if validation
or a smoke test fails.

`restore()` copies the latest-known-good snapshot (or an explicit snapshot) to a
TARGET path. The target is a parameter: in production this would be the live
analysis.json, but OPS-02 does NOT wire production restore automatically — the
preview test mode only restores into gitignored working copies.
"""
from __future__ import annotations
import os
import shutil
from .backup import latest_known_good_path, DEFAULT_BACKUP_DIR


def restore(target_path: str, backup_dir: str = DEFAULT_BACKUP_DIR, snapshot: str | None = None) -> str:
    """Restore a known-good model to target_path. If `snapshot` is given, use it;
    otherwise use latest-known-good.json. Returns the path written to target."""
    src = snapshot or latest_known_good_path(backup_dir)
    if not src or not os.path.exists(src):
        raise FileNotFoundError(f"no known-good snapshot available in {backup_dir}")
    os.makedirs(os.path.dirname(os.path.abspath(target_path)) or ".", exist_ok=True)
    shutil.copy2(src, target_path)
    return target_path
