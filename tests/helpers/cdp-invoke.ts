/** Browser proof inputs are data, not interpolated JavaScript source. */
type CdpSend = <T>(method: string, params: Record<string, unknown>) => Promise<T>;
type RemoteResult<T> = {
  result?: { objectId?: string; value?: T };
  exceptionDetails?: { text?: string };
};

const OPERATIONS = {
  "set-input": `function(selector, value) {
    const input = this.querySelector(selector);
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles:true}));
  }`,
  "click-text": `function(text) {
    const node = [...this.querySelectorAll('button,label')].find(item => item.textContent?.includes(text));
    if (!node) throw new Error('Missing ' + text);
    node.click();
  }`,
  "set-textarea": `function(value) {
    const input = this.querySelector('.reservation-lifecycle-confirmation textarea');
    if (!(input instanceof HTMLTextAreaElement)) throw new Error('Missing reason textarea');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles:true}));
  }`,
  "submit-yellow": `async function(message) {
    const input = this.querySelector('[aria-label="Ask Yellow"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing Yellow input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, message);
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    this.querySelector('[aria-label="Send request to Yellow"]').click();
    return true;
  }`,
} as const;

export async function invokeCdp<T>(
  send: CdpSend,
  operation: keyof typeof OPERATIONS,
  args: readonly string[],
): Promise<T | undefined> {
  if (!Object.hasOwn(OPERATIONS, operation)) throw new Error('Unknown browser proof operation');
  const document = await send<RemoteResult<unknown>>('Runtime.evaluate', {
    expression: 'document', returnByValue: false,
  });
  const objectId = document.result?.objectId;
  if (document.exceptionDetails || !objectId) throw new Error('Browser document is unavailable');
  try {
    const response = await send<RemoteResult<T>>('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: OPERATIONS[operation],
      arguments: args.map(value => ({ value })),
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error('Browser proof operation failed');
    return response.result?.value;
  } finally {
    await send('Runtime.releaseObject', { objectId }).catch(() => undefined);
  }
}
