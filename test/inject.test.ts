import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { injectSelection } from '../src/extension/chrome/inject';

const permissionError = () => new Error('Cannot access contents of the page. Extension manifest must request permission to access the respective host.');
const executeScript = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  executeScript.mockReset();
  vi.stubGlobal('chrome', { scripting: { executeScript } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('toolbar script injection', () => {
  it('injects once without a delay when activeTab access is ready', async () => {
    executeScript.mockResolvedValue([]);
    await injectSelection(42);
    expect(executeScript).toHaveBeenCalledExactlyOnceWith({ target: { tabId: 42 }, files: ['content.js'] });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers when the temporary host permission arrives after the action event', async () => {
    executeScript.mockRejectedValueOnce(permissionError()).mockRejectedValueOnce(permissionError()).mockResolvedValue([]);
    const injection = injectSelection(42);
    await vi.runAllTimersAsync();
    await injection;
    expect(executeScript).toHaveBeenCalledTimes(3);
    expect(executeScript.mock.calls.every(([request]) => request.target.tabId === 42 && request.files[0] === 'content.js')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops retrying a persistent host denial so the caller can open the viewer', async () => {
    const error = permissionError();
    executeScript.mockRejectedValue(error);
    const rejection = expect(injectSelection(42)).rejects.toBe(error);
    await vi.runAllTimersAsync();
    await rejection;
    expect(executeScript).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['Cannot access a chrome:// URL', 'Could not load file: content.js', 'No tab with id: 42'])('preserves immediate fallback for %s', async (message) => {
    const error = new Error(message);
    executeScript.mockRejectedValue(error);
    await expect(injectSelection(42)).rejects.toBe(error);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
