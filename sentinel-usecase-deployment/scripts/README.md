# Existing deployment script

The application reuses the supplied external
`Deploy-SentinelUseCases.ps1` through `SENTINEL_DEPLOYMENT_SCRIPT`; it does not copy or rewrite
that script. Before `APPROVE` can deploy, set `SENTINEL_SUBSCRIPTION_ID` in `.env` and ensure
PowerShell 7.2+ with the `Az.Accounts` module is available.

The adapter writes a one-row CSV and its relative KQL file under
`generated-rules/deployment-input/<rule-id>/`, runs the script in preview mode, and only then
runs it with `-Apply`. It always writes `Enabled=false`.

The supplied script contract does not accept Sentinel entity mappings. The generated review
artifact preserves them, but its PowerShell deployment payload does not include them. Extend the
existing script deliberately if entity mappings are required in deployed rules.

To smoke test the complete Azure read/validation path without creating or updating a rule, run:

```powershell
.\scripts\Smoke-Test-SentinelDeployment.ps1 `
  -SubscriptionId "<subscription-guid>" `
  -CsvPath ".\generated-rules\deployment-input\<rule-id>\sentinel-use-cases.csv"
```

It invokes the supplied script with `-Apply -WhatIf`; the script still validates the workspace,
CSV, KQL file, and existing rule state, but `ShouldProcess` skips every PUT request.

The smoke test is read-only with respect to Microsoft Sentinel. It does require an authenticated
Azure context with permission to read the target workspace and rules. If `pwsh` or Az modules are
not installed locally, the Python adapter tests still verify the exact preview/apply command
contract without making an Azure call.
