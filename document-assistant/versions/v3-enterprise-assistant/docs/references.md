# References and Further Reading

These sources support the architecture and terminology used in the documentation. The
repository code and tests remain the authority for what this particular version actually
implements.

## Project Learning Reference

- [Shared Version 3 learning discussion](https://chatgpt.com/s/t_6a79e1061a308191865bf661c6470797)
  inspired the beginner mental model and capability checklist. This documentation
  corrects analogy boundaries where the current code differs.

## OpenAI

- [Embeddings guide](https://developers.openai.com/api/docs/guides/embeddings) explains
  embedding vectors and common retrieval uses.
- [Text generation guide](https://developers.openai.com/api/docs/guides/text) explains the
  Responses API used by the centralized provider.
- [Models documentation](https://developers.openai.com/api/docs/models) is the current
  source for available model capabilities and lifecycle information.
- [API key safety guidance](https://help.openai.com/en/articles/5112595-best-practices-for-api-key)
  covers secret handling and server-side key use.

## Application Engineering

- [FastAPI request body documentation](https://fastapi.tiangolo.com/tutorial/body/)
  explains how Pydantic models validate HTTP data.
- [FastAPI async documentation](https://fastapi.tiangolo.com/async/) explains when
  asynchronous route and client patterns help I/O-bound applications.
- [Pydantic Settings documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
  describes typed settings loaded from environment variables and dotenv files.

## Architecture and Delivery

- [C4 model](https://c4model.com/) defines the context, container, component, and code
  levels used in the architecture folder.
- [C4 diagrams guidance](https://c4model.com/diagrams) emphasizes audience, scope, and
  clear abstraction levels.
- [Docker Compose getting started](https://docs.docker.com/compose/gettingstarted/)
  explains multi-container local composition.

## How to Use References

External documentation changes over time. When upgrading a model or dependency, verify
current official documentation, record the reason and consequences in an ADR, update the
code and tests, and then update these project documents. Do not infer an implemented
capability merely because a dependency supports it.
