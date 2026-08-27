import { useRef, useCallback, useEffect } from 'react';
import { renderDrawingCommands } from '../utils/drawingRenderer';

interface UseCanvasOptions {
  strokeColor?: string;
  strokeWidth?: number;
  onStrokeComplete?: (canvasPng: string, canvasWidth: number, canvasHeight: number) => void;
  smoothingEnabled?: boolean;
}

export function useCanvas(options: UseCanvasOptions = {}) {
  // Two canvases: background (completed strokes) and foreground (active stroke)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const fgCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Raw points of current stroke
  const rawPointsRef = useRef<Array<{ x: number; y: number }>>([]);

  // Detect Kindle / E-Ink
  const isEInk = useCallback(() => {
    const ua = navigator.userAgent || '';
    return ua.includes('Kindle') || ua.includes('Silk') || ua.includes('KFOT') || ua.includes('KFTT') || ua.includes('KFJWI') || ua.includes('KFJWA') || ua.includes('KFAPWI') || ua.includes('KFAPWA');
  }, []);

  // Initialize both canvases
  const initCanvas = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!bgCanvas || !fgCanvas) return;

    const updateSize = () => {
      const rect = fgCanvas.getBoundingClientRect();
      const dpr = isEInk() ? 1 : (window.devicePixelRatio || 1);

      // Size both canvases identically
      for (const canvas of [bgCanvas, fgCanvas]) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      // Background context (completed strokes)
      const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: false });
      if (bgCtx) {
        if (dpr !== 1) bgCtx.scale(dpr, dpr);
        bgCtx.lineCap = 'round';
        bgCtx.lineJoin = 'round';
        bgCtx.strokeStyle = '#000000';
        bgCtx.lineWidth = 2;
        bgCtxRef.current = bgCtx;
      }

      // Foreground context (active stroke)
      const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: false });
      if (fgCtx) {
        if (dpr !== 1) fgCtx.scale(dpr, dpr);
        fgCtx.lineCap = 'round';
        fgCtx.lineJoin = 'round';
        fgCtx.strokeStyle = '#000000';
        fgCtx.lineWidth = 2;
        fgCtxRef.current = fgCtx;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [isEInk]);

  // Get coordinates from pointer event
  const getPoint = useCallback((e: React.PointerEvent | PointerEvent) => {
    const canvas = fgCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Catmull-Rom spline with tangent clamping to prevent overshoot at sharp corners
  const catmullRomSmooth = useCallback((raw: Array<{ x: number; y: number }>, steps = 8): Array<{ x: number; y: number }> => {
    if (raw.length < 3) return raw;

    const result: Array<{ x: number; y: number }> = [];
    const TENSION = 0.4; // 0.5 = standard Catmull-Rom, lower = less overshoot
    const CLAMP_FACTOR = 4.0; // max tangent length as multiple of segment length

    for (let i = 0; i < raw.length - 1; i++) {
      const p0 = raw[Math.max(0, i - 1)];
      const p1 = raw[i];
      const p2 = raw[i + 1];
      const p3 = raw[Math.min(raw.length - 1, i + 2)];

      // Segment length
      const segLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const maxTangent = segLen * CLAMP_FACTOR;

      // Tangents at p1 and p2 (Catmull-Rom style)
      let t1x = TENSION * (p2.x - p0.x);
      let t1y = TENSION * (p2.y - p0.y);
      let t2x = TENSION * (p3.x - p1.x);
      let t2y = TENSION * (p3.y - p1.y);

      // Clamp tangent magnitudes to prevent overshoot
      const t1Len = Math.sqrt(t1x * t1x + t1y * t1y);
      if (t1Len > maxTangent) {
        const scale = maxTangent / t1Len;
        t1x *= scale;
        t1y *= scale;
      }
      const t2Len = Math.sqrt(t2x * t2x + t2y * t2y);
      if (t2Len > maxTangent) {
        const scale = maxTangent / t2Len;
        t2x *= scale;
        t2y *= scale;
      }

      // Hermite basis functions
      for (let t = 0; t < steps; t++) {
        const s = t / steps;
        const s2 = s * s;
        const s3 = s2 * s;

        // Hermite basis
        const h00 = 2 * s3 - 3 * s2 + 1;
        const h10 = s3 - 2 * s2 + s;
        const h01 = -2 * s3 + 3 * s2;
        const h11 = s3 - s2;

        const x = h00 * p1.x + h10 * t1x + h01 * p2.x + h11 * t2x;
        const y = h00 * p1.y + h10 * t1y + h01 * p2.y + h11 * t2y;

        result.push({ x, y });
      }
    }

    // Add the last point
    result.push(raw[raw.length - 1]);

    return result;
  }, []);

  // Draw a stroke on a given context
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, color: string, width: number) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
  }, []);

  // Start stroke
  const startStroke = useCallback((e: React.PointerEvent) => {
    const point = getPoint(e);
    if (!point) return;

    isDrawingRef.current = true;
    rawPointsRef.current = [point];

    // Cancel pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Clear foreground canvas
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (fgCtx && fgCanvas) {
      fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    }

    // Draw first point on foreground
    if (fgCtx) {
      fgCtx.beginPath();
      fgCtx.strokeStyle = options.strokeColor || '#000000';
      fgCtx.lineWidth = options.strokeWidth || 2;
      fgCtx.moveTo(point.x, point.y);
    }
  }, [getPoint, options.strokeColor, options.strokeWidth]);

  // Continue stroke — draw raw on foreground
  const continueStroke = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;

    const point = getPoint(e);
    if (!point) return;

    rawPointsRef.current.push(point);

    // Draw raw line on foreground (immediate, no smoothing)
    const fgCtx = fgCtxRef.current;
    if (fgCtx) {
      fgCtx.lineTo(point.x, point.y);
      fgCtx.stroke();
      fgCtx.beginPath();
      fgCtx.moveTo(point.x, point.y);
    }
  }, [getPoint]);

  // End stroke — smooth and render to background
  const endStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const raw = rawPointsRef.current;
    const bgCtx = bgCtxRef.current;
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;

    if (!bgCtx || !fgCtx || !fgCanvas || raw.length < 2) {
      rawPointsRef.current = [];
      return;
    }

    // Clear foreground
    fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);

    // Apply smoothing if enabled
    const smoothed = options.smoothingEnabled ? catmullRomSmooth(raw) : raw;

    // Draw smoothed stroke on background
    drawStroke(bgCtx, smoothed, options.strokeColor || '#000000', options.strokeWidth || 2);

    // Export PNG (debounced)
    const debounceMs = parseInt(localStorage.getItem('candle_debounce') || '500', 10);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const bgCanvas = bgCanvasRef.current;
      if (bgCanvas) {
        const png = bgCanvas.toDataURL('image/png');
        const dpr = isEInk() ? 1 : (window.devicePixelRatio || 1);
        const cssWidth = Math.round(bgCanvas.width / dpr);
        const cssHeight = Math.round(bgCanvas.height / dpr);
        options.onStrokeComplete?.(png, cssWidth, cssHeight);
      }
    }, debounceMs);

    rawPointsRef.current = [];
  }, [options.onStrokeComplete, options.smoothingEnabled, options.strokeColor, options.strokeWidth, catmullRomSmooth, drawStroke]);

  // Clear both canvases
  const clearCanvas = useCallback(() => {
    const bgCtx = bgCtxRef.current;
    const bgCanvas = bgCanvasRef.current;
    const fgCtx = fgCtxRef.current;
    const fgCanvas = fgCanvasRef.current;

    if (bgCtx && bgCanvas) {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    }
    if (fgCtx && fgCanvas) {
      fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    }
  }, []);

  // Render AI drawing on background canvas
  const renderAIDrawing = useCallback((drawingCommands: any[]) => {
    const bgCtx = bgCtxRef.current;
    if (!bgCtx || !drawingCommands) return;
    renderDrawingCommands(bgCtx, drawingCommands);
  }, []);

  // Export background canvas as PNG
  const exportPNG = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return null;
    return bgCanvas.toDataURL('image/png');
  }, []);

  // Initialize on mount
  useEffect(() => {
    const cleanup = initCanvas();
    return cleanup;
  }, [initCanvas]);

  return {
    bgCanvasRef,
    fgCanvasRef,
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    renderAIDrawing,
    exportPNG
  };
}
