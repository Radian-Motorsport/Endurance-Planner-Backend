/**
 * Batch processor for generating racing lines for multiple tracks
 * Processes tracks one at a time: fetch → process → write to DB
 * 
 * Usage:
 *   node database-data/batch-process-racing-lines.js
 * 
 * Environment variables:
 *   LIMIT=10           - Number of tracks to process (default: 10)
 *   START_FROM=0       - Skip first N tracks (default: 0)
 *   DRY_RUN=1          - Don't write to DB, just log (default: false)
 */

const { Pool } = require('pg');
const axios = require('axios');
const { parse } = require('svgson');
const svgpath = require('svgpath');
const { svgPathProperties: SVGPathProperties } = require('svg-path-properties');
const fs = require('fs');
const path = require('path');

// Import OAuth client
const IracingOAuth2Client = require('../iracing-oauth2-client');

// Database connection
let pool = null;
if (!process.env.DRY_RUN && process.env.DATABASE_URL) {
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  console.log('📊 Connected to database');
} else if (!process.env.DRY_RUN) {
  console.error('❌ DATABASE_URL required (or use DRY_RUN=1)');
  process.exit(1);
}

// Configuration
const LIMIT = parseInt(process.env.LIMIT) || 10;
const START_FROM = parseInt(process.env.START_FROM) || 0;
const DRY_RUN = process.env.DRY_RUN === '1';

// OAuth credentials
const IRACING_CLIENT_ID = "radian-limited";
const IRACING_CLIENT_SECRET = "viewable-SALAMI-net-mortician-Fever-asparagus";
const IRACING_USERNAME = "grannville@hotmail.co.uk";
const IRACING_PASSWORD = "CAMpagnolo9!";

const iracingClient = new IracingOAuth2Client(IRACING_CLIENT_ID, IRACING_CLIENT_SECRET);

// -----------------------------
// Helper: Check if point is in bridge zone
// -----------------------------
function isNearBridge(x, y, bridges) {
  for (const b of bridges) {
    if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) {
      return true;
    }
  }
  return false;
}

// -----------------------------
// Extract bridge locations from background layer
// -----------------------------
async function extractBridgeLocations(layersObj, trackMapBaseUrl) {
  const layerNames = ['background-details', 'background', 'inactive'];
  let layerName = null;
  
  for (const name of layerNames) {
    if (layersObj[name]) {
      layerName = name;
      break;
    }
  }
  
  if (!layerName) return [];
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj[layerName];
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    const svgJson = await parse(svgContent);
    
    const bridges = [];
    
    function walkForBridges(node) {
      if (node.attributes && node.attributes.id && node.attributes.id.includes('Bridge')) {
        function extractRects(n) {
          if (n.name === 'rect' && n.attributes) {
            const x = parseFloat(n.attributes.x || 0);
            const y = parseFloat(n.attributes.y || 0);
            const width = parseFloat(n.attributes.width || 0);
            const height = parseFloat(n.attributes.height || 0);
            bridges.push({ minX: x, maxX: x + width, minY: y, maxY: y + height });
          }
          if (n.children) n.children.forEach(extractRects);
        }
        extractRects(node);
      }
      if (node.children) node.children.forEach(walkForBridges);
    }
    
    walkForBridges(svgJson);
    
    if (bridges.length > 0) {
      return mergeBridgeZones(bridges);
    }
  } catch (err) {
    // Silently fail
  }
  
  return [];
}

