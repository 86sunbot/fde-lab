from pathlib import Path

from sentinel_usecase.deployment import DeploymentTarget, load_artifact, write_artifact
from sentinel_usecase.models import DetectionRule


def test_artifact_round_trip_uses_typed_contract(
    valid_rule: DetectionRule, tmp_path: Path
) -> None:
    target = DeploymentTarget(
        resource_group="rg-surya-sentinel-lab",
        workspace="law-surya-sentinel-lab",
    )
    artifact, path = write_artifact(valid_rule, target, tmp_path)
    loaded = load_artifact(path)
    assert loaded == artifact
    assert loaded.rule.enabled is False
    assert loaded.sentinel_payload.properties.enabled is False
