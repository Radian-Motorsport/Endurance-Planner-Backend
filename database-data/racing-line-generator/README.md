# Racing Line Generator

This folder contains tools to fetch, process, and store racing line data for all iRacing tracks.

## What It Does

Fetches track SVG map data from iRacing API, extracts the racing line path, samples coordinate points, detects start/finish line position, and generates data suitable for lap percentage calculations and visual overlays.

## Files

- **`reprocess-maps.js`** - Single track processor (for testing/debugging)
- **`batch-process-racing-lines.js`** - Batch processor for all tracks
- **`generate-sql.js`** - Converts JSON exports to SQL UPDATE statements
- **`add-racing-line-column.sql`** - Database migration (one-time setup)

## Prerequisites

```bash
npm install pg axios svgson svgpath svg-path-properties
```

## Quick Start

### Option 1: Batch Process All Tracks (Recommended)

```powershell
# 1. Dry-run (exports JSON files, no database writes)
$env:DRY_RUN='1'
$env:LIMIT='500'
node batch-process-racing-lines.js

# 2. Review output in processed-maps/ folder

# 3. Generate SQL file for database import
node generate-sql.js

# 4. Run update-racing-lines.sql in DBeaver or psql
```

### Option 2: Test Single Track

```powershell
# Edit reprocess-maps.js line ~410 to set track_id
# Example: const TRACK_ID = 268;  // Le Mans

node reprocess-maps.js
```

## Configuration

### Environment Variables

- **`DRY_RUN`** - Set to `1` to export JSON files instead of writing to database
- **`LIMIT`** - Number of tracks to process (default: 10, max: 500)
- **`START_FROM`** - Skip first N tracks (default: 0)
- **`DATABASE_URL`** - PostgreSQL connection string (not needed for dry-run)

### iRacing Credentials

Edit `batch-process-racing-lines.js` lines 47-50:

```javascript
const IRACING_CLIENT_ID = "your-client-id";
const IRACING_CLIENT_SECRET = "your-client-secret";
const IRACING_USERNAME = "your-email@example.com";
const IRACING_PASSWORD = "your-password";
```

## Output Format

### JSON Export (Dry-Run Mode)

Files saved to `processed-maps/track-{id}.json`:

```json
{
  "points": [
    {"x": 1221.65, "y": 575.6},
    {"x": 1220.32, "y": 578.45},
    ...
  ],
  "point_count": 554,
  "start_finish": {"x": 1221.65, "y": 575.6},
  "processed_at": "2025-11-02T21:45:00.000Z",
  "version": 1
}
```

### Database Column

The `racing_line` JSONB column in the `tracks` table stores the same structure.

## How It Works

### 1. OAuth Authentication
- Uses iRacing OAuth2 Password Grant flow
- Fetches access token (valid 10 minutes)
- Single authentication for entire batch

### 2. Fetch Track Assets
- Single API call to `/data/track/assets` fetches all 452 tracks
- Extracts `track_map` base URL and `track_map_layers` object
- Finds `active.svg` layer (primary racing surface)

### 3. Process SVG Path
- Fetches SVG from presigned S3 URL (no auth required)
- Parses all `<path>` elements using svgson
- Samples 500 points along path using svg-path-properties

### 4. Split Double-Loop Paths
- iRacing SVGs contain both inner and outer track boundaries as single "donut" path
- Algorithm: Calculate point-to-point distances, find median, detect jump >2.5× median
- Splits at connection jump, keeps only outer boundary (larger segment)

### 5. Extract Start/Finish Line
- Fetches `start-finish.svg` layer if available
- Regex pattern matches horizontal/vertical/diagonal red line: `/M([0-9.]+),([0-9.]+)(?:[^l]*?)l(-?[0-9.]+),?(-?[0-9.]+)/`
- Calculates midpoint of line as reference position
- Fallback: Uses bottom-center of bounding box if no start/finish marker found

### 6. Sort Points (Conditional)
- **If path was split**: Uses sequential points from SVG (already correct order)
- **If path NOT split**: Applies nearest-neighbor greedy sort for smooth progression

### 7. Rotate Array
- Finds point closest to start/finish position
- Rotates array to position start/finish at index 0
- Closes loop by duplicating first point at end

### 8. Export Data
- Dry-run: Writes JSON file to `processed-maps/`
- Live mode: Executes `UPDATE tracks SET racing_line = $1 WHERE track_id = $2`

