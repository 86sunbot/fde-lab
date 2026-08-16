# AI-Assisted Custom Use-Case Deployment — V1

This local Python application turns a natural-language password-spray requirement into a typed,
explainable Microsoft Sentinel **Scheduled** analytics rule. The LLM can only propose a rule.
Pydantic contracts and deterministic code independently validate, serialize, approve, and deploy
through the supplied `Deploy-SentinelUseCases.ps1` CSV/KQL contract.

Every rule is permanently constrained to `enabled = false` in V1.

## V1 release scope

V1 is intentionally a focused, safe baseline: it generates and validates a Microsoft Entra ID
password-spray scheduled rule, creates a review artifact, and gates deployment behind explicit
human approval. It is not yet a general-purpose detection catalog. Broader detection templates
and a generalized KQL validator are planned for V2.

The offline reference is a deterministic fixture for testing the complete workflow. It is not a
claim that the product is limited to password spraying forever.

Architecture decisions and diagrams are documented in:

- [ADR-0001: Freeze the V1 safety baseline](docs/adr/0001-freeze-v1-safety-baseline.md)
- [C4 system context](docs/architecture/c4-context.md)
- [C4 container view](docs/architecture/c4-container.md)
- [V1 end-to-end flow image](docs/architecture/v1-end-to-end-flow.svg)
- [Work-machine deployment plan](docs/WORK-MACHINE-DEPLOYMENT.md)
- [Configuration profiles](docs/CONFIGURATION.md)
- [V1 test runbook](docs/TEST-RUNBOOK.md)
- [Test artifacts](test-artifacts/README.md)

## Current delivery status

Generation, two-layer validation, review artifacts, explicit approval/rejection, Sentinel payload
construction, and PowerShell deployment integration are implemented. The adapter calls the
existing script first in preview mode and only then with `-Apply` after explicit human approval.

## Safety boundary

```text
Natural-language request
        |
        v
Typed LLM proposal (no tools or side effects)
        |
        v
Strict DetectionRule contract (unknown fields rejected)
        |
        +--> Structural validation
        |
        +--> Password-spray detection validation
        |
        v
Typed review artifact + disabled Sentinel payload
        |
        v
Human types APPROVE or REJECT
        |
        v
Validation rerun immediately before deployment
        |
        v
DeploymentGateway --> CSV/KQL preview --> existing PowerShell script with -Apply
```

The LLM client has no reference to the deployment gateway. A rule cannot represent `enabled=true`
because the field is typed as `Literal[False]`. Loading a review artifact also re-runs its full
Pydantic schema validation, so arbitrary JSON is never passed to deployment code.

## Password-spray reference logic

The included offline reference proposal uses `SigninLogs` and detects:

- failed sign-ins (`ResultType != "0"`);
- one source IP (`summarize ... by SourceIP = IPAddress`);
- multiple accounts (`dcount(UserPrincipalName)`);
- a typed detection window; and
- typed distinct-account and failed-attempt thresholds.

Its illustrative assumptions are **10 distinct accounts and 20 failed attempts in 15 minutes**.
These values are deliberately visible in `detection_parameters`, KQL `let` declarations, and the
human-readable assumptions. They are starting points for review, not silently chosen facts.

## Setup

Requires Python 3.11–3.13 and PowerShell only after deployment integration becomes possible.
Python 3.14 is not currently supported for this local setup because its virtual-environment path
handling and the installed OpenAI SDK are not reliable together.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
```

Set `SENTINEL_OPENAI_API_KEY` and `SENTINEL_SUBSCRIPTION_ID` in `.env`. The deployment script
path is prefilled for the supplied local script; update `SENTINEL_DEPLOYMENT_SCRIPT` if it moves.
For local deployment, install PowerShell 7.2+ and the `Az.Accounts` module, then sign in once:

```powershell
Connect-AzAccount
```

The script will use the persisted Az context. Alternatively, set `SENTINEL_MANAGED_IDENTITY=true`
only in an Azure-hosted environment with an assigned managed identity.

The fixed target is:

- Resource group: `rg-surya-sentinel-lab`
- Log Analytics workspace: `law-surya-sentinel-lab`

## Generate a rule

AI-assisted mode:

```bash
python run.py create "Create a password spray detection"
```

For an offline local demonstration of the exact same contracts and validation pipeline:

```bash
python run.py create \
  "Create a password spray detection" \
  --offline-reference
