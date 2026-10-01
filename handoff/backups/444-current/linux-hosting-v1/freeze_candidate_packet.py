#!/usr/bin/env python3
"""Freeze only explicit public helper/proof records; do not modify source index."""
import hashlib,json,os,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=Path('/workspace/yellow-release')
PARENT='a1fbcabf7f2caaeb0e666a281931a557c04f26cc'
BASE='0a47cb5ecf564fda63f4058a7b548b8038c95fa3'
PREFIX='handoff/backups/444-current/linux-hosting-v1/'
OUT=ROOT/'publication-inputs-v2'
assert not OUT.exists();OUT.mkdir(mode=0o700)
env=os.environ.copy();env['GIT_INDEX_FILE']=str(OUT/'index')
def git(*args,data=None):return subprocess.run(['git','-C',str(REPO),*args],env=env,input=data,capture_output=True,check=True,timeout=15).stdout
assert git('rev-parse',PARENT+'^{tree}').decode().strip()==BASE
for path,sha in [(REPO,'9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'),(Path('/workspace/yellow-receiving-b9'),'b9ba702a074a487feeafa056abb49abcdcf01ba8'),(Path('/workspace/yellow-candidate-444'),'444072ffdff2b7745345d88f71b603c17e11ace6')]:
 assert subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD']).decode().strip()==sha
 assert not subprocess.check_output(['git','-C',str(path),'status','--porcelain=v1'])
git('read-tree',BASE)
names=['LAPTOP_CLOUD444_HOSTING_HANDOFF.md','ORDER.md','BUILD_V2_ORDER.md','RUNTIME_LAUNCH_PLAN.md','candidate-compose.yml','EXISTING_SYNTHETIC_BINDING_METADATA.json','ADMISSION_FAILURE_PIN_CORRECTION.json','IMAGE_BUILD_V1_FAILURE.json','build_and_export_candidate.py','build_and_export_candidate_v2.py','verify_candidate_oci.py','test_candidate_guards.py','test_candidate_v2_guards.py','launch_private_candidate.py','launch_private_candidate_v2.py','test_launch_candidate_guards.py','CANDIDATE_444_IMAGE_EXPORT_PROOF_V2.json','ACTUAL_PRIVATE_CANDIDATE_RUNTIME_PROOF.json','ACTUAL_PRIVATE_CANDIDATE_RUNTIME_PROOF_V2.json','FAILED_CANDIDATE_PRESERVATION_CHECK.json','ACTUAL_EXECUTION_REVIEW.md','CI_444_ATTEMPT2_OBSERVATION.json','INDEPENDENT_CANDIDATE_444_REVIEW.md','INDEPENDENT_CANDIDATE_444_REVIEW.json','INDEPENDENT_CONVERTER_PIN_REVIEW.md','INDEPENDENT_CONVERTER_PIN_REVIEW.json','INDEPENDENT_CANDIDATE_444_OCI_REVIEW.md','INDEPENDENT_CANDIDATE_444_OCI_REVIEW.json','freeze_candidate_packet.py']
select={ROOT/name:PREFIX+name for name in names}
ng=ROOT.parent/'ngrok-supported-proxy-v1'
ngnames=['SUPPORTED_NGROK_PLAN.md','OPERATOR_HANDOFF.md','NGROK_CAPABILITY_OBSERVATION.json','NGROK_DOCUMENTED_PROXY_SUPPORT.json','OFFICIAL_DOWNLOAD_PAGE_OBSERVATION.json','OFFICIAL_AGENT_PROVENANCE.json','OFFICIAL_OAUTH_DOC_OBSERVATION.json','OFFICIAL_FIREWALL_DOC_OBSERVATION.json','LOCAL_CONFIG_VALIDATION.json','ngrok-config.template.json','MANAGED_HTTPS_AGENT_HOST_CHECK.json','PLATFORM_BINDING_CAPABILITY_OBSERVATION.json','INDEPENDENT_NGROK_PACKET_REVIEW.md','INDEPENDENT_NGROK_PACKET_REVIEW.json','INDEPENDENT_NGROK_PACKET_REVIEW_CORRECTION.md','INDEPENDENT_NGROK_PACKET_REVIEW_CORRECTION.json']
for name in ngnames:select[ng/name]=PREFIX+'ngrok/'+name
ledger=OUT/'artifact-ledger.md'
ledger.write_bytes(git('show',BASE+':handoff/LEDGER.md')+b'\n\n### RELEASE-20261001 exact444 private candidate and supported ngrok preparation\n\n- Cloud root personally built/exported identity-only exact444 candidate from byte-identical reviewed b9 runtime; independent11layer/config/index and459producttree entries verified. No fresh compile claim, feature edits, migrations or extra synthetic/business DB. Actual private53018 ready444/103, UI/assets200, anonymous401/sourcepaths404 and full syntheticdata/schemaownerACL fingerprints unchanged; originalb9/9ff services remain running. Guard tests8+4pass; bounded failed attempts/checkpoints preserved.\n- Official ngrok3.39.11 installed via unchanged managedproxy/trust, no-token localconfig check0. GoogleOAuth then exactemail restriction prepared/unregistered; ordinary documentedingressHTTPSGET503, responseoriginunknown, noagentconnection/publicURL. Environment224 onlystatustool, no nativepreview/secretbinding/editor/apply. One dedicatedtoken through supported privatebinding remains account prerequisite; no secrettransfer/paidfallback/TLS/networkbypass.\n- Laptop solecontroller/source/integration; latest444CI stilltwoactualfailures nativeWindowsAdd-Type and staleDB100/24 vs103/26 oracle, no waivers. Previousstrictsyntheticrestore readinessfailure remains sharedproductsource. No permanentlifetime/businessdata/deletionresilience claims. Globalplan1%pause/emergencycreditsreserve/noreset continue.\n')
select[ledger]='handoff/LEDGER.md'
records=[]
patterns=[rb'gh[pousr]_[A-Za-z0-9]{24,}',rb'github_pat_[A-Za-z0-9_]{30,}',rb'sk-[A-Za-z0-9]{24,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----',rb'AKIA[0-9A-Z]{16}',rb'(?i)(?:postgres(?:ql)?|https?)://[^\s/:]+:[^\s/@]+@']
for local,dest in select.items():
 assert local.is_file() and not local.is_symlink() and not local.name.endswith('.env')
 data=local.read_bytes();data.decode('utf-8');assert len(data)<1_000_000
 scan=data
 for role,var in [('yellow_runtime','YELLOW_RUNTIME_DATABASE_PASSWORD'),('yellow_extension_registrar','YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD')]:
  symbol=('postgres'+'://'+role+':${'+var+':?required}@').encode();scan=scan.replace(symbol,b'<documented-managed-binding-template>')
 assert not any(re.search(pattern,scan) for pattern in patterns),'credential pattern guard: '+local.name
 oid=git('hash-object','-w','--stdin',data=data).decode().strip();git('update-index','--add','--cacheinfo','100644',oid,dest)
 records.append({'path':dest,'local':str(local),'mode':'100644','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':oid})
