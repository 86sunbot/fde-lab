import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from sentinel_usecase.deployment.gateway import DeploymentTarget
from sentinel_usecase.deployment.sentinel_payload import (
    SentinelScheduledAlertRule,
    build_sentinel_payload,
)
from sentinel_usecase.models import DetectionRule
from sentinel_usecase.models.base import StrictModel


class RuleArtifact(StrictModel):
    """Fully typed review artifact; files are revalidated when loaded."""

    artifact_version: Literal["1.0"] = "1.0"
    rule_id: UUID
    created_at: datetime
    target: DeploymentTarget
    rule: DetectionRule
    sentinel_payload: SentinelScheduledAlertRule

    @classmethod
    def create(cls, rule: DetectionRule, target: DeploymentTarget) -> "RuleArtifact":
        return cls(
            rule_id=uuid4(),
            created_at=datetime.now(UTC),
            target=target,
            rule=rule,
            sentinel_payload=build_sentinel_payload(rule),
        )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return slug[:80] or "sentinel-rule"


def write_artifact(
    rule: DetectionRule,
    target: DeploymentTarget,
    output_directory: Path,
) -> tuple[RuleArtifact, Path]:
    artifact = RuleArtifact.create(rule, target)
    output_directory.mkdir(parents=True, exist_ok=True)
    path = output_directory / f"{_slugify(rule.display_name)}-{str(artifact.rule_id)[:8]}.json"
    path.write_text(
        artifact.model_dump_json(indent=2, by_alias=True),
        encoding="utf-8",
    )
    return artifact, path


def load_artifact(path: Path) -> RuleArtifact:
    # JSON-mode validation preserves strict Python contracts while accepting JSON-native arrays,
    # ISO datetimes, and UUID strings produced by model_dump_json.
    return RuleArtifact.model_validate_json(path.read_text(encoding="utf-8"))
