import React from 'react';
import { useCanvas } from '../hooks/useCanvas';

interface CanvasProps {
  strokeColor: string;
  strokeWidth: number;
  onStrokeComplete: (canvasPng: string, canvasWidth: number, canvasHeight: number) => void;
  drawingCommands: any[] | null;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  smoothingEnabled: boolean;
}

export function Canvas({ 
  strokeColor, 
  strokeWidth, 
  onStrokeComplete,
  drawingCommands,
  onCanvasReady,
  smoothingEnabled
}: CanvasProps) {
  const {
    bgCanvasRef,
    fgCanvasRef,
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    renderAIDrawing
  } = useCanvas({
    strokeColor,
    strokeWidth,
    onStrokeComplete,
    smoothingEnabled
  });

  // Render AI drawing when commands change
  React.useEffect(() => {
    if (drawingCommands && drawingCommands.length > 0) {
      renderAIDrawing(drawingCommands);
    }
  }, [drawingCommands, renderAIDrawing]);

  // Expose bg canvas ref to parent
  React.useEffect(() => {
    if (bgCanvasRef.current && onCanvasReady) {
      onCanvasReady(bgCanvasRef.current);
    }
  }, [bgCanvasRef, onCanvasReady]);

  // Touch event handlers (fallback for Kindle Scribe)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    startStroke({ clientX: touch.clientX, clientY: touch.clientY } as any);
  }, [startStroke]);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    continueStroke({ clientX: touch.clientX, clientY: touch.clientY } as any);
  }, [continueStroke]);

  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    endStroke();
  }, [endStroke]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Background canvas: completed strokes (smoothed or raw) */}
      <canvas
        ref={bgCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />
      {/* Foreground canvas: active stroke (raw, real-time) */}
      <canvas
        ref={fgCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
        onPointerDown={startStroke}
        onPointerMove={continueStroke}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