## Processing Results (Latest Run)

- **Total tracks**: 452
- **Successfully processed**: 448
- **Failed**: 4 (tracks 37-40, 403 Forbidden - restricted content)
- **Average points per track**: 250-550
- **Processing time**: ~4-5 minutes for all tracks (500ms delay between tracks)

## Troubleshooting

### Connection Errors

If you see "Connection terminated unexpectedly" or "SSL/TLS required":

1. Use dry-run mode instead: `$env:DRY_RUN='1'; node batch-process-racing-lines.js`
2. Generate SQL file: `node generate-sql.js`
3. Import manually via DBeaver

### OAuth Failures

- Verify credentials are correct
- Check iRacing account has active subscription
- Token expires after 10 minutes (re-authenticate if batch takes longer)

### Missing Start/Finish

Some tracks don't have a `start-finish.svg` layer. The code falls back to bottom-center of bounding box. You'll see:

```
⚠️  No start/finish found - using fallback
```

### Split Detection Issues

If a track shows artifacts or incorrect line:

1. Run single track with `reprocess-maps.js`
2. Adjust split threshold in line ~115: `const splitThreshold = median * 2.5;` (try 2.0 or 3.0)
3. Visualize output with `public/track-{id}-debug.html`

## Database Schema

The `racing_line` column was added via `add-racing-line-column.sql`:

```sql
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS racing_line JSONB;

CREATE INDEX idx_tracks_racing_line 
ON tracks USING GIN (racing_line);

COMMENT ON COLUMN tracks.racing_line IS 
'Processed racing line data with sampled points, start/finish position, and metadata';
```

## Re-running at Later Date

If iRacing adds new tracks or updates existing ones:

1. Update credentials if changed
2. Run batch processor in dry-run mode
3. Review changes in `processed-maps/`
4. Generate new SQL file
5. Run SQL updates in database

**Note**: This will overwrite existing `racing_line` data for tracks that are re-processed.

## Visualization

Debug visualizers in `public/`:

- `track-15-debug.html` - Concord Half
- `track-268-debug.html` - Le Mans
- `track-262-debug.html` - Nürburgring
- `track-219-debug.html` - Bathurst

Each shows:
- Green racing line
- Red start/finish marker
- Black background
- Stats (point count, start/finish coordinates)

## Integration

To use racing line data in your planner:

```javascript
// Fetch from database
const result = await pool.query(
  'SELECT racing_line FROM tracks WHERE track_id = $1',
  [trackId]
);

const { points, start_finish } = result.rows[0].racing_line;

// Calculate lap percentage
function getLapPercentage(carX, carY, racingLine) {
  // Find nearest point on racing line
  let minDist = Infinity;
  let nearestIndex = 0;
  
  for (let i = 0; i < racingLine.points.length; i++) {
    const dx = carX - racingLine.points[i].x;
    const dy = carY - racingLine.points[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < minDist) {
      minDist = dist;
      nearestIndex = i;
    }
  }
  
  return (nearestIndex / racingLine.points.length) * 100;
}
```

## Technical Details

### Algorithms

**Path Splitting** (O(n)):
```
1. Calculate distances between consecutive points
2. Find median distance
3. Detect jump > 2.5× median (connection point)
4. Split array, keep larger segment (outer boundary)
```

**Nearest-Neighbor Sort** (O(n²)):
```
1. Start with first point
2. Find nearest unvisited point
3. Add to sorted array, mark visited
4. Repeat until all points sorted
```

**Start/Finish Detection**:
```
Regex: /M([0-9.]+),([0-9.]+)(?:[^l]*?)l(-?[0-9.]+),?(-?[0-9.]+)/
Matches: M<x>,<y>l<dx>,<dy> (line command in SVG path)
Calculates: midpoint = (x + dx/2, y + dy/2)
```

### Dependencies

- **pg** - PostgreSQL client
- **axios** - HTTP requests
- **svgson** - SVG to JSON parser
- **svgpath** - SVG path manipulation
- **svg-path-properties** - Path sampling and measurements

### Rate Limiting

- Single OAuth call for all tracks (no rate limit)
- All SVG fetches from S3 CDN (no iRacing API rate limits)
- 500ms delay between tracks (courtesy only)

## License

Internal use only. iRacing data subject to iRacing Terms of Service.
