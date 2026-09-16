# AI Foundations for This Project

## Purpose

This guide defines the AI concepts used by the Document Assistant without
assuming previous machine-learning knowledge. Each concept is connected to the
actual V1 -> V2 -> V3 evolution.

## Start With the Problem

A PDF is too large to place blindly into every model request. The assistant
must first identify the small parts of the document that are likely to answer a
question. Only then should it ask a language model to write an answer.

This creates two separate problems:

1. **Retrieval:** find the best evidence.
2. **Generation:** explain that evidence as an answer.

RAG combines those two steps.

## Artificial Intelligence, Machine Learning, and LLMs

### Artificial intelligence

AI is the broad category of systems that perform tasks associated with human
intelligence, such as understanding language, recognizing patterns, planning,
or generating content.

### Machine learning

Machine learning is one way to build AI systems. Instead of writing every rule
manually, a model learns patterns from data.

### Large language model

A large language model (LLM) predicts and generates language based on patterns
learned during training. In this project the LLM is used only after retrieval.
It is the writer, not the source of truth.

Important: fluent language does not prove factual support. That is why the
project retrieves evidence, applies a grounding policy, and shows sources.

## Text Extraction

The model cannot directly search a PDF file structure. `pypdf` extracts the
text from each page and adds page markers.

```text
document.pdf
  -> page 1 text
  -> page 2 text
  -> ...
  -> one bounded text corpus
```

Current limitation: scanned images have no extractable text unless an OCR step
is added.

## Chunking

A chunk is a smaller passage cut from the extracted document.

Why chunks exist:

- retrieval works better on focused passages than on an entire book;
- embedding and model requests have size and cost constraints;
- small sources are easier for a user to inspect;
- the prompt should include only relevant evidence.

V3 prefers paragraph, sentence, line, and word boundaries before making a hard
character cut. Consecutive chunks overlap so an idea near one boundary also
appears in the next retrieval unit.

### Chunk-size trade-off

| Smaller chunks | Larger chunks |
| --- | --- |
| More focused matches | More surrounding context |
| More embeddings and index entries | Fewer index entries |
| Greater risk of losing context | Greater risk of mixing unrelated ideas |

There is no universally correct chunk size. It is a retrieval hypothesis that
must be evaluated against representative questions.

## Tokens

A token is a unit a language model processes. It is not exactly a word: a word
may be one token or several tokens, and punctuation can also consume tokens.

This implementation chunks by characters for transparency. It is deliberately
not tokenizer-aware. That is acceptable for the learning scope but should be
revisited if model-context or cost measurements show a problem.

## TF-IDF: the V1 Representation

TF-IDF represents a document passage using the importance of its words.

- term frequency asks how often a word appears in a passage;
- inverse document frequency reduces the importance of words that appear
  everywhere;
- the result is a sparse vector associated with literal vocabulary.

TF-IDF is understandable and useful, but it depends heavily on shared words.
“Lateral movement” and “spreading from one system to another” may express the
same idea with little lexical overlap.

## Embeddings: the V2 Representation

An embedding converts text into a numeric vector:

```text
"detect lateral movement"
  -> [0.0084, 0.0050, 0.0452, ...]
```

The individual numbers are not human-readable features. Their useful property
is geometric: semantically related text tends to occupy related regions of the
embedding space.

The project uses embeddings for:

- every document chunk during index creation;
- every user question during retrieval.

The same embedding model must be used for both sides of the comparison.

## Vector

A vector is simply an ordered list of numbers. In this project a vector is the
machine-readable representation of a chunk or question.

Do not confuse:

- vector: one numeric representation;
- vector store: the component holding many vectors and their source text;
- vector database: a product designed to store and search vectors, often across
  machines and large datasets.

V3 has a transparent local vector store, not a managed vector database.

## Cosine Similarity

Cosine similarity compares the direction of two vectors.

Conceptually:

```text
question vector
      \ small angle -> more related
       \________________ chunk vector
```

A higher score usually indicates greater semantic relatedness for this search.
It does not mean:

