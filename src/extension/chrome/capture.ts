import { cropSource } from '../core/crop';
import { decodeWithRetries } from '../core/decode';

export interface Box { x: number; y: number; w: number; h: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * `box` is in CSS pixels of the viewport, `viewportWidth` is window.innerWidth at the time.
 * The screenshot is in device pixels, so the ratio of the two gives the scale (this also
 * accounts for browser zoom).
 */
export async function cropAndDecode(dataUrl: string, box: Box, viewportWidth: number): Promise<string | null> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const k = bitmap.width / viewportWidth;
    const sx = clamp(Math.floor(box.x * k), 0, bitmap.width - 1);
    const sy = clamp(Math.floor(box.y * k), 0, bitmap.height - 1);
    const sw = clamp(Math.ceil(box.w * k), 1, bitmap.width - sx);
    const sh = clamp(Math.ceil(box.h * k), 1, bitmap.height - sy);
    return decodeWithRetries(cropSource(bitmap, sx, sy, sw, sh, new OffscreenCanvas(1, 1)));
  } finally {
    bitmap.close();
  }
}
