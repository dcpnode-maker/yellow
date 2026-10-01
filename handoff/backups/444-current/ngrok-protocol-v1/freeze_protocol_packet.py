#!/usr/bin/env python3
"""Freeze only explicit public helper/proof records; do not modify source index."""
import hashlib,json,os,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=Path('/workspace/yellow-release')
PARENT='b0dbf54fd80b2048a5435570e8bbb10825aae965'
BASE='a7296ff57a63071a93411974ba8d7b187d5a75e7'
PREFIX='handoff/backups/444-current/ngrok-protocol-v1/'
OUT=ROOT/'publication-protocol-inputs-v1'
assert not OUT.exists();OUT.mkdir(mode=0o700)
env=os.environ.copy();env['GIT_INDEX_FILE']=str(OUT/'index')
def git(*args,data=None):return subprocess.run(['git','-C',str(REPO),*args],env=env,input=data,capture_output=True,check=True,timeout=15).stdout
assert git('rev-parse',PARENT+'^{tree}').decode().strip()==BASE
for path,sha in [(REPO,'9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'),(Path('/workspace/yellow-receiving-b9'),'b9ba702a074a487feeafa056abb49abcdcf01ba8'),(Path('/workspace/yellow-candidate-444'),'444072ffdff2b7745345d88f71b603c17e11ace6')]:
 assert subprocess.check_output(['git','-C',str(path),'rev-parse','HEAD']).decode().strip()==sha
 assert not subprocess.check_output(['git','-C',str(path),'status','--porcelain=v1'])
git('read-tree',BASE)
names=['NO_SECRET_DIAGNOSE_EXECUTION.json','NO_TOKEN_AGENT_START_EXECUTION.json','NO_TOKEN_AGENT_REDACTED.log','BOUNDED_PROTOCOL_RESULT.json','NGROK_NO_TOKEN_PROTOCOL_HANDOFF.md','PROTOCOL_PREFLIGHT_ORDER.md','INDEPENDENT_NO_TOKEN_PROTOCOL_REVIEW.md','INDEPENDENT_NO_TOKEN_PROTOCOL_REVIEW.json','IMPLICIT_DIAGNOSTIC_REPORT_PRIVACY.json','NATIVE_POSTGRES_BOUNDARY.md','freeze_protocol_packet.py']
select={ROOT/name:PREFIX+name for name in names}
ledger=OUT/'artifact-ledger.md'
ledger.write_bytes(git('show',BASE+':handoff/LEDGER.md')+b'\n\n### RELEASE-20261001 actual bounded no-token ngrok protocol preflight\n\n- Founder/controllerauthorized root26s actual ngrok3.39.11 start with explicitexistingmanagedproxy/trustedCA and no authtoken, preservedGoogle-emaildeny. Sixfailedsendauthrequest/sessionclosed messages, no providerauthtokenrejection/session/URL; exactownedchild gracefullystopped, exit0onstop is NOTsuccess. No proxy/CA/TLS/route changes, account/paidresources or unchangedCFretries. Standarddiagnose proxyTCPok butgenericDNS/internetwarn; notsessionproof, no repeats.\n- Privatecloud444 app53018 stillready200/frontier103; old9ff/b9images/servicespreserved. Runtime226/statusonly has no callable nativeHTTP/configuration/securesecretbinding. Supportedbindingproposal explicitunavailable, no secretinchat/Git/browserpermissionbypass. Laptop reports preferredoldUIorder737/assetsDusA4ysm-C9ZASg81/receipt734/container34b83ec; cloudattributeslaptoponly, no unreviewedfrontendcopy. NopublicURL or durablebusinessrecoveryclaim; laptopcontroller andplan1%pause/emergencyreserve unchanged.\n')
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
manifest={'schema':'yellow-ngrok-protocol-artifact-manifest/v1','source_revision':'444072ffdff2b7745345d88f71b603c17e11ace6','parent_artifact_revision':PARENT,'base_tree':BASE,'artifact_only':True,'no_public_app_url':True,'files':[{k:v for k,v in r.items() if k!='local'} for r in records],'excluded':['all managed secret/env/proxy/CA configuration values','private agent config/log/token/binary','opaque Docker/OCI binaries/config','raw PostgreSQL dumps/data/logs','laptop dirty source/business data']}
file=OUT/'ARTIFACT_MANIFEST.json';file.write_text(json.dumps(manifest,indent=2)+'\n');data=file.read_bytes();oid=git('hash-object','-w','--stdin',data=data).decode().strip();dest=PREFIX+'ARTIFACT_MANIFEST.json';git('update-index','--add','--cacheinfo','100644',oid,dest)
records.append({'path':dest,'local':str(file),'mode':'100644','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':oid})
tree=git('write-tree').decode().strip();assert sorted(git('diff','--name-only',BASE,tree).decode().splitlines())==sorted(x['path'] for x in records)
result={'parent':PARENT,'baseTree':BASE,'tree':tree,'branch':'phase-7/source-checkpoint-9ff27ad-20261001','files':records}
(OUT/'publication-freeze.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'files':len(records),'bytes':sum(x['bytes'] for x in records),'tree':tree}))
