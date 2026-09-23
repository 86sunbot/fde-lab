# Streamlit Frontend

The frontend is a thin human-facing client of the V3 API. It does not parse PDFs, create
embeddings, search vectors, build prompts, or call OpenAI.

It owns:

- question input and basic client-side feedback;
- API readiness display;
- sending the application bearer key to the backend;
- rendering answers, request IDs, similarity values, and source text;
- friendly handling of timeout, authentication, rate-limit, and connectivity errors.

It does not provide secure browser-based authentication. The local Streamlit process
reads the shared `APP_API_KEY` from the environment and calls the backend server-to-server.
A public multi-user deployment needs a real identity design before this pattern is used.

Start it only after the API is ready:

```bash
python3 -m streamlit run frontend/streamlit_app.py
```

See `docs/api.md` for the contract and `docs/security.md` for the trust boundary.
