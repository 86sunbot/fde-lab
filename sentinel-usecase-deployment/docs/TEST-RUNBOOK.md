# V1 test runbook

Run these steps from the repository root. The commands are safe until the explicit approval step.

## 1. Confirm the repository

```bash
pwd
test -f run.py
test -d src/sentinel_usecase
```

Expected: the current repository path is printed and both checks succeed silently.

## 2. Activate and install dependencies

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
```

Expected: the shell prompt includes `(.venv)` and installation completes without errors.

## 3. Run static checks

```bash
ruff check .
python -m compileall -q src
```

Expected: Ruff reports `All checks passed!`; compilation produces no output.

## 4. Run deployment preflight

```bash
python run.py doctor
```

Expected: configuration, PowerShell, and the deployment script are reported as ready. This does
not contact Azure and does not deploy anything.

## 5. Generate the offline reference rule

```bash
python run.py create "Create a password spray detection" --offline-reference
```

Expected: progress messages show proposal generation and validation, followed by `Validation:
passed`, `Enabled: false`, and a review-artifact path under `generated-rules/`.

## 6. Validate the artifact

```bash
ls -t generated-rules/*.json
python run.py validate generated-rules/<artifact-name>.json
```

Expected: the artifact revalidates successfully and the KQL is printed.

## 7. Test the rejection gate

```bash
python run.py review generated-rules/<artifact-name>.json
```

Enter a reviewer name and `REJECT` exactly. Expected: the rule is rejected and no deployment is
attempted.

## 8. Optional lab deployment test

Only run this when the target subscription, workspace, and PowerShell script are intentionally
configured for a test deployment:

```bash
python run.py review generated-rules/<artifact-name>.json
```

Enter a reviewer name and `APPROVE` exactly. Expected: the gateway performs a preview first,
then applies the approved disabled rule. The deployment-input files are written beneath
`generated-rules/deployment-input/`.

## 9. Work-laptop Foundry test

Use `.env.foundry.example` as the template, sign in with the approved Azure identity, select the
intended subscription, run `doctor`, and repeat step 5 without `--offline-reference`.

## 10. Record the run

Copy the command output into a local test note, but do not commit `.env`, credentials, generated
deployment inputs, or secrets. Keep only the final pass/fail summary and non-sensitive observations.
