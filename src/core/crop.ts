import type { ImageSource } from './decode';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Crop (sx, sy, sw, sh) out of `image` (in image pixels), resampled at the requested scale. */
export function cropSource(
  image: CanvasImageSource,
  sx: number, sy: number, sw: number, sh: number,
  canvas: AnyCanvas,
  maxPixels = 16_000_000,
): ImageSource {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as AnyContext;
  return (scale) => {
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    if (w < 21 || h < 21 || w * h > maxPixels) return null; // below the smallest QR version, or too big
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = scale < 1; // nearest-neighbour keeps upscaled modules crisp
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
    const { data, width, height } = ctx.getImageData(0, 0, w, h);
    return { data, width, height };
  };
}
