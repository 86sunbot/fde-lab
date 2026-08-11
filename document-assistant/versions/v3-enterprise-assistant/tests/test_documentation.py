import re
from pathlib import Path
from urllib.parse import unquote

PROJECT_ROOT = Path(__file__).parents[1]
MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")

REQUIRED_DOCUMENTATION = [
    Path("README.md"),
    Path("VERSION"),
    Path("app/README.md"),
    Path("app/services/README.md"),
    Path("frontend/README.md"),
    Path("tests/README.md"),
    Path("evals/README.md"),
    Path("scripts/README.md"),
    Path("docs/README.md"),
    Path("docs/getting-started.md"),
    Path("docs/configuration.md"),
    Path("docs/development.md"),
    Path("docs/api.md"),
    Path("docs/security.md"),
    Path("docs/testing.md"),
    Path("docs/runbook.md"),
    Path("docs/troubleshooting.md"),
    Path("docs/reuse-blueprint.md"),
    Path("docs/glossary.md"),
    Path("docs/references.md"),
    Path("docs/concepts/README.md"),
    Path("docs/concepts/ai-foundations.md"),
    Path("docs/concepts/rag-pipeline.md"),
    Path("docs/concepts/production-engineering.md"),
    Path("docs/architecture/README.md"),
    Path("docs/architecture/c4-context.md"),
    Path("docs/architecture/c4-container.md"),
    Path("docs/architecture/c4-component.md"),
    Path("docs/architecture/c4-code.md"),
    Path("docs/architecture/request-lifecycle.md"),
    Path("docs/architecture/deployment.md"),
    Path("docs/decisions/README.md"),
    Path("docs/decisions/ADR-TEMPLATE.md"),
    Path("docs/test-results/README.md"),
]


def test_required_documentation_exists() -> None:
    missing = [
        str(path)
        for path in REQUIRED_DOCUMENTATION
        if not (PROJECT_ROOT / path).is_file()
    ]

    assert not missing, f"Missing required documentation: {missing}"


def test_local_markdown_links_resolve() -> None:
    broken: list[str] = []

    for markdown_file in PROJECT_ROOT.rglob("*.md"):
        if ".venv" in markdown_file.parts:
            continue

        text = markdown_file.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().strip("<>")
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue

            path_text = unquote(target.split("#", maxsplit=1)[0])
            if not path_text:
                continue

            resolved = (markdown_file.parent / path_text).resolve()
            if not resolved.exists():
                relative_file = markdown_file.relative_to(PROJECT_ROOT)
                broken.append(f"{relative_file}: {raw_target}")

    assert not broken, "Broken local Markdown links:\n" + "\n".join(broken)