manifest={'schema':'yellow-444-hosting-artifact-manifest/v1','source_revision':'444072ffdff2b7745345d88f71b603c17e11ace6','parent_artifact_revision':PARENT,'base_tree':BASE,'artifact_only':True,'no_public_app_url':True,'files':[{k:v for k,v in r.items() if k!='local'} for r in records],'excluded':['all managed secret/env/proxy/CA configuration values','private agent config/log/token/binary','opaque Docker/OCI binaries/config','raw PostgreSQL dumps/data/logs','laptop dirty source/business data']}
file=OUT/'ARTIFACT_MANIFEST.json';file.write_text(json.dumps(manifest,indent=2)+'\n');data=file.read_bytes();oid=git('hash-object','-w','--stdin',data=data).decode().strip();dest=PREFIX+'ARTIFACT_MANIFEST.json';git('update-index','--add','--cacheinfo','100644',oid,dest)
records.append({'path':dest,'local':str(file),'mode':'100644','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':oid})
tree=git('write-tree').decode().strip();assert sorted(git('diff','--name-only',BASE,tree).decode().splitlines())==sorted(x['path'] for x in records)
result={'parent':PARENT,'baseTree':BASE,'tree':tree,'branch':'phase-7/source-checkpoint-9ff27ad-20261001','files':records}
(OUT/'publication-freeze.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'files':len(records),'bytes':sum(x['bytes'] for x in records),'tree':tree}))
