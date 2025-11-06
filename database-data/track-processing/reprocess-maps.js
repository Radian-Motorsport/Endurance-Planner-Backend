// process_track15.js
// Converted to CommonJS-compatible runner with more robust asset fetching
const pg = require('pg');
const { parse } = require('svgson');
const svgpath = require('svgpath');
// svg-path-properties may export as named or default depending on package build
const _svgProps = require('svg-path-properties');
// Support different export shapes (svgPathProperties, SVGPathProperties, default or module itself)
const SVGPathProperties = _svgProps.svgPathProperties || _svgProps.SVGPathProperties || _svgProps.default || _svgProps;
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// Debug: inspect svg-path-properties export shape (helps with ESM/CJS interop differences)
try {
  console.log('DEBUG: svg-path-properties export keys:', Object.keys(_svgProps || {}));
  console.log('DEBUG: resolved SVGPathProperties type:', typeof SVGPathProperties);
} catch (e) {
  // ignore
}
const iRacingOAuth2Client = require('../iracing-oauth2-client.js');

// -----------------------------
// Database connection
// -----------------------------
const client = new pg.Client({
  host: "dpg-d38kop9r0fns73834270-a",   // e.g. dpg-xxxxxx
  port: 5432,
  database: "radian_database_809f",   // e.g. radian_database_889E
  user: "radian_database_809f_user",       // e.g. radian_database_889E_user
  password: "zLD6hvbJbq2nfhN85xirj2LExz87k7Aj"
});

// -----------------------------
// iRacing OAuth2 credentials
// -----------------------------
const IRACING_CLIENT_ID = "radian-limited";       // e.g. radian-limited
const IRACING_CLIENT_SECRET = "viewable-SALAMI-net-mortician-Fever-asparagus";
const IRACING_USERNAME = "grannville@hotmail.co.uk";
const IRACING_PASSWORD = "CAMpagnolo9!";

