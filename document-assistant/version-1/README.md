# Document Assistant — Version 1

## Overview

Document Assistant V1 is a simple document retrieval application.

It allows a user to ask questions about a PDF document and retrieves the most relevant section from the document.

V1 does not use a Large Language Model (LLM), embeddings, vector database, or RAG.

The purpose of this version is to understand the fundamental document retrieval workflow before introducing Generative AI capabilities.

## Objective

Build the smallest working document assistant that can:

- Read a PDF
- Extract text
- Split the text into chunks
- Accept a user question
- Compare the question with document chunks
- Identify the most relevant chunk
- Display the retrieved content

## Architecture

```text
PDF Document
     ↓
Text Extraction
     ↓
Text Chunking
     ↓
TF-IDF Vectorization
     ↓
User Question
     ↓
Cosine Similarity
     ↓
Most Relevant Chunk
     ↓
Display Result
```

## Technologies Used

- Python
- Streamlit
- PyPDF
- Scikit-learn
- TF-IDF
- Cosine Similarity

Refer to `requirements.txt` for the actual Python dependencies.

## How It Works

1. The PDF document is read.
2. Text is extracted from the PDF.
3. The extracted text is divided into smaller chunks.
4. TF-IDF converts the chunks into numerical vectors.
5. The user's question is converted into the same vector space.
6. Cosine similarity compares the question with each document chunk.
7. The highest-scoring chunk is selected.
8. The matching document text is displayed to the user.

## Running the Application

Create a virtual environment:

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Run the application:

```bash
python3 -m streamlit run app.py
```

## V1 Scope

### Included

- PDF text extraction
- Text chunking
- TF-IDF
- Cosine similarity
- Document retrieval
- Streamlit interface

### Not Included

- LLM
- OpenAI API
- Generated answers
- Embeddings
- Vector database
- RAG
- Authentication
- Rate limiting
- Concurrency
- Production deployment
- Advanced observability

These capabilities can be introduced incrementally in future versions.

## Project Structure

```text
version-1/
├── .gitignore
├── README.md
├── VERSION
├── app.py
├── document.pdf
├── requirements.txt
│
└── docs/
    ├── architecture/
    │   ├── c4-context.md
    │   ├── c4-container.md
    │   └── c4-component.md
    │
    ├── decisions/
    │   └── ADR-001-v1-architecture.md
    │
    └── runbook.md
```

## Version

1.0.0