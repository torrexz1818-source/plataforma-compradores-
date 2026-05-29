from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI, OpenAIError

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

app = FastAPI(
    title="Buyer Nodus AI Engine",
    version="0.1.0",
    description="Motor temporal para agentes IA de Buyer Nodus.",
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
    if not settings.openai_api_key:
        return {
            "ok": False,
            "provider": "openai",
            "provider_reachable": False,
            "error_code": "AI_PROVIDER_NOT_CONFIGURED",
            "message": "OPENAI_API_KEY no esta configurada en el AI Engine.",
        }

    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.health_deep_timeout_seconds,
    )

    try:
        model = await client.models.retrieve(settings.openai_model)
    except OpenAIError as exc:
        return {
            "ok": False,
            "provider": "openai",
            "provider_reachable": False,
            "error_code": "AI_PROVIDER_ERROR",
            "message": exc.__class__.__name__,
        }

    return {
        "ok": True,
        "provider": "openai",
        "provider_reachable": True,
        "model": getattr(model, "id", settings.openai_model),
        "error_code": None,
        "message": "AI Engine y proveedor IA responden correctamente.",
    }


app.include_router(proposal_comparison_router)
app.include_router(terms_of_reference_router)
app.include_router(tco_analysis_router)
app.include_router(purchase_order_router)
app.include_router(dashboard_creator_router)
app.include_router(spend_analysis_router)
app.include_router(contract_risk_analysis_router)
app.include_router(supplier_evaluation_ranking_router)
