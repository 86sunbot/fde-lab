from pydantic import BaseModel, Field, field_validator


class QuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2_000)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("question must contain at least 3 non-whitespace characters")
        return normalized


class SourceResponse(BaseModel):
    source_number: int
    chunk_number: int
    similarity: float
    text: str


class QuestionResponse(BaseModel):
    request_id: str
    answer: str
    sources: list[SourceResponse]


class HealthResponse(BaseModel):
    status: str
    version: str


class ReadinessResponse(BaseModel):
    status: str
    document: str
    indexed_chunks: int


class MetricsResponse(BaseModel):
    total_requests: int
    question_requests: int
    error_responses: int
    rate_limited_requests: int
    active_requests: int
    average_duration_ms: float
