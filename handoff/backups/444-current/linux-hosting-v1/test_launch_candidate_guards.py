import ast,json,re,subprocess,unittest
from pathlib import Path

SOURCE=Path(__file__).with_name('launch_private_candidate_v2.py')
def functions():
 tree=ast.parse(SOURCE.read_text());names={'require','http','absent','cleanup'}
 module=ast.Module(body=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in names],type_ignores=[])
 ns={'re':re,'hashlib':__import__('hashlib')}
 exec(compile(module,str(SOURCE),'exec'),ns)
 return ns
class Response:
 status=200
 def read(self,n):return b'{}'
class FakeConnection:
 def __init__(self,*a,**kw):self.closed=False
 def request(self,*a):pass
 def getresponse(self):return Response()
 def close(self):self.closed=True
class Guards(unittest.TestCase):
 def test_http_function_uses_direct_connection_alias_without_module_shadow(self):
  ns=functions();ns['HTTPConnection']=FakeConnection
  result,raw=ns['http']('/ready');self.assertEqual(result['status'],200);self.assertEqual(raw,b'{}')
 def cleanup_case(self,mutation=None,absence=None):
  ns=functions();calls=[];name='owned-test-app';image='sha256:test';nonce='ownnonce';job='job';source='reviewed-source'
  m={'id':'full-owned-cid','name':'/'+name,'image':image,'labels':{'com.yellow.proof.nonce':nonce,'com.yellow.proof.job':job,'com.yellow.proof.source':source}}
  if mutation:m['labels'].update(mutation)
  ns.update(CID=None,NAME=name,image=image,NONCE=nonce,JOB=job,SOURCE=source,D=['docker'],ENV={},meta=lambda cid:m,run=lambda cmd:calls.append(cmd))
  result=absence or subprocess.CompletedProcess([],0,b'full-owned-cid\n',b'')
  class FakeSubprocess:
   @staticmethod
   def run(*a,**kw):return result
  ns['subprocess']=FakeSubprocess
  return ns,calls
 def test_timeout_discovery_removes_only_fully_owned_candidate(self):
  ns,calls=self.cleanup_case();ns['cleanup']();self.assertEqual(ns['CID'],'full-owned-cid');self.assertEqual(calls,[['docker','rm','-f','full-owned-cid']])
 def test_wrong_source_or_nonce_never_deletes(self):
  for mutation in [{'com.yellow.proof.source':'other'},{'com.yellow.proof.nonce':'other'}]:
   ns,calls=self.cleanup_case(mutation)
   with self.assertRaises(RuntimeError):ns['cleanup']()
   self.assertEqual(calls,[])
 def test_daemon_failure_is_not_confirmed_absence(self):
  ns,calls=self.cleanup_case(absence=subprocess.CompletedProcess([],1,b'',b'Cannot connect to Docker daemon'))
  with self.assertRaises(RuntimeError):ns['cleanup']()
  self.assertEqual(calls,[])
if __name__=='__main__':unittest.main()
