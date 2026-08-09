from pathlib import Path

from pypdf import PdfReader

from app.errors import DocumentProcessingError


def load_pdf(file_path: Path) -> str:
    """Extract text from a PDF while preserving simple page markers."""
    if not file_path.is_file():
        raise DocumentProcessingError(f"PDF not found: {file_path}")

    try:
        reader = PdfReader(file_path)
    except Exception as error:
        raise DocumentProcessingError("The PDF could not be opened") from error

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


def split_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> list[str]:
    """Split text using V2's fixed-size overlapping character strategy."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be non-negative and smaller than chunk_size")

    chunks = []
    start = 0

    while start < len(text):
        chunk = text[start : start + chunk_size]
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap

    return chunks
