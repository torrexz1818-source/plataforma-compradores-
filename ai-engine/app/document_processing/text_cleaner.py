import re

MAX_TEXT_LENGTH = 180000


def clean_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = normalized.strip()

    if len(normalized) <= MAX_TEXT_LENGTH:
        return normalized

    return (
        normalized[:MAX_TEXT_LENGTH]
        + "\n\n[Contenido recortado por seguridad. Usa el paquete estructurado para trazabilidad de bloques enviados.]"
    )
