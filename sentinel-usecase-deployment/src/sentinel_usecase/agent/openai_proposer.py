from pydantic import ValidationError

from sentinel_usecase.config import Settings
from sentinel_usecase.errors import ProposalError
from sentinel_usecase.models import DetectionRequest, DetectionRuleProposal

SYSTEM_INSTRUCTIONS = """You propose one Microsoft Sentinel Scheduled analytics rule.
V1 supports only Microsoft Entra ID password spraying using SigninLogs.

The proposal must detect authentication failures from one source IP against multiple distinct
user accounts within a detection window. Express all threshold and window values in the typed
detection_parameters, use the same literal values in KQL let-statements named DetectionWindow,
MinimumDistinctAccounts, and MinimumFailedAttempts, and explicitly state those values in an
assumption. Use ResultType != \"0\" for failure filtering. Use this required query shape exactly:

| summarize FailedAttempts = count(), DistinctAccountCount = dcount(UserPrincipalName),
            TargetAccounts = make_set(UserPrincipalName, 100)
    by SourceIP = IPAddress, bin(TimeGenerated, DetectionWindow)
| where DistinctAccountCount >= MinimumDistinctAccounts
    and FailedAttempts >= MinimumFailedAttempts
| mv-expand TargetAccount = TargetAccounts to typeof(string)
| project TimeGenerated, SourceIP, TargetAccount, FailedAttempts, DistinctAccountCount

This produces scalar SourceIP and TargetAccount fields for entity mapping. Do not substitute
different aggregation aliases or map the dynamic TargetAccounts array directly. The query must
emit only when its internal thresholds are reached.

Do not claim that the rule was validated, approved, deployed, or enabled. Do not include
deployment commands. The application, not you, owns validation, approval, and deployment.
"""


class OpenAIRuleProposer:
    """Async typed-output LLM adapter; it has no deployment capability."""

    def __init__(self, settings: Settings) -> None:
        try:
            from openai import AsyncOpenAI
        except ImportError as error:  # pragma: no cover - installation failure path
            raise ProposalError("the openai package is not installed") from error

        self._model = settings.proposal_model()
        client_options = {
            "timeout": settings.openai_timeout_seconds,
            "max_retries": settings.openai_max_retries,
        }
        if settings.llm_provider == "azure_foundry":
            try:
                from azure.identity import DefaultAzureCredential, get_bearer_token_provider
            except ImportError as error:  # pragma: no cover - optional workplace dependency
                raise ProposalError(
                    "azure-identity is required for SENTINEL_LLM_PROVIDER=azure_foundry"
                ) from error
            client_options["api_key"] = get_bearer_token_provider(
                DefaultAzureCredential(), "https://ai.azure.com/.default"
            )
            client_options["base_url"] = settings.require_foundry_endpoint()
        else:
            client_options["api_key"] = settings.require_openai_api_key()
        self._client = AsyncOpenAI(**client_options)

    async def propose(self, request: DetectionRequest) -> DetectionRuleProposal:
        return await self._parse(request.requirement)

    async def repair(
        self,
        request: DetectionRequest,
        validation_errors: tuple[str, ...],
    ) -> DetectionRuleProposal:
        """Make one bounded, feedback-driven correction; validation still owns acceptance."""

        feedback = "\n".join(f"- {error}" for error in validation_errors)
        repair_request = (
            f"Original request: {request.requirement}\n\n"
            "The previous proposal failed deterministic validation for these reasons:\n"
            f"{feedback}\n\n"
            "Return a complete replacement proposal. Correct every listed issue and follow the "
            "required KQL shape exactly."
        )
        return await self._parse(repair_request)

    async def _parse(self, input_text: str) -> DetectionRuleProposal:
        try:
            response = await self._client.responses.parse(
                model=self._model,
                instructions=SYSTEM_INSTRUCTIONS,
                input=input_text,
                text_format=DetectionRuleProposal,
            )
            proposal = response.output_parsed
        except (ValidationError, ValueError) as error:
            raise ProposalError("the model returned an invalid structured proposal") from error
        except Exception as error:
            # SDK exception classes vary across compatible 2.x releases. Preserve the cause while
            # exposing one stable application error at this narrow upstream boundary.
            raise ProposalError("the rule-proposal request failed") from error

        if proposal is None:
            raise ProposalError("the model returned no structured proposal")
        return proposal

    async def close(self) -> None:
        await self._client.close()
