"""
Backup mechanism for the Silverline model.

Before any candidate can replace the current model, this snapshots the existing
known-good model to a timestamped file and maintains a `latest-known-good.json`
copy. All writes go to a configured backup directory (gitignored by default) —
production analysis.json is NEVER modified here.
"""
from __future__ import annotations
import os
import shutil
import json
from datetime import datetime, timezone

DEFAULT_BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backups")
KEEP_LAST_N = 30  # retention cap on timestamped snapshots


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def snapshot_known_good(live_path: str, backup_dir: str = DEFAULT_BACKUP_DIR) -> str:
    """Copy live_path -> backup_dir/analysis.<UTCts>.json and refresh latest-known-good.json.
    Returns the snapshot path. Raises FileNotFoundError if live_path is missing."""
    os.makedirs(backup_dir, exist_ok=True)
    if not os.path.exists(live_path):
        raise FileNotFoundError(f"known-good model not found: {live_path}")
    snapshot_path = os.path.join(backup_dir, f"analysis.{_ts()}.json")
    shutil.copy2(live_path, snapshot_path)
    latest = os.path.join(backup_dir, "latest-known-good.json")
    shutil.copy2(live_path, latest)
    _prune(backup_dir)
    return snapshot_path


def _prune(backup_dir: str) -> None:
    """Keep only the most recent KEEP_LAST_N timestamped analysis.*.json snapshots."""
    snaps = [f for f in os.listdir(backup_dir) if f.startswith("analysis.") and f.endswith(".json")]
    snaps.sort(key=lambda f: os.path.getmtime(os.path.join(backup_dir, f)), reverse=True)
    for old in snaps[KEEP_LAST_N:]:
        try:
            os.remove(os.path.join(backup_dir, old))
        except OSError:
            pass


def latest_known_good_path(backup_dir: str = DEFAULT_BACKUP_DIR) -> str | None:
    p = os.path.join(backup_dir, "latest-known-good.json")
    return p if os.path.exists(p) else None
