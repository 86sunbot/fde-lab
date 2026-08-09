# C4 Level 3 — Component View

## Purpose

This document describes the logical components inside Document Assistant V1.

## Component Flow

```text
PDF Document
     ↓
PDF Reader
     ↓
Text Extraction
     ↓
Text Chunker
     ↓
Document Chunks
     ↓
TF-IDF Vectorizer
     ↑
User Question
     ↓
Cosine Similarity
     ↓
Similarity Ranking
     ↓
Best Matching Chunk
     ↓
Streamlit Output
```

## Components

### Streamlit User Interface

Responsibilities:

- Display the application
- Accept the user's question
- Display the retrieved result

### PDF Reader

Responsibilities:

- Read the PDF document
- Extract text from PDF pages

### Text Chunker

Responsibilities:

- Divide extracted text into smaller searchable sections

### TF-IDF Vectorizer

Responsibilities:

- Convert document chunks into numerical vectors
- Convert the user question into the same vector representation

### Similarity Calculator

Technique:

Cosine Similarity

Responsibilities:

- Compare the user question with each document chunk
- Generate similarity scores

### Retriever

Responsibilities:

- Rank document chunks
- Select the highest-scoring chunk

### Response Renderer

Responsibilities:

- Display the retrieved document text through Streamlit

## Important V1 Boundary

V1 performs retrieval.

It does not generate new answers.

Therefore, V1 is not a RAG system and does not use Generative AI.