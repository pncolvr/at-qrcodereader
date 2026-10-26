const HOST_PERMISSION_ERROR = 'Extension manifest must request permission to access the respective host.';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 50;

/** activeTab permission updates can reach script injection after onClicked fires. */
export async function injectSelection(tabId: number): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS || !message.includes(HOST_PERMISSION_ERROR)) throw error;
      // Retry the same injection while Chrome finishes propagating the user's
      // temporary grant. This neither invokes the action again nor grants access.
      await new Promise<void>((done) => setTimeout(done, RETRY_DELAY_MS));
    }
  }
}
