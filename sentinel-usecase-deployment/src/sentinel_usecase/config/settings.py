import shutil
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from sentinel_usecase.errors import ConfigurationError


class Settings(BaseSettings):
    """Validated local configuration, following the reusable V3 settings pattern."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SENTINEL_",
        case_sensitive=False,
        extra="ignore",
    )

    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-5-mini"
    llm_provider: Literal["openai", "azure_foundry"] = "openai"
    foundry_endpoint: str | None = None
    foundry_model: str | None = None
    openai_timeout_seconds: float = Field(default=60.0, gt=0, le=300)
    openai_max_retries: int = Field(default=2, ge=0, le=5)

    resource_group: str = Field(default="rg-surya-sentinel-lab", min_length=1)
    workspace: str = Field(default="law-surya-sentinel-lab", min_length=1)
    subscription_id: UUID | None = None
    deployment_script: Path = Path(
        "/Users/suryap/Library/Mobile Documents/com~apple~CloudDocs/"
        "Surya_Professional_Repository/MS_Sentinel/Deploy-SentinelUseCases.ps1"
    )
    powershell_executable: str = "pwsh"
    managed_identity: bool = False
    generated_rules_directory: Path = Path("generated-rules")
    log_level: str = "INFO"

    @field_validator("deployment_script", mode="after")
    @classmethod
    def resolve_known_deployment_script(cls, value: Path) -> Path:
        """Resolve the supplied script from either the project or its known external location."""

        if value.is_file():
            return value

        project_root = Path(__file__).resolve().parents[3]
        project_candidate = project_root / value
        if project_candidate.is_file():
            return project_candidate

        supplied_script = Path(
            "/Users/suryap/Library/Mobile Documents/com~apple~CloudDocs/"
            "Surya_Professional_Repository/MS_Sentinel/Deploy-SentinelUseCases.ps1"
        )
        return supplied_script if supplied_script.is_file() else value

    def require_openai_api_key(self) -> str:
        if self.openai_api_key is None or not self.openai_api_key.get_secret_value().strip():
            raise ConfigurationError(
                "SENTINEL_OPENAI_API_KEY is required unless --offline-reference is used"
            )
        return self.openai_api_key.get_secret_value()

    def require_foundry_endpoint(self) -> str:
        if not self.foundry_endpoint or not self.foundry_endpoint.strip():
            raise ConfigurationError(
                "SENTINEL_FOUNDRY_ENDPOINT is required when SENTINEL_LLM_PROVIDER=azure_foundry"
            )
        return self.foundry_endpoint.rstrip("/") + "/"

    def proposal_model(self) -> str:
        if self.llm_provider == "azure_foundry":
            if not self.foundry_model or not self.foundry_model.strip():
                raise ConfigurationError(
                    "SENTINEL_FOUNDRY_MODEL is required when SENTINEL_LLM_PROVIDER=azure_foundry"
                )
            return self.foundry_model
        return self.openai_model

    def require_deployment_subscription(self) -> UUID:
        if self.subscription_id is None:
            raise ConfigurationError(
                "SENTINEL_SUBSCRIPTION_ID is required before an approved rule can deploy"
            )
        return self.subscription_id

    def deployment_preflight_errors(self) -> tuple[str, ...]:
        errors: list[str] = []
        if self.subscription_id is None:
            errors.append("SENTINEL_SUBSCRIPTION_ID is not configured")
        if not self.deployment_script.is_file():
            errors.append(f"deployment script not found: {self.deployment_script}")
        if shutil.which(self.powershell_executable) is None:
            errors.append(
                f"PowerShell executable not found: {self.powershell_executable}"
            )
        return tuple(errors)