// -----------------------------
// SVG processing helper
// -----------------------------
async function processSvg(svgDataOrUrl, samples = 500, bridges = []) {
  let svgContent = null;

  if (!svgDataOrUrl) throw new Error('No SVG data provided');

  // If it's a data URL (base64), decode it
  if (typeof svgDataOrUrl === 'string' && svgDataOrUrl.trim().startsWith('data:')) {
    const base64 = svgDataOrUrl.split(',')[1] || '';
    svgContent = Buffer.from(base64, 'base64').toString('utf-8');
  } else if (typeof svgDataOrUrl === 'string' && svgDataOrUrl.trim().startsWith('<')) {
    // Raw SVG content
    svgContent = svgDataOrUrl;
  } else if (typeof svgDataOrUrl === 'string' && (svgDataOrUrl.startsWith('http://') || svgDataOrUrl.startsWith('https://'))) {
    // Fetch remote SVG
    const resp = await axios.get(svgDataOrUrl, { responseType: 'text' });
    svgContent = resp.data;
  } else {
    // Unknown format - try to stringify and parse
    svgContent = String(svgDataOrUrl);
  }

  const svgJson = await parse(svgContent);

  const paths = [];
  function walk(node) {
    if (node.name === 'path' && node.attributes && node.attributes.d) paths.push(node.attributes.d);
    if (node.children) node.children.forEach(walk);
  }
  walk(svgJson);

  const points = [];
  let wasSplit = false;
  
  for (const d of paths) {
    const absPath = svgpath(d).abs().toString();
    let props = null;
    try {
      // Try constructor form
      props = new SVGPathProperties(absPath);
    } catch (e) {
      // Fallback to callable form
      props = SVGPathProperties(absPath);
    }
    const length = props.getTotalLength();
    
    // Dynamic sampling: adjust sample count based on path length
    // Target: ~2 SVG units per sample for consistent detail across all tracks
    const SPACING_TARGET = 2.0;
    const dynamicSamples = Math.max(100, Math.min(2000, Math.ceil(length / SPACING_TARGET)));
    console.log(`📏 Path length: ${length.toFixed(0)} units → ${dynamicSamples} samples (target spacing: ${SPACING_TARGET})`);
    
    // Sample points along the entire path
    const allPoints = [];
    for (let i = 0; i <= dynamicSamples; i++) {
      const pt = props.getPointAtLength((i / dynamicSamples) * length);
      allPoints.push({ x: pt.x, y: pt.y });
    }
    
    // Step 1: Find ALL significant jumps (potential splits or bridge gaps)
    const jumps = [];
    const avgDist = [];
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const dx = allPoints[i + 1].x - allPoints[i].x;
      const dy = allPoints[i + 1].y - allPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      avgDist.push(dist);
      
      jumps.push({ index: i, dist, point: allPoints[i], nextPoint: allPoints[i + 1] });
    }
    
    const medianDist = avgDist.sort((a, b) => a - b)[Math.floor(avgDist.length / 2)];
    const threshold = medianDist * 2.5; // Higher threshold to ignore small jumps
    
    // Step 2: Categorize jumps - bridge gaps vs double-loop connections
    const bridgeGaps = [];
    const connectionJumps = [];
    
    jumps.forEach(jump => {
      if (jump.dist > threshold) {
        // Check if this jump is near a bridge
        const midX = (jump.point.x + jump.nextPoint.x) / 2;
        const midY = (jump.point.y + jump.nextPoint.y) / 2;
        
        if (bridges.length > 0 && isNearBridge(midX, midY, bridges)) {
          console.log(`🌉 Jump at index ${jump.index} (dist=${jump.dist.toFixed(2)}, pos=[${midX.toFixed(1)},${midY.toFixed(1)}]) is near bridge - marking as gap`);
          bridgeGaps.push(jump);
        } else {
          console.log(`🔀 Jump at index ${jump.index} (dist=${jump.dist.toFixed(2)}, pos=[${midX.toFixed(1)},${midY.toFixed(1)}]) is NOT near bridge - marking as connection`);
          connectionJumps.push(jump);
        }
      }
    });
    
    console.log(`🔍 Analysis: median=${medianDist.toFixed(2)}, threshold=${threshold.toFixed(2)}, bridge gaps=${bridgeGaps.length}, connections=${connectionJumps.length}`);
    
    // Step 3: Handle bridges with direction reversal detection
    if (bridges.length > 0) {
      console.log(`🌉 Bridge detected - looking for direction reversals in bridge zone`);
      
      // Find direction reversals - where path jumps from one loop to opposite-direction loop
      const reversals = [];
      const windowSize = 10; // Look at average direction over 10 points
      
      // Compare average direction BEFORE point vs AFTER point
      for (let i = windowSize; i < allPoints.length - windowSize; i++) {
        const currentPoint = allPoints[i];
        
        // Only check points in bridge zone
        if (!isNearBridge(currentPoint.x, currentPoint.y, bridges)) {
          continue;
        }
        
        // Calculate average direction BEFORE this point (last windowSize points)
        let beforeDx = 0, beforeDy = 0;
        for (let j = i - windowSize; j < i; j++) {
          beforeDx += allPoints[j + 1].x - allPoints[j].x;
          beforeDy += allPoints[j + 1].y - allPoints[j].y;
        }
        beforeDx /= windowSize;
        beforeDy /= windowSize;
        
        // Calculate average direction AFTER this point (next windowSize points)
        let afterDx = 0, afterDy = 0;
        for (let j = i; j < i + windowSize; j++) {
          afterDx += allPoints[j + 1].x - allPoints[j].x;
          afterDy += allPoints[j + 1].y - allPoints[j].y;
        }
        afterDx /= windowSize;
        afterDy /= windowSize;
        
        const beforeMag = Math.sqrt(beforeDx * beforeDx + beforeDy * beforeDy);
        const afterMag = Math.sqrt(afterDx * afterDx + afterDy * afterDy);
        
        if (beforeMag > 0 && afterMag > 0) {
          // Dot product of average directions
          const dotProduct = beforeDx * afterDx + beforeDy * afterDy;
          const cosAngle = dotProduct / (beforeMag * afterMag);
          const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
          
          // Reversal = average directions are significantly opposite (>120 degrees)
          if (cosAngle < -0.5) { // >120 degrees
            reversals.push({
              index: i,
              point: currentPoint,
              angle: angleDeg
            });
            console.log(`🔄 Direction reversal at index ${i}: angle=${angleDeg.toFixed(1)}°, pos=[${currentPoint.x.toFixed(1)}, ${currentPoint.y.toFixed(1)}]`);
          }
        }
      }
      
      if (reversals.length >= 2) {
        // Found both reversals - split and interpolate
        const firstReversal = reversals[0].index;
        const lastReversal = reversals[reversals.length - 1].index;
        
        console.log(`✂️  Splitting at reversals: ${firstReversal} and ${lastReversal}`);
        
        // Keep outer loop: points before first reversal + points after last reversal
        const segment1 = allPoints.slice(0, firstReversal + 1);
        const segment2 = allPoints.slice(lastReversal);
        
        console.log(`🌉 Outer loop segments: ${segment1.length} + ${segment2.length} points`);
        
        // Interpolate across bridge gap (match 2.0 units/point density)
        const lastOfSegment1 = segment1[segment1.length - 1];
        const firstOfSegment2 = segment2[0];
        const gapDist = Math.sqrt(
          (firstOfSegment2.x - lastOfSegment1.x) ** 2 + 
          (firstOfSegment2.y - lastOfSegment1.y) ** 2
        );
        const numInterpolated = Math.max(2, Math.min(20, Math.ceil(gapDist / 2.0)));
        
        points.push(...segment1);
        
        // Add interpolated points
        for (let j = 1; j <= numInterpolated; j++) {
          const t = j / (numInterpolated + 1);
          points.push({
            x: lastOfSegment1.x + (firstOfSegment2.x - lastOfSegment1.x) * t,
            y: lastOfSegment1.y + (firstOfSegment2.y - lastOfSegment1.y) * t
          });
        }
        console.log(`🌉 Interpolated ${numInterpolated} points across ${gapDist.toFixed(2)} unit bridge gap`);
        
        points.push(...segment2);
        wasSplit = true;
        
      } else if (reversals.length === 1) {
        // Only one reversal found - treat like normal split
        console.log(`✂️  Single reversal at ${reversals[0].index} - splitting there`);
        const firstLoop = allPoints.slice(0, reversals[0].index + 1);
        points.push(...firstLoop);
        wasSplit = true;
        
      } else {
        console.log(`⚠️  No direction reversals found in bridge zone - using standard logic`);
        // Fall through to standard logic
        if (connectionJumps.length > 0) {
          const maxJump = connectionJumps.reduce((max, j) => j.dist > max.dist ? j : max);
          const firstLoop = allPoints.slice(0, maxJump.index + 1);
          console.log(`✂️  Split path at index ${maxJump.index}: keeping first loop with ${firstLoop.length} points`);
          points.push(...firstLoop);
          wasSplit = true;
        } else {
          console.log(`ℹ️  No split needed - using all ${allPoints.length} points`);
          points.push(...allPoints);
        }
      }
      
    } else if (connectionJumps.length > 0) {
      // No bridges - standard double-loop split
      const maxJump = connectionJumps.reduce((max, j) => j.dist > max.dist ? j : max);
      const firstLoop = allPoints.slice(0, maxJump.index + 1);
      console.log(`✂️  Split path at index ${maxJump.index}: keeping first loop with ${firstLoop.length} points`);
      points.push(...firstLoop);
      wasSplit = true;
    } else {
      // No significant jump found - use all points
      console.log(`ℹ️  No split needed - using all ${allPoints.length} points`);
      points.push(...allPoints);
    }
  }
  return { points, wasSplit };
}

