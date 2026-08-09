import os
from pathlib import Path

import streamlit as st
from openai import OpenAI, OpenAIError
from pypdf import PdfReader
from sklearn.metrics.pairwise import cosine_similarity


DOCUMENT_PATH = Path(__file__).with_name("document.pdf")
EMBEDDING_MODEL = "text-embedding-3-small"
GENERATION_MODEL = "gpt-5.6-terra"
TOP_K = 3


# ---------------------------------------------------
# 1. LOAD PDF (REUSED FROM V1)
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
# 2. SPLIT TEXT INTO CHUNKS (REUSED FROM V1)
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
# 3. CREATE THE IN-MEMORY VECTOR STORE
# ---------------------------------------------------

@st.cache_data(show_spinner=False)
def create_chunk_embeddings(chunks):
    """Turn every document chunk into an embedding vector once."""
    client = OpenAI()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=chunks,
    )

    ordered_embeddings = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in ordered_embeddings]


def build_vector_store(chunks):
    """Keep chunks and their vectors together for semantic search."""
    return {
        "chunks": chunks,
        "embeddings": create_chunk_embeddings(chunks),
    }


# ---------------------------------------------------
# 4. SEMANTIC SEARCH
# ---------------------------------------------------

def semantic_search(question, vector_store, top_k=TOP_K):
    client = OpenAI()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=question,
    )
    question_embedding = response.data[0].embedding

    similarities = cosine_similarity(
        [question_embedding],
        vector_store["embeddings"],
    )[0]

    number_of_results = min(top_k, len(vector_store["chunks"]))
    top_indices = similarities.argsort()[::-1][:number_of_results]

    return [
        {
            "source_number": position,
            "chunk_number": int(chunk_index) + 1,
            "text": vector_store["chunks"][chunk_index],
            "score": float(similarities[chunk_index]),
        }
        for position, chunk_index in enumerate(top_indices, start=1)
    ]


# ---------------------------------------------------
# 5. BUILD A GROUNDED RAG PROMPT
# ---------------------------------------------------

def build_prompt(question, search_results):
    sources = "\n\n".join(
        f"[Source {result['source_number']}]\n{result['text']}"
        for result in search_results
    )

    return f"""
Answer the question using only the document sources below.

Rules:
- Do not use outside knowledge.
- If the sources do not contain the answer, say: "I could not find that in the document."
- Give a concise answer in plain language.
- Cite supporting statements with source labels such as [Source 1].

Question:
{question}

Document sources:
{sources}
""".strip()


# ---------------------------------------------------
# 6. GENERATE THE ANSWER
# ---------------------------------------------------

def generate_answer(question, search_results):
    client = OpenAI()
    response = client.responses.create(
        model=GENERATION_MODEL,
        input=build_prompt(question, search_results),
    )
    return response.output_text


# ---------------------------------------------------
# 7. STREAMLIT USER INTERFACE
# ---------------------------------------------------

st.set_page_config(
    page_title="AI Document Assistant V2",
    page_icon="🤖",
)

st.title("AI Document Assistant V2")
st.write(
    "Ask a question about the PDF. The application retrieves semantically "
    "related passages and uses them to generate a grounded answer."
)

if not os.getenv("OPENAI_API_KEY"):
    st.error(
        "OPENAI_API_KEY is missing. Configure it in this terminal, then restart "
        "the Streamlit application."
    )
    st.stop()


# ---------------------------------------------------
# 8. LOAD AND EMBED THE DOCUMENT
# ---------------------------------------------------

try:
    document_text = load_pdf(DOCUMENT_PATH)

    if not document_text.strip():
        st.error("The PDF contains no extractable text.")
        st.stop()

    chunks = split_text(document_text)

    with st.spinner("Creating semantic search index..."):
        vector_store = build_vector_store(chunks)

    st.success(
        f"Document ready. {len(chunks)} chunks embedded and stored in memory."
    )

except FileNotFoundError:
    st.error(
        "document.pdf was not found. Place the PDF in the same folder as app.py."
    )
    st.stop()
except OpenAIError as error:
    st.error(f"OpenAI could not create the document embeddings: {error}")
    st.stop()
except Exception as error:
    st.error(f"The PDF could not be prepared: {error}")
    st.stop()


# ---------------------------------------------------
# 9. RETRIEVE CONTEXT AND GENERATE AN ANSWER
# ---------------------------------------------------

question = st.text_input("Ask a question about the document:")

if st.button("Generate Answer", type="primary"):
    if not question.strip():
        st.warning("Enter a question first.")
    else:
        try:
            with st.spinner("Retrieving evidence and generating an answer..."):
                search_results = semantic_search(question, vector_store)
                answer = generate_answer(question, search_results)

            st.subheader("Answer")
            st.write(answer)

            st.subheader("Supporting Sources")
            st.caption(
                "These are the document chunks retrieved before the answer was generated. "
                "Similarity is retrieval relevance, not answer confidence."
            )

            for result in search_results:
                label = (
                    f"Source {result['source_number']} · "
                    f"chunk {result['chunk_number']} · "
                    f"similarity {result['score']:.3f}"
                )
                with st.expander(label):
                    st.write(result["text"])

        except OpenAIError as error:
            st.error(f"OpenAI could not complete the request: {error}")
        except Exception as error:
            st.error(f"The question could not be processed: {error}")


# ---------------------------------------------------
# 10. LEARNING VIEW
# ---------------------------------------------------

with st.expander("How Version 2 works"):
    st.markdown(
        """
        1. Read the PDF and extract its text.
        2. Split the text into chunks, as Version 1 did.
        3. Convert each chunk into an embedding vector.
        4. Store the chunks and vectors together in memory.
        5. Convert the user's question into an embedding.
        6. Retrieve the three chunks with the highest cosine similarity.
        7. Build a prompt containing only the question and retrieved chunks.
        8. Ask the LLM to generate a cited answer from that evidence.

        **The architectural change:** Version 1 returned one lexically similar
        chunk. Version 2 retrieves passages by meaning and gives those passages
        to an LLM. That retrieval-plus-generation pattern is RAG.
        """
    )
