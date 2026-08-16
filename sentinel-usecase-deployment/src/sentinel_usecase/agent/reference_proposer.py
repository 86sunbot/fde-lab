from sentinel_usecase.models import (
    DetectionParameters,
    DetectionRequest,
    DetectionRuleProposal,
    EntityFieldMapping,
    EntityMapping,
    TableFieldRequirement,
    TelemetryRequirement,
    TriggerConfiguration,
)


class ReferencePasswordSprayProposer:
    """Deterministic offline fixture for local demos and tests; it is not an LLM substitute."""

    async def propose(self, request: DetectionRequest) -> DetectionRuleProposal:
        del request
        return DetectionRuleProposal(
            display_name="Microsoft Entra ID password spray from a single IP",
            description=(
                "Detects repeated failed Microsoft Entra ID sign-ins from one source IP "
                "targeting many distinct user accounts within a short time window."
            ),
            detection_objective=(
                "Identify probable password spraying by correlating authentication failures "
                "from one source IP across multiple distinct accounts."
            ),
            required_telemetry=(
                TelemetryRequirement(
                    source="Microsoft Entra ID SigninLogs",
                    purpose=(
                        "Provides sign-in result, source IP, target account, and event time."
                    ),
                ),
            ),
            required_tables=("SigninLogs",),
            required_fields=(
                TableFieldRequirement(
                    table="SigninLogs",
                    fields=(
                        "TimeGenerated",
                        "ResultType",
                        "IPAddress",
                        "UserPrincipalName",
                    ),
                ),
            ),
            query="""let DetectionWindow = 15m;
let MinimumDistinctAccounts = 10;
let MinimumFailedAttempts = 20;
SigninLogs
| where TimeGenerated >= ago(DetectionWindow)
| where ResultType != "0"
| where isnotempty(IPAddress) and isnotempty(UserPrincipalName)
| summarize FailedAttempts = count(),
            DistinctAccountCount = dcount(UserPrincipalName),
            TargetAccounts = make_set(UserPrincipalName, 100)
    by SourceIP = IPAddress, bin(TimeGenerated, DetectionWindow)
| where DistinctAccountCount >= MinimumDistinctAccounts
    and FailedAttempts >= MinimumFailedAttempts
| mv-expand TargetAccount = TargetAccounts to typeof(string)
| project TimeGenerated, SourceIP, TargetAccount, FailedAttempts, DistinctAccountCount""",
            severity="Medium",
            query_frequency="PT5M",
            query_lookback="PT15M",
            trigger_configuration=TriggerConfiguration(),
            entity_mappings=(
                EntityMapping(
                    entity_type="IP",
                    field_mappings=(
                        EntityFieldMapping(identifier="Address", column_name="SourceIP"),
                    ),
                ),
                EntityMapping(
                    entity_type="Account",
                    field_mappings=(
                        EntityFieldMapping(
                            identifier="FullName", column_name="TargetAccount"
                        ),
                    ),
                ),
            ),
            detection_parameters=DetectionParameters(
                detection_window_minutes=15,
                minimum_distinct_accounts=10,
                minimum_failed_attempts=20,
            ),
            assumptions=(
                "Threshold assumption: at least 10 distinct accounts and 20 failed attempts "
                "from one source IP within a 15-minute detection window indicates suspicious "
                "spraying; review these values against the environment baseline.",
                "ResultType equal to 0 represents a successful sign-in; all other populated "
                "result codes are treated as failures for this V1 rule.",
            ),
            potential_false_positives=(
                "Users behind a large corporate NAT or secure web gateway may share one IP.",
                "Misconfigured applications or identity synchronization can repeatedly try "
                "stale credentials across service accounts.",
                "Authorized penetration tests and password-audit exercises can match the pattern.",
            ),
        )
