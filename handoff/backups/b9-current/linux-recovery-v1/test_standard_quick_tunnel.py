#!/usr/bin/env python3
"""Two bounded standard Cloudflare Quick Tunnel attempts; no network-policy edits."""
import hashlib,json,os,re,signal,socket,subprocess,time
from pathlib import Path

ROOT=Path(__file__).resolve().parent/'quick-tunnel-v1'
BINARY=Path('/workspace/yellow-toolchain/cloudflared-2026.9.3')
assert not ROOT.exists()
assert hashlib.sha256(BINARY.read_bytes()).hexdigest()=='77e26d8d900e0b8469f416239d14b5f296525fdf79fee6f511ef55609e3fbac2'
assert not any(k in os.environ for k in ('TUNNEL_TOKEN','TUNNEL_TOKEN_FILE','TUNNEL_ORIGIN_CERT','TUNNEL_CONFIG'))
assert not any(p.exists() for p in (Path.home()/'.cloudflared/config.yml',Path('/etc/cloudflared/config.yml')))
ROOT.mkdir(mode=0o700)
results=[]
for index,protocol in enumerate(('auto','http2')):
    metrics=53016+index
    sock=socket.socket();sock.bind(('127.0.0.1',metrics));sock.close()
    args=[str(BINARY),'tunnel','--no-autoupdate','--protocol',protocol,'--metrics','127.0.0.1:'+str(metrics),'--url','http://127.0.0.1:53014']
    path=ROOT/(protocol+'.private.log')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as stream:
        process=subprocess.Popen(args,stdout=stream,stderr=stream,env=os.environ.copy(),start_new_session=True)
    manifest={'command':args,'pid':process.pid,'protocol':protocol,'log':path.name,'scope':'synthetic authenticated b9 temporary preview','proxy_trust_policy_unchanged':True}
    (ROOT/(protocol+'-ownership.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    deadline=time.monotonic()+45
    registered=False
    try:
        while time.monotonic()<deadline and process.poll() is None:
            text=path.read_text(errors='replace')
            if 'Registered tunnel connection' in text:
                registered=True;break
            time.sleep(0.5)
    finally:
        if not registered and process.poll() is None:
            os.killpg(process.pid,signal.SIGTERM)
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=5)
    text=path.read_text(errors='replace')
    urls=sorted(set(re.findall(r'https://[a-z0-9-]+\.trycloudflare\.com',text)))
    # Publish only ordinary connection errors; do not publish settings/config/certificate/token lines.
    errors=[line for line in text.splitlines() if any(s in line for s in ('Failed to dial','failed to dial','Unable to establish','Request failed','timeout','connection refused','network is unreachable','Tunnel server stopped','QUIC connection','Registered tunnel connection')) and not re.search(r'(?i)token|password|certificate|settings',line)]
    result={**manifest,'connection_registered':registered,'generated_urls':urls,'process_retained':registered,'exit_code':process.poll(),'private_log_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sanitized_connection_errors':errors[-20:],'user_openable_url_verified':False,'public_autologin':False,'tls_validation_disabled':False,'proxy_removed_or_runtime_policy_changed':False}
    results.append(result)
    (ROOT/(protocol+'-result.json')).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)
    if registered:break
(ROOT/'RESULTS.json').write_text(json.dumps(results,indent=2)+'\n')