// -----------------------------
// Sort points by proximity (nearest neighbor)
// Fixes chaotic SVG path order by reordering points
// so each connects to its closest unvisited neighbor
// -----------------------------
function sortPathByProximity(points) {
  if (!points || points.length < 2) return points;
  
  const sorted = [];
  const remaining = [...points];
  
  // Start with first point
  let current = remaining.shift();
  sorted.push(current);
  
  // Greedily pick nearest unvisited point
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].x - current.x;
      const dy = remaining[i].y - current.y;
      const dist = dx * dx + dy * dy; // squared distance (no sqrt needed for comparison)
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    
    current = remaining.splice(nearestIdx, 1)[0];
    sorted.push(current);
  }
  
  return sorted;
}

// -----------------------------
// Extract bridge locations from Background Details layer
// Returns array of bridge bounding boxes: [{minX, maxX, minY, maxY}, ...]
// -----------------------------
async function extractBridgeLocations(layersObj, trackMapBaseUrl) {
  // Try multiple possible layer names
  const layerNames = ['background-details', 'background', 'inactive'];
  let layerName = null;
  
  for (const name of layerNames) {
    if (layersObj[name]) {
      layerName = name;
      break;
    }
  }
  
  if (!layerName) {
    console.log('ℹ️  No background layer found');
    return [];
  }
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj[layerName];
    console.log(`🌉 Fetching ${layerName} layer for bridges: ${layerUrl}`);
    
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    const svgJson = await parse(svgContent);
    
    const bridges = [];
    
    function walkForBridges(node) {
      // Look for groups with "Bridge" in the id
      if (node.attributes && node.attributes.id && node.attributes.id.includes('Bridge')) {
        console.log(`🌉 Found bridge group: ${node.attributes.id}`);
        
        // Extract all rect elements within this bridge group
        function extractRects(n) {
          if (n.name === 'rect' && n.attributes) {
            const x = parseFloat(n.attributes.x || 0);
            const y = parseFloat(n.attributes.y || 0);
            const width = parseFloat(n.attributes.width || 0);
            const height = parseFloat(n.attributes.height || 0);
            
            bridges.push({
              minX: x,
              maxX: x + width,
              minY: y,
              maxY: y + height
            });
          }
          if (n.children) {
            n.children.forEach(extractRects);
          }
        }
        extractRects(node);
      }
      
      if (node.children) {
        node.children.forEach(walkForBridges);
      }
    }
    
    walkForBridges(svgJson);
    
    if (bridges.length > 0) {
      console.log(`🌉 Found ${bridges.length} bridge rectangles`);
      bridges.forEach((b, idx) => {
        console.log(`  Bridge ${idx}: x=[${b.minX.toFixed(1)}, ${b.maxX.toFixed(1)}], y=[${b.minY.toFixed(1)}, ${b.maxY.toFixed(1)}]`);
      });
      // Merge overlapping rectangles into single bridge zones
      const mergedBridges = mergeBridgeZones(bridges);
      console.log(`🌉 Merged into ${mergedBridges.length} bridge zones`);
      mergedBridges.forEach((b, idx) => {
        console.log(`  Zone ${idx}: x=[${b.minX.toFixed(1)}, ${b.maxX.toFixed(1)}], y=[${b.minY.toFixed(1)}, ${b.maxY.toFixed(1)}]`);
      });
      return mergedBridges;
    }
    
  } catch (err) {
    console.log(`⚠️  Could not access ${layerName} layer: ${err.message}`);
  }
  
  return [];
}

