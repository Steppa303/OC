/**
 * Content Detection — finds bounding box of existing content on canvas.
 * Used for relative positioning of AI drawing commands.
 */

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detect the bounding box of non-white content on a canvas.
 * Scans every 4th pixel for performance.
 * Returns full canvas bounds if canvas is empty.
 */
export function detectContentBounds(canvas: HTMLCanvasElement): ContentBounds {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { x: 0, y: 0, width: canvas.width, height: canvas.height };

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  // Scan every 4th pixel for performance
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Not white (or near-white) and not transparent
      if (a > 128 && (r < 240 || g < 240 || b < 240)) {
        hasContent = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
