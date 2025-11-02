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
// Process SVG to sampled points
// (Same logic as reprocess-maps.js)
// -----------------------------
async function processSvg(svgDataOrUrl, samples = 500) {
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
    
    const allPoints = [];
    for (let i = 0; i <= samples; i++) {
      const pt = props.getPointAtLength((i / samples) * length);
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
    
    if (maxJumpDist > threshold && maxJumpIdx > 0) {
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
    
    // Extract start/finish
    const startFinishPos = await extractStartFinishPosition(trackMapBaseUrl, layersObj);
    if (startFinishPos) {
      console.log(`✅ Start/finish: (${startFinishPos.x.toFixed(2)}, ${startFinishPos.y.toFixed(2)})`);
    } else {
      console.log(`⚠️  No start/finish found - using fallback`);
    }
    
    // Process SVG
    const result = await processSvg(svgUrl, 500);
    let sortedPoints;
    
    if (result.wasSplit) {
      console.log(`✂️  Path split - using sequential points`);
      sortedPoints = result.points;
    } else {
      console.log(`🔧 Sorting ${result.points.length} points`);
      sortedPoints = sortPathByProximity(result.points);
    }
    
    // Rotate to start/finish
    const finalPoints = rotateToStartFinish(sortedPoints, startFinishPos);
    console.log(`✅ Final: ${finalPoints.length} points (closed loop)`);
    
    // Prepare racing line data
    const racingLineData = {
      points: finalPoints,
      point_count: finalPoints.length,
      start_finish: startFinishPos,
      processed_at: new Date().toISOString(),
      version: 1
    };
    
    // Write to database or dry-run
    if (DRY_RUN) {
      console.log(`🔍 DRY RUN - would write ${finalPoints.length} points to DB`);
      
      // Export to file for inspection
      const outputDir = path.join(__dirname, 'processed-maps');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `track-${trackId}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(racingLineData, null, 2), 'utf8');
      console.log(`💾 Exported to: ${outputPath}`);
    } else {
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
