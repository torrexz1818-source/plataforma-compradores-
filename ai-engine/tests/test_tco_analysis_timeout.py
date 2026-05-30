import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.agents.tco_analysis.service import analyze_tco
from app.config import get_settings


class TcoAnalysisTimeoutTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["AI_PROVIDER"] = "anthropic"
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        os.environ["ANTHROPIC_MODEL"] = "test-claude-model"
        os.environ["TCO_MODEL_TIMEOUT_SECONDS"] = "0.01"
        get_settings.cache_clear()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)
        get_settings.cache_clear()

    async def test_tco_model_timeout_returns_blocked_limited_result(self):
        async def slow_model(*_args, **_kwargs):
            import asyncio

            await asyncio.sleep(1)
            return {"analysis_title": "late"}

        alternatives_json = """
        [
          {"supplier_name":"Proveedor A","base_price":1000,"currency":"USD"},
          {"supplier_name":"Proveedor B","base_price":1200,"currency":"USD"}
        ]
        """

        with patch("app.agents.tco_analysis.service.analyze_tco_with_claude", slow_model):
            result = await analyze_tco(
                title="Analisis TCO",
                item_name="Equipo industrial",
                analysis_type="Compra",
                evaluation_horizon="3 anos",
                comparison_unit="Por equipo",
                currency="USD",
                purchase_volume=None,
                objective="Comparar alternativas",
                alternatives_json=alternatives_json,
                general_context=None,
                additional_instructions=None,
                files=[],
                trace_id="trace-timeout-test",
            )

        payload = result.model_dump()
        self.assertTrue(payload["model_timed_out"])
        self.assertEqual(payload["downloadReadiness"]["status"], "blocked")
        self.assertEqual(payload["ranking"], [])
        self.assertIsNone(payload["scorecard"])
        self.assertEqual(payload["financial_model"], [])
        self.assertIsNone(payload["executive_summary"]["best_alternative_score"])
        self.assertIn("no respondio", " ".join(payload["calculation_warnings"]).lower())


if __name__ == "__main__":
    unittest.main()
