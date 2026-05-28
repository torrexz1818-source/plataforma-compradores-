from __future__ import annotations

import json
import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


def _pubsub_configured() -> bool:
    settings = get_settings()
    return bool(settings.google_cloud_project_id and settings.google_pubsub_topic_dashboard_ready)


def get_pubsub_status() -> dict[str, Any]:
    settings = get_settings()
    missing = [
        name
        for name, value in {
            "GOOGLE_CLOUD_PROJECT_ID": settings.google_cloud_project_id,
            "GOOGLE_PUBSUB_TOPIC_DASHBOARD_READY": settings.google_pubsub_topic_dashboard_ready,
        }.items()
        if not value
    ]
    if missing:
        return {
            "status": "disabled",
            "configured": False,
            "required": False,
            "reason": "optional_not_configured",
            "missing": missing,
        }

    return {
        "status": "configured",
        "configured": True,
        "required": False,
        "topic": settings.google_pubsub_topic_dashboard_ready,
    }


def publish_dashboard_completed_event(payload: dict[str, Any]) -> bool:
    """Publish dashboard completion event when Google Pub/Sub is configured.

    This notifier is intentionally best-effort. It never raises to callers,
    because dashboard generation must not depend on Google Cloud availability.
    """
    if not _pubsub_configured():
        logger.info("Dashboard Pub/Sub notification disabled: missing Google Cloud project or topic.")
        return False

    try:
        from google.cloud import pubsub_v1
    except Exception as exc:
        logger.warning("Dashboard Pub/Sub notification skipped: google-cloud-pubsub is unavailable. %s", exc)
        return False

    settings = get_settings()
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(
            settings.google_cloud_project_id,
            settings.google_pubsub_topic_dashboard_ready,
        )
        data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        future = publisher.publish(
            topic_path,
            data,
            event=str(payload.get("event") or "dashboard_creator.completed"),
            agentKey=str(payload.get("agentKey") or "dashboard_creator"),
        )
        future.result(timeout=5)
        logger.info("Dashboard Pub/Sub notification published for event=%s.", payload.get("event"))
        return True
    except Exception as exc:
        logger.warning("Dashboard Pub/Sub notification failed and was ignored. %s", exc)
        return False
