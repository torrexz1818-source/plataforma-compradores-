from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import get_settings
from app.utils.security import safe_temp_name


async def save_upload_temporarily(upload: UploadFile, max_size_mb: int) -> Path:
    settings = get_settings()
    max_bytes = max_size_mb * 1024 * 1024
    temp_path = settings.temp_dir / safe_temp_name(upload.filename or "proposal")
    bytes_written = 0

    with temp_path.open("wb") as target:
        while chunk := await upload.read(1024 * 1024):
            bytes_written += len(chunk)
            if bytes_written > max_bytes:
                target.close()
                temp_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"El archivo {upload.filename} supera el tamaño máximo de {max_size_mb} MB.",
                )
            target.write(chunk)

    await upload.seek(0)
    return temp_path


def cleanup_files(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
