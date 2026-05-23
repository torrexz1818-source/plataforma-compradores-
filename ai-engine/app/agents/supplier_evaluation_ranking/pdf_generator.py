from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf


def build_supplier_ranking_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    return build_platform_result_pdf(result, "Evaluacion y Ranking de Proveedores", branding, "Evaluacion y Ranking de Proveedores")
