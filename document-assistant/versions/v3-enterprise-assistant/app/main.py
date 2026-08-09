import time
from contextlib import asynccontextmanager
from typing import Any, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.errors import AssistantNotReadyError, UpstreamServiceError
from app.models import (
    HealthResponse,
    MetricsResponse,
    QuestionRequest,
    QuestionResponse,
    ReadinessResponse,
    SourceResponse,
)
from app.observability import MetricsCollector, configure_logging, request_id_context
from app.security import InMemoryRateLimiter, enforce_rate_limit, require_api_key
from app.services.rag import DocumentAssistant


def create_app(
    settings: Optional[Settings] = None,
    assistant: Optional[DocumentAssistant] = None,
) -> FastAPI:
    """Application factory used by Uvicorn and isolated API tests."""
    app_settings = settings or get_settings()
    logger = configure_logging(app_settings.log_level)
    service = assistant or DocumentAssistant(app_settings)
    metrics = MetricsCollector()
    rate_limiter = InMemoryRateLimiter(
        request_limit=app_settings.rate_limit_requests,
        window_seconds=app_settings.rate_limit_window_seconds,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            logger.info(
                "document_index_initializing",
                extra={"document": service.document_name},
            )
            await service.initialize()
            logger.info(
                "document_index_ready",
                extra={
                    "document": service.document_name,
                    "indexed_chunks": service.chunk_count,
                },
            )
            yield
        finally:
            await service.close()

    app = FastAPI(
        title=app_settings.app_name,
        version=app_settings.app_version,
        description="Authenticated API for grounded questions about one configured PDF.",
        lifespan=lifespan,
    )
    app.state.settings = app_settings
    app.state.assistant = service
    app.state.metrics = metrics
    app.state.rate_limiter = rate_limiter

    @app.middleware("http")
    async def request_observability(request: Request, call_next: Any):
        request_id = str(uuid4())
        request.state.request_id = request_id
        context_token = request_id_context.set(request_id)
        start_time = time.perf_counter()
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        metrics.record_start(request.url.path)

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            logger.exception("unhandled_request_error")
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An unexpected application error occurred",
                    "request_id": request_id,
                },
            )
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000
            metrics.record_completion(status_code, duration_ms)
            logger.info(
                "request_completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                },
            )
            request_id_context.reset(context_token)

        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(UpstreamServiceError)
    async def upstream_error_handler(
        request: Request,
        error: UpstreamServiceError,
    ) -> JSONResponse:
        logger.error(
            "upstream_service_error",
            exc_info=(type(error), error, error.__traceback__),
        )
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "detail": str(error),
                "request_id": request.state.request_id,
            },
        )

    @app.exception_handler(AssistantNotReadyError)
    async def not_ready_error_handler(
        request: Request,
        error: AssistantNotReadyError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": str(error),
                "request_id": request.state.request_id,
            },
        )

    @app.get("/health", response_model=HealthResponse, tags=["Operations"])
    async def health() -> HealthResponse:
        return HealthResponse(status="ok", version=app_settings.app_version)

    @app.get("/ready", response_model=ReadinessResponse, tags=["Operations"])
    async def readiness() -> ReadinessResponse:
        if not service.ready:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The document index is not ready",
            )

        return ReadinessResponse(
            status="ready",
            document=service.document_name,
            indexed_chunks=service.chunk_count,
        )

    @app.get(
        "/metrics",
        response_model=MetricsResponse,
        tags=["Operations"],
        dependencies=[Depends(require_api_key)],
    )
    async def application_metrics() -> MetricsResponse:
        return MetricsResponse(**metrics.snapshot())

    @app.post(
        "/v1/questions",
        response_model=QuestionResponse,
        tags=["Questions"],
        dependencies=[Depends(enforce_rate_limit)],
    )
    async def ask_question(
        payload: QuestionRequest,
        request: Request,
    ) -> QuestionResponse:
        result = await service.answer(payload.question)
        sources = [
            SourceResponse(
                source_number=source.source_number,
                chunk_number=source.chunk_number,
                similarity=source.score,
                text=source.text,
            )
            for source in result.sources
        ]
        return QuestionResponse(
            request_id=request.state.request_id,
            answer=result.answer,
            sources=sources,
        )

    return app
