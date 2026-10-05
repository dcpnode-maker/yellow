import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('findings_packets', Path(__file__).with_name('findings-packets.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FindingsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.value = module.build_manifest()

    def test_bulk_queue_has_three_exact_workers_without_duplicate_live_job(self):
        tasks = self.value['tasks']
        self.assertEqual([t['workerId'] for t in tasks], ['worker-1', 'worker-2', 'worker-3'])
        self.assertEqual(tasks[0]['dispatchState'], 'already-dispatched-do-not-resend')
        self.assertEqual(tasks[0]['promptSha256'], '2b1925f27f3e63f18455f0c58c93cb6a1037c03c331c79e3a855aff44743ca1b')
        self.assertFalse(self.value['automaticDispatch'])
        self.assertEqual(self.value['acceptedWork'], 0)

    def test_actual_finance_failure_becomes_exact_repair_not_weakened_assertions(self):
        t = self.value['tasks'][1]
        source = t['sources'][0]['text']
        self.assertIn("sourceBetween('function MovementGrid', 'function ReservationWorkspace')", source)
        self.assertEqual(t['sources'][1]['nextMarker'], 'function LegacyReservationWorkspace')
        self.assertEqual(t['sources'][1]['startLine'], 2793)
        self.assertEqual(t['sources'][1]['nextFunctionLine'], 2959)
        self.assertFalse(t['sources'][1]['oldEndFoundAfterStart'])
        self.assertIn('every original assertion', t['prompt'])
        self.assertIn('end exists BEFORE start', t['prompt'])
        self.assertEqual(source.count('\ntest('), 3)

    def test_map_tasks_include_real_api_existing_tests_and_nonduplicate_case_groups(self):
        t = self.value['tasks'][2]
        self.assertIn('export function createMarketMapChannel', t['prompt'])
        self.assertIn('import { expect, test } from "bun:test"', t['prompt'])
        self.assertIn('first accepted nonce is fixed', t['sources'][1]['text'])
        self.assertIn('VALID data under nonce A', t['prompt'])
        self.assertIn('Reflect.set', t['prompt'])
        self.assertNotIn('function frameFixture()', t['sources'][1]['text'])
        self.assertNotIn('export function mountMarketMapFrame', t['sources'][0]['text'])

    def test_all_supplied_public_bytes_have_provenance_and_fit_without_trimming(self):
        for task in self.value['tasks'][1:]:
            self.assertEqual(task['promptSha256'], module.sha(task['prompt']))
            self.assertLessEqual(task['inputUtf8UpperBound'] + 256 + task['outputTokens'], task['contextTokens'])
            self.assertFalse(task['measuredTokenizerCount'])
            self.assertEqual(task['dispatchState'], 'prepared-not-sent')
            for source in task['sources']:
                original = module.blob(module.ROOT, task['publicSourceSha'], source['path'])
                self.assertEqual(source['fullFileSha256'], module.sha(original))
                self.assertEqual(source['suppliedSha256'], module.sha(source['text']))
                self.assertIn(source['text'], task['prompt'])
                if source['kind'] == 'complete-public-file':
                    self.assertEqual(original, source['text'])
            for key in ['accepted', 'generatedCodeExecuted', 'sourceApplied']:
                self.assertFalse(task[key])

    def test_oversized_or_bad_structural_boundaries_reject_before_dispatch(self):
        with self.assertRaisesRegex(ValueError, 'capacity'):
            module.packet('worker-2', 'oversize', module.PUBLIC, 'tests/no.test.ts', 'x' * 18448, [])
        with self.assertRaisesRegex(ValueError, 'boundary'):
            module.prefix(module.ROOT, module.MAP_PUBLIC, 'src/http/operator/market-map.js', 'not a real boundary')

    def test_worker2_original_assertions_and_exact_fix_required_before_review(self):
        task = self.value['tasks'][1]
        original = task['sources'][0]['text']
        fixed = original.replace("sourceBetween('function MovementGrid', 'function ReservationWorkspace')",
                                 "sourceBetween('function MovementGrid', 'function LegacyReservationWorkspace')")
        wrap = lambda code: '```typescript\n' + code + '\n```'
        self.assertEqual(module.inspect_output(task, wrap(original))['status'], 'stale-boundary-not-repaired')
        passed = module.inspect_output(task, wrap(fixed))
        self.assertEqual(passed['status'], 'needs-parent-inspection-and-executable-proof')
        self.assertFalse(passed['accepted'])  # This simple fix still needs the four new tests and actual proof.
        weakened = fixed.replace("  expect(action).toContain('fresh.reservation.reservationId !== reservation.reservationId');", '')
        self.assertEqual(module.inspect_output(task, wrap(weakened))['status'], 'original-assertion-missing-or-weakened')

    def test_wrong_runner_disabled_and_partial_delivery_cannot_be_accepted(self):
        task = self.value['tasks'][2]
        for text in ['```typescript\npartial', 'analysis only', '```typescript\nimport {test} from "vitest";\n```',
                     '```typescript\nimport {test} from "bun:test"; test.skip("case",()=>{});\n```']:
            result = module.inspect_output(task, text)
            self.assertFalse(result['accepted'])
            self.assertNotEqual(result['status'], 'needs-parent-inspection-and-executable-proof')


if __name__ == '__main__':
    unittest.main()