// Helper: Merge overlapping bridge rectangles and expand to detection zones
function mergeBridgeZones(bridges) {
  if (bridges.length === 0) return [];
  
  const merged = [];
  const sorted = bridges.sort((a, b) => a.minX - b.minX);
  let current = {...sorted[0]};
  
  for (let i = 1; i < sorted.length; i++) {
    const bridge = sorted[i];
    // Check if overlapping or adjacent (within 50 units)
    if (bridge.minX <= current.maxX + 50 && 
        bridge.minY <= current.maxY + 50 &&
        bridge.maxY >= current.minY - 50) {
      // Merge
      current.minX = Math.min(current.minX, bridge.minX);
      current.maxX = Math.max(current.maxX, bridge.maxX);
      current.minY = Math.min(current.minY, bridge.minY);
      current.maxY = Math.max(current.maxY, bridge.maxY);
    } else {
      merged.push(current);
      current = {...bridge};
    }
  }
  merged.push(current);
  
  // Expand each zone to 120% of longest dimension as a square
  const expanded = merged.map(zone => {
    const width = zone.maxX - zone.minX;
    const height = zone.maxY - zone.minY;
    const maxDim = Math.max(width, height);
    const targetSize = maxDim * 1.2;
    
    const centerX = (zone.minX + zone.maxX) / 2;
    const centerY = (zone.minY + zone.maxY) / 2;
    
    return {
      minX: centerX - targetSize / 2,
      maxX: centerX + targetSize / 2,
      minY: centerY - targetSize / 2,
      maxY: centerY + targetSize / 2
    };
  });
  
  return expanded;
}

