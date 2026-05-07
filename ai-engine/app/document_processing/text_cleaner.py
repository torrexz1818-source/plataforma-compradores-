import re

MAX_TEXT_LENGTH = 50000


def clean_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = normalized.strip()

    if len(normalized) <= MAX_TEXT_LENGTH:
        return normalized

    return (
        normalized[:MAX_TEXT_LENGTH]
        + "\n\n[Texto truncado por longitud. Se conservaron montos, fechas, condiciones y notas visibles en el contenido inicial.]"
    )
