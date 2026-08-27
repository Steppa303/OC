import { useRef, useCallback, useEffect } from 'react';
import { renderDrawingCommands } from '../utils/drawingRenderer';

interface UseCanvasOptions {
  strokeColor?: string;
  strokeWidth?: number;
  onStrokeComplete?: (canvasPng: string) => void;
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- E-Ink optimized drawing state ---
  const pendingPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const rafIdRef = useRef<number | null>(null);
  const strokeColorRef = useRef('#000000');
  const strokeWidthRef = useRef(2);
  const lastDrawnPointRef = useRef<{ x: number; y: number } | null>(null);
  // Last smoothed point for causal EMA smoothing
  const lastSmoothedRef = useRef<{ x: number; y: number } | null>(null);
  const SMOOTHING_FACTOR = 0.4; // 0 = no smoothing, 1 = max smoothing (0.4 = moderate)

  // Detect Kindle / E-Ink: disable DPR scaling for 1:1 pixel mapping
  const isEInk = useCallback(() => {
    const ua = navigator.userAgent || '';
    return ua.includes('Kindle') || ua.includes('Silk') || ua.includes('KFOT') || ua.includes('KFTT') || ua.includes('KFJWI') || ua.includes('KFJWA') || ua.includes('KFAPWI') || ua.includes('KFAPWA');
  }, []);

  // Initialize canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      // On E-Ink: 1:1 pixel mapping (no DPR scaling)
      // On normal screens: use DPR for crisp rendering
      const dpr = isEInk() ? 1 : (window.devicePixelRatio || 1);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (ctx) {
        if (dpr !== 1) ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Pre-set static styles (avoid state changes per point)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctxRef.current = ctx;
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, [isEInk]);

  // Get canvas coordinates from pointer event
  const getCanvasPoint = useCallback((e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Flush pending points to canvas (called once per rAF frame)
  // Uses causal EMA: each smoothed point depends only on previous smoothed point
  // No recalculation, no gaps, works with incremental drawing
  const flushPoints = useCallback(() => {
    rafIdRef.current = null;

    const ctx = ctxRef.current;
    const points = pendingPointsRef.current;
    if (!ctx || points.length === 0) return;

    // Clear the pending buffer
    const toDraw = points.slice();
    pendingPointsRef.current = [];

    const alpha = SMOOTHING_FACTOR;
    let prev = lastSmoothedRef.current;

    ctx.beginPath();
    ctx.strokeStyle = strokeColorRef.current;
    ctx.lineWidth = strokeWidthRef.current;

    // Move to first point
    if (!prev) {
      // First point of stroke — no smoothing yet
      prev = toDraw[0];
      lastSmoothedRef.current = prev;
      ctx.moveTo(prev.x, prev.y);
      // Draw remaining points with EMA
      for (let i = 1; i < toDraw.length; i++) {
        const raw = toDraw[i];
        const sx: number = prev.x + alpha * (raw.x - prev.x);
        const sy: number = prev.y + alpha * (raw.y - prev.y);
        ctx.lineTo(sx, sy);
        prev = { x: sx, y: sy };
      }
    } else {
      // Continue from last smoothed point
      ctx.moveTo(prev.x, prev.y);
      for (let i = 0; i < toDraw.length; i++) {
        const raw = toDraw[i];
        const sx: number = prev.x + alpha * (raw.x - prev.x);
        const sy: number = prev.y + alpha * (raw.y - prev.y);
        ctx.lineTo(sx, sy);
        prev = { x: sx, y: sy };
      }
    }

    ctx.stroke();

    // Update state
    lastSmoothedRef.current = prev;
    lastDrawnPointRef.current = prev;
  }, []);

  // Schedule a frame if not already scheduled
  const scheduleFrame = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushPoints);
    }
  }, [flushPoints]);

  // Start stroke
  const startStroke = useCallback((e: React.PointerEvent) => {
    const point = getCanvasPoint(e);
    if (!point) return;

    isDrawingRef.current = true;

    // Cancel any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Cancel any pending frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingPointsRef.current = [];
    lastDrawnPointRef.current = null;
    lastSmoothedRef.current = null;

    // Set stroke style ONCE at stroke start (no changes per point)
    strokeColorRef.current = options.strokeColor || '#000000';
    strokeWidthRef.current = options.strokeWidth || 2;

    // Begin new path segment at the start point
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = strokeColorRef.current;
    ctx.lineWidth = strokeWidthRef.current;
    ctx.moveTo(point.x, point.y);
    lastDrawnPointRef.current = point;
  }, [getCanvasPoint, options.strokeColor, options.strokeWidth]);

  // Continue stroke — just collect points, don't draw yet
  const continueStroke = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;

    const point = getCanvasPoint(e);
    if (!point) return;

    // Buffer the point
    pendingPointsRef.current.push(point);

    // Schedule a frame to draw all buffered points
    scheduleFrame();
  }, [getCanvasPoint, scheduleFrame]);

  // End stroke
  const endStroke = useCallback(() => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;

    // Flush any remaining points immediately
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushPoints();
    lastDrawnPointRef.current = null;
    lastSmoothedRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Debounce the PNG export
    const debounceMs = parseInt(localStorage.getItem('candle_debounce') || '500', 10);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const png = canvas.toDataURL('image/png');
      options.onStrokeComplete?.(png);
    }, debounceMs);
  }, [options.onStrokeComplete, flushPoints]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Render AI drawing commands
  const renderAIDrawing = useCallback((drawingCommands: any[]) => {
    const ctx = ctxRef.current;
    if (!ctx || !drawingCommands) return;

    renderDrawingCommands(ctx, drawingCommands);
  }, []);

  // Export canvas as PNG
  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const cleanup = initCanvas();
    return () => {
      cleanup?.();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [initCanvas]);

  return {
    canvasRef,
    ctxRef,
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    renderAIDrawing,
    exportPNG
  };
}