// Check if a point is near a bridge zone (no tolerance needed - zones are already expanded)
function isNearBridge(x, y, bridges) {
  return bridges.some(bridge => 
    x >= bridge.minX && 
    x <= bridge.maxX &&
    y >= bridge.minY && 
    y <= bridge.maxY
  );
}

// -----------------------------
// Extract start/finish line position from SVG layers
// Looks for the start-finish layer with a simple line path (horizontal or vertical)
// Returns {x, y} of the midpoint of that line, or null if not found
// -----------------------------
async function extractStartFinishPosition(trackMapBaseUrl, layersObj) {
  // Look specifically for 'start-finish' layer
  if (!layersObj['start-finish']) {
    console.log('⚠️  No start-finish layer found in layersObj');
    return null;
  }
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj['start-finish'];
    console.log(`🔍 Fetching start-finish layer: ${layerUrl}`);
    
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    
    // Look for simple line path: M<x>,<y>l<dx>,<dy> or M<x>,<y>l-<dx>,-<dy>
    // This matches both horizontal (l-103,0) and vertical (l0,50) lines
    // Note: Some paths may have curves (c commands) but still contain the line position
    const lineMatch = svgContent.match(/M([0-9.]+),([0-9.]+)(?:[^l]*?)l(-?[0-9.]+),?(-?[0-9.]+)/);
    
    if (lineMatch) {
      const startX = parseFloat(lineMatch[1]);
      const startY = parseFloat(lineMatch[2]);
      const dx = parseFloat(lineMatch[3]);
      const dy = parseFloat(lineMatch[4]);
      
      // Calculate end point and midpoint
      const endX = startX + dx;
      const endY = startY + dy;
      const x = (startX + endX) / 2;
      const y = (startY + endY) / 2;
      
      console.log(`✅ Found start/finish line: (${startX.toFixed(2)}, ${startY.toFixed(2)}) to (${endX.toFixed(2)}, ${endY.toFixed(2)})`);
      console.log(`📍 Start/finish midpoint: (${x.toFixed(2)}, ${y.toFixed(2)})`);
      return { x, y };
    }
    
    // Fallback: parse SVG and look for any simple line path in the first few path elements
    const svgJson = await parse(svgContent);
    let foundPath = null;
    
    function walk(node) {
      if (node.name === 'path' && node.attributes && node.attributes.d && !foundPath) {
        const d = node.attributes.d;
        // Look for simple line pattern (ignore complex paths with curves)
        const match = d.match(/M([0-9.]+),([0-9.]+)l(-?[0-9.]+),(-?[0-9.]+)/);
        if (match && !d.includes('c') && !d.includes('C')) { // Ignore paths with curves
          foundPath = match;
        }
      }
      if (node.children && !foundPath) {
        node.children.forEach(walk);
      }
    }
    
    walk(svgJson);
    
    if (foundPath) {
      const startX = parseFloat(foundPath[1]);
      const startY = parseFloat(foundPath[2]);
      const dx = parseFloat(foundPath[3]);
      const dy = parseFloat(foundPath[4]);
      const endX = startX + dx;
      const endY = startY + dy;
      const x = (startX + endX) / 2;
      const y = (startY + endY) / 2;
      console.log(`📍 Start/finish midpoint (from parsed SVG): (${x.toFixed(2)}, ${y.toFixed(2)})`);
      return { x, y };
    }
    
  } catch (err) {
    console.log(`  ⚠️  Could not access start-finish layer: ${err.message}`);
  }
  
  console.log('⚠️  No start/finish line found - will use default (bottom-center)');
  return null;
}

