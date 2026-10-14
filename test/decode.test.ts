import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { decodeQr, decodeWithRetries, type RawImage } from '../src/core/decode';
import { EXAMPLES } from './fixtures';

// Render a QR as RGBA at `px` pixels per module with `margin` modules of quiet zone.
// The spec asks for ECC M, byte mode, 2 px/module and a 2-module (0.25 cm) margin.
function render(text: string, px = 2, margin = 2): RawImage {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const size = (n + margin * 2) * px;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(x, y))
        for (let dy = 0; dy < px; dy++)
          for (let dx = 0; dx < px; dx++) {
            const i = (((y + margin) * px + dy) * size + (x + margin) * px + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  return { data, width: size, height: size };
}

function nearest(img: RawImage, scale: number): RawImage {
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = (Math.min(img.height - 1, Math.floor(y / scale)) * img.width + Math.min(img.width - 1, Math.floor(x / scale))) * 4;
      data.set(img.data.subarray(s, s + 4), (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

describe('decoding', () => {
  for (const [name, msg] of Object.entries(EXAMPLES)) {
    it(`decodes spec example "${name}" at spec settings`, () => {
      expect(decodeQr(render(msg))).toBe(msg);
    });
  }

  it('retries at other scales when the capture is small', () => {
    const base = render(EXAMPLES.simplificada, 1, 4); // 1 px per module, e.g. a zoomed-out page
    const seen: number[] = [];
    const out = decodeWithRetries((s) => (seen.push(s), nearest(base, s)));
    expect(out).toBe(EXAMPLES.simplificada);
  });

  it('returns null when there is no QR code', () => {
    const blank: RawImage = { data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 };
    expect(decodeWithRetries(() => blank)).toBeNull();
  });
});
