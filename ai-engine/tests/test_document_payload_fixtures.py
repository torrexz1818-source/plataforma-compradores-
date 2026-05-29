import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.agents.dashboard_creator.data_profiler import profile_files
from app.agents.proposal_comparison.service import build_proposal_document_context
from app.agents.tco_analysis.service import build_document_summary
from app.document_processing.structured_document import build_structured_document_payload


class DocumentPayloadFixtureTests(unittest.TestCase):
    def test_four_agent_document_contexts_use_structured_payload(self):
        with tempfile.TemporaryDirectory(prefix="nodus_doc_payload_", ignore_cleanup_errors=True) as temp_dir:
            base = Path(temp_dir)
            workbook = base / "compras.xlsx"
            with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
                pd.DataFrame(
                    [
                        {
                            "Proveedor": "Andes SAC",
                            "Alternativa": "A",
                            "Monto USD": 120000,
                            "Fecha OC": "2026-01-15",
                            "Categoria": "Mantenimiento",
                            "Comprador": "Comprador A",
                        },
                        {
                            "Proveedor": "Pacifico SAC",
                            "Alternativa": "B",
                            "Monto USD": 130000,
                            "Fecha OC": "2026-02-15",
                            "Categoria": "Equipos",
                            "Comprador": "Comprador B",
                        },
                    ]
                ).to_excel(writer, sheet_name="Alternativas", index=False)
                pd.DataFrame([{"Concepto": "Horizonte", "Valor": "5 anios"}]).to_excel(
                    writer,
                    sheet_name="Supuestos",
                    index=False,
                )

            trace = build_structured_document_payload(workbook, workbook.name)
            proposal_context = build_proposal_document_context(workbook, workbook.name)
            tco_summary = build_document_summary(workbook, workbook.name)
            dashboard_profile = profile_files([(workbook, workbook.name)], {"objective": "Dashboard de compras"})

            self.assertEqual(trace["fileType"], "xlsx")
            self.assertEqual(len(trace["sheetsDetected"]), 2)
            self.assertGreaterEqual(trace["rowsDetected"], 3)
            self.assertTrue(trace["tables"])
            self.assertTrue(trace["evidenceBlocks"])

            self.assertEqual(proposal_context["fileName"], workbook.name)
            self.assertTrue(proposal_context["evidenceBlocks"])
            self.assertIn("minimumEvidenceRequired", proposal_context)

            self.assertEqual(len(tco_summary["sheets_detected"]), 2)
            self.assertTrue(tco_summary["tables"])
            self.assertGreaterEqual(tco_summary["rows_detected"], 3)

            self.assertEqual(dashboard_profile["profile"]["files_processed"], 1)
            self.assertTrue(dashboard_profile["profile"]["candidateFields"].get("proveedor"))
            self.assertTrue(dashboard_profile["profile"]["candidateFields"].get("monto"))
            self.assertTrue(dashboard_profile["kpis"])


if __name__ == "__main__":
    unittest.main()
