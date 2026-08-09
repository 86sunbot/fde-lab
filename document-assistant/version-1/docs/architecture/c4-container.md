# C4 Level 2 — Container View

## Purpose

This document describes the main technical building blocks of Document Assistant V1.

## Architecture

```text
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│   Streamlit App     │
│      app.py         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Document Processing │
│                     │
│ PDF → Text          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Retrieval Processing│
│                     │
│ Chunking            │
│ TF-IDF              │
│ Cosine Similarity   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Most Relevant Chunk │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Streamlit Output    │
└─────────────────────┘
```

## Streamlit Application

Responsibilities:

- Provide the user interface
- Accept the user's question
- Coordinate document processing
- Display the retrieved result

## Document Processing

Responsibilities:

- Read the PDF
- Extract textual content
- Prepare the document for retrieval

## Retrieval Processing

Responsibilities:

- Split text into chunks
- Create TF-IDF vectors
- Compare the user question with document chunks
- Calculate cosine similarity
- Identify the highest-scoring chunk

## Result

The most relevant document chunk is displayed to the user.

## V1 Design Decision

All functionality is intentionally kept inside a simple local Python application.

Separate APIs, databases, microservices, and AI models are not required for V1.