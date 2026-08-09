import pytest

from app.services.document import split_text


def test_split_text_preserves_overlap() -> None:
    chunks = split_text("abcdefghij", chunk_size=4, overlap=1)

    assert chunks == ["abcd", "defg", "ghij", "j"]


@pytest.mark.parametrize(
    ("chunk_size", "overlap"),
    [(0, 0), (10, -1), (10, 10), (10, 11)],
)
def test_split_text_rejects_invalid_boundaries(chunk_size: int, overlap: int) -> None:
    with pytest.raises(ValueError):
        split_text("document", chunk_size=chunk_size, overlap=overlap)
