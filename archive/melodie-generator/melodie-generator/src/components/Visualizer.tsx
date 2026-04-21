import React, { useRef, useEffect, useCallback } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  chaos: number;
  bpm: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, chaos, bpm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const timeRef = useRef<number>(0);
  const barsRef = useRef<number[]>([]);

  // Initialize bars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const barCount = Math.floor(canvas.width / 8);
    barsRef.current = Array(barCount).fill(0).map(() => Math.random() * 0.5);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(15, 10, 30, 0.2)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      // Draw idle state
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 + Math.sin(timeRef.current * 0.002) * 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Update time
    timeRef.current += 16;

    // Calculate bar properties based on BPM and chaos
    const barCount = Math.floor(width / 8);
    const speed = bpm / 60;
    const chaosFactor = chaos / 100;

    // Update and draw bars
    barsRef.current = barsRef.current.map((bar, i) => {
      const targetHeight = isPlaying 
        ? Math.sin(timeRef.current * 0.005 * speed + i * 0.2) * 0.5 
          + Math.sin(timeRef.current * 0.01 * speed + i * 0.1) * 0.3
          + Math.random() * chaosFactor * 0.5
        : 0.1;
      
      const newHeight = bar + (targetHeight - bar) * 0.1;
      return Math.max(0.05, Math.min(1, newHeight));
    });

    // Draw waveform bars
    barsRef.current.forEach((barHeight, i) => {
      const x = i * 8;
      const barHeightPx = barHeight * height * 0.8;
      const y = (height - barHeightPx) / 2;

      // Gradient for each bar
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeightPx);
      const hue = 260 + (i / barCount) * 60 + Math.sin(timeRef.current * 0.001) * 20;
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
      gradient.addColorStop(0.5, `hsla(${hue + 20}, 90%, 70%, 0.9)`);
      gradient.addColorStop(1, `hsla(${hue + 40}, 80%, 60%, 0.8)`);

      ctx.fillStyle = gradient;
      
      // Rounded bar - fallback for older browsers
      const barWidth = 6;
      const borderRadius = 3;
      ctx.beginPath();
      
      // Check if roundRect is available, otherwise use rectangle
      if (ctx.roundRect) {
        ctx.roundRect(x + 1, y, barWidth, barHeightPx, borderRadius);
      } else {
        // Fallback to regular rect for older browsers
        ctx.rect(x + 1, y, barWidth, barHeightPx);
      }
      ctx.fill();

      // Glow effect
      ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.5)`;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

  }, [isPlaying, chaos, bpm]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      if (!container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="glass-card canvas-container transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
      <canvas
        ref={canvasRef}
        className="w-full h-[150px] sm:h-[180px] md:h-[200px] rounded-xl"
        style={{ background: 'transparent' }}
      />
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-white/40 text-sm sm:text-base font-light tracking-wide">
            ▶ Drücke Play zum Starten
          </div>
        </div>
      )}
    </div>
  );
};

export default Visualizer;
