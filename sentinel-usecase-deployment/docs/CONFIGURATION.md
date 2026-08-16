# Configuration profiles

The application is designed to be platform-agnostic. macOS, Windows, and Linux use the same
Python entry point and the same workflow. Only the local shell, identity login, and deployment
script path differ.

## MacBook with OpenAI

```bash
cp .env.openai.example .env
```

Set `SENTINEL_OPENAI_API_KEY` only in the local `.env`; never commit that file. For repeatable
offline testing, leave the key blank and use `--offline-reference`.

## Work laptop with Microsoft Foundry

```powershell
Copy-Item .env.foundry.example .env
az login
az account show
```

If you have access to more than one Azure account or subscription, select the intended context
before running the application:

```powershell
az account list --output table
az account set --subscription <approved-subscription-id>
az account show
```

The application uses `DefaultAzureCredential` for the `azure_foundry` provider. This means the
same code can use Azure CLI credentials during development, a developer identity on a work laptop,
or a managed identity when hosted in Azure. No credential value belongs in GitHub.

## Azure lab credentials

You do not need to give credentials to the application developer or commit them to the repository.
Use whichever lab identity has the required permissions. Reusing one identity across the Mac and
work laptop is acceptable if company policy allows it, but keep Azure account context explicit and
verify it with `az account show` before deployment. Separate identities are preferable when your
organization requires stronger separation between development and work access.

## Cross-platform deployment

The Python application is operating-system agnostic. The existing deployment adapter invokes
PowerShell Core (`pwsh`), which is cross-platform. On a work Windows laptop, configure the script
path and executable for the approved installation. Do not assume a macOS absolute path exists on
Windows.

## Provider selection table

| Goal | `SENTINEL_LLM_PROVIDER` | Credential source |
|---|---|---|
| Mac development with direct OpenAI | `openai` | `SENTINEL_OPENAI_API_KEY` |
| Mac offline testing | no provider call | `--offline-reference` |
| Work laptop with Microsoft Foundry | `azure_foundry` | `DefaultAzureCredential` / Entra ID |
