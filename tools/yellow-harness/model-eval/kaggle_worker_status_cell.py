"""Read-only status display for the completed synthetic worker pilot."""

import json
import os
from pathlib import Path
import subprocess


root = Path('/kaggle/working/yellow-qwen38')
model = root / 'weights' / 'Qwen3.8-27B-UD-Q4_K_M.gguf'
binary = root / 'runtime' / 'llama-cli'
if not model.is_file() or model.stat().st_size != 16_464_440_224 or not binary.is_file():
    raise RuntimeError('Worker model/runtime files are absent or unexpected')
env = os.environ.copy()
env['LD_LIBRARY_PATH'] = str(binary.parent) + ':/usr/local/nvidia/lib64:' + env.get('LD_LIBRARY_PATH', '')
devices = subprocess.run([str(binary), '--list-devices'], env=env, capture_output=True,
                         text=True, timeout=60, check=True).stdout
if 'CUDA0' not in devices or 'CUDA1' not in devices:
    raise RuntimeError('Expected two-GPU runtime unavailable')
print('Qwen3.8-27B Q4_K_M: model and two-GPU runtime available')
print(devices.strip())
probe = json.loads((root / 'last_probe.json').read_text(encoding='utf-8'))
print('Fresh coding check:', probe['status'], '| exit:', probe['returncode'],
      '| elapsed:', probe.get('elapsed_s', probe.get('elapsed_seconds')), 'seconds')
for path in sorted((root / 'tasks').glob('*.json')):
    task = json.loads(path.read_text(encoding='utf-8'))
    print('Task:', task['task_id'], '| exit:', task['returncode'],
          '| elapsed:', task['elapsed_s'], 'seconds | proposal only')
print('Manual pilot only; no public endpoint or automatic harness connection.')
