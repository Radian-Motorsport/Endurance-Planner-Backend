const fs = require('fs');
const path = require('path');

// Quick test - check track 168 (Suzuka) from processed maps
const trackFile = path.join(__dirname, 'processed-maps', 'track-168.json');
const points = JSON.parse(fs.readFileSync(trackFile, 'utf8'));

console.log(`Track 168 (Suzuka): ${points.length} points`);
console.log(`First point: x=${points[0].x.toFixed(2)}, y=${points[0].y.toFixed(2)}`);
console.log(`Last point: x=${points[points.length-1].x.toFixed(2)}, y=${points[points.length-1].y.toFixed(2)}`);

// Check direction of first few segments
console.log('\nFirst 5 segments direction:');
for (let i = 0; i < 5 && i < points.length - 1; i++) {
  const dx = points[i + 1].x - points[i].x;
  const dy = points[i + 1].y - points[i].y;
  console.log(`  ${i} → ${i+1}: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}`);
}

// Suzuka start/finish from output: x=1348.35, y=313.15
// Find closest point
const targetX = 1348.35, targetY = 313.15;
let closestIdx = 0, closestDist = Infinity;
for (let i = 0; i < points.length; i++) {
  const dist = Math.sqrt((points[i].x - targetX) ** 2 + (points[i].y - targetY) ** 2);
  if (dist < closestDist) {
    closestDist = dist;
    closestIdx = i;
  }
}

console.log(`\nClosest point to start/finish (${targetX}, ${targetY}):`);
console.log(`  Index: ${closestIdx}, Distance: ${closestDist.toFixed(2)} units`);
console.log(`  Point: x=${points[closestIdx].x.toFixed(2)}, y=${points[closestIdx].y.toFixed(2)}`);

// Check if it's at or near index 0
if (closestIdx < 5) {
  console.log(`\n✅ GOOD: Start/finish is at beginning of array (index ${closestIdx})`);
} else {
  console.log(`\n❌ PROBLEM: Start/finish NOT at beginning (at index ${closestIdx}, should be near 0)`);
}