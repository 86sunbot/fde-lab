import streamlit as st
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ---------------------------------------------------
# 1. LOAD PDF
# ---------------------------------------------------

def load_pdf(file_path):
    reader = PdfReader(file_path)

    full_text = ""

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()

        if text:
            full_text += f"\n--- Page {page_number} ---\n"
            full_text += text

    return full_text


# ---------------------------------------------------
# 2. SPLIT TEXT INTO CHUNKS
# ---------------------------------------------------

def split_text(text, chunk_size=1200, overlap=200):
    chunks = []

    start = 0

    while start < len(text):
        end = start + chunk_size

        chunk = text[start:end]

        chunks.append(chunk)

        start = end - overlap

    return chunks


# ---------------------------------------------------
# 3. SEARCH THE DOCUMENT
# ---------------------------------------------------

def search_document(question, chunks):

    # Add the user question to the document chunks
    documents = chunks + [question]

    # Convert text into numerical vectors
    vectorizer = TfidfVectorizer(
        stop_words="english"
    )

    vectors = vectorizer.fit_transform(documents)

    # Last vector belongs to user question
    question_vector = vectors[-1]

    # Remaining vectors belong to document chunks
    document_vectors = vectors[:-1]

    # Compare question with all chunks
    similarities = cosine_similarity(
        question_vector,
        document_vectors
    )[0]

    # Find highest matching chunk
    best_index = similarities.argmax()

    best_score = similarities[best_index]

    return chunks[best_index], best_score


# ---------------------------------------------------
# 4. STREAMLIT USER INTERFACE
# ---------------------------------------------------

st.set_page_config(
    page_title="Document Assistant V1",
    page_icon="📄"
)

st.title("Document Assistant V1")

st.write(
    "Ask a question and the application will search "
    "the PDF and return the most relevant section."
)


# ---------------------------------------------------
# 5. LOAD DOCUMENT
# ---------------------------------------------------

try:

    document_text = load_pdf("document.pdf")

    chunks = split_text(document_text)

    st.success(
        f"Document loaded successfully. "
        f"{len(chunks)} searchable chunks created."
    )

except FileNotFoundError:

    st.error(
        "document.pdf was not found. "
        "Place the PDF in the same folder as app.py."
    )

    st.stop()


# ---------------------------------------------------
# 6. USER QUESTION
# ---------------------------------------------------

question = st.text_input(
    "Ask a question about the document:"
)


# ---------------------------------------------------
# 7. SEARCH
# ---------------------------------------------------

if st.button("Search"):

    if not question.strip():

        st.warning(
            "Enter a question first."
        )

    else:

        result, score = search_document(
            question,
            chunks
        )

        st.subheader(
            "Most Relevant Section"
        )

        st.write(result)

        st.caption(
            f"Similarity score: {score:.3f}"
        )


# ---------------------------------------------------
# 8. OPTIONAL DEBUG INFORMATION
# ---------------------------------------------------

with st.expander("How this works"):

    st.write(
        """
        1. Read the PDF.
        2. Extract the text.
        3. Split the text into smaller chunks.
        4. Convert the chunks and question into TF-IDF vectors.
        5. Compare the question against every chunk.
        6. Return the chunk with the highest similarity.
        """
    )