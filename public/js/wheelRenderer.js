/**
 * Wheel Renderer - Draws the roulette wheel on Canvas
 */
class WheelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(segments) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (!segments || segments.length === 0) return;

    const segmentAngle = (2 * Math.PI) / segments.length;

    // Draw segments
    segments.forEach((segment, index) => {
      const startAngle = index * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text (clipped to segment, dynamically fitted)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius - 2, startAngle, endAngle);
      ctx.closePath();
      ctx.clip();

      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';

      const fontSize = Math.max(10, Math.min(14, 180 / segments.length));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;

      const maxTextWidth = radius - 38;
      let text = segment.name;
      if (ctx.measureText(text).width > maxTextWidth) {
        while (text.length > 2 && ctx.measureText(text.trimEnd() + '…').width > maxTextWidth) {
          text = text.slice(0, -1);
        }
        text = text.trimEnd() + '…';
      }
      ctx.fillText(text, radius - 16, 5);
      ctx.restore();
    });

    // Draw outer ring (white chrome bezel)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 26, 0, 2 * Math.PI);
    const hubGradient = ctx.createRadialGradient(centerX - 4, centerY - 4, 0, centerX, centerY, 26);
    hubGradient.addColorStop(0, '#2a1650');
    hubGradient.addColorStop(1, '#0d0a1e');
    ctx.fillStyle = hubGradient;
    ctx.fill();
    ctx.strokeStyle = '#FF6B9D';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  getSegmentAngle(segmentCount) {
    return 360 / segmentCount;
  }

  getSegmentAtAngle(angle, segmentCount) {
    const segmentAngle = 360 / segmentCount;
    const normalizedAngle = ((angle % 360) + 360) % 360;
    return Math.floor(normalizedAngle / segmentAngle);
  }
}
