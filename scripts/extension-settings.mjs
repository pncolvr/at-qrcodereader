export function extensionBuildDefines(settings = process.env) {
  const value = settings.EXTENSION_WEBSITE_URL?.trim();
  if (!value) return {};

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXTENSION_WEBSITE_URL must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('EXTENSION_WEBSITE_URL must be an absolute HTTPS URL.');
  }
  return { __EXTENSION_WEBSITE_URL__: JSON.stringify(value) };
}
