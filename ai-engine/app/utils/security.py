from pathlib import Path
from uuid import uuid4


def safe_temp_name(original_name: str) -> str:
    suffix = Path(original_name).suffix.lower()
    return f"{uuid4().hex}{suffix}"
