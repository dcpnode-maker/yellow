"""Offline exact test tasks; no credentials, model calls, GPU dispatch or code execution."""
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUBLIC = 'd708ff29e2e44df74a5c1a12e58a8cf656b14c8d'
MAP_PUBLIC = '01c9ffa4d35894c29c93bf66556d6c26848a24be'


def sha(text):
    return hashlib.sha256(text.encode('utf8')).hexdigest()


def blob(repo, pin, name):
    return subprocess.check_output(['git', '-C', str(repo), 'show', pin + ':' + name], timeout=15).decode('utf8')


def full(repo, pin, name):
    value = blob(repo, pin, name)
    return {'path': name, 'kind': 'complete-public-file', 'text': value,
            'fullFileSha256': sha(value), 'suppliedSha256': sha(value)}


def prefix(repo, pin, name, end):
    value = blob(repo, pin, name)
    if value.count(end) != 1:
        raise ValueError('Exact complete-function boundary required')
    excerpt = value[:value.index(end)]
    return {'path': name, 'kind': 'public-complete-function-prefix-not-full-module',
            'text': excerpt, 'fullFileSha256': sha(value), 'suppliedSha256': sha(excerpt), 'endMarker': end}


def finance_boundary(repo):
    value = blob(repo, PUBLIC, 'frontend/yellow/src/App.tsx')
    start = value.index('\nfunction MovementGrid(') + 1
    match = re.search(r'^function ([A-Za-z]+)\(', value[start + 1:], re.M)
    if not match:
        raise ValueError('Actual next function required')
    end = start + 1 + match.start()
    next_name = match.group(1)
    old_end = value.find('function ReservationWorkspace', start)
    if next_name != 'LegacyReservationWorkspace' or old_end >= start:
        raise ValueError('Recorded stale boundary no longer matches exact public pin')
    region = value[start:end]
    billing = [line for line in region.splitlines() if 'movement-billing-action' in line]
    if len(billing) != 1:
        raise ValueError('Exact billing evidence required')
    # Label the excerpt honestly; irrelevant giant JSX is not silently truncated.
    text = value[start:value.index('\n', start)] + '\n' + billing[0] + '\n' + value[end:value.index('\n', end)]
    return {'path': 'frontend/yellow/src/App.tsx', 'kind': 'public-boundary-and-billing-evidence-not-full-module',
            'text': text, 'fullFileSha256': sha(value), 'suppliedSha256': sha(text),
            'startLine': value[:start].count('\n') + 1, 'nextFunctionLine': value[:end].count('\n') + 1,
            'startMarker': 'function MovementGrid', 'nextMarker': 'function LegacyReservationWorkspace',
            'oldEndFoundAfterStart': False}


def packet(worker, task, pin, target, instructions, sources, output=2048, seconds=240):
    prompt = instructions + '\n\n' + '\n\n'.join(
        'PUBLIC CONTEXT ' + source['path'] + ' [' + source['kind'] + ']\n' + source['text'] + '\nEND CONTEXT'
        for source in sources)
    size = len(prompt.encode('utf8'))
    if size + 256 + output > 16384:
        raise ValueError('Split task before GPU: capacity exceeded')
    return {'workerId': worker, 'taskId': task, 'publicSourceSha': pin, 'target': target,
            'prompt': prompt, 'promptSha256': sha(prompt), 'sources': sources,
            'contextTokens': 16384, 'outputTokens': output, 'generationSeconds': seconds,
            'inputUtf8UpperBound': size, 'measuredTokenizerCount': False,
            'dispatchState': 'prepared-not-sent', 'accepted': False,
            'generatedCodeExecuted': False, 'sourceApplied': False}


