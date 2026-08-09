# AI Document Assistant V2 — Runbook

## Purpose

This runbook explains how to install, run, stop, and troubleshoot Version 2.

## Prerequisites

- Python 3.9 or newer
- An OpenAI API key with available credits
- A text-based PDF named `document.pdf` in the same directory as `app.py`

## Setup

Run these commands from `versions/v2-ai-assistant`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

Configure the API key without storing it in source code:

```bash
read -s "OPENAI_API_KEY?Paste your OpenAI API key: "
export OPENAI_API_KEY
```

Confirm that the current terminal has the variable:

```bash
python3 -c "import os; print('API key configured' if os.getenv('OPENAI_API_KEY') else 'API key missing')"
```

Never print the key itself.

## Start

```bash
python3 -m streamlit run app.py
```

Open `http://localhost:8501` if the browser does not open automatically.

On the first run, the app extracts the PDF, creates chunk embeddings, and
stores them in Streamlit's local cache. This uses the OpenAI API. Rerunning the
same app with the same chunks should reuse the cached document embeddings.

## Use

1. Wait for `Document ready`.
2. Enter a question whose answer should be in the PDF.
3. Select **Generate Answer**.
4. Read the generated answer and its `[Source N]` citations.
5. Expand **Supporting Sources** to inspect the retrieved evidence.

Also test a question that the PDF does not answer. The expected answer is:

```text
I could not find that in the document.
```

## Stop

Press `Ctrl+C` in the terminal running Streamlit.

## Troubleshooting

### The page still says Version 1

Stop the old process with `Ctrl+C`, change to `versions/v2-ai-assistant`, and
start `app.py` again. Refresh the browser after Streamlit starts.

### `File does not exist: app.py`

The command was run from the repository root. Change to the V2 directory first,
or pass the full V2 path to Streamlit.

### `OPENAI_API_KEY is missing`

Configure and export the key in the same terminal that starts Streamlit. A new
terminal does not automatically inherit a variable created in an old terminal.

### `429` or `insufficient_quota`

The API account has no usable credits or has reached a limit. Check API billing
and usage, then retry after credits are available.

### Blank page

Look at the terminal running Streamlit for an exception. Stop the server,
restart it from the V2 directory, and hard-refresh the browser.

### The answer is unsupported or incorrect

Inspect the three supporting sources:

- If the correct evidence was not retrieved, the problem is retrieval or chunking.
- If the evidence was retrieved but the answer ignored it, the problem is generation or prompting.
- If the evidence is not in the PDF, the document cannot support the answer.

This separation is a central RAG troubleshooting technique.

## Operational Boundaries

Version 2 has no authentication, rate limiting, concurrency controls,
persistent vector database, production telemetry, or deployment automation.
Those are Version 3 concerns.
