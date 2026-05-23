from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf


def build_tco_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    return build_platform_result_pdf(result, "Analisis de Costo Total / TCO", branding, "Analisis de Costo Total / TCO")
