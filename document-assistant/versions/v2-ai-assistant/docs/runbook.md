# Document Assistant V1 — Runbook

## Purpose

This runbook explains how to install, run, stop, and troubleshoot Document Assistant V1.

## Prerequisites

Required:

- Python 3
- pip
- Project source code

No LLM API key is required for V1.

## Setup

### Create Virtual Environment

```bash
python3 -m venv .venv
```

### Activate Virtual Environment

```bash
source .venv/bin/activate
```

### Install Dependencies

```bash
python3 -m pip install -r requirements.txt
```

## Start Application

```bash
python3 -m streamlit run app.py
```

Streamlit should open the application in the browser.

The default local URL is usually:

```text
http://localhost:8501
```

## Using the Application

1. Start the application.
2. Enter a question related to the PDF document.
3. Submit the question.
4. The application compares the question with document chunks.
5. The most relevant document text is displayed.

## Stop Application

Press:

```text
Ctrl + C
```

in the terminal.

## Troubleshooting

### pip command not found

Use:

```bash
python3 -m pip install -r requirements.txt
```

### streamlit command not found

Use:

```bash
python3 -m streamlit run app.py
```

### Virtual environment not active

Run:

```bash
source .venv/bin/activate
```

### Missing Python package

Run:

```bash
python3 -m pip install -r requirements.txt
```

### Irrelevant Search Result

V1 uses TF-IDF and cosine similarity.

Try asking the question using terminology similar to the words used in the PDF.

## Known Limitations

V1 does not include:

- LLM
- Semantic embeddings
- Generated answers
- RAG
- Vector database
- Authentication
- Rate limiting
- Concurrency controls
- Production monitoring