// Helper: Merge and expand bridge zones
// -----------------------------
function mergeBridgeZones(bridges) {
  if (bridges.length === 0) return [];
  
  const merged = [];
  const sorted = bridges.sort((a, b) => a.minX - b.minX);
  let current = {...sorted[0]};
  
  for (let i = 1; i < sorted.length; i++) {
    const bridge = sorted[i];
    if (bridge.minX <= current.maxX + 50 && 
        bridge.minY <= current.maxY + 50 &&
        bridge.maxY >= current.minY - 50) {
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
  
  // Expand to 120% square
  return merged.map(zone => {
    const width = zone.maxX - zone.minX;
    const height = zone.maxY - zone.minY;
    const targetSize = Math.max(width, height) * 1.2;
    const centerX = (zone.minX + zone.maxX) / 2;
    const centerY = (zone.minY + zone.maxY) / 2;
    
    return {
      minX: centerX - targetSize / 2,
      maxX: centerX + targetSize / 2,
      minY: centerY - targetSize / 2,
      maxY: centerY + targetSize / 2,
      x: centerX - targetSize / 2,
      x2: centerX + targetSize / 2,
      y: centerY - targetSize / 2,
      y2: centerY + targetSize / 2
    };
  });
}

// -----------------------------
// Process SVG to sampled points
// (Same logic as reprocess-maps.js)
// -----------------------------
async function processSvg(svgDataOrUrl, samples = 500, bridges = []) {
  let svgContent = null;

  if (!svgDataOrUrl) throw new Error('No SVG data provided');

  if (typeof svgDataOrUrl === 'string' && svgDataOrUrl.trim().startsWith('data:')) {
    const base64 = svgDataOrUrl.split(',')[1] || '';
    svgContent = Buffer.from(base64, 'base64').toString('utf-8');
  } else if (typeof svgDataOrUrl === 'string' && svgDataOrUrl.trim().startsWith('<')) {
    svgContent = svgDataOrUrl;
  } else if (typeof svgDataOrUrl === 'string' && (svgDataOrUrl.startsWith('http://') || svgDataOrUrl.startsWith('https://'))) {
    const resp = await axios.get(svgDataOrUrl, { responseType: 'text' });
    svgContent = resp.data;
  } else {
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
      props = new SVGPathProperties(absPath);
    } catch (e) {
      props = SVGPathProperties(absPath);
    }
    const length = props.getTotalLength();
    
    // Dynamic sampling: adjust sample count based on path length
    const SPACING_TARGET = 2.0; // 2 SVG units per sample
    const dynamicSamples = Math.max(100, Math.min(2000, Math.ceil(length / SPACING_TARGET)));
    
    const allPoints = [];
    for (let i = 0; i <= dynamicSamples; i++) {
      const pt = props.getPointAtLength((i / dynamicSamples) * length);
      allPoints.push({ x: pt.x, y: pt.y });
    }
    
    let maxJumpIdx = -1;
    let maxJumpDist = 0;
    const avgDist = [];
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const dx = allPoints[i + 1].x - allPoints[i].x;
      const dy = allPoints[i + 1].y - allPoints[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      avgDist.push(dist);
      
      if (dist > maxJumpDist) {
        maxJumpDist = dist;
        maxJumpIdx = i;
      }
    }
    
    const medianDist = avgDist.sort((a, b) => a - b)[Math.floor(avgDist.length / 2)];
    const threshold = medianDist * 2.5;
    
    // Step 3: Handle bridges with direction reversal detection
    if (bridges.length > 0) {
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
          const dotProduct = beforeDx * afterDx + beforeDy * afterDy;
          const cosAngle = dotProduct / (beforeMag * afterMag);
          
          // Reversal = average directions are significantly opposite (>120 degrees)
          if (cosAngle < -0.5) { // >120 degrees
            reversals.push({ index: i, point: currentPoint });
          }
        }
      }
      
      if (reversals.length >= 2) {
        // Found both reversals - split and interpolate
        const firstReversal = reversals[0].index;
        const lastReversal = reversals[reversals.length - 1].index;
        
        // Keep points BEFORE first reversal and AFTER last reversal
        const outerLoop = [
          ...allPoints.slice(0, firstReversal),
          ...allPoints.slice(lastReversal + 1)
        ];
        
        // Interpolate across bridge gap (match 2.0 units/point density)
        const p1 = allPoints[firstReversal - 1];
        const p2 = allPoints[lastReversal + 1];
        const gapDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const numInterpolated = Math.max(2, Math.min(20, Math.ceil(gapDist / 2.0)));
        
        const interpolated = [];
        for (let i = 1; i < numInterpolated + 1; i++) {
          const t = i / (numInterpolated + 1);
          interpolated.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
          });
        }
        
        points.push(...outerLoop.slice(0, firstReversal), ...interpolated, ...outerLoop.slice(firstReversal));
        wasSplit = true;
      } else if (reversals.length === 1) {
        // Single reversal - split there
        const splitIdx = reversals[0].index;
        points.push(...allPoints.slice(0, splitIdx + 1));
        wasSplit = true;
      } else if (maxJumpDist > threshold && maxJumpIdx > 0) {
        // Fallback to distance-based detection
        const firstLoop = allPoints.slice(0, maxJumpIdx + 1);
        points.push(...firstLoop);
        wasSplit = true;
      } else {
        points.push(...allPoints);
      }
    } else if (maxJumpDist > threshold && maxJumpIdx > 0) {
      const firstLoop = allPoints.slice(0, maxJumpIdx + 1);
      points.push(...firstLoop);
      wasSplit = true;
    } else {
      points.push(...allPoints);
    }
  }
  return { points, wasSplit };
}

