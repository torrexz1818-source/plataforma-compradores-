from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    """Legacy-compatible PDF path.

    The frontend export flow uses src/lib/agentPdf.ts as the official path.
    This backend endpoint only converts the provided DashboardResult and must
    not recalculate metrics or call the LLM.
    """
    return build_platform_result_pdf(result, "Creador de Dashboard", branding, "Creador de Dashboard")
