import argparse
import asyncio
import sys
from pathlib import Path

from sentinel_usecase.agent import OpenAIRuleProposer, ReferencePasswordSprayProposer
from sentinel_usecase.config import Settings
from sentinel_usecase.deployment import (
    DeploymentTarget,
    PowerShellCsvDeploymentGateway,
    load_artifact,
    write_artifact,
)
from sentinel_usecase.errors import SentinelUseCaseError
from sentinel_usecase.models import (
    ApprovalDecision,
    DetectionRequest,
    HumanApproval,
    ValidationState,
)
from sentinel_usecase.validation import RuleValidator
from sentinel_usecase.workflow import UseCaseWorkflow


def _progress(message: str) -> None:
    print(f"[sentinel-usecase] {message}", flush=True)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sentinel-usecase",
        description="Generate, validate, review, and safely gate Sentinel scheduled rules.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser("create", help="generate and validate a rule proposal")
    create.add_argument("requirement", help='for example: "Create a password spray detection"')
    create.add_argument(
        "--offline-reference",
        action="store_true",
        help="use the deterministic reference proposal instead of an LLM (demo/testing only)",
    )
    create.add_argument("--output-dir", type=Path, default=Path("generated-rules"))

    review = subparsers.add_parser("review", help="review a saved rule and approve or reject")
    review.add_argument("artifact", type=Path)
    review.add_argument("--reviewer", help="reviewer name; prompted if omitted")

    validate = subparsers.add_parser("validate", help="revalidate a saved rule artifact")
    validate.add_argument("artifact", type=Path)

    subparsers.add_parser(
        "doctor",
        help="check deployment configuration without contacting Azure or deploying",
    )
    return parser


def _print_rule(rule: object) -> None:
    from sentinel_usecase.models import DetectionRule

    if not isinstance(rule, DetectionRule):
        return
    print(f"\nRule: {rule.display_name}")
    print(f"Severity: {rule.severity}")
    print(f"Enabled: {str(rule.enabled).lower()}")
    print(f"Validation: {rule.validation_status.state.value}")
    print("\nAssumptions:")
    for assumption in rule.assumptions:
        print(f"  - {assumption}")
    print("\nPotential false positives:")
    for false_positive in rule.potential_false_positives:
        print(f"  - {false_positive}")
    print("\nKQL:\n")
    print(rule.query)


async def _create(args: argparse.Namespace, settings: Settings) -> int:
    mode = "offline reference" if args.offline_reference else "OpenAI structured proposal"
    _progress(f"1/4 Selecting proposal mode: {mode}.")
    proposer = (
        ReferencePasswordSprayProposer()
        if args.offline_reference
        else OpenAIRuleProposer(settings)
    )
    workflow = UseCaseWorkflow(proposer)
    try:
        _progress("2/4 Generating a typed proposal and running deterministic validation.")
        if args.offline_reference:
            _progress("Offline mode selected: using the built-in password-spray reference fixture.")
        else:
            _progress("Waiting for the proposal service; this may take a few seconds.")
        request = DetectionRequest(requirement=args.requirement)
        rule = await workflow.generate(request)
        _progress("Proposal received; deterministic validation is complete.")
    finally:
        close = getattr(proposer, "close", None)
        if close is not None:
            await close()

    _print_rule(rule)
    if rule.validation_status.state is not ValidationState.PASSED:
        _progress("Validation failed; no review artifact was written.")
        print("\nRule was not saved because deterministic validation failed.", file=sys.stderr)
        for issue in (
            *rule.validation_status.structural_errors,
            *rule.validation_status.detection_errors,
        ):
            print(f"  - {issue}", file=sys.stderr)
        return 2

    target = DeploymentTarget(
        resource_group=settings.resource_group,
        workspace=settings.workspace,
    )
    _progress("3/4 Validation passed; writing the typed review artifact.")
    _, path = write_artifact(rule, target, args.output_dir)
    _progress("4/4 Complete; no deployment was attempted.")
    print(f"\nReview artifact: {path.resolve()}")
    print("No deployment was attempted. Run the review command for an explicit decision.")
    return 0


async def _review(args: argparse.Namespace, settings: Settings) -> int:
    _progress("1/4 Loading the typed review artifact.")
    artifact = load_artifact(args.artifact)
    validator = RuleValidator()
    _progress("2/4 Re-running deterministic validation immediately before review.")
    rule = validator.validate(artifact.rule)
    _print_rule(rule)
    if rule.validation_status.state is not ValidationState.PASSED:
        print("\nREJECTED automatically: deterministic validation failed.", file=sys.stderr)
        return 2

    reviewer = (args.reviewer or input("\nReviewer name: ")).strip()
    decision_text = input('Type exactly "APPROVE" or "REJECT": ').strip().upper()
    try:
        decision = ApprovalDecision(decision_text)
        approval = HumanApproval(decision=decision, reviewer=reviewer)
    except ValueError:
        print("Invalid review response; deployment remains blocked.", file=sys.stderr)
        return 2

    if approval.decision is ApprovalDecision.REJECT:
        _progress("3/4 Review rejected; deployment was not attempted.")
        print("Rule rejected. No deployment was attempted.")
        return 0

    _progress("3/4 Approval accepted; validating deployment prerequisites.")
    workflow = UseCaseWorkflow(ReferencePasswordSprayProposer(), validator)
    gateway = PowerShellCsvDeploymentGateway(
        script_path=settings.deployment_script,
        subscription_id=settings.require_deployment_subscription(),
        powershell_executable=settings.powershell_executable,
        managed_identity=settings.managed_identity,
        output_directory=args.artifact.parent,
    )
    result = await workflow.deploy(
        rule,
        approval,
        gateway,
        artifact.target,
        rule_id=artifact.rule_id,
    )
    _progress("4/4 Deployment gateway completed.")
    print(result.message)
    return 0


def _validate(args: argparse.Namespace) -> int:
    artifact = load_artifact(args.artifact)
    rule = RuleValidator().validate(artifact.rule)
    _print_rule(rule)
    return 0 if rule.validation_status.state is ValidationState.PASSED else 2


def _doctor(settings: Settings) -> int:
    print(f"Target: {settings.resource_group}/{settings.workspace}")
    print(f"Deployment script: {settings.deployment_script}")
    print(f"PowerShell: {settings.powershell_executable}")
    errors = settings.deployment_preflight_errors()
    if errors:
        print("Deployment preflight: FAILED")
        for error in errors:
            print(f"  - {error}")
        return 2
    print("Deployment preflight: READY")
    return 0


async def _run(args: argparse.Namespace) -> int:
    settings = Settings()
    if args.command == "create":
        return await _create(args, settings)
    if args.command == "review":
        return await _review(args, settings)
    if args.command == "validate":
        return _validate(args)
    if args.command == "doctor":
        return _doctor(settings)
    return 2


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    try:
        exit_code = asyncio.run(_run(args))
    except (SentinelUseCaseError, OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        exit_code = 2
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