// -----------------------------
// Sort points by proximity (only if not split)
// -----------------------------
function sortPathByProximity(points) {
  const sorted = [];
  const remaining = [...points];
  
  let current = remaining.shift();
  sorted.push(current);
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].x - current.x;
      const dy = remaining[i].y - current.y;
      const dist = dx * dx + dy * dy;
      
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
// Extract start/finish position
// -----------------------------
async function extractStartFinishPosition(trackMapBaseUrl, layersObj) {
  if (!layersObj['start-finish']) return null;
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj['start-finish'];
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    
    const lineMatch = svgContent.match(/M([0-9.]+),([0-9.]+)(?:[^l]*?)l(-?[0-9.]+),?(-?[0-9.]+)/);
    
    if (lineMatch) {
      const startX = parseFloat(lineMatch[1]);
      const startY = parseFloat(lineMatch[2]);
      const dx = parseFloat(lineMatch[3]);
      const dy = parseFloat(lineMatch[4]);
      
      const endX = startX + dx;
      const endY = startY + dy;
      const x = (startX + endX) / 2;
      const y = (startY + endY) / 2;
      
      return { x, y };
    }
  } catch (err) {
    // Ignore errors, use fallback
  }
  
  return null;
}

// -----------------------------
// Extract arrow direction from start-finish SVG
// -----------------------------
async function extractArrowDirection(trackMapBaseUrl, layersObj) {
  if (!layersObj['start-finish']) return null;
  
  try {
    const layerUrl = trackMapBaseUrl + layersObj['start-finish'];
    const resp = await axios.get(layerUrl, { timeout: 10000 });
    const svgContent = resp.data;
    
    // Look for arrow path (typically has multiple 'l' commands for the arrow shape)
    // We want the first 'l' command which is the arrow shaft direction
    // Pattern: may have M and curves (c commands) before the l command
    const arrowMatch = svgContent.match(/l(-?[0-9.]+),(-?[0-9.]+)/);
    
    if (arrowMatch) {
      const dx = parseFloat(arrowMatch[1]);
      const dy = parseFloat(arrowMatch[2]);
      
      // Normalize the direction vector
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag > 0) {
        return { dx: dx / mag, dy: dy / mag };
      }
    }
  } catch (err) {
    // Ignore errors
  }
  
  return null;
}

// -----------------------------
// Rotate to start/finish
// -----------------------------
function rotateToStartFinish(points, startFinishPos) {
  if (points.length === 0) return points;
  
  let targetX, targetY;
  
  if (startFinishPos) {
    targetX = startFinishPos.x;
    targetY = startFinishPos.y;
  } else {
    // Fallback: bottom-center
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    targetX = (minX + maxX) / 2;
    targetY = maxY;
  }
  
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
  
  const rotated = [...points.slice(closestIdx), ...points.slice(0, closestIdx)];
  rotated.push({ ...rotated[0] }); // Close loop
  
  return rotated;
}

