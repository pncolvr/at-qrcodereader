export function listenForEscape(target: EventTarget, cancel: () => void) {
  const controller = new AbortController();
  const onKey = (event: Event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Escape') return;
    keyEvent.stopPropagation();
    cancel();
  };
  target.addEventListener('keydown', onKey, { capture: true, signal: controller.signal });
  return () => controller.abort();
}