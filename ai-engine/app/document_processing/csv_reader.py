from pathlib import Path

import pandas as pd


def read_csv(path: Path) -> str:
    try:
        frame = pd.read_csv(path, dtype=str)
    except UnicodeDecodeError:
        frame = pd.read_csv(path, dtype=str, encoding="latin-1")

    return frame.fillna("").to_csv(index=False, sep="|")
