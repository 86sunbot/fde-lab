# C4 Level 3 — Component View

## Component Flow

```text
document.pdf
    ↓
PDF Reader → Text Chunker
                 ↓
         Embedding Creator ──────► OpenAI Embeddings API
                 ↓
         In-Memory Vector Store
                 ↑
User Question → Question Embedding
                 ↓
        Cosine Similarity Retriever
                 ↓ top 3 chunks
           Grounded Prompt Builder
                 ↓
          Answer Generator ───────► OpenAI Responses API
                 ↓
      Answer + Supporting Sources
```

## Components

### Streamlit UI

Accepts a question and displays status, answer, citations, retrieved chunks, and
similarity scores.

### PDF Reader

Extracts text from every readable PDF page and preserves page markers.

### Text Chunker

Reuses V1's fixed-size, overlapping character chunks. Keeping this unchanged
isolates the effect of the new semantic retrieval method.

### Embedding Creator

Uses `text-embedding-3-small` to represent chunks and questions as numeric
vectors. Document embeddings are cached to avoid repeating them on every UI
interaction.

### In-Memory Vector Store

Keeps each chunk beside its embedding. It is a Python dictionary, not an
external vector database.

### Semantic Retriever

Calculates cosine similarity and returns the three highest-ranked chunks.

### Prompt Builder

Labels retrieved chunks as sources and instructs the model to answer only from
those sources, cite them, and admit when the answer is absent.

### Answer Generator

Uses the OpenAI Responses API with `gpt-5.6-terra` to generate the final answer.

## V1-to-V2 Continuity

PDF reading, chunking, cosine similarity, and Streamlit remain. TF-IDF vectors
are replaced by embeddings; top-k evidence, prompt construction, and LLM
generation are added.
