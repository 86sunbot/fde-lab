from sentinel_usecase.errors import RuleValidationError
from sentinel_usecase.models import DetectionRule, ValidationState, ValidationStatus
from sentinel_usecase.validation.detection import PasswordSprayDetectionValidator
from sentinel_usecase.validation.structural import StructuralValidator


class ValidationReport(ValidationStatus):
    @property
    def passed(self) -> bool:
        return self.state is ValidationState.PASSED


class RuleValidator:
    """Run independent structural and detection-specific validators."""

    def __init__(self) -> None:
        self._structural = StructuralValidator()
        self._detection = PasswordSprayDetectionValidator()

    def validate(self, rule: DetectionRule) -> DetectionRule:
        structural_errors, structural_warnings = self._structural.validate(rule)
        detection_errors, detection_warnings = self._detection.validate(rule)
        passed = not structural_errors and not detection_errors
        status = ValidationStatus(
            state=ValidationState.PASSED if passed else ValidationState.FAILED,
            structural_errors=tuple(structural_errors),
            detection_errors=tuple(detection_errors),
            warnings=tuple(structural_warnings + detection_warnings),
        )
        payload = rule.model_dump(mode="python")
        payload["validation_status"] = status
        return DetectionRule.model_validate(payload)

    def validate_or_raise(self, rule: DetectionRule) -> DetectionRule:
        validated = self.validate(rule)
        if validated.validation_status.state is ValidationState.FAILED:
            issues = (
                *validated.validation_status.structural_errors,
                *validated.validation_status.detection_errors,
            )
            raise RuleValidationError("; ".join(issues))
        return validated
