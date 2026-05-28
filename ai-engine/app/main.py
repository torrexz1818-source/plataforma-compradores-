from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


app.include_router(proposal_comparison_router)
app.include_router(terms_of_reference_router)
app.include_router(tco_analysis_router)
app.include_router(purchase_order_router)
app.include_router(dashboard_creator_router)
app.include_router(spend_analysis_router)
app.include_router(contract_risk_analysis_router)
app.include_router(supplier_evaluation_ranking_router)
