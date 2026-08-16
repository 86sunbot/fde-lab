import re

from sentinel_usecase.models import DetectionRule


class PasswordSprayDetectionValidator:
    """Semantic checks that distinguish password spraying from merely valid KQL."""

    def validate(self, rule: DetectionRule) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []
        query = rule.query
        compact_query = re.sub(r"\s+", " ", query)
        parameters = rule.detection_parameters

        objective = f"{rule.display_name} {rule.detection_objective}".casefold()
        if "password" not in objective or "spray" not in objective:
            errors.append("detection objective does not explicitly identify password spraying")

        if "SigninLogs" not in rule.required_tables:
            errors.append("V1 password-spray detection requires the SigninLogs table")

        if re.search(r'(?i)\bwhere\s+ResultType\s*!=\s*["\']0["\']', compact_query) is None:
            errors.append('query must filter authentication failures with ResultType != "0"')

        if re.search(
            r"(?i)\bdcount\s*\(\s*UserPrincipalName\s*\)", compact_query
        ) is None:
            errors.append("query must count distinct target user accounts")

        if re.search(
            r"(?i)\bsummarize\b.+?\bby\b.+?(?:IPAddress|SourceIP)", compact_query
        ) is None:
            errors.append("query must group authentication failures by source IP")

        expected_lets = {
            "DetectionWindow": f"{parameters.detection_window_minutes}m",
            "MinimumDistinctAccounts": str(parameters.minimum_distinct_accounts),
            "MinimumFailedAttempts": str(parameters.minimum_failed_attempts),
        }
        for name, expected in expected_lets.items():
            match = re.search(
                rf"(?i)\blet\s+{name}\s*=\s*([A-Za-z0-9]+)\s*;", query
            )
            if match is None:
                errors.append(f"query must declare {name}")
            elif match.group(1).casefold() != expected.casefold():
                errors.append(
                    f"query {name}={match.group(1)!r} does not match typed value {expected!r}"
                )

        if re.search(r"(?i)\bago\s*\(\s*DetectionWindow\s*\)", query) is None:
            errors.append("query must apply DetectionWindow to TimeGenerated")

        if re.search(
            r"(?i)\bDistinctAccountCount\s*>=\s*MinimumDistinctAccounts\b", query
        ) is None:
            errors.append("query must enforce the distinct-account threshold")

        if re.search(
            r"(?i)\bFailedAttempts\s*>=\s*MinimumFailedAttempts\b", query
        ) is None:
            errors.append("query must enforce the failed-attempt threshold")

        if re.search(
            r"(?i)\bmv-expand\s+TargetAccount\s*=\s*TargetAccounts\s+to\s+typeof\s*\(\s*string\s*\)",
            compact_query,
        ) is None:
            errors.append("query must expand TargetAccounts into scalar TargetAccount values")

        assumptions = " ".join(rule.assumptions).casefold()
        surfaced_values = (
            (str(parameters.detection_window_minutes), "window"),
            (str(parameters.minimum_distinct_accounts), "account"),
            (str(parameters.minimum_failed_attempts), "fail"),
        )
        for value, context in surfaced_values:
            if value not in assumptions or context not in assumptions:
                errors.append(
                    f"assumptions must explicitly surface the {context} threshold value {value}"
                )

        if parameters.detection_window_minutes % 5 != 0:
            warnings.append("detection window is not aligned to a five-minute boundary")

        return errors, warnings
