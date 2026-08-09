# C4 Level 1 — System Context

## Purpose

This document describes the high-level context of Document Assistant V1.

## System Overview

Document Assistant V1 allows a user to ask questions about a PDF document.

The application searches the document and returns the most relevant section of text.

```text
┌──────────────┐
│     User     │
└──────┬───────┘
       │
       │ Question
       ▼
┌────────────────────────┐
│   Document Assistant   │
│                        │
│  Retrieval-based       │
│  Document Search       │
└────────────┬───────────┘
             │
             │ Reads
             ▼
      ┌──────────────┐
      │ PDF Document │
      └──────────────┘
```

## User

The user:

- Interacts with the Streamlit application
- Asks questions about the document
- Receives the most relevant document content

## Document Assistant

The Document Assistant:

- Reads the PDF
- Extracts text
- Splits text into chunks
- Performs TF-IDF vectorization
- Calculates cosine similarity
- Finds the most relevant chunk
- Displays the result

## External Systems

V1 does not use any external AI system.

There is:

- No LLM
- No OpenAI API
- No vector database
- No external AI service

## Scope

V1 is a local learning prototype designed to demonstrate a basic document retrieval workflow.