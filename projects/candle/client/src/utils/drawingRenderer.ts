/**
 * Render AI drawing commands on canvas
 * Commands format:
 * - line: { type: 'line', x1, y1, x2, y2, color?, width? }
 * - circle: { type: 'circle', cx, cy, r, fill?, color?, width? }
 * - path: { type: 'path', points: [[x,y], ...], color?, width? }
 * - text: { type: 'text', x, y, content, font?, color? }
 */

const AI_COLOR = '#666666';
const AI_WIDTH = 2;

export function renderDrawingCommands(
  ctx: CanvasRenderingContext2D,
  commands: any[]
) {
  if (!Array.isArray(commands)) return;

  // Save current state
  ctx.save();

  commands.forEach((cmd) => {
    try {
      switch (cmd.type) {
        case 'line':
          drawLine(ctx, cmd);
          break;
        case 'circle':
          drawCircle(ctx, cmd);
          break;
        case 'path':
          drawPath(ctx, cmd);
          break;
        case 'text':
          drawText(ctx, cmd);
          break;
        default:
          console.warn('Unknown drawing command type:', cmd.type);
      }
    } catch (error) {
      console.error('Error rendering drawing command:', error, cmd);
    }
  });

  // Restore state
  ctx.restore();
}

function drawLine(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x1, y1, x2, y2, color, width } = cmd;
  
  if (typeof x1 !== 'number' || typeof y1 !== 'number' || 
      typeof x2 !== 'number' || typeof y2 !== 'number') {
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = color || AI_COLOR;
  ctx.lineWidth = width || AI_WIDTH;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCircle(ctx: CanvasRenderingContext2D, cmd: any) {
  const { cx, cy, r, fill, color, width } = cmd;
  
  if (typeof cx !== 'number' || typeof cy !== 'number' || typeof r !== 'number') {
    return;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2);
  
  if (fill) {
    ctx.fillStyle = color || AI_COLOR;
    ctx.fill();
  } else {
    ctx.strokeStyle = color || AI_COLOR;
    ctx.lineWidth = width || AI_WIDTH;
    ctx.stroke();
  }
}

function drawPath(ctx: CanvasRenderingContext2D, cmd: any) {
  const { points, color, width } = cmd;
  
  if (!Array.isArray(points) || points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = color || AI_COLOR;
  ctx.lineWidth = width || AI_WIDTH;
  
  const [startX, startY] = points[0];
  ctx.moveTo(startX, startY);
  
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    if (typeof x === 'number' && typeof y === 'number') {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();
}

function drawText(ctx: CanvasRenderingContext2D, cmd: any) {
  const { x, y, content, font, color } = cmd;
  
  if (typeof x !== 'number' || typeof y !== 'number' || !content) {
    return;
  }

  ctx.font = font || '24px sans-serif';
  ctx.fillStyle = color || AI_COLOR;
  ctx.textBaseline = 'top';
  ctx.fillText(String(content), x, y);
}
