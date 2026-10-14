import jsQR from 'jsqr';

export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Returns the selection rendered at the given scale, or null to skip that scale. */
export type ImageSource = (scale: number) => RawImage | null;

// Screenshots of printed QR codes are often small (the spec's minimum is 30 mm at
// 2 px/module), so upscaling first is the cheapest way to help the decoder.
export const DEFAULT_SCALES = [1, 2, 3, 0.5];

export function decodeQr(img: RawImage): string | null {
  const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  return result ? result.data : null;
}

export function decodeWithRetries(source: ImageSource, scales: number[] = DEFAULT_SCALES): string | null {
  for (const scale of scales) {
    const img = source(scale);
    if (!img) continue;
    const text = decodeQr(img);
    if (text) return text;
  }
  return null;
}
