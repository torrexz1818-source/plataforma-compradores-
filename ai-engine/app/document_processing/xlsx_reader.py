from pathlib import Path

import pandas as pd


def read_xlsx(path: Path) -> str:
    workbook = pd.read_excel(path, sheet_name=None, dtype=str)
    parts: list[str] = []

    for sheet_name, frame in workbook.items():
        cleaned = frame.fillna("")
        parts.append(f"Hoja: {sheet_name}")
        parts.append(cleaned.to_csv(index=False, sep="|"))

    return "\n".join(parts)
