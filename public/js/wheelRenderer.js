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

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(11, Math.min(14, 160 / segments.length))}px Arial`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;

      const text = segment.name.length > 12 ? segment.name.substring(0, 11) + '…' : segment.name;
      ctx.fillText(text, radius - 20, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#2C3E50';
    ctx.fill();
    ctx.strokeStyle = '#ECF0F1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw outer border
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2C3E50';
    ctx.lineWidth = 4;
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
