# Forward Deployed Engineering Lab (`fde-lab`)

**Enterprise AI/DR Architectural Benchmark, Progressive RAG Document Assistant (`v1 → v3`), and Sentinel Use-Case Deployment (`v1` Baseline)**

---

## 1. Purpose and Scope

This repository hosts three complementary Forward Deployed Engineering (FDE) and security architecture artifacts:

| Component | Path | Maturity & Scope | Verification |
| :--- | :--- | :--- | :--- |
| **1. Enterprise AI/DR Architecture Benchmark** | [`microsoft_vs_crowdstrike_ai_dr_guide.md`](microsoft_vs_crowdstrike_ai_dr_guide.md) | **Technical Comparative Guide (491 lines)** evaluating Microsoft Defender XDR + Sentinel + Security Copilot vs. CrowdStrike Falcon + Charlotte AI. | Architectural trade-off matrices, TCO/ingestion models, and KQL/SPL query comparisons. |
| **2. Document Assistant Progression (`v1 → v3`)** | [`document-assistant/`](document-assistant/) | **3-Stage Applied AI Evolution:**<br>• `v1-retrieval`: Local TF-IDF baseline<br>• `v2-ai-assistant`: Basic OpenAI RAG + C4/ADRs<br>• `v3-enterprise-assistant`: Decoupled FastAPI backend + Streamlit UI + Docker + evaluation suite. | **32 automated `pytest` tests** across 9 test files in `v3-enterprise-assistant/tests/` + `ruff` lint + CI workflow. |
| **3. Sentinel Use-Case Deployment (`v1` Baseline)** | [`sentinel-usecase-deployment/`](sentinel-usecase-deployment/) | **Frozen V1 Prototype Snapshot (`2026-08-16`):** Single-pattern Entra ID password-spray KQL generator with human approval gate and `enabled = false` safety enforcement. | **28 automated `pytest` tests** across 5 test files in `sentinel-usecase-deployment/tests/` + `ruff` lint + CI workflow. |

> **Canonical Evolution Notice for Sentinel Use-Case Deployment:** The `sentinel-usecase-deployment/` directory in this repository is the frozen **V1 baseline** (supporting only a single Entra ID password-spray template via PowerShell deployment). Active development from **V2 through V3.4** (arbitrary natural-language requirements, live Log Analytics schema discovery, bounded historical backtesting, Python-native ARM REST deployment, Terraform export, and SHA-256 client readiness gates) lives in the standalone repository [**`ai-agent-usecase-deployment`**](https://github.com/86sunbot/portfolio/blob/main/ai-agents.md#1-ai-assisted-microsoft-sentinel-detection-engineering-agent-ai-agent-usecase-deployment-v34).

---

## 2. Highlighted Artifact: Enterprise AI/DR Benchmark

[**Read: `Enterprise AI/DR: Microsoft Security vs. CrowdStrike Falcon`**](microsoft_vs_crowdstrike_ai_dr_guide.md)

Evaluates enterprise security architecture decisions across:
1. **Telemetry & Data Lake Economics:** Sentinel Analytics/Basic/Auxiliary log tiers and Defender XDR native tables vs. CrowdStrike Falcon Next-Gen SIEM (LogScale) ingestion models.
2. **Identity & Lateral Movement Detection:** Microsoft Defender for Identity (MDI) + Entra ID Identity Protection vs. Falcon Identity Threat Protection.
3. **Agentic SecOps & Triage:** Microsoft Security Copilot & custom Foundry agents vs. CrowdStrike Charlotte AI.

---

## 3. Quick Start & Running the Test Suites

### A. Document Assistant v3 (`document-assistant/versions/v3-enterprise-assistant`)
```bash
cd document-assistant/versions/v3-enterprise-assistant
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
ruff check .
pytest -q
```

### B. Sentinel Use-Case Deployment v1 Baseline (`sentinel-usecase-deployment`)
```bash
cd sentinel-usecase-deployment
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check .
PYTHONPATH=src pytest -q tests
```

---

## 4. Tests and CI Coverage

Both Python modules in this repository are verified by [`.github/workflows/v3-ci.yml`](.github/workflows/v3-ci.yml):
- **`verify-document-assistant-v3`:** Runs `ruff check .`, **32 `pytest` unit/API/evaluation tests**, and `docker build`.
- **`verify-sentinel-usecase-v1`:** Runs `ruff check .` and **28 `pytest` tests** covering artifact generation, KQL validation, approval gates, and disabled-by-default (`enabled = false`) deployment rules.

---

## 5. Known Limitations

- `document-assistant/versions/v1-retrieval` and `v2-ai-assistant` are preserved as historical learning stages (validated manually with screenshots in `docs/images/`); automated testing begins in `v3-enterprise-assistant`.
- `sentinel-usecase-deployment/` is a frozen V1 snapshot limited to a single password-spray template; see [`ai-agent-usecase-deployment` (V3.4)](https://github.com/86sunbot/portfolio/blob/main/ai-agents.md#1-ai-assisted-microsoft-sentinel-detection-engineering-agent-ai-agent-usecase-deployment-v34) for the current multi-table platform.

---

## 6. Author & Attribution

- **Author:** Sharat P Surya (`Surya PS`), CISSP — [Portfolio Catalogue](https://github.com/86sunbot/portfolio)