// -----------------------------
// Process single track
// -----------------------------
async function processTrack(trackId, trackData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🏁 Processing Track ${trackId}: ${trackData.track_name || 'Unknown'}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Check if track has map data
    if (!trackData.track_map) {
      console.log(`⚠️  No track_map field - skipping`);
      return { success: false, reason: 'no_track_map' };
    }
    
    const trackMapBaseUrl = trackData.track_map;
    
    // Parse track_map_layers
    let layersObj = trackData.track_map_layers;
    if (typeof layersObj === 'string') {
      layersObj = JSON.parse(layersObj);
    }
    
    if (!layersObj || !layersObj.active) {
      console.log(`⚠️  No active layer found - skipping`);
      return { success: false, reason: 'no_active_layer' };
    }
    
    const svgUrl = trackMapBaseUrl + layersObj.active;
    console.log(`📥 Fetching SVG: ${svgUrl}`);
    
    // Extract bridge locations
    const bridges = await extractBridgeLocations(layersObj, trackMapBaseUrl);
    if (bridges.length > 0) {
      console.log(`🌉 Found ${bridges.length} bridge zone(s)`);
    }
    
    // Extract start/finish position and arrow direction
    const startFinishPos = await extractStartFinishPosition(trackMapBaseUrl, layersObj);
    const arrowDirection = await extractArrowDirection(trackMapBaseUrl, layersObj);
    
    if (startFinishPos) {
      console.log(`✅ Start/finish: (${startFinishPos.x.toFixed(2)}, ${startFinishPos.y.toFixed(2)})`);
    } else {
      console.log(`⚠️  No start/finish found - using fallback`);
    }
    
    if (arrowDirection) {
      console.log(`🎯 Arrow direction: dx=${arrowDirection.dx.toFixed(3)}, dy=${arrowDirection.dy.toFixed(3)}`);
    }
    
    // Process SVG with bridge detection
    const result = await processSvg(svgUrl, 500, bridges);
    let sortedPoints;
    
    if (result.wasSplit) {
      console.log(`✂️  Path split - using sequential points`);
      sortedPoints = result.points;
    } else {
      console.log(`🔧 Sorting ${result.points.length} points`);
      sortedPoints = sortPathByProximity(result.points);
    }
    
    // Always rotate to start/finish position
    let rotatedPoints = rotateToStartFinish(sortedPoints, startFinishPos);
    console.log(`🔄 Rotated to start/finish position`);
    
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
        
        console.log(`📐 Racing line direction: dx=${lineDx.toFixed(3)}, dy=${lineDy.toFixed(3)}`);
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
    
    console.log(`✅ Final: ${finalPoints.length} points (closed loop)`);
    
    // Write to database or dry-run
    if (DRY_RUN) {
      console.log(`🔍 DRY RUN - would write ${finalPoints.length} points to DB`);
      
      // Export to file for inspection (plain array format, same as reprocess-maps.js)
      const outputDir = path.join(__dirname, 'processed-maps');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `track-${trackId}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(finalPoints, null, 2), 'utf8');
      console.log(`💾 Exported to: ${outputPath}`);
    } else {
      // Prepare racing line data for DB (keep as object for database storage)
      const racingLineData = {
        points: finalPoints,
        point_count: finalPoints.length,
        start_finish: startFinishPos,
        processed_at: new Date().toISOString(),
        version: 1
      };
      
      const client = await pool.connect();
      try {
        await client.query(`
          UPDATE tracks 
          SET racing_line = $1
          WHERE track_id = $2
        `, [JSON.stringify(racingLineData), trackId]);
        console.log(`💾 Written to database for track_id=${trackId}`);
      } finally {
        client.release();
      }
    }
    
    return { success: true, points: finalPoints.length };
    
  } catch (err) {
    console.error(`❌ Error processing track ${trackId}:`, err.message);
    return { success: false, reason: err.message };
  }
}

// -----------------------------
// Main batch processor
// -----------------------------
async function main() {
  console.log('\n🚀 Starting batch racing line processor');
  console.log(`📊 Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE (writing to DB)'}`);
  console.log(`📏 Limit: ${LIMIT} tracks, starting from ${START_FROM}\n`);
  
  try {
    // Test database connection if not dry-run
    if (!DRY_RUN && pool) {
      console.log('🔌 Testing database connection...');
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection OK\n');
    }
    
    // Authenticate with iRacing
    console.log('🔐 Authenticating with iRacing...');
    await iracingClient.authenticate(IRACING_USERNAME, IRACING_PASSWORD);
    
    if (!iracingClient.accessToken) {
      throw new Error('iRacing authentication failed');
    }
    console.log('✅ Authenticated with iRacing\n');
    
    // Fetch track assets ONCE
    console.log('📡 Fetching ALL track assets from iRacing API (one request)...');
    let assetsData = await iracingClient.makeDataAPIRequest('/data/track/assets');
    
    // Normalize to array
    let assetsArray = assetsData;
    if (!Array.isArray(assetsArray)) {
      if (assetsArray.link) {
        const s3Resp = await axios.get(assetsArray.link);
        assetsArray = Object.values(s3Resp.data);
      } else {
        assetsArray = Object.values(assetsData);
      }
    }
    
    console.log(`✅ Fetched ${assetsArray.length} tracks from iRacing (cached locally)\n`);
    
    // Filter tracks with track_id and track_map
    const validTracks = assetsArray.filter(t => t.track_id && t.track_map);
    console.log(`📋 Valid tracks with map data: ${validTracks.length}`);
    
    // Apply limit and offset
    const tracksToProcess = validTracks.slice(START_FROM, START_FROM + LIMIT);
    console.log(`🎯 Processing ${tracksToProcess.length} tracks (${START_FROM} to ${START_FROM + tracksToProcess.length})\n`);
    console.log(`⚡ All SVG fetches will be direct (no iRacing API rate limits)\n`);
    
    // Process each track
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    for (let i = 0; i < tracksToProcess.length; i++) {
      const track = tracksToProcess[i];
      const result = await processTrack(track.track_id, track);
      
      if (result.success) {
        results.success++;
      } else if (result.reason === 'no_track_map' || result.reason === 'no_active_layer') {
        results.skipped++;
      } else {
        results.failed++;
        results.errors.push({ track_id: track.track_id, reason: result.reason });
      }
      
      // Minimal delay (just to avoid hammering S3 CDN)
      if (i < tracksToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 BATCH PROCESSING COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Success: ${results.success}`);
    console.log(`⚠️  Skipped: ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach(e => console.log(`   Track ${e.track_id}: ${e.reason}`));
    }
    
    console.log('');
    
  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.end();
  }
}

main();
