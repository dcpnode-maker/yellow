import { expect, test } from 'bun:test';
import { invokeCdp } from './helpers/cdp-invoke';

test('CDP proof inputs remain arguments even with executable-looking text', async () => {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const send = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    calls.push({ method, params });
    return (method === 'Runtime.evaluate'
      ? { result: { objectId: 'document-1' } }
      : { result: { value: true } }) as T;
  };
  const hostile = `');globalThis.unexpectedExecution=true;//\n<script>alert(1)</script>`;
  for (const operation of ['set-input', 'click-text', 'set-textarea', 'submit-yellow'] as const) {
    expect(await invokeCdp<boolean>(send, operation, [hostile, hostile])).toBe(true);
  }
  const evaluated = calls.filter(call => call.method === 'Runtime.evaluate');
  expect(evaluated).toHaveLength(4);
  expect(evaluated.every(call => call.params.expression === 'document')).toBe(true);
  const invoked = calls.filter(call => call.method === 'Runtime.callFunctionOn');
  expect(invoked).toHaveLength(4);
  for (const call of invoked) {
    expect(call.params.functionDeclaration).not.toContain(hostile);
    expect(call.params.arguments).toEqual([{ value: hostile }, { value: hostile }]);
    expect(call.params.awaitPromise).toBe(true);
  }
  expect(calls.filter(call => call.method === 'Runtime.releaseObject')).toHaveLength(4);
});

test('CDP document handles are released after a failed browser operation', async () => {
  const calls: string[] = [];
  const send = async <T>(method: string): Promise<T> => {
    calls.push(method);
    return (method === 'Runtime.evaluate'
      ? { result: { objectId: 'document-1' } }
      : { exceptionDetails: { text: 'synthetic failure' } }) as T;
  };
  await expect(invokeCdp(send, 'click-text', ['missing'])).rejects.toThrow('Browser proof operation failed');
  expect(calls).toEqual(['Runtime.evaluate', 'Runtime.callFunctionOn', 'Runtime.releaseObject']);
});
