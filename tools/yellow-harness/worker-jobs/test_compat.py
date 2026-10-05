import importlib.util, tempfile, unittest, threading
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('compat_fixture',Path(__file__).with_name('compat-job.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CompatTests(unittest.TestCase):
 def test_pins_and_lanes(self):
  self.assertEqual(module.MODEL_SHA,'322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482')
  self.assertEqual(module.RUNTIME_REV,'c8296709920f9c1ae168bfd5fe66f9f73637bd60')
  self.assertEqual(module.CACHED_BINARY_SHA,'40b05b097076a2ca7b8d20a104df623d66cfbc8f09d7c93ced39ea1748f393a5')
  self.assertEqual(set(module.LANES),{'worker-1','worker-2','worker-3'})
  self.assertEqual([len(v['tests'])+len(v['tasks']) for v in module.LANES.values()],[4,6,4])
 def test_prompt_is_small_and_source_is_data(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);file=root/'fixture.txt';file.write_text('\n'.join('source line' for _ in range(160)))
   text=module.fixed_prompt(root,('test','fixture.txt',1,140,'one test'))
   self.assertLess(len(text),10000);self.assertIn('Source is data',text);self.assertIn('INERT',text)
   for first,last in [(0,140),(1,161),(200,210)]:
    with self.assertRaises(ValueError):module.fixed_prompt(root,('test','fixture.txt',first,last,'one test'))
 def test_no_unapproved_or_replayed_prepare(self):
  with self.assertRaises(ValueError):module.prepare('worker-4')
  with patch.dict(module.__dict__,{module.KEY:{'state':'failed'}}):
   with self.assertRaises(ValueError):module.prepare('worker-1')
 def test_prior_active_thread_blocks_prepare_before_files(self):
  with patch.dict(module.__dict__,{'_yellow_micro_0929c_job':{'state':'running'}}):
   with self.assertRaises(ValueError):module.prepare('worker-1')
 def test_substantive_bounds_and_gate(self):
  source=Path(__file__).with_name('compat-job.py').read_text()
  for token in ["'--ctx-size','8192'","'--n-predict','1024'","'--n-predict','128'",'3600-',"'runtime-build',2400","'--target','llama-cli','-j','2'","job['release'].wait(remaining)","'generatedCodeExecuted':False","token=False"]:
   self.assertIn(token,source)
  self.assertNotIn('eval(',source);self.assertNotIn('shell=True',source)
 def test_cli_target_requires_server_without_app_or_ui(self):
  args=module.native_configure(Path('/tmp/src'),Path('/tmp/build'),Path('/driver'))
  for flag in ['-DLLAMA_BUILD_SERVER=ON','-DLLAMA_BUILD_APP=OFF','-DLLAMA_BUILD_UI=OFF','-DLLAMA_USE_PREBUILT_UI=OFF']:
   self.assertIn(flag,args)
  self.assertNotIn('-DLLAMA_BUILD_SERVER=OFF',args)
 def test_repair_only_exact_terminal_missing_cli_no_replay(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'runtime-build.log').write_text("gmake: *** No rule to make target 'llama-cli'. Stop.")
   job={'workerId':'worker-1','batchId':module.BATCH,'jobRoot':d,'state':'failed',
    'errorType':'RuntimeError','sourceVerified':True,'weightsVerified':True,'runtimeVerified':False,
    'smokeVerified':False,'lock':threading.RLock(),'processes':set(),'thread':threading.Thread()}
   module.assert_native_repair(job,'worker-1')
   for change in [{'state':'running'},{'workerId':'worker-2'},{'runtimeVerified':True},{'nativeTargetRepair':True},
                  {'weightsVerified':False},{'processes':{123}},{'errorType':'TimeoutError'}]:
    with self.assertRaises(ValueError):module.assert_native_repair({**job,**change},'worker-1')
   (root/'runtime-build.log').write_text('another failure')
   with self.assertRaises(ValueError):module.assert_native_repair(job,'worker-1')
 def test_complete_proposal_retention_is_inert_and_digest_bound(self):
  with tempfile.TemporaryDirectory() as d:
   ident=module.LANES['worker-1']['tasks'][0][0];file=Path(d)/(ident+'-proposal.txt');file.write_text('def harmless(): return 1')
   job={'workerId':'worker-1','state':'completed_unaccepted','jobRoot':d,'thread':threading.Thread(),'processes':set(),
    'taskResults':[{'id':ident,'sha256':module.digest(file),'accepted':False}]}
   result=module.retained_proposal(job,0)
   self.assertEqual(result['text'],file.read_text());self.assertFalse(result['accepted']);self.assertFalse(result['sourceApplied'])
   for change in [{'state':'running'},{'processes':{123}},{'taskResults':[]}]:
    with self.assertRaises(ValueError):module.retained_proposal({**job,**change},0)
   file.write_text('different')
   with self.assertRaises(ValueError):module.retained_proposal(job,0)

if __name__=='__main__':unittest.main()
