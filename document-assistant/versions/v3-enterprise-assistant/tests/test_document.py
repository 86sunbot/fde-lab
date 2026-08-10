import pytest
from pypdf import PdfWriter

from app.errors import DocumentProcessingError
from app.services.document import document_fingerprint, load_pdf, split_text


def test_split_text_preserves_overlap() -> None:
    chunks = split_text("abcdefghij", chunk_size=4, overlap=1)

    assert chunks == ["abcd", "defg", "ghij"]


def test_split_text_prefers_sentence_boundaries() -> None:
    text = "First sentence ends here. Second sentence has more detail. Final sentence."

    chunks = split_text(text, chunk_size=45, overlap=8)

    assert chunks[0].endswith("here.")
    assert "here." in chunks[1]
    assert all(len(chunk) <= 45 for chunk in chunks)


def test_document_fingerprint_changes_with_content(tmp_path) -> None:
    document = tmp_path / "document.pdf"
    document.write_bytes(b"first version")
    first = document_fingerprint(document)

    document.write_bytes(b"second version")
    second = document_fingerprint(document)

    assert first != second


def test_load_pdf_rejects_oversized_document(tmp_path) -> None:
    document = tmp_path / "large.pdf"
    document.write_bytes(b"larger than the configured limit")

    with pytest.raises(DocumentProcessingError, match="MAX_DOCUMENT_BYTES"):
        load_pdf(document, max_document_bytes=10)


def test_load_pdf_rejects_too_many_pages(tmp_path) -> None:
    document = tmp_path / "many-pages.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_blank_page(width=100, height=100)
    with document.open("wb") as output:
        writer.write(output)

    with pytest.raises(DocumentProcessingError, match="MAX_DOCUMENT_PAGES"):
        load_pdf(document, max_document_pages=1)


@pytest.mark.parametrize(
    ("chunk_size", "overlap"),
    [(0, 0), (10, -1), (10, 10), (10, 11)],
)
def test_split_text_rejects_invalid_boundaries(chunk_size: int, overlap: int) -> None:
    with pytest.raises(ValueError):
        split_text("document", chunk_size=chunk_size, overlap=overlap)