- probability that the answer is correct;
- confidence that the model will not hallucinate;
- proof that the passage fully answers the question.

Similarity is a retrieval signal, not answer confidence.

## Semantic Search

Semantic search retrieves by meaning rather than relying only on exact word
overlap.

```text
question
  -> question embedding
  -> compare with stored chunk embeddings
  -> rank related chunks
```

Semantic search solves the paraphrase limitation visible in V1, but it is still
imperfect. Similar topics can be retrieved even when a passage does not contain
the exact answer.

## Candidate Retrieval

Candidate retrieval intentionally gathers more passages than the final prompt
will use.

```text
all chunks -> six semantic candidates -> three final sources
```

Why: the first search is optimized for recall—avoid missing useful evidence.
The next stage can be more selective.

## Reranking

The reranker reviews the semantic shortlist and changes its order using a small
lexical-overlap signal.

V3 uses an inspectable formula:

```text
rerank score = 0.85 * semantic similarity + 0.15 * lexical overlap
```

This is not another AI model. It is deterministic Python code. That choice
makes the behavior inexpensive, testable, and explainable.

The returned `similarity` remains the semantic similarity value; it is not the
combined reranking score.

## Prompt

A prompt is the instruction and context sent to the generation model. V3's
prompt contains:

- the user question;
- the selected source chunks;
- rules to use only those sources;
- a fixed abstention response;
- citation instructions;
- a warning that source text is evidence, not instructions.

Prompt engineering is the design of those instructions. It improves behavior
but is not a security boundary by itself.

## Retrieval-Augmented Generation

RAG means the model receives retrieved evidence at answer time.

```text
Retrieval
question -> embedding -> candidates -> reranking -> evidence

Augmentation
instructions + question + evidence -> prompt

Generation
prompt -> LLM -> answer with source labels
```

The model is not retrained on the PDF. The PDF evidence is supplied dynamically
in the prompt.

## Grounding

Grounding restricts the answer to available evidence.

V3 uses two layers:

1. a deterministic minimum-similarity gate before generation;
2. prompt instructions that prohibit outside knowledge and require citations.

If the strongest selected passage is below the configured threshold, V3 does
not call the generation model. It returns the exact abstention response.

## Hallucination

A hallucination is plausible-sounding model output that is unsupported or
incorrect. RAG reduces hallucination risk by supplying relevant evidence, but
does not eliminate it.

Remaining failure modes include:

- retrieval misses the correct passage;
- the correct passage is present but ambiguous;
- the model misreads the evidence;
- the model produces a citation label that does not support the statement;
- the document itself is wrong or outdated.

That is why visible sources and evaluation remain necessary.

## Citations

V3 asks the model to use labels such as `[Source 1]` and returns the actual
retrieved chunks alongside the answer.

The citations are useful for inspection, but they are prompt-generated. V3 does
not independently verify that every sentence is entailed by the cited chunk.

## Abstention

Abstention means refusing to invent an answer when evidence is inadequate:

```text
I could not find that in the document.
```

For an evidence-bound assistant, a correct refusal is better than a fluent
unsupported answer.

## Evaluation

AI evaluation checks model-backed behavior against representative cases.

V3's small evaluation covers:

- direct terminology;
- semantic paraphrasing;
- unsupported questions.

It verifies behavior, not statistical quality. A larger project needs more
documents, question categories, expected evidence, failure cases, latency, and
cost measurements.

## V1, V2, and V3 Compared

| Concern | V1 | V2 | V3.1 |
| --- | --- | --- | --- |
| Representation | TF-IDF | Embeddings | Embeddings with persistent snapshot |
| Search | Lexical top one | Semantic top three | Semantic candidates plus reranking |
| Output | Passage | Generated answer | Validated answer, sources, request ID |
| Evidence policy | Always return best match | Prompt grounding | Threshold plus prompt grounding |
| Operations | Local UI | Local AI app | Protected, observable, tested service |

## One Sentence to Remember

Embeddings help the system find meaning; RAG supplies evidence; grounding tells
the model that evidence—not its general knowledge—defines the answer.
