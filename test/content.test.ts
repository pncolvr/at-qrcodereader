import { describe, expect, it, vi } from 'vitest';
import { listenForEscape } from '../src/extension/content/escape';

function dispatchKey(target: EventTarget, key: string) {
  const event = new Event('keydown', { bubbles: true });
  Object.defineProperty(event, 'key', { value: key });
  target.dispatchEvent(event);
  return event;
}

describe('capture keyboard handling', () => {
  it('cancels on Escape and removes the listener when capture ends', () => {
    const target = new EventTarget();
    const cancel = vi.fn();
    const stopListening = listenForEscape(target, cancel);

    const event = dispatchKey(target, 'Escape');

    expect(cancel).toHaveBeenCalledOnce();
    expect(event.cancelBubble).toBe(true);

    stopListening();
    dispatchKey(target, 'Escape');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('handles Escape again in a subsequent capture session', () => {
    const target = new EventTarget();
    const cancel = vi.fn();

    let stopListening = listenForEscape(target, cancel);
    dispatchKey(target, 'Escape');
    stopListening();
    stopListening = listenForEscape(target, cancel);
    dispatchKey(target, 'Escape');

    expect(cancel).toHaveBeenCalledTimes(2);
    stopListening();
  });

  it('does not cancel capture for other keys', () => {
    const target = new EventTarget();
    const cancel = vi.fn();
    const stopListening = listenForEscape(target, cancel);

    dispatchKey(target, 'Enter');

    expect(cancel).not.toHaveBeenCalled();
    stopListening();
  });
});