// -----------------------------
// Extract arrow direction from start-finish SVG
// -----------------------------
async function extractArrowDirection(trackMapBaseUrl, layersObj) {
  if (!layersObj['start-finish']) {
    console.log('⚠️  No start-finish layer for arrow extraction');
    return null;
  }
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj['start-finish'];
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    
    // Look for arrow path (typically has multiple 'l' commands for the arrow shape)
    // We want the first 'l' command which is the arrow shaft direction
    // Pattern: M...l<dx>,<dy> - may have curves (c commands) between M and l
    const arrowMatch = svgContent.match(/l(-?[0-9.]+),(-?[0-9.]+)/);
    
    console.log(`🔍 Arrow regex test:`, arrowMatch ? `matched: l${arrowMatch[1]},${arrowMatch[2]}` : 'NO MATCH');
    if (arrowMatch) {
      const dx = parseFloat(arrowMatch[1]);
      const dy = parseFloat(arrowMatch[2]);
      
      // Normalize the direction vector
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        const normalized = { dx: dx / mag, dy: dy / mag };
        console.log(`🎯 Arrow direction: dx=${normalized.dx.toFixed(3)}, dy=${normalized.dy.toFixed(3)}`);
        return normalized;
      }
    } else {
      console.log('⚠️  Arrow pattern not found in start-finish SVG');
    }
  } catch (err) {
    console.log(`⚠️  Error extracting arrow: ${err.message}`);
  }
  
  return null;
}