def build_manifest(repo=ROOT):
    spec = importlib.util.spec_from_file_location('fixed_fit_packets', HERE / 'work-packets.py')
    fixed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fixed)
    current = fixed.build_packet(repo)
    worker1 = {'workerId': 'worker-1', 'taskId': current['taskId'], 'batchId': 'fit-0930e',
               'promptSha256': current['promptSha256'], 'dispatchState': 'already-dispatched-do-not-resend',
               'scope': 'Existing ten concrete CDP groups; do not alter in-flight source', 'accepted': False}
    worker2 = packet('worker-2', 'finance-test-boundary-repair', PUBLIC,
        'tests/yellow-reservation-finance-entry.test.ts', '''Return ONE complete replacement TypeScript file in one typescript code fence.
Target tests/yellow-reservation-finance-entry.test.ts. Use the existing bun:test runner, no dependencies.
Only fix test-maintenance; do not change production finance behavior or remove/weaken any existing assertion.
Actual public finding: MovementGrid starts at line2793. The next function is LegacyReservationWorkspace
at line2959; ReservationWorkspace does not occur after MovementGrid. The old end marker is stale.
1. Correct only that end marker to function LegacyReservationWorkspace in the existing movement test.
2. Make sourceBetween(start,end,source=app) testable with small synthetic source strings.
Find end only after the found start; reject missing start and missing end with diagnostics naming
the missing marker. Never return all source or empty text as fallback.
3. Add four deterministic Bun tests: exact slice; missing start even when end exists; missing end
even when an end exists BEFORE start; chooses the first end AFTER start without including later text.
Use meaningful expected bytes and errors. Keep the existing three tests and every original assertion
unchanged except the verified end marker; do not skip tests or lower assertion counts.
The excerpt is labelled boundary evidence, not an executable full App module. Complete original test follows.
Return code only, no essay or runtime claims; parent will inspect and run it.''',
        [full(repo, PUBLIC, 'tests/yellow-reservation-finance-entry.test.ts'), finance_boundary(repo)],
        output=3072, seconds=360)
    worker3 = packet('worker-3', 'map-channel-rejected-state-tests', MAP_PUBLIC,
        'tests/operator-market-channel-worker.test.ts', '''Return ONE complete new TypeScript Bun test file in one typescript code fence.
Target tests/operator-market-channel-worker.test.ts. Use import {expect,test} from "bun:test" and
import {createMarketMapChannel} from "../src/http/operator/market-map.js" (existing intentional
JS-module declaration comment is allowed). No Vitest, DOM, Leaflet, network, dependencies or production changes.
The complete relevant pure functions and existing protocol tests follow. Do NOT repeat their generic
stale-revision, Mercator-edge or basic disposal cases. Implement these additional precise cases:
1. Fresh channel receives malformed data under nonce B, then VALID data under nonce A: accept A.
Use malformed duplicate points and extra envelope field in separate fresh channels; failed input cannot bind nonce B.
2. Accept revision1, then reject a table of high-revision messages (wrong source, wrong origin, wrong nonce,
wrong version, duplicate point IDs); valid revision2 under the original nonce MUST still be accepted.
After each rejected message inspect(originalId,1) remains valid, and after revision2 the revision1 inspect fails.
Use separate fresh channels per mutation to make failures pinpointed.
3. An inspect result is Object.isFrozen true; use Reflect.set to show changing revision or id returns false.
The exact inspect object stays unchanged and a later inspect returns the same correct values.
Supply a tiny local point/envelope/event fixture using the existing APIs. Verify meaningful exact objects,
not test count or source-string checks. This is pure protocol proof, not browser or security acceptance.
Return complete code only; no essay or unfinished analysis. Parent will inspect and run it.''',
        [prefix(repo, MAP_PUBLIC, 'src/http/operator/market-map.js', '/** No network or document access'),
         prefix(repo, MAP_PUBLIC, 'tests/operator-market-map.test.ts', '// This fixture executes our lifecycle only.')])
    return {'schema': 'yellow-findings-worker-tests-v1', 'scope': 'Prepared public test tasks, not worker readiness',
            'planner': 'current Codex coordinator', 'tasks': [worker1, worker2, worker3],
            'automaticDispatch': False, 'modelCallsMadeByPreparation': 0, 'acceptedWork': 0}


def inspect_output(task, text):
    """Deterministic delivery triage, never approval or execution of worker code."""
    verdict = {'accepted': False, 'generatedCodeExecuted': False, 'sourceApplied': False,
               'status': 'incomplete-file'}
    fences = re.findall(r'```(?:typescript|ts)\s*\n(.*?)\n```', text, re.S)
    if len(fences) != 1:
        return verdict
    code = fences[0]
    verdict['codeSha256'] = sha(code)
    if not re.search(r'from\s+[\'\"]bun:test[\'\"]', code) or \
       re.search(r'from\s+[\'\"]vitest[\'\"]|\b(?:test|describe)\.(?:skip|todo|only)\s*\(', code):
        verdict['status'] = 'wrong-or-disabled-test-contract'
    elif task['workerId'] == 'worker-2':
        assertions = [line.strip() for line in task['sources'][0]['text'].splitlines() if line.strip().startswith('expect(')]
        if any(line not in code for line in assertions):
            verdict['status'] = 'original-assertion-missing-or-weakened'
        elif "sourceBetween('function MovementGrid', 'function ReservationWorkspace')" in code or \
             not re.search(r"sourceBetween\(['\"]function MovementGrid['\"],\s*['\"]function LegacyReservationWorkspace['\"]\)", code):
            verdict['status'] = 'stale-boundary-not-repaired'
        else:
            verdict['status'] = 'needs-parent-inspection-and-executable-proof'
    elif task['workerId'] == 'worker-3':
        verdict['status'] = 'needs-parent-inspection-and-executable-proof' if \
            'createMarketMapChannel' in code and 'Reflect.set' in code else 'missing-requested-contract'
    else:
        raise ValueError('Fixed prepared worker task required')
    return verdict


if __name__ == '__main__':
    value = build_manifest()
    if sys.argv[1:] != ['--include-prompts']:
        for task in value['tasks']:
            task.pop('prompt', None)
            for source in task.get('sources', []):
                source.pop('text', None)
    print(json.dumps(value))
