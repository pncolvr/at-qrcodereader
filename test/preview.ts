import { EXAMPLES, INVALID_EXAMPLE } from './fixtures';

const previewPayload = new URLSearchParams(location.search).has('invalid')
  ? INVALID_EXAMPLE
  : EXAMPLES.fatura;

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      sendMessage: async () => ({ ok: true, text: previewPayload }),
    },
  },
});

void import('../src/extension/content/content');
