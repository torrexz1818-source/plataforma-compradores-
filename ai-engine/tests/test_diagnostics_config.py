import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class DiagnosticsConfigTests(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["AI_PROVIDER"] = "anthropic"
        os.environ["ANTHROPIC_API_KEY"] = "test-secret-key"
        os.environ["ANTHROPIC_MODEL"] = "test-claude-model"
        os.environ["TCO_MODEL_TIMEOUT_SECONDS"] = "90"
        os.environ["ANTHROPIC_TIMEOUT_SECONDS"] = "75"
        os.environ["ANTHROPIC_MAX_RETRIES"] = "1"
        from app.config import get_settings

        get_settings.cache_clear()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)
        from app.config import get_settings

        get_settings.cache_clear()

    def test_diagnostics_config_does_not_expose_secrets(self):
        import importlib
        import app.main as main_module

        main_module = importlib.reload(main_module)
        payload = main_module.diagnostics_config()

        self.assertEqual(payload["aiProvider"], "anthropic")
        self.assertTrue(payload["anthropicModelConfigured"])
        self.assertTrue(payload["anthropicApiKeyConfigured"])
        self.assertEqual(payload["tcoModelTimeoutSeconds"], 90)
        self.assertEqual(payload["anthropicTimeoutSeconds"], 75)
        self.assertEqual(payload["anthropicMaxRetries"], 1)
        self.assertNotIn("test-secret-key", str(payload))


if __name__ == "__main__":
    unittest.main()
