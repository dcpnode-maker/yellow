#!/usr/bin/env python3
"""Freeze an explicit nonsecret receipt packet, without touching either source index."""
import hashlib,json,os,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RECOVERY=ROOT.parent/'synthetic-recovery-v5'
REPO=Path('/workspace/yellow-release')
PARENT='0aac2a98af76483277b7eb6aca923e919c45bdce'
BASE='8fa7147ff4793bb40d5ed0c2df5f97cf5325dde9'
PREFIX='handoff/backups/b9-current/linux-recovery-v1/'
PRIVATE=ROOT/'publication-inputs-v3'
def main():
 assert not PRIVATE.exists();PRIVATE.mkdir(mode=0o700)
 env=os.environ.copy();env['GIT_INDEX_FILE']=str(PRIVATE/'index')
 def git(*args,data=None):
  return subprocess.run(['git','-C',str(REPO),*args],env=env,input=data,capture_output=True,check=True,timeout=15).stdout
 assert git('rev-parse','HEAD').decode().strip()=='9ff27ad8765dc75ebae9e083d4635c7a9b89fa62'
 assert not subprocess.run(['git','-C',str(REPO),'status','--porcelain=v1'],capture_output=True,check=True).stdout
 assert not subprocess.run(['git','-C','/workspace/yellow-receiving-b9','status','--porcelain=v1'],capture_output=True,check=True).stdout
 git('read-tree',BASE)
 names=['LAPTOP_LINUX_RECOVERY_HANDOFF.md','PUBLIC_LINK_STATUS.md','ORDER.md','DATABASE_PROOF_ORDER.md','LINUX_RECEIVING_PLAN.md','CI_QUALITY_FAILURE_HANDOFF.md','CI_SUCCESSOR_TIMEOUT_HANDOFF.md','PRODUCT_SOURCE_EQUIVALENCE.json','BUILD_INPUT_MANIFEST_V2.json','LINUX_IMAGE_BUILD_PROOF.json','B9_OCI_CONTENT_PROOF.json','INDEPENDENT_B9_IMAGE_OCI_REVIEW.md','INDEPENDENT_B9_IMAGE_OCI_REVIEW.json','ROOT_PRIVATE_B9_REVIEW.json','root_verify_private_b9.py','CANONICAL_REFEREE_SUMMARY.json','HOST_ENVIRONMENT_OBSERVATION.json','runtime-image-status.json','runtime-image-status-v2.json','database-tools-image-status-v2.json','OCI_VERIFIER_INITIAL_FAILURE.json','b9-export-execution.json','build_pinned_images.py','verify_b9_oci_export.py','docker_save_to_oci.py','run_owned_b9_image_export.py','freeze_linux_recovery_packet.py','test_standard_quick_tunnel.py','quick-tunnel-v1/VERIFIED_QUICK_TUNNEL_FAILURES.json','database-proof-v1/failure-receipt.json','database-proof-v1/CONNECTIVITY_DIAGNOSIS.json','database-proof-v2/FINAL_PRIVATE_LOOPBACK_RECEIPT.json','database-proof-v2/database-snapshot.json','database-proof-v2/database-snapshot-pg_roles-masked.json','database-proof-v2/setup-status.json','database-proof-v2/seed-status.json','database-proof-v2/schema-check-status.json']
 names.extend(['HTTPS_PROVISIONING_DIAGNOSTIC.json','HTTPS_CLIENT_COMPARISON.json','PROVISIONING_PROXY_FINDING.json','HOST_ENVIRONMENT_OBSERVATION_CURRENT.json','CURRENT_PRIVATE_ORIGIN_RECHECK.json','PRODUCT_SOURCE_EQUIVALENCE_444.json','CI_444_OBSERVATION.json','SUPPORTED_HOSTING_CONFIGURATION_REQUEST.md'])
 selections={ROOT/n:PREFIX+n for n in names}
 for version in range(1,5):
  selections[ROOT.parent/f'synthetic-recovery-v{version}'/'FAILED_ATTEMPT_RECEIPT.json']=PREFIX+f'recovery-v{version}-failure.json'
 for name in ['ORDER.md','compose.yml','recover_synthetic_origin.py','test_recovery_guards.py','BUILDER_RECEIPT.md','INDEPENDENT_SCHEMA_RECOVERY_REVIEW.md','INDEPENDENT_SCHEMA_RECOVERY_REVIEW.json','ACTUAL_RECOVERY_PROOF.json','ROOT_RECOVERY_REVIEW.md']:
  selections[RECOVERY/name]=PREFIX+'recovery-v5/'+name
 for name in ['ORDER.md','compose.yml','recover_synthetic_origin.py','test_recovery_guards.py','BUILDER_RECEIPT.md','INDEPENDENT_RECOVERY_DIAGNOSTIC_REVIEW.md','INDEPENDENT_RECOVERY_DIAGNOSTIC_REVIEW.json','RECOVERY_READINESS_SOURCE_ISSUE.md','RECOVERY_READINESS_SOURCE_ISSUE.json','RECOVERY_READINESS_REPAIR_ORDER.md','ACTUAL_RECOVERY_PROOF.json','ROOT_RECOVERY_REVIEW.md']:
  selections[ROOT.parent/'synthetic-recovery-v6'/name]=PREFIX+'recovery-v6/'+name
 old=git('show',BASE+':handoff/LEDGER.md')
 assert old==(ROOT.parent/'hosting-fix-discussion-v1/publication-inputs/artifact-ledger.md').read_bytes()
 append=b'\n\n### RELEASE-20261001 reviewed b9 Linux image, synthetic recovery and standard Quick Tunnel proof\n\n- Exact b9 product source/image/native type/boundary/frontend/backend builds and offline OCI bytes independently reviewed; all291 selected image files and11 layers match. b9 and7f1 product paths equal; laptop owns test-only CI. Actual canonical fresh103 setup/11invariants/seed/fullPG18schema passed. Private latest source loopback53014 health/ready/UI200, anonymous401/privatepaths404; no browser/login/fullPMS claim.\n- Root executes and retains bounded synthetic100 backup/restore attempts and strict original grantor/full-schema comparison evidence, with independent nonimplementer review. Original services/source data remain unchanged. This packet is synthetic, VM-local, not offhost business recovery or cold-cache proof. Exact recovery result and all failed attempts are explicit in handoff.\n- Founder specifically authorized ordinary temporary tunnel alternatives; actual verified cloudflared defaultauto/http2 both fail Quick Tunnel provisioning API HTTPS443 connectionrefused BEFORE edge7844. No URL/registered connection; no tunnel retries, APIhostname-as-link claim, TLS/proxy/policy bypass, phone-token reuse, purchase or emergency credits. Runtime status216 only/status API, no port exposure/editor/private HTTP binding; no public app URL or ETA. Laptop remains controller/source/integrator.\n'
 ledger=PRIVATE/'artifact-ledger.md';ledger.write_bytes(old+append);selections[ledger]='handoff/LEDGER.md'
 records=[]
 patterns=[rb'gh[pousr]_[A-Za-z0-9]{24,}',rb'github_pat_[A-Za-z0-9_]{30,}',rb'sk-[A-Za-z0-9]{24,}',rb'-----BEGIN [A-Z ]*PRIVATE KEY-----',rb'AKIA[0-9A-Z]{16}',rb'(?i)(?:postgres(?:ql)?|https?)://[^\s/:]+:[^\s/@]+@']
 for local,dest in selections.items():
  assert local.is_file() and not local.is_symlink()
  assert 'private-' not in local.name and not str(local).endswith('.env')
  data=local.read_bytes();data.decode('utf-8')
  scanned=data
  for role,var in [('yellow_runtime','YELLOW_RUNTIME_DATABASE_PASSWORD'),('yellow_extension_registrar','YELLOW_EXTENSION_REGISTRAR_DATABASE_PASSWORD')]:
   scanned=scanned.replace(('postgres://'+role+':${'+var+':?required}@').encode(),b'postgres://<managed-required-binding>@')
  if local==Path(__file__).resolve():
   template_source="".join(["('","postgres","://","'+role+':${'+var+':?required}@')"])
   scanned=scanned.replace(template_source.encode(),b'<known-python-managed-binding-template>')
  assert not any(re.search(p,scanned) for p in patterns),'credential pattern guard: '+str(local)
  oid=git('hash-object','-w','--stdin',data=data).decode().strip();git('update-index','--add','--cacheinfo','100644',oid,dest)
  records.append({'path':dest,'local':str(local),'mode':'100644','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':oid})
 manifest={'schema':'yellow-linux-recovery-artifact-manifest/v1','source_revision':'b9ba702a074a487feeafa056abb49abcdcf01ba8','original_source_revision':'9ff27ad8765dc75ebae9e083d4635c7a9b89fa62','parent_artifact_revision':PARENT,'base_tree':BASE,'artifact_only':True,'files':[{k:v for k,v in row.items() if k!='local'} for row in records],'excluded':['credential/env bindings','private SQL dumps/raw command logs','opaque OCI/Docker image binaries/config','laptop dirty source','real business data'],'no_public_app_url':True}
 path=PRIVATE/'ARTIFACT_MANIFEST.json';path.write_text(json.dumps(manifest,indent=2)+'\n');data=path.read_bytes();oid=git('hash-object','-w','--stdin',data=data).decode().strip();dest=PREFIX+'ARTIFACT_MANIFEST.json';git('update-index','--add','--cacheinfo','100644',oid,dest)
 records.append({'path':dest,'local':str(path),'mode':'100644','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'git_blob':oid})
 tree=git('write-tree').decode().strip()
 assert sorted(git('diff','--name-only',BASE,tree).decode().splitlines())==sorted(row['path'] for row in records)
 result={'parent':PARENT,'baseTree':BASE,'tree':tree,'branch':'phase-7/source-checkpoint-9ff27ad-20261001','files':records}
 (PRIVATE/'publication-freeze.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'files':len(records),'tree':tree,'total_bytes':sum(r['bytes'] for r in records)}))
if __name__=='__main__':main()
