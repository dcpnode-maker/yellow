import importlib.util
import subprocess
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('work_packets', Path(__file__).with_name('work-packets.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class WorkPacketTests(unittest.TestCase):
    def test_actual_public_packet_contains_source_tests_and_complete_deliverable(self):
        root = Path(__file__).resolve().parents[3]
        packet = module.build_packet(root)
        self.assertEqual(packet['publicSourceSha'], module.PUBLIC_SHA)
        self.assertIn('bun:test', packet['prompt'])
        self.assertIn('Runtime.releaseObject', packet['prompt'])
        self.assertIn('Promise<T | undefined>', packet['prompt'])
        self.assertIn('one COMPLETE', packet['prompt'])
        self.assertEqual(packet['outputTokens'], 4096)
        self.assertEqual(packet['contextTokens'], 16384)
        self.assertLessEqual(packet['inputUtf8UpperBound'] + 256 + 4096, 16384)
        self.assertFalse(packet['measuredTokenizerCount'])
        for source in packet['sources']:
            exact = subprocess.check_output(['git', '-C', str(root), 'show', module.PUBLIC_SHA + ':' + source['path']]).decode('utf8')
            self.assertIn(exact, packet['prompt'])

    def test_oversized_input_rejected_before_compute_not_silently_trimmed(self):
        with self.assertRaisesRegex(ValueError, 'capacity'):
            module.validate_capacity('x' * 18448)
        self.assertEqual(module.validate_capacity('small'), 5)
        with self.assertRaises(ValueError):
            module.validate_capacity('界' * 5000)

    def test_model_bound_changes_must_not_claim_extra_capacity(self):
        with self.assertRaises(ValueError):
            module.validate_capacity('a', context=4096, output=4096)
        with self.assertRaises(ValueError):
            module.validate_capacity('a', context=200000, output=4096)

    def test_complete_code_is_not_execution_or_acceptance(self):
        text = '```typescript\nimport {expect, test} from "bun:test";\nimport {invokeCdp} from "./helpers/cdp-invoke";\ntest("case",()=>expect(true).toBe(true));\n```'
        result = module.inspect_delivery(text)
        self.assertTrue(result['completeCodeFence'])
        self.assertFalse(result['accepted'])
        self.assertFalse(result['sourceApplied'])
        self.assertFalse(result['generatedCodeExecuted'])
        self.assertEqual(result['status'], 'needs-parent-review')

    def test_missing_tail_runner_or_unsafe_artifact_is_not_delivered(self):
        for text in ['```typescript\npartial', 'some thoughts',
                     '```typescript\nimport {test} from "vitest";\n```',
                     '```typescript\nimport {test} from "bun:test";\nimport {invokeCdp} from "./helpers/cdp-invoke";\nfetch("https://example.test");\n```']:
            self.assertNotEqual(module.inspect_delivery(text)['status'], 'needs-parent-review')


if __name__ == '__main__':
    unittest.main()