```

In Bash or zsh, each continuation backslash must be the final character on its line. The simplest
single-line form is:

```bash
python run.py create "Create a password spray detection" --offline-reference
```

The offline flag is explicit because that proposal is deterministic and does not call an LLM. A
successful command writes a typed review artifact under `generated-rules/`; a failed proposal is
not written there.

## Review and gate deployment

```bash
python run.py review generated-rules/<artifact>.json
```

The command displays the KQL, assumptions, likely false positives, validation status, and disabled
state. It accepts only exact `APPROVE` or `REJECT`. Approval does not override validation: the rule
is validated again immediately before the deployment boundary.

On approval, the adapter generates a one-row CSV and relative KQL file under
`generated-rules/deployment-input/<rule-id>/`, invokes the script’s no-side-effect preview, and
only then invokes it with `-Apply`. The rule remains disabled in both files and the final Sentinel
request.

The supplied script does not accept entity mappings. The review artifact retains them, but the
script does not send them to Sentinel. This limitation is explicit rather than silently hidden;
extend the script deliberately if deployed entity mappings are required.

To revalidate an artifact without reviewing it:

```bash
python run.py validate generated-rules/<artifact>.json
```

Before an approval, check the local deployment prerequisites without contacting Azure or changing
Sentinel:

```bash
python run.py doctor
```

## Interface status

The browser UI and local API launcher were removed from the V1 repository because the development
runtime was experimental and slow. The CLI is the supported V1 interface. A web interface can be
added later as a separate V2 decision without changing the core workflow.

Use `.env.openai.example` for permitted Mac development and `.env.foundry.example` for the work
laptop. The application is platform-agnostic; provider and identity selection come from environment
configuration rather than operating-system-specific code.

## Work-machine readiness

The MacBook is for development; the work laptop is the acceptance environment. For a workplace
demo, use Microsoft Foundry with Microsoft Entra ID rather than requiring a direct OpenAI API key.
Read the [work-machine deployment plan](docs/WORK-MACHINE-DEPLOYMENT.md) before publishing or
tagging the repository. The proposal adapter supports `openai` and `azure_foundry` providers;
the Foundry path requires `azure-identity`, an approved endpoint/model deployment, and Entra ID
permissions. The target resource group and workspace are environment-configurable; replace the
lab defaults before a work deployment.

## Validation details

Structural checks include required tables and fields, mapped output columns, unresolved
placeholders, disallowed management/external-data commands, and the disabled-state invariant.

Detection checks independently require password-spray intent, failure filtering, grouping by one
source IP, distinct-account counting, a time window, internal threshold enforcement, agreement
between typed values and KQL, and visible threshold assumptions. Valid-looking KQL that does not
model password spraying fails validation.

## Tests

```bash
pytest
ruff check .
```

Tests cover valid and invalid requests, valid rules, missing fields, invalid threshold types and
values, the disabled default/invariant, structural and semantic validation, unsupported V1 use
cases, artifact round-tripping, deployment without approval, deployment after failed validation,
the CSV/KQL adapter contract, preview-before-apply behavior, and the disabled-state invariant.

## Release checklist

Before publishing V1, run `ruff check .` and `pytest`, verify that `.env` is ignored and contains
no committed secrets, confirm `python run.py doctor` is ready on the deployment machine, and review
the generated artifact once with a human reviewer. Do not commit generated artifacts, deployment
inputs, virtual environments, or local web build output.
