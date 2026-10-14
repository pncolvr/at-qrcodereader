import { EXAMPLES } from './fixtures';

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    runtime: {
      sendMessage: async () => ({ ok: true, text: EXAMPLES.fatura }),
    },
  },
});

void import('../src/extension/content/content');
