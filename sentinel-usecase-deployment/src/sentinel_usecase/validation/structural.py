import re

from sentinel_usecase.models import DetectionRule


class StructuralValidator:
    """Validate Sentinel shape and safe, self-contained KQL characteristics."""

    _FORBIDDEN_KQL = (
        r"(?im)^\s*\.(?:create|alter|drop|set|append|ingest)\b",
        r"(?i)\bexternaldata\s*\(",
    )
    _UNRESOLVED_PLACEHOLDER = re.compile(r"\{\{[^}]+}}|<[^>]+>|\$\{[^}]+}")

    def validate(self, rule: DetectionRule) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        if rule.enabled is not False:
            errors.append("new V1 rules must be disabled")

        if self._UNRESOLVED_PLACEHOLDER.search(rule.query):
            errors.append("query contains an unresolved placeholder")

        for pattern in self._FORBIDDEN_KQL:
            if re.search(pattern, rule.query):
                errors.append("query contains a disallowed management or external-data command")
                break

        for table in rule.required_tables:
            table_pattern = rf"(?<![A-Za-z0-9_]){re.escape(table)}(?![A-Za-z0-9_])"
            if re.search(table_pattern, rule.query) is None:
                errors.append(f"required table {table!r} is not referenced by the query")

        for field_requirement in rule.required_fields:
            for field in field_requirement.fields:
                if re.search(
                    rf"(?<![A-Za-z0-9_]){re.escape(field)}(?![A-Za-z0-9_])", rule.query
                ) is None:
                    errors.append(
                        f"required field {field_requirement.table}.{field} is not referenced "
                        "by the query"
                    )

        for mapping in rule.entity_mappings:
            for field_mapping in mapping.field_mappings:
                column = field_mapping.column_name
                if re.search(
                    rf"(?<![A-Za-z0-9_]){re.escape(column)}(?![A-Za-z0-9_])", rule.query
                ) is None:
                    errors.append(
                        f"entity-mapped column {column!r} is not emitted by the query"
                    )

        if "TimeGenerated" not in rule.query:
            warnings.append("query does not expose TimeGenerated for investigation context")

        return errors, warnings
