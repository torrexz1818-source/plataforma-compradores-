import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from anthropic import APIError, AsyncAnthropic

from app.agents.proposal_comparison.router import router as proposal_comparison_router
from app.agents.tco_analysis.router import router as tco_analysis_router
from app.agents.purchase_order.router import router as purchase_order_router
from app.agents.dashboard_creator.router import router as dashboard_creator_router
from app.agents.spend_analysis.router import router as spend_analysis_router
from app.agents.contract_risk_analysis.router import router as contract_risk_analysis_router
from app.agents.supplier_evaluation_ranking.router import router as supplier_evaluation_ranking_router
from app.config import get_settings
from app.utils.google_pubsub_notifier import get_pubsub_status

settings = get_settings()
from app.agents.terms_of_reference.router import router as terms_of_reference_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info(
        "ai_engine.startup_config aiProvider=%s anthropicModelConfigured=%s tcoModelTimeoutSeconds=%s anthropicTimeoutSeconds=%s anthropicMaxRetries=%s maxFileSizeMb=%s maxFilesPerAnalysis=%s",
        settings.ai_provider,
        bool(settings.anthropic_model),
        settings.tco_model_timeout_seconds,
        settings.anthropic_timeout_seconds,
        settings.anthropic_max_retries,
        settings.max_file_size_mb,
        settings.max_files_per_analysis,
    )
    yield


app = FastAPI(
    title="Buyer Nodus AI Engine",
    version="0.1.0",
    description="Motor temporal para agentes IA de Buyer Nodus.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "optional_integrations": {
            "google_pubsub": get_pubsub_status(),
        },
    }


@app.get("/health/deep")
async def deep_health_check():
    if settings.ai_provider != "anthropic":
        return {
            "ok": False,
            "provider": settings.ai_provider or "unknown",
            "provider_reachable": False,
            "error_code": "AI_PROVIDER_NOT_CONFIGURED",
            "message": "AI_PROVIDER debe ser anthropic.",
        }
    if not settings.anthropic_api_key or not settings.anthropic_model:
        return {
            "ok": False,
            "provider": "anthropic",
            "provider_reachable": False,
            "error_code": "AI_PROVIDER_NOT_CONFIGURED",
            "message": "ANTHROPIC_API_KEY y ANTHROPIC_MODEL deben estar configurados.",
        }

    client = AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.health_deep_timeout_seconds,
    )

    try:
        model = await client.models.retrieve(settings.anthropic_model)
    except APIError as exc:
        return {
            "ok": False,
            "provider": "anthropic",
            "provider_reachable": False,
            "error_code": "AI_PROVIDER_ERROR",
            "message": exc.__class__.__name__,
        }

    return {
        "ok": True,
        "provider": "anthropic",
        "provider_reachable": True,
        "model": getattr(model, "id", settings.anthropic_model),
        "error_code": None,
        "message": "AI Engine y proveedor IA responden correctamente.",
    }


@app.get("/diagnostics/config")
def diagnostics_config():
    return {
        "aiProvider": settings.ai_provider,
        "anthropicModelConfigured": bool(settings.anthropic_model),
        "anthropicApiKeyConfigured": bool(settings.anthropic_api_key),
        "tcoModelTimeoutSeconds": settings.tco_model_timeout_seconds,
        "anthropicTimeoutSeconds": settings.anthropic_timeout_seconds,
        "anthropicMaxRetries": settings.anthropic_max_retries,
        "maxFileSizeMb": settings.max_file_size_mb,
        "maxFilesPerAnalysis": settings.max_files_per_analysis,
    }


app.include_router(proposal_comparison_router)
app.include_router(terms_of_reference_router)
app.include_router(tco_analysis_router)
app.include_router(purchase_order_router)
app.include_router(dashboard_creator_router)
app.include_router(spend_analysis_router)
app.include_router(contract_risk_analysis_router)
app.include_router(supplier_evaluation_ranking_router)
