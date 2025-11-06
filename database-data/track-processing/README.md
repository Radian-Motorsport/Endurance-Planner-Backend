# Track Processing System

This folder contains the complete system for processing iRacing track racing lines from SVG data into optimized point arrays for the database.

## Overview

The system fetches track SVG assets from iRacing's Data API, processes the racing line paths with dynamic sampling and validation, and generates SQL updates for the PostgreSQL database. It handles complex scenarios including bridge tracks with direction reversals, start/finish alignment, and automatic direction validation.

## How It Works

### 1. Data Acquisition
- Authenticates with iRacing OAuth2 API
- Fetches track assets (3 SVG layers: active, background, start-finish)
- Extracts racing line from `active.svg` layer
- Extracts bridge zones from `background.svg` layer
- Extracts start/finish position and direction arrow from `start-finish.svg` layer

### 2. Dynamic Sampling
- Calculates total path length in SVG units
- Samples points at ~2.0 SVG unit intervals: `Math.max(100, Math.min(2000, Math.ceil(length / 2.0)))`
- Results in 100-2000 points per track depending on length
- Ensures consistent detail level across all track sizes

### 3. Track Type Detection & Processing

#### Normal Tracks (Square Ends)
- Large jump in point distances at connection (23+ units)
- Uses distance threshold detection (median * 2.5)
- Splits array and interpolates across gap

#### Bridge Tracks (Rounded Ends)
- Small jumps in distances (5-6 units)
- Uses **window-based direction reversal detection**:
  - 10-point windows before/after each point
  - Calculates average direction vectors
  - Detects reversals: `dot product < -0.5` (>120° angle)
  - Finds reversal clusters in bridge zone
  - Splits at first and last reversal indices

### 4. Bridge Gap Interpolation
- Dynamically calculates gap distance between split endpoints
- Interpolates points matching track density: `Math.max(2, Math.min(20, Math.ceil(gapDist / 2.0)))`
- Example: 92-unit gap → 20 interpolated points (vs old fixed 2 points)

### 5. Start/Finish Alignment
- Finds closest point to start/finish coordinates from SVG
- Rotates array to put that point at index 0
- **Always applied** (removed previous `wasSplit` skip condition)

### 6. Direction Validation
- Extracts arrow direction from start-finish SVG
  - Regex: `/l(-?[0-9.]+),(-?[0-9.]+)/` (first `l` command = arrow shaft)
  - Normalizes to unit vector {dx, dy}
- Calculates racing line direction (average of first 5 segments)
- Compares via dot product
- **Auto-reverses if opposite** (dot product < 0)
- Result: 193/448 tracks were auto-reversed to match arrow direction

### 7. Output Generation
- Saves processed points as JSON files
- Generates SQL UPDATE statements
- Creates standalone HTML visualizations (CORS-free)

## File Descriptions

### Core Processing Scripts

**`batch-process-racing-lines.js`** - Primary batch processor
- Processes all ~450 tracks with full OAuth authentication
- Implements all features: dynamic sampling, bridge detection, rotation, direction validation
- Outputs: JSON files in `processed-maps/`, processing log
- Last run: 448 success, 4 failed (403 HTTP errors), 193 auto-reversed

**`reprocess-maps.js`** - Single track processor
- Same logic as batch script but for individual tracks
- Used for testing and debugging specific tracks
- Takes track ID as parameter
- Example: `node reprocess-maps.js 168` (Suzuka)

**`generate-update-sql.js`** - SQL generator
- Reads all JSON files from `processed-maps/`
- Generates UPDATE statements for PostgreSQL
- Output: `update-racing-lines.sql` with 448 UPDATEs
- Format: `UPDATE tracks SET racing_line = '{"points":[...]}'::jsonb WHERE track_id = X;`

### Verification & Visualization

**`test-single-track.js`** - Programmatic verification
- Checks specific track processing results
- Validates: point count, start position distance, rotation correctness
- Example output:
  ```
  Track 168 (Suzuka):
  - Points: 1016
  - Start/finish distance: 3.59 units ✅
  - First point: (1349.80, 309.86)
  ```

**`generate-viz.js`** - Visualization generator
- Creates standalone HTML files with embedded track data
- Avoids CORS issues by embedding JSON in `<script>` tag
- Canvas rendering: green racing line, red start marker, yellow direction arrow
- Self-contained, no external dependencies
- Usage: `node generate-viz.js 168` → creates `track-168-standalone.html`

### Support Files

**`tracks-to-reverse.js`** - ⚠️ DEPRECATED
- Old manual reversal list (contained track 239 - Monza)
- No longer used - direction validation is now automatic
- Kept for reference only

## Output Files

### `processed-maps/` Folder
- 448 JSON files, one per track
- Format: `track-{id}.json`
- Structure: Array of `{x, y}` coordinate objects
- Point counts: 100-2000 per track (dynamic sampling)

