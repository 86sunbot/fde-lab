Document Assistant — Version 1
Overview
Document Assistant V1 is a simple document retrieval application.

It allows a user to ask questions about a PDF document and retrieves the most relevant section from the document.

V1 does not use a Large Language Model (LLM), embeddings, vector database, or RAG.

The purpose of this version is to understand the fundamental document retrieval workflow before introducing Generative AI capabilities.

Objective
Build the smallest working document assistant that can:

Read a PDF
Extract text
Split the text into chunks
Accept a user question
Compare the question with document chunks
Identify the most relevant chunk
Display the retrieved content
Architecture
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
Technologies Used
Python
Streamlit
PyPDF
Scikit-learn
TF-IDF
Cosine Similarity
Refer to requirements.txt for the actual Python dependencies.

How It Works
The PDF document is read.
Text is extracted from the PDF.
The extracted text is divided into smaller chunks.
TF-IDF converts the chunks into numerical vectors.
The user's question is converted into the same vector space.
Cosine similarity compares the question with each document chunk.
The highest-scoring chunk is selected.
The matching document text is displayed to the user.
Running the Application
Create a virtual environment:

python3 -m venv .venv
Activate it:

source .venv/bin/activate
Install dependencies:

python3 -m pip install -r requirements.txt
Run the application:

python3 -m streamlit run app.py
V1 Scope
Included
PDF text extraction
Text chunking
TF-IDF
Cosine similarity
Document retrieval
Streamlit interface
Not Included
LLM
OpenAI API
Generated answers
Embeddings
Vector database
RAG
Authentication
Rate limiting
Concurrency
Production deployment
Advanced observability
These capabilities can be introduced incrementally in future versions.

Manual Validation Evidence

The V1 retrieval tests, screenshots, and findings are recorded in
`docs/test-results/v1-retrieval-manual-validation.md`.

Project Structure
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
    ├── test-results/
    │   └── v1-retrieval-manual-validation.md
    │
    └── runbook.md
Version
1.0.0
