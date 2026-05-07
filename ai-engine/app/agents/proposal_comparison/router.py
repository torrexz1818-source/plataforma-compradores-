from fastapi import APIRouter, File, Form, UploadFile

from app.agents.proposal_comparison.schemas import ProposalComparisonResult
from app.agents.proposal_comparison.service import analyze_proposals

router = APIRouter(prefix="/agents/proposal-comparison", tags=["Proposal comparison"])


@router.post("/analyze", response_model=ProposalComparisonResult)
async def analyze_proposal_comparison(
    title: str | None = Form(default=None),
    service: str = Form(...),
    objective: str | None = Form(default=None),
    criteria: str | None = Form(default=None),
    files: list[UploadFile] = File(...),
):
    return await analyze_proposals(title, service, objective, criteria, files)
