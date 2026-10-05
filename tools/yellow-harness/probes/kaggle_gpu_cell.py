"""Exact small code cell used for the first personal Kaggle GPU startup probe."""

import json, os, platform, time
import torch

r = {"schema":"yellow-hardware-probe-v1", "python":platform.python_version(), "system":platform.system(), "cpu_count":os.cpu_count(), "accelerator":"cuda" if torch.cuda.is_available() else "none", "devices":[], "checks":{"torch":str(torch.__version__)}}
with open('/proc/meminfo', encoding='utf-8') as f:
    line = next((line for line in f if line.startswith('MemTotal:')), None)
r['ram_bytes'] = int(line.split()[1]) * 1024 if line else None
if torch.cuda.is_available():
    for i in range(min(torch.cuda.device_count(), 8)):
        p = torch.cuda.get_device_properties(i)
        r['devices'].append({'name':p.name, 'memory_bytes':p.total_memory})
    start = time.perf_counter()
    a = torch.ones((128,128), device='cuda')
    b = a @ a
    torch.cuda.synchronize()
    r['checks']['tiny_matmul_ms'] = round((time.perf_counter()-start)*1000, 2)
    r['checks']['tiny_matmul_ok'] = float(b[0,0]) == 128.0
print(json.dumps(r, sort_keys=True))