// -----------------------------
// Rotate path so start/finish is at index 0
// Uses provided start/finish position if available,
// otherwise falls back to bottom-center of the track
// -----------------------------
function rotateToStartFinish(points, startFinishPos = null) {
  if (!points || points.length < 2) return points;
  
  // Find bounds
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  let targetX, targetY;
  
  if (startFinishPos) {
    // Use actual start/finish position from SVG
    targetX = startFinishPos.x;
    targetY = startFinishPos.y;
    console.log(`🎯 Using actual start/finish position: (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);
  } else {
    // Fallback: start/finish is typically at bottom-center
    targetX = (minX + maxX) / 2;
    targetY = maxY; // bottom of track (max Y in SVG coords)
    console.log(`🎯 Using fallback start/finish position (bottom-center): (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`);
  }
  
  // Find closest point to target
  let closestIdx = 0;
  let closestDist = Infinity;
  
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - targetX;
    const dy = points[i].y - targetY;
    const dist = dx * dx + dy * dy;
    
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  
  // Rotate array so start/finish is at index 0
  const rotated = [...points.slice(closestIdx), ...points.slice(0, closestIdx)];
  
  // Close the loop by duplicating first point at end
  rotated.push({ ...rotated[0] });
  
  return rotated;
}

// -----------------------------
// Main
// -----------------------------
(async () => {
  try {
    // Connect to DB unless explicitly skipped
    if (!process.env.SKIP_DB_CONNECT) {
      await client.connect();
    } else {
      console.log('INFO: SKIP_DB_CONNECT set - skipping DB connection');
    }

    const irClient = new iRacingOAuth2Client(IRACING_CLIENT_ID, IRACING_CLIENT_SECRET);
    await irClient.authenticate(IRACING_USERNAME, IRACING_PASSWORD);

    // Fetch track assets (this endpoint can return a {link,expires} object)
    let data = await irClient.makeDataAPIRequest('/data/track/assets');
    if (data && !Array.isArray(data) && data.link) {
      // follow the provided link to get the actual assets array
      // Use a plain HTTP GET (axios) so the OAuth Bearer header from makeDataAPIRequest
      // is NOT sent to the S3 presigned URL (S3 rejects combined auth mechanisms).
      const s3Resp = await axios.get(data.link, { timeout: 30000 });
      // Debug: log the shape of the S3 response to detect XML error or unexpected payloads
      try {
        if (s3Resp && s3Resp.data) {
          // If it's a string (e.g., XML error), log a prefix to avoid huge output
          if (typeof s3Resp.data === 'string') {
            console.log('DEBUG: s3Resp.data (string, first 1000 chars):', s3Resp.data.slice(0, 1000));
          } else {
            console.log('DEBUG: s3Resp.data (object):', JSON.stringify(s3Resp.data).slice(0, 1000));
          }
        } else {
          console.log('DEBUG: s3Resp has no data:', s3Resp);
        }
      } catch (e) {
        console.log('DEBUG: failed to stringify s3Resp.data', e);
      }
      data = s3Resp.data;
    }

    // Some API responses (when returned from S3) may be an object keyed by id rather than
    // an array. Normalize that to an array of values so downstream code can find track_id.
    if (!Array.isArray(data) && data && typeof data === 'object') {
      try {
        data = Object.keys(data).map(k => data[k]);
        console.log('DEBUG: Normalized assets object to array with length', data.length);
      } catch (e) {
        // fall through to error below
      }
    }

    if (!Array.isArray(data)) {
      throw new Error('Unexpected assets payload - expected array after following link');
    }

    // Try several possible id fields (some payloads use different property names)
    const track = data.find(t => {
      try {
        return Number(t.track_id) === 168 || Number(t.id) === 168 || Number(t.track_garage61_id) === 168 || Number(t.garage61_id) === 168;
      } catch (e) {
        return false;
      }
    });

    if (!track) {
      console.log('DEBUG: Could not find track by numeric id 168. Showing sample entry keys to help diagnose:');
      if (data.length > 0) {
        console.log('DEBUG: sample keys of first element:', Object.keys(data[0]).slice(0,50));
        console.log('DEBUG: sample of first element (truncated):', JSON.stringify(data[0]).slice(0,1000));
      }
      throw new Error('No track entry matching id 168 found in assets');
    }

    if (!track.track_map) {
      console.log('DEBUG: Found track object but no `track_map` field present. Track keys:', Object.keys(track));
      throw new Error('No track_map found for track_id=168');
    }

    console.log('DEBUG: Found track keys:', Object.keys(track));
    console.log('DEBUG: track_map type:', typeof track.track_map);
    try {
      if (typeof track.track_map === 'string') {
        console.log('DEBUG: track_map (first 1000 chars):', track.track_map.slice(0, 1000));
      } else {
        console.log('DEBUG: track_map is not a string; value (truncated):', JSON.stringify(track.track_map).slice(0, 1000));
      }
    } catch (e) {
      console.log('DEBUG: failed to inspect track_map', e);
    }

    // track.track_map is a base URL; track.track_map_layers contains filenames for SVG layers.
    // Find a suitable SVG layer to parse (prefer background or active layer).
    let svgUrl = null;
    let layersObj = {};
    try {
      // track_map_layers might be a JSON string or already an object
      if (typeof track.track_map_layers === 'string') {
        layersObj = JSON.parse(track.track_map_layers);
      } else if (typeof track.track_map_layers === 'object') {
        layersObj = track.track_map_layers;
      }
      console.log('DEBUG: layersObj keys:', Object.keys(layersObj));
      console.log('DEBUG: layersObj:', JSON.stringify(layersObj));
    } catch (e) {
      console.log('DEBUG: failed to parse track_map_layers', e);
    }

  // Prefer the 'active' layer (the track layout) over background imagery
  const preferred = ['active', 'background', 'inactive', 'turns', 'start-finish', 'pitroad'];
    for (const p of preferred) {
      if (layersObj[p]) {
        svgUrl = track.track_map + layersObj[p];
        break;
      }
    }

    // If no preferred layer found, try any layer file
    if (!svgUrl && Object.keys(layersObj).length > 0) {
      const firstKey = Object.keys(layersObj)[0];
      svgUrl = track.track_map + layersObj[firstKey];
    }

    // As a last resort, if track_map itself points directly to an SVG file, try it
    if (!svgUrl) {
      if (typeof track.track_map === 'string' && track.track_map.match(/\.svg$/i)) {
        svgUrl = track.track_map;
      } else if (typeof track.track_map === 'string' && track.track_map.endsWith('/')) {
        // try common filenames
  // Try common layer filenames; prefer active.svg when present
  const candidates = ['active.svg','background.svg','track-map.svg','map.svg','track_map.svg'];
        for (const c of candidates) {
          const tryUrl = track.track_map + c;
          try {
            const r = await axios.get(tryUrl, { timeout: 5000 });
            if (r && typeof r.data === 'string' && r.data.includes('<svg')) {
              svgUrl = tryUrl;
              break;
            }
          } catch (e) {
            // try next
          }
        }
      }
    }

    if (!svgUrl) {
      console.log('DEBUG: Could not determine SVG URL from track.track_map and layers');
      throw new Error('No SVG layer found to process for track_id=15');
    }

    console.log('DEBUG: Using SVG URL:', svgUrl);
    
    // Extract bridge locations from background-details layer
    console.log('🌉 Searching for bridge locations in background-details layer...');
    const bridges = await extractBridgeLocations(layersObj, track.track_map);
    
    // Extract start/finish position and arrow direction from SVG layers
    console.log('🔍 Searching for start/finish line in SVG layers...');
    const startFinishPos = await extractStartFinishPosition(track.track_map, layersObj);
    const arrowDirection = await extractArrowDirection(track.track_map, layersObj);
    
    const result = await processSvg(svgUrl, 1000, bridges);
    let sortedPoints;
    
    // Only sort if we didn't split - split points are already in correct sequential order
    if (result.wasSplit) {
      console.log('ℹ️  Skipping nearest-neighbor sort (split points already sequential)');
      sortedPoints = result.points;
    } else {
      console.log('🔧 Sorting points by nearest-neighbor proximity...');
      sortedPoints = sortPathByProximity(result.points);
      console.log(`✅ Sorted ${sortedPoints.length} points into smooth path`);
    }
    
    // Always rotate to start/finish position
    console.log('🔄 Rotating to start/finish position...');
    let rotatedPoints = rotateToStartFinish(sortedPoints, startFinishPos);
    
    // Check if racing line direction matches arrow direction
    let finalPoints = rotatedPoints;
    if (arrowDirection && rotatedPoints.length >= 2) {
      // Calculate racing line direction at start (average of first few segments)
      const checkPoints = Math.min(5, rotatedPoints.length - 1);
      let lineDx = 0, lineDy = 0;
      for (let i = 0; i < checkPoints; i++) {
        lineDx += rotatedPoints[i + 1].x - rotatedPoints[i].x;
        lineDy += rotatedPoints[i + 1].y - rotatedPoints[i].y;
      }
      lineDx /= checkPoints;
      lineDy /= checkPoints;
      
      // Normalize
      const lineMag = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
      if (lineMag > 0) {
        lineDx /= lineMag;
        lineDy /= lineMag;
        
        // Calculate dot product with arrow direction
        const dotProduct = lineDx * arrowDirection.dx + lineDy * arrowDirection.dy;
        
        console.log(`� Racing line direction: dx=${lineDx.toFixed(3)}, dy=${lineDy.toFixed(3)}`);
        console.log(`📐 Dot product with arrow: ${dotProduct.toFixed(3)}`);
        
        // If dot product is negative, directions are opposite - reverse the racing line
        if (dotProduct < 0) {
          console.log(`🔄 Reversing racing line (opposite to arrow direction)`);
          finalPoints = [...rotatedPoints].reverse();
        } else {
          console.log(`✅ Racing line matches arrow direction`);
        }
      }
    }
    
    console.log(`✅ Final path has ${finalPoints.length} points (closed loop)`);

    if (!process.env.SKIP_DB_CONNECT) {
      await client.query(
        `UPDATE track_assets SET processed_path = $1 WHERE track_id = $2`,
        [JSON.stringify(finalPoints), '15']
      );
      console.log(`✅ Track 15 processed and stored with ${finalPoints.length} points`);
    } else {
      console.log('INFO: SKIPPED DB UPDATE in dry run. Points length =', finalPoints.length);
    }

    // Export sampled points to a JSON file when requested (useful for visualization)
    if (process.env.EXPORT_JSON || process.env.SKIP_DB_CONNECT) {
      try {
        const outDir = path.join(__dirname, 'processed-maps');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        
        // Export racing line
        const outPath = path.join(outDir, 'track-168.json');
        fs.writeFileSync(outPath, JSON.stringify(finalPoints, null, 2), 'utf8');
        console.log('✅ Exported sampled points to', outPath);
        
        // Export bridge data
        const bridgesPath = path.join(outDir, 'track-168-bridges.json');
        fs.writeFileSync(bridgesPath, JSON.stringify(bridges, null, 2), 'utf8');
        console.log('✅ Exported bridge zones to', bridgesPath);
        
      } catch (e) {
        console.warn('⚠️ Failed to export data to JSON:', e && e.message ? e.message : e);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    try {
      if (!process.env.SKIP_DB_CONNECT) await client.end();
    } catch (e) {
      // ignore
    }
  }
})();
