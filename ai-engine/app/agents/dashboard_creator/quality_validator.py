from __future__ import annotations

from fastapi import HTTPException, UploadFile


def validate_dashboard_request(title: str, objective: str, files: list[UploadFile]) -> None:
    if not title.strip():
        raise HTTPException(status_code=400, detail="El nombre del dashboard es obligatorio.")
    if not objective.strip():
        raise HTTPException(status_code=400, detail="El objetivo del dashboard es obligatorio.")
    if not files:
        raise HTTPException(status_code=400, detail="Sube al menos un archivo de datos para crear el dashboard.")
    if len(files) > 8:
        raise HTTPException(status_code=400, detail="Puedes subir como máximo 8 archivos para crear el dashboard.")
