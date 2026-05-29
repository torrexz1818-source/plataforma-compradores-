import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import HTTPException

from app.ai.llm_client import generate_agent_response
from app.config import get_settings


class FakeMessages:
    def __init__(self, responses=None, error=None):
        self.responses = responses or []
        self.error = error
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        response = self.responses[min(len(self.calls) - 1, len(self.responses) - 1)]
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=response)],
            usage=SimpleNamespace(input_tokens=10, output_tokens=20),
        )


class FakeClient:
    def __init__(self, responses=None, error=None):
        self.messages = FakeMessages(responses=responses, error=error)


class ClaudeClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["AI_PROVIDER"] = "anthropic"
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        os.environ["ANTHROPIC_MODEL"] = "test-claude-model"
        os.environ["ANTHROPIC_MAX_TOKENS"] = "1024"
        os.environ["ANTHROPIC_TEMPERATURE"] = "0.2"
        get_settings.cache_clear()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)
        get_settings.cache_clear()

    async def test_valid_json_response(self):
        client = FakeClient(['{"executiveSummary":"ok","downloadReadiness":{"status":"ready"}}'])
        result = await generate_agent_response(
            agentType="proposal_comparison",
            systemPrompt="Sistema",
            userPrompt="Usuario",
            documentPayload=[{"fileName": "propuesta.pdf", "evidenceBlocks": [{"content": "Precio USD 100"}]}],
            outputContract={"required": ["executiveSummary", "downloadReadiness"]},
            client=client,
        )

        self.assertEqual(result["executiveSummary"], "ok")
        self.assertEqual(result["_model"], "test-claude-model")
        self.assertEqual(result["_usage"], {"tokens_input": 10, "tokens_output": 20})
        call = client.messages.calls[0]
        self.assertEqual(call["system"], "Sistema")
        self.assertEqual(call["model"], "test-claude-model")
        self.assertEqual(call["max_tokens"], 1024)
        self.assertEqual(call["temperature"], 0.2)

    async def test_invalid_json_retries_once(self):
        client = FakeClient(["no-json", '{"executiveSummary":"ok"}'])
        result = await generate_agent_response(
            agentType="dashboard_creator",
            systemPrompt="Sistema",
            userPrompt="Usuario",
            client=client,
        )

        self.assertEqual(result["executiveSummary"], "ok")
        self.assertEqual(len(client.messages.calls), 2)
        self.assertIn("_warnings", result)

    async def test_invalid_json_after_retry_returns_controlled_error(self):
        client = FakeClient(["no-json", "still-no-json"])

        with self.assertRaises(HTTPException) as ctx:
            await generate_agent_response(
                agentType="tco_analysis",
                systemPrompt="Sistema",
                userPrompt="Usuario",
                client=client,
            )

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertIn("respuesta valida", ctx.exception.detail)

    async def test_api_error_returns_controlled_error(self):
        client = FakeClient(error=RuntimeError("network down"))

        with self.assertRaises(HTTPException) as ctx:
            await generate_agent_response(
                agentType="terms_of_reference",
                systemPrompt="Sistema",
                userPrompt="Usuario",
                client=client,
            )

        self.assertEqual(ctx.exception.status_code, 502)

    async def test_missing_api_key_fails_before_calling_client(self):
        os.environ["ANTHROPIC_API_KEY"] = ""
        get_settings.cache_clear()
        client = FakeClient(['{"ok":true}'])

        with self.assertRaises(HTTPException) as ctx:
            await generate_agent_response(
                agentType="proposal_comparison",
                systemPrompt="Sistema",
                userPrompt="Usuario",
                client=client,
            )

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertFalse(client.messages.calls)

    async def test_missing_model_fails_before_calling_client(self):
        os.environ["ANTHROPIC_MODEL"] = ""
        get_settings.cache_clear()
        client = FakeClient(['{"ok":true}'])

        with self.assertRaises(HTTPException) as ctx:
            await generate_agent_response(
                agentType="proposal_comparison",
                systemPrompt="Sistema",
                userPrompt="Usuario",
                client=client,
            )

        self.assertEqual(ctx.exception.status_code, 500)
        self.assertIn("ANTHROPIC_MODEL", ctx.exception.detail)
        self.assertFalse(client.messages.calls)

    def test_legacy_provider_runtime_is_not_imported_by_client(self):
        self.assertNotIn("open" + "ai", sys.modules)


if __name__ == "__main__":
    unittest.main()
