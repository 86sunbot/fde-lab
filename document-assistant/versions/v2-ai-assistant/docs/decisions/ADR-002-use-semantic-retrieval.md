# ADR-002 — Use Embeddings for Semantic Retrieval

## Status

Accepted

## Context

Version 1 uses TF-IDF and cosine similarity to retrieve one document chunk.

TF-IDF measures similarity based primarily on shared words. An experiment showed
that a question using document terminology received a similarity score of 0.277
but returned an unrelated section. A paraphrased question received a lower score
of 0.097 but returned a more relevant section.

This demonstrates that lexical similarity scores do not reliably represent
semantic relevance or answer confidence.

## Decision

Version 2 will replace TF-IDF vectors with embedding vectors for document
retrieval.

The existing PDF extraction and text chunking behavior will initially remain
unchanged. Cosine similarity will continue to compare the question vector with
document chunk vectors.

This isolates the effect of changing the text representation from lexical
vectors to semantic vectors.

## Why

Embeddings represent aspects of meaning rather than relying only on exact word
overlap.

This should improve retrieval when a user's question and the relevant document
passage express similar ideas using different terminology.

## Consequences

### Benefits

- Better support for paraphrased questions
- Semantic rather than purely lexical retrieval
- Provides the retrieval foundation required for RAG

### Costs and limitations

- Requires an embedding model
- Introduces latency and possible API cost
- Embedding vectors are less interpretable than TF-IDF
- Retrieval quality still depends on chunk quality
- Vector similarity is not answer confidence

## Not Decided Here

This ADR does not select:

- A specific embedding model
- A specific vector database
- An LLM
- A prompt format

Those decisions will be made separately when each component is introduced.