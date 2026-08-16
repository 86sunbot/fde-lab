from sentinel_usecase.models import DetectionRule, ValidationState
from sentinel_usecase.validation import RuleValidator


def _replace_query(rule: DetectionRule, query: str) -> DetectionRule:
    payload = rule.model_dump(mode="python")
    payload["query"] = query
    return DetectionRule.model_validate(payload)


def test_reference_rule_passes_both_validation_layers(valid_rule: DetectionRule) -> None:
    assert valid_rule.validation_status.state is ValidationState.PASSED
    assert valid_rule.validation_status.structural_errors == ()
    assert valid_rule.validation_status.detection_errors == ()


def test_syntactically_plausible_query_is_not_automatically_valid(
    valid_rule: DetectionRule,
) -> None:
    query = """SigninLogs
| where TimeGenerated > ago(15m)
| where ResultType != "0"
| project TimeGenerated, SourceIP = IPAddress, TargetAccount = UserPrincipalName"""
    invalid_rule = _replace_query(valid_rule, query)
    validated = RuleValidator().validate(invalid_rule)
    assert validated.validation_status.state is ValidationState.FAILED
    assert any(
        "distinct target" in error
        for error in validated.validation_status.detection_errors
    )


def test_threshold_mismatch_is_rejected(valid_rule: DetectionRule) -> None:
    invalid_rule = _replace_query(
        valid_rule,
        valid_rule.query.replace("MinimumDistinctAccounts = 10", "MinimumDistinctAccounts = 50"),
    )
    validated = RuleValidator().validate(invalid_rule)
    assert validated.validation_status.state is ValidationState.FAILED
    assert any(
        "does not match typed value" in error
        for error in validated.validation_status.detection_errors
    )


def test_missing_required_field_reference_fails_structural_validation(
    valid_rule: DetectionRule,
) -> None:
    invalid_rule = _replace_query(
        valid_rule,
        valid_rule.query.replace("ResultType", "FailureCode"),
    )
    validated = RuleValidator().validate(invalid_rule)
    assert any(
        "SigninLogs.ResultType" in error
        for error in validated.validation_status.structural_errors
    )
