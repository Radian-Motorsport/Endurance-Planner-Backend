// Generate standalone HTML visualization with embedded track data
const fs = require('fs');
const path = require('path');

const trackId = 168;
const trackName = 'Suzuka Grand Prix';

// Load data
const pointsPath = path.join(__dirname, 'processed-maps', `track-${trackId}.json`);
const points = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Track ${trackId} - ${trackName}</title>
  <style>
    body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #eee; }
    canvas { border: 2px solid #333; background: #0a0a0a; display: block; margin: 20px auto; }
    #info { text-align: center; padding: 10px; background: #222; border: 1px solid #444; margin: 20px auto; max-width: 800px; }
    h1 { color: #4a9eff; text-align: center; }
  </style>
</head>
<body>
  <h1>🏁 Track ${trackId}: ${trackName}</h1>
  <canvas id="canvas" width="1400" height="900"></canvas>
  <div id="info">
    <strong>Points:</strong> ${points.length} | 
    <strong>Start/Finish:</strong> Index 0 at (${points[0].x.toFixed(2)}, ${points[0].y.toFixed(2)})
  </div>

  <script>
    const points = ${JSON.stringify(points)};
    
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // Find bounds
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 50;
    const scaleX = (canvas.width - 2 * padding) / (maxX - minX);
    const scaleY = (canvas.height - 2 * padding) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - (maxX - minX) * scale) / 2;
    const offsetY = (canvas.height - (maxY - minY) * scale) / 2;

    function toCanvas(x, y) {
      return {
        x: (x - minX) * scale + offsetX,
        y: (y - minY) * scale + offsetY
      };
    }

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw racing line
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < points.length; i++) {
      const p = toCanvas(points[i].x, points[i].y);
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    // Mark start/finish
    const start = toCanvas(points[0].x, points[0].y);
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw arrow showing direction at start
    const p1 = toCanvas(points[0].x, points[0].y);
    const p2 = toCanvas(points[5].x, points[5].y);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + ux * 30, p1.y + uy * 30);
    ctx.stroke();
    
    // Arrow head
    const headLen = 10;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(p1.x + ux * 30, p1.y + uy * 30);
    ctx.lineTo(
      p1.x + ux * 30 - headLen * Math.cos(angle - Math.PI / 6),
      p1.y + uy * 30 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(p1.x + ux * 30, p1.y + uy * 30);
    ctx.lineTo(
      p1.x + ux * 30 - headLen * Math.cos(angle + Math.PI / 6),
      p1.y + uy * 30 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();

    console.log('Track ${trackId} rendered:', points.length, 'points');
    console.log('Start/finish at index 0:', points[0]);
    console.log('Direction (first 5 points avg): dx=' + 
      ((points[5].x - points[0].x) / 5).toFixed(3) + ', dy=' + 
      ((points[5].y - points[0].y) / 5).toFixed(3));
  </script>
</body>
</html>`;

const outputPath = path.join(__dirname, `track-${trackId}-standalone.html`);
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`✅ Generated: ${outputPath}`);
console.log(`📊 ${points.length} points embedded`);
console.log(`🌐 Open this file directly in your browser`);