### `update-racing-lines.sql`
- 448 SQL UPDATE statements ready to execute
- Updates `tracks.racing_line` JSONB column
- **Ready for DBeaver execution**

### `batch-process-full.log`
- Complete processing log from last batch run
- Shows all decisions: splits, reversals, interpolations
- Useful for debugging individual track processing

### `track-168-standalone.html`
- Example visualization (Suzuka Grand Prix)
- Self-contained HTML with embedded data
- **Reference example for viewing processed tracks**
- Open directly in browser - no server needed

## Usage Examples

### Process All Tracks
```bash
cd database-data/track-processing
node batch-process-racing-lines.js
# Output: processed-maps/*.json + batch-process-full.log
```

### Process Single Track
```bash
node reprocess-maps.js 168
# Output: track-168.json
```

### Generate SQL Updates
```bash
node generate-update-sql.js
# Output: update-racing-lines.sql (448 UPDATE statements)
```

### Verify Processing
```bash
node test-single-track.js
# Shows: point count, start position alignment, rotation validation
```

### Create Visualization
```bash
node generate-viz.js 168
# Output: track-168-standalone.html
# Open in browser to view racing line
```

### View Visualization
1. Generate standalone HTML: `node generate-viz.js {track_id}`
2. Open resulting HTML file in any browser
3. Visual check:
   - ✅ Green line = racing line (should be single continuous loop)
   - ✅ Red dot = start/finish position (index 0)
   - ✅ Yellow arrow = direction of travel (clockwise for most tracks)

## Database Update Workflow

1. **Verify processing**: Open `track-168-standalone.html` in browser
   - Check single continuous line (no double-line artifacts)
   - Verify start position (red dot should be at start/finish area)
   - Confirm direction (yellow arrow should match expected track direction)

2. **Execute SQL**: Open `update-racing-lines.sql` in DBeaver
   - Connect to PostgreSQL database
   - Execute all 448 UPDATE statements
   - Updates `tracks.racing_line` JSONB column

3. **Verify database**: Query a sample track
   ```sql
   SELECT track_id, 
          jsonb_array_length(racing_line->'points') as point_count,
          racing_line->'points'->0 as first_point
   FROM tracks 
   WHERE track_id = 168;
   ```

## Technical Details

### Dependencies
- `axios`: HTTP requests to iRacing API
- `pg`: PostgreSQL client
- `svgson`: SVG parsing to JSON
- `svgpath`: SVG path transformations
- `svg-path-properties`: Path length and point sampling

### iRacing Data API
- Endpoint: `/data/track/assets`
- Authentication: OAuth2 with refresh token
- Returns: S3 presigned URLs for 3 SVG layers
- SVG layers expire after ~5 minutes

### Database Schema
```sql
-- tracks table
racing_line JSONB
-- Structure: {"points": [{"x": 123.45, "y": 678.90}, ...]}
```

### Processing Statistics
- **Total tracks**: 452 in database
- **Successfully processed**: 448 tracks
- **Failed**: 4 tracks (403 HTTP errors - expired/unavailable assets)
- **Auto-reversed**: 193 tracks (based on arrow direction validation)
- **Point range**: 100-2000 points per track
- **Average processing time**: ~2-3 seconds per track

### Known Issues
- 4 tracks failed with 403 errors (likely retired/unavailable configurations)
- Old manual `tracks-to-reverse.js` list deprecated but kept for reference
- Bridge detection requires both background SVG layer and direction reversal logic

## Key Improvements Over Previous Version

1. ✅ **Dynamic Sampling**: Was fixed 500 points → now length-based (100-2000)
2. ✅ **Bridge Detection**: Window-based direction reversal detection
3. ✅ **Dynamic Interpolation**: Was fixed 2 points → now density-matched (2-20)
4. ✅ **Rotation**: Now always applied (removed `wasSplit` skip)
5. ✅ **Direction Validation**: Automatic arrow-based reversal (was manual list)
6. ✅ **Visualization**: CORS-free standalone HTML (was external fetch)

## Verification Checklist

Before committing database updates:
- [ ] Run `test-single-track.js` - confirms rotation alignment
- [ ] Generate visualization: `node generate-viz.js 168`
- [ ] Open `track-168-standalone.html` in browser
- [ ] Visual check: single line, correct start, proper direction
- [ ] Review `batch-process-full.log` for anomalies
- [ ] Verify SQL file has 448 UPDATE statements
- [ ] Test SQL on dev database before production

## Support

For issues or questions:
1. Check `batch-process-full.log` for processing details
2. Test single track: `node reprocess-maps.js {track_id}`
3. Generate visualization for visual confirmation
4. Review this README for technical details

---

**Last Updated**: November 5, 2025  
**Processing Version**: v2.0 (Dynamic sampling + arrow validation)  
**Tracks Processed**: 448/452 successful  
**Database Ready**: Yes (`update-racing-lines.sql`)
