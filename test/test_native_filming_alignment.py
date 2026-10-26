import unittest
import tempfile
import pathlib
import json
import importlib.util

location = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "align-native-filming.py"
spec = importlib.util.spec_from_file_location("native_align", location)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class NativeAlignmentTest(unittest.TestCase):
    def test_evidence_and_time_alignment(self):
        with tempfile.TemporaryDirectory() as directory:
            logfile = pathlib.Path(directory) / "agent.log"
            records = [
                {"timestamp":"2026-10-26T18:00:00.000Z","type":"target_decision","action":"explore"},
                {"timestamp":"2026-10-26T18:00:02.250Z","type":"target_attack_attempt"},
                {"timestamp":"2026-10-26T18:00:06.000Z","type":"target_verified_recovery"},
                {"timestamp":"2026-10-26T18:02:00.000Z","type":"target_decision","action":"too late"},
            ]
            logfile.write_text("\n".join(map(json.dumps, records))+"\n", encoding="utf-8")
            subtitles, manifest = module.create_alignment(
                logfile,"2026-10-26T18:00:00Z",10)
            self.assertEqual(manifest["annotationCount"],3)
            self.assertIn("00:00:02,250", subtitles)
            self.assertIn("attack attempted", subtitles)
            self.assertIn("mineflayer_agent_log_not_server_confirmed",manifest["origin"])
    def test_timezone_and_zero_duration_validation(self):
        self.assertEqual(module.parse_time("2026-10-26T13:00:00-05:00"),
                         module.parse_time("2026-10-26T18:00:00Z"))
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory)/"empty.log"
            file.write_text("")
            with self.assertRaises(ValueError):
                module.create_alignment(file,"2026-10-26T18:00:00Z",0)

if __name__ == "__main__":
    unittest.main()
