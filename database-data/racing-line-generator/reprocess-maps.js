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
async function processSvg(svgDataOrUrl, samples = 500) {
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
    
    // Sample points along the entire path
    const allPoints = [];
    for (let i = 0; i <= samples; i++) {
      const pt = props.getPointAtLength((i / samples) * length);
      allPoints.push({ x: pt.x, y: pt.y });
    }
    
    // Detect the connection jump (where inner/outer boundaries connect)
    // This will be a much longer distance than normal adjacent points
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
    const threshold = medianDist * 2.5; // Jump should be 2.5x larger than normal spacing
    
    console.log(`🔍 Analyzing path: max jump = ${maxJumpDist.toFixed(2)}, median = ${medianDist.toFixed(2)}, threshold = ${threshold.toFixed(2)}`);
    
    if (maxJumpDist > threshold && maxJumpIdx > 0) {
      // Found the connection - split here and use only the first loop (outer boundary)
      const firstLoop = allPoints.slice(0, maxJumpIdx + 1);
      console.log(`✂️  Split path at index ${maxJumpIdx}: keeping first loop with ${firstLoop.length} points`);
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
        return Number(t.track_id) === 219 || Number(t.id) === 219 || Number(t.track_garage61_id) === 219 || Number(t.garage61_id) === 219;
      } catch (e) {
        return false;
      }
    });

    if (!track) {
      console.log('DEBUG: Could not find track by numeric id 219. Showing sample entry keys to help diagnose:');
      if (data.length > 0) {
        console.log('DEBUG: sample keys of first element:', Object.keys(data[0]).slice(0,50));
        console.log('DEBUG: sample of first element (truncated):', JSON.stringify(data[0]).slice(0,1000));
      }
      throw new Error('No track entry matching id 219 found in assets');
    }

    if (!track.track_map) {
      console.log('DEBUG: Found track object but no `track_map` field present. Track keys:', Object.keys(track));
      throw new Error('No track_map found for track_id=219');
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
    
    // Extract start/finish position from SVG layers (look for #991b1b red line)
    console.log('🔍 Searching for start/finish line in SVG layers...');
    const startFinishPos = await extractStartFinishPosition(track.track_map, layersObj);
    
    const result = await processSvg(svgUrl, 1000);
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
    
    // Rotate so start/finish is at index 0 and close the loop
    console.log('🔄 Rotating to start/finish and closing loop...');
    const finalPoints = rotateToStartFinish(sortedPoints, startFinishPos);
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
        const outPath = path.join(outDir, 'track-219.json');
        fs.writeFileSync(outPath, JSON.stringify(finalPoints, null, 2), 'utf8');
        console.log('✅ Exported sampled points to', outPath);
      } catch (e) {
        console.warn('⚠️ Failed to export sampled points to JSON:', e && e.message ? e.message : e);
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
