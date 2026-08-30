"""Machine-readable status report schema for the validation/backup pipeline."""
from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, Any

# publication_status enum values
HELD = "held"            # validation failed; candidate NOT published
PASSED = "passed"        # validation passed; candidate published (in preview, to a copy)
RESTORED = "restored"    # validation/smoke failed and prior known-good was restored
NOT_ATTEMPTED = "not_attempted"  # pipeline did not attempt publication


@dataclass
class StatusReport:
    run_utc: str
    candidate_path: str
    candidate_generation_time: Optional[str] = None
    data_through_time: Optional[str] = None
    validation_outcome: str = "fail"        # "pass" | "fail"
    validation_failures: list[dict] = field(default_factory=list)
    backup_reference: Optional[str] = None   # snapshot path taken BEFORE swapping
    current_known_good_reference: Optional[str] = None  # latest-known-good.json path
    publication_status: str = NOT_ATTEMPTED  # held | passed | restored | not_attempted

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def write(self, path: str) -> str:
        import os
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
        return path
