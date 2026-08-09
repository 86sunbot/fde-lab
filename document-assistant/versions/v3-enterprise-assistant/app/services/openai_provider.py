from collections.abc import Sequence

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.errors import UpstreamServiceError


class OpenAIProvider:
    """Narrow adapter around the OpenAI operations required by the RAG service."""

    def __init__(self, settings: Settings) -> None:
        self._embedding_model = settings.embedding_model
        self._generation_model = settings.generation_model
        self._client = AsyncOpenAI(
            api_key=settings.openai_api_key.get_secret_value(),
            timeout=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
        )

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        try:
            response = await self._client.embeddings.create(
                model=self._embedding_model,
                input=list(texts),
            )
        except OpenAIError as error:
            raise UpstreamServiceError("The embedding request failed") from error

        ordered = sorted(response.data, key=lambda item: item.index)
        return [item.embedding for item in ordered]

    async def generate_answer(self, prompt: str) -> str:
        try:
            response = await self._client.responses.create(
                model=self._generation_model,
                input=prompt,
            )
        except OpenAIError as error:
            raise UpstreamServiceError("The answer-generation request failed") from error

        answer = response.output_text.strip()
        if not answer:
            raise UpstreamServiceError("The generation model returned an empty answer")
        return answer

    async def close(self) -> None:
        await self._client.close()
