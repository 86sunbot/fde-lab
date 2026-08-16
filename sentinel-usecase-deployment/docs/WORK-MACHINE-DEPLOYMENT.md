# Work-machine deployment plan

## The simple answer

The MacBook is a development machine. The work laptop is the acceptance environment. The
acceptance test is not “does it run on the Mac?”; it is “can an approved user run the same repository
on the work laptop using the organization-approved Microsoft service and deployment permissions?”

For work, use **Microsoft Foundry with Microsoft Entra ID authentication**. Do not require a direct
OpenAI API key on the work laptop. Microsoft Foundry supports Entra ID token-based authentication,
RBAC, auditing, conditional access, and managed identities. See the official
[Foundry authentication guidance](https://learn.microsoft.com/en-us/azure/foundry/concepts/authentication-authorization-foundry)
and [keyless authentication setup](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/configure-entra-id).

## Two supported environments

| Environment | Proposal service | Authentication | Purpose |
|---|---|---|---|
| MacBook development | Offline reference, or direct OpenAI if policy permits | Local `.env` key or no key | Build and repeatable tests |
| Work laptop demo | Microsoft Foundry model deployment | Microsoft Entra ID / `az login` / approved identity | Leadership demonstration and acceptance |

The generated rule, deterministic validation, review artifact, approval gate, and PowerShell
deployment contract must be identical in both environments. Only the proposal-service adapter and
authentication method should change.

## Important current gap

The repository now includes an Azure Foundry proposal-provider path using
`DefaultAzureCredential`, but it has not yet been tested against your organization’s Foundry
endpoint, model deployment, network policy, or RBAC. Until that work-laptop test passes, treat the
repository as a development baseline rather than a completed workplace demo package.

## Work-laptop acceptance checklist

1. Confirm the work laptop allows Python 3.11–3.13, PowerShell 7.2+, and the Azure CLI.
2. Confirm the organization permits the required Python packages and the Foundry endpoint.
3. Create or identify the approved Foundry project and model deployment.
4. Assign the appropriate Foundry inference role to the user, group, service principal, or managed identity.
5. Sign in with the approved identity (`az login`, if permitted).
6. Configure the Foundry endpoint and deployment name through environment variables; never commit them as secrets.
7. Run the proposal connectivity check.
8. Run offline generation and validation.
9. Run Foundry-backed generation and compare the review artifact shape.
10. Run `python run.py doctor` and validate the PowerShell deployment preflight.
11. Demonstrate review with `REJECT`, then separately with `APPROVE` in the approved test subscription.

## What goes to GitHub

Commit source code, tests, documentation, ADRs, diagrams, `.env.example`, and safe scripts.

Do not commit `.env`, API keys, Azure tokens, generated deployment inputs, generated rule artifacts,
virtual environments, `node_modules`, or machine-specific absolute paths. Work-specific resource
groups, workspaces, subscriptions, Foundry endpoints, and deployment-script paths belong in the
work machine's environment configuration or an approved secret store.

## Release decision

Do not tag the repository as work-ready until the Foundry adapter and the work-laptop acceptance
checklist have both passed. The current V1 tag can represent the safe local baseline; the workplace
demo should be a follow-up release after Azure authentication is verified.
