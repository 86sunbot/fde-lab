from pydantic import BaseModel, ConfigDict, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class QuestionRequest(APIModel):
    question: str = Field(min_length=3, max_length=2_000)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("question must contain at least 3 non-whitespace characters")
        return normalized


class SourceResponse(APIModel):
    source_number: int
    chunk_number: int
    similarity: float
    text: str


class QuestionResponse(APIModel):
    request_id: str
    answer: str
    sources: list[SourceResponse]


class HealthResponse(APIModel):
    status: str
    version: str


class ReadinessResponse(APIModel):
    status: str
    document: str
    indexed_chunks: int


class MetricsResponse(APIModel):
    total_requests: int
    question_requests: int
    error_responses: int
    rate_limited_requests: int
    active_requests: int
    average_duration_ms: float
