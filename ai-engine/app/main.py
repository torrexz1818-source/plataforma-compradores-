from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents.proposal_comparison.router import router as proposal_comparison_router
from app.config import get_settings

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
    return {"status": "ok"}


app.include_router(proposal_comparison_router)
app.include_router(terms_of_reference_router)
