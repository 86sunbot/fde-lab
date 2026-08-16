import asyncio
import csv
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Literal, Protocol
from uuid import UUID

from sentinel_usecase.deployment.sentinel_payload import SentinelScheduledAlertRule
from sentinel_usecase.errors import DeploymentExecutionError, DeploymentUnavailableError
from sentinel_usecase.models import DetectionRule
from sentinel_usecase.models.base import StrictModel


class DeploymentTarget(StrictModel):
    resource_group: Literal["rg-surya-sentinel-lab"]
    workspace: Literal["law-surya-sentinel-lab"]


class DeploymentResult(StrictModel):
    deployed: bool
    message: str


class DeploymentPackage(StrictModel):
    """Validated internal object passed to the side-effecting adapter."""

    rule_id: UUID
    rule: DetectionRule
    target: DeploymentTarget
    sentinel_payload: SentinelScheduledAlertRule


class DeploymentGateway(Protocol):
    async def deploy(self, package: DeploymentPackage) -> DeploymentResult: ...


class UnavailableDeploymentGateway:
    """Explicit fail-closed boundary used until the existing script contract is available."""

    def __init__(self, script_path: Path) -> None:
        self._script_path = script_path

    async def deploy(
        self,
        package: DeploymentPackage,
    ) -> DeploymentResult:
        del package
        if not self._script_path.is_file():
            raise DeploymentUnavailableError(
                f"deployment blocked: required script not found at {self._script_path}"
            )
        raise DeploymentUnavailableError(
            "deployment blocked: Deploy-SentinelUseCases.ps1 now exists, but its input contract "
            "was unavailable during this build and no adapter was guessed"
        )


CommandRunner = Callable[[list[str]], subprocess.CompletedProcess[str]]


class PowerShellCsvDeploymentGateway:
    """Adapter for the supplied Deploy-SentinelUseCases.ps1 CSV/KQL contract."""

    def __init__(
        self,
        *,
        script_path: Path,
        subscription_id: UUID,
        powershell_executable: str,
        managed_identity: bool,
        output_directory: Path,
        command_runner: CommandRunner | None = None,
    ) -> None:
        self._script_path = script_path
        self._subscription_id = subscription_id
        self._powershell_executable = powershell_executable
        self._managed_identity = managed_identity
        self._output_directory = output_directory
        self._command_runner = command_runner or self._run_command

    async def deploy(self, package: DeploymentPackage) -> DeploymentResult:
        csv_path = self._write_script_inputs(package)
        print(
            f"[sentinel-usecase] Deployment inputs written to {csv_path.parent}.",
            flush=True,
        )
        preview_command = self._build_command(package.target, csv_path, apply=False)
        print(
            "[sentinel-usecase] Running PowerShell preview; no apply flag is set.",
            flush=True,
        )
        preview = await asyncio.to_thread(self._command_runner, preview_command)
        self._require_success(preview, "preview")

        apply_command = self._build_command(package.target, csv_path, apply=True)
        print(
            "[sentinel-usecase] Preview succeeded; running the explicitly approved apply.",
            flush=True,
        )
        applied = await asyncio.to_thread(self._command_runner, apply_command)
        self._require_success(applied, "deployment")
        return DeploymentResult(
            deployed=True,
            message=(
                "Deployment script preview and apply completed. CSV/KQL inputs were retained at "
                f"{csv_path.parent}. Note: the supplied script does not accept entity mappings; "
                "they remain in the review artifact but are not sent to Sentinel by this script."
            ),
        )

    def _write_script_inputs(self, package: DeploymentPackage) -> Path:
        if not self._script_path.is_file():
            raise DeploymentUnavailableError(
                f"deployment blocked: required script not found at {self._script_path}"
            )
        if shutil.which(self._powershell_executable) is None:
            raise DeploymentUnavailableError(
                "deployment blocked: PowerShell executable "
                f"{self._powershell_executable!r} was not found"
            )

        package_directory = self._output_directory / "deployment-input" / str(package.rule_id)
        package_directory.mkdir(parents=True, exist_ok=True)
        query_path = package_directory / "rule.kql"
        csv_path = package_directory / "sentinel-use-cases.csv"
        query_path.write_text(package.rule.query.rstrip() + "\n", encoding="utf-8")

        row = {
            "RuleId": str(package.rule_id),
            "DisplayName": package.rule.display_name,
            "Description": package.rule.description,
            "Enabled": "false",
            "Severity": package.rule.severity,
            "QueryFile": query_path.name,
            "QueryFrequency": package.rule.query_frequency,
            "QueryPeriod": package.rule.query_lookback,
            "TriggerOperator": package.rule.trigger_configuration.operator,
            "TriggerThreshold": str(package.rule.trigger_configuration.threshold),
            "Tactics": ";".join(package.rule.tactics),
            "Techniques": ";".join(package.rule.techniques),
            "CreateIncident": "true",
        }
        with csv_path.open("w", newline="", encoding="utf-8") as file_handle:
            writer = csv.DictWriter(file_handle, fieldnames=tuple(row))
            writer.writeheader()
            writer.writerow(row)
        return csv_path

    def _build_command(self, target: DeploymentTarget, csv_path: Path, *, apply: bool) -> list[str]:
        command = [
            self._powershell_executable,
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            str(self._script_path),
            "-SubscriptionId",
            str(self._subscription_id),
            "-ResourceGroupName",
            target.resource_group,
            "-WorkspaceName",
            target.workspace,
            "-CsvPath",
            str(csv_path),
        ]
        if self._managed_identity:
            command.append("-ManagedIdentity")
        if apply:
            command.extend(("-Apply", "-Confirm:$false"))
        return command

    @staticmethod
    def _run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=300,
        )

    @staticmethod
    def _require_success(result: subprocess.CompletedProcess[str], phase: str) -> None:
        if result.returncode == 0:
            return
        output = "\n".join(part for part in (result.stdout, result.stderr) if part).strip()
        detail = output[-4_000:] if output else "no PowerShell output was returned"
        raise DeploymentExecutionError(f"{phase} failed: {detail}")
