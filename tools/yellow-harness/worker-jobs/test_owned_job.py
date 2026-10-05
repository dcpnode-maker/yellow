import importlib.util
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch

path = Path(__file__).with_name('owned-job.py')
spec = importlib.util.spec_from_file_location('owned_job', path)
job = importlib.util.module_from_spec(spec)
spec.loader.exec_module(job)


class OwnedJobTests(unittest.TestCase):
    def test_microtasks_are_small_fixed_public_slices_with_separate_batch(self):
        self.assertEqual(job.batch_settings('micro-0929c')[0], '_yellow_micro_0929c_job')
        self.assertEqual(set(job.MICRO_LANES), set(job.LANES))
        for lane in job.MICRO_LANES.values():
            self.assertEqual(len(lane['tasks']), 3)
            for task in lane['tasks']:
                self.assertLessEqual(sum(end-start+1 for _,start,end in task['slices']), 160)
                self.assertTrue(task['question'])
                self.assertTrue(task['test'].startswith('tests/'))
        self.assertEqual(job.MICRO_CONTEXT, 8192)
        self.assertEqual(job.MICRO_OUTPUT, 1024)
        self.assertEqual(job.MICRO_TIMEOUT, 180)

    def test_prebuilt_runtime_is_release_pinned_and_never_compiles(self):
        self.assertEqual(job.RUNTIME_ASSETS[0]['size'], 172252243)
        self.assertEqual(job.RUNTIME_ASSETS[0]['sha'], '058181c6679888d06385f6ca81b9f6cc0490f35cbd385e4a7fcafd1f8cb32289')
        for artifact in job.RUNTIME_ASSETS:
            self.assertIn('/releases/download/b11216/', artifact['url'])
            self.assertRegex(artifact['sha'], '^[a-f0-9]{64}$')
        import io, tarfile
        for name in ['../escape','/absolute']:
            with tempfile.TemporaryDirectory() as folder:
                archive=Path(folder)/'hostile.tar.gz'
                with tarfile.open(archive,'w:gz') as out:
                    member=tarfile.TarInfo(name); member.size=1
                    out.addfile(member,io.BytesIO(b'x'))
                with self.assertRaises(ValueError): job.extract_pinned_archive(archive,Path(folder)/'runtime')

    def test_three_public_pinned_lanes_no_generation_on_import(self):
        self.assertEqual(set(job.LANES), {'worker-1','worker-2','worker-3'})
        self.assertFalse(hasattr(job, '_yellow_pr_job'))
        for lane in job.LANES.values():
            self.assertRegex(lane['sha'], '^[a-f0-9]{40}$')
            self.assertTrue(all(p.startswith('tests/') and p.endswith('.test.ts') for p in lane['tests']))

    def test_invalid_worker_starts_no_compute(self):
        with self.assertRaises(ValueError):
            job.start('other')

    def test_next_build_lanes_are_separate_public_patch_proposals(self):
        self.assertEqual(set(job.BUILD_LANES), set(job.LANES))
        self.assertEqual(job.BUILD_LANES['worker-3']['sha'],
                         '01c9ffa4d35894c29c93bf66556d6c26848a24be')
        self.assertEqual(job.BUILD_LANES['worker-1']['tests'], ['tests/project-status.test.ts'])
        for lane in job.BUILD_LANES.values():
            self.assertIn('proposal', lane['focus'])
            self.assertTrue(all(not p.startswith(('/', '..')) for p in lane['read']))
        self.assertEqual(job.batch_settings('0929')[0], '_yellow_pr_job')
        self.assertEqual(job.batch_settings('build-0929b')[0], '_yellow_build_0929b_job')
        with self.assertRaises(ValueError): job.batch_settings('unknown')

    def test_next_initial_runtime_has_no_ui_download_or_build(self):
        source = path.read_text()
        self.assertIn("'-DLLAMA_USE_PREBUILT_UI=OFF', '-DLLAMA_BUILD_UI=OFF'", source)
        self.assertIn('start_new_session=True', source)
        self.assertIn('recommended_parent_action', source)

    def test_retained_or_active_batch_rejects_before_any_new_root(self):
        with patch.object(job.Path,'is_dir',return_value=True), \
             patch.object(job.tempfile,'mkdtemp') as make:
            for value in [{'state':'completed_unaccepted'}, {'state':'running'}]:
                job._yellow_pr_job=value
                try:
                    with self.assertRaises(ValueError): job.start('worker-1')
                finally:
                    del job._yellow_pr_job
                make.assert_not_called()
            job._yellow_build_0929b_job={'state':'running'}
            try:
                with self.assertRaises(ValueError): job.start('worker-1')
            finally:
                del job._yellow_build_0929b_job
            make.assert_not_called()

    def test_snapshot_drops_unserializable_internal_objects(self):
        import threading
        value = job.snapshot({'lock':threading.Lock(), 'thread':object(), '_display':object(), 'completedSteps':0})
        self.assertEqual(value, {'completedSteps':0})

    def test_model_code_is_inert_and_downloads_are_pinned(self):
        source = path.read_text()
        self.assertNotIn('exec(', source)
        self.assertNotIn('eval(', source)
        self.assertIn('token=False', source)
        self.assertIn('generatedCodeExecuted=False, sourceApplied=False', source)
        self.assertEqual(len(job.MODEL_SHA), 64)
        self.assertEqual(len(job.BUN_SHA), 64)

    def test_recovery_rejects_active_unverified_or_replayed_attempts(self):
        class Thread:
            def __init__(self,alive): self.alive=alive
            def is_alive(self): return self.alive
        value={'state':'failed','errorType':'TimeoutExpired','runtimeVerified':False,
            'weightsVerified':True,'recoveryAttempts':0,'thread':Thread(False)}
        job.recovery_allowed(value)
        for change in [{'state':'running'},{'thread':Thread(True)},{'recoveryAttempts':1},
            {'errorType':'ValueError'},{'runtimeVerified':True},{'weightsVerified':False}]:
            with self.assertRaises(ValueError):
                job.recovery_allowed({**value,**change})

    def test_runtime_inspection_rejects_non_owned_root(self):
        for root in ['/tmp','/kaggle/working','/tmp/other']:
            with self.assertRaises(ValueError):
                job.owned_runtime_state({'jobRoot':root})

    def test_proposal_is_hash_bound_inert_and_secret_like_text_is_withheld(self):
        with tempfile.TemporaryDirectory() as folder:
            proposal=Path(folder)/'proposal.txt'
            proposal.write_text('Public review\n[ Prompt: 350.0 t/s | Generation: 13.0 t/s ]')
            value={'state':'completed_unaccepted','jobRoot':folder,'proposalFile':str(proposal),
                'proposalSha256':job.digest(proposal),'workerId':'worker-1','sourceSha':'a'*40,'tests':[]}
            result=job.proposal_result(value)
            self.assertEqual(result['generationTokensPerSecond'],13.0)
            self.assertFalse(result['generatedCodeExecuted'])
            self.assertTrue(result['boundedResponseMayBeIncomplete'])
            with self.assertRaises(ValueError): job.proposal_result({**value,'proposalSha256':'0'*64})
            proposal.write_text('Bearer synthetic-secret')
            with self.assertRaises(ValueError): job.proposal_result({**value,'proposalSha256':job.digest(proposal)})
            with self.assertRaises(ValueError): job.proposal_result({**value,'state':'running'})


if __name__ == '__main__':
    unittest.main()
