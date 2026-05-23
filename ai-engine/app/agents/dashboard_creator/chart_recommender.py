from __future__ import annotations


def recommend_chart_type(*, has_date: bool, has_category: bool, has_amount: bool, item_count: int = 0) -> str:
    if has_date and has_amount:
        return "line"
    if has_category and has_amount and item_count > 6:
        return "horizontal_bar"
    if has_category and has_amount:
        return "bar"
    if has_amount:
        return "bar"
    return "table"
