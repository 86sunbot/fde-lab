import hashlib
from pathlib import Path

from pypdf import PdfReader

from app.errors import DocumentProcessingError


def validate_document_size(file_path: Path, max_document_bytes: int) -> None:
    """Reject missing or oversized documents before parsing or hashing them."""
    if not file_path.is_file():
        raise DocumentProcessingError(f"PDF not found: {file_path}")

    try:
        document_bytes = file_path.stat().st_size
    except OSError as error:
        raise DocumentProcessingError("The PDF size could not be inspected") from error

    if document_bytes > max_document_bytes:
        raise DocumentProcessingError(
            f"PDF exceeds MAX_DOCUMENT_BYTES ({max_document_bytes})"
        )


def load_pdf(
    file_path: Path,
    max_document_bytes: int = 20_000_000,
    max_document_pages: int = 200,
) -> str:
    """Extract text from a PDF while preserving simple page markers."""
    validate_document_size(file_path, max_document_bytes)

    try:
        reader = PdfReader(file_path)
    except Exception as error:
        raise DocumentProcessingError("The PDF could not be opened") from error

    if len(reader.pages) > max_document_pages:
        raise DocumentProcessingError(
            f"PDF exceeds MAX_DOCUMENT_PAGES ({max_document_pages})"
        )

    pages = []
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text()
        except Exception as error:
            raise DocumentProcessingError(
                f"Text extraction failed on page {page_number}"
            ) from error

        if text:
            pages.append(f"--- Page {page_number} ---\n{text}")

    full_text = "\n\n".join(pages)
    if not full_text.strip():
        raise DocumentProcessingError("The PDF contains no extractable text")

    return full_text


def document_fingerprint(
    file_path: Path,
    max_document_bytes: int = 20_000_000,
) -> str:
    """Return a stable content fingerprint used to invalidate a stale index."""
    validate_document_size(file_path, max_document_bytes)

    digest = hashlib.sha256()
    try:
        with file_path.open("rb") as document:
            for block in iter(lambda: document.read(1024 * 1024), b""):
                digest.update(block)
    except OSError as error:
        raise DocumentProcessingError("The PDF could not be fingerprinted") from error

    return digest.hexdigest()


def split_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
    """Create overlapping chunks while preferring paragraph and sentence boundaries."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")

    chunks: list[str] = []
    start = 0

    while start < len(text):
        hard_end = min(start + chunk_size, len(text))
        end = hard_end

        if hard_end < len(text):
            preferred_start = start + max(chunk_size // 2, 1)
            window = text[preferred_start:hard_end]
            paragraph_boundary = window.rfind("\n\n")
            sentence_boundary = max(
                window.rfind(". "),
                window.rfind("? "),
                window.rfind("! "),
            )
            line_boundary = window.rfind("\n")
            word_boundary = window.rfind(" ")
            best_boundary = next(
                (
                    boundary
                    for boundary in (
                        paragraph_boundary,
                        sentence_boundary,
                        line_boundary,
                        word_boundary,
                    )
                    if boundary >= 0
                ),
                -1,
            )
            if best_boundary >= 0:
                end = preferred_start + best_boundary + 1

        chunk = text[start:end].strip()
        if chunk.strip():
            chunks.append(chunk)

        if end >= len(text):
            break

        next_start = max(start + 1, end - overlap)
        aligned_start = next_start
        while aligned_start > start and not text[aligned_start - 1].isspace():
            aligned_start -= 1
        if aligned_start > start:
            next_start = aligned_start
        start = next_start

    return chunks
