# Racing Line Integration - Testing Guide

## ✅ Implementation Complete

The racing line data from your database has been fully integrated into the live tracker. Here's what was done:

### 1. **Server-Side** (`server.js`)
- Modified `/api/track-assets/:trackId` endpoint to include `racing_line` data from database
- Fetches from `tracks.racing_line` JSONB column
- Graceful fallback if column doesn't exist or data is missing

### 2. **Car Position Tracker Module** (`car-position-tracker.js`)
- Added **dual-mode support**: racing line points OR SVG path
- New method: `setRacingLineData(racingLineData)` - loads racing line from DB
- New method: `toggleRacingLineVisibility(visible)` - show/hide line for testing
- Creates invisible racing line layer (green polyline) 
- Car position uses array index: `index = Math.floor(LapDistPct * points.length)`
- Falls back to SVG path if no racing line data available

### 3. **Live Tracker** (`live-tracker.js`)
- Uncommented track map section
- New method: `loadTrackAssetsWithRacingLine(trackId)` - fetches both SVG + racing line
- Passes racing line data to car position tracker
- Console helper: `window.toggleRacingLine(true/false)` for alignment testing

### 4. **HTML** (`live-tracker.html`)
- Uncommented track map section
- Ready to display when strategy loads

---

## 🧪 How to Test

### Step 1: Load Strategy
1. Start your telemetry backend: `node server.js` (or it should already be running on Render)
2. Open live tracker: `http://localhost:3000/live-tracker.html`
3. Click **"Load Strategy"** button
4. Paste a strategy ID or share link

### Step 2: Wait for Track Map to Load
- Track map will load automatically when strategy is loaded
- Watch console for these messages:
  - `✅ Racing line data loaded: XXX points`
  - `✅ Car position tracker ready`
  - `🏁 Initializing car tracker with racing line data` (means using racing line!)
  - OR `⚠️ No racing line data, using SVG path fallback` (means no racing line in DB)

### Step 3: Start iRacing
- Launch iRacing and join a session
- Telemetry should start streaming
- Watch the **cyan dot** move around the track

### Step 4: Test Alignment
Open browser console (F12) and run:

```javascript
// Show racing line as GREEN overlay
toggleRacingLine(true)

// Hide racing line
toggleRacingLine(false)
```

### What to Look For:
- ✅ **Perfect alignment**: Green line matches SVG track exactly, car dot follows smoothly
- ⚠️ **Offset but same shape**: Racing line correct but rotated/positioned wrong
- ❌ **Different shape**: Racing line doesn't match track (wrong track data?)
- ❌ **Jumping dot**: Car jumping around = old SVG path bug still present

---

## 📊 Expected Console Output

### Success (Racing Line Mode):
```
🗺️ Loading track map for: Road Atlanta
✅ Track assets loaded: { track_map: 'yes', racing_line: 'yes (550 points)' }
🏁 Racing line data available, using racing line mode
✅ Racing line data loaded: 550 points
📍 Start/finish position: { x: 1221.65, y: 575.6 }
✅ Racing line layer created (invisible)
✅ Car marker created at start line
✅ Car position tracker ready
🚗 Car position (racing line): 23.4% → index 128/550 → (1205.3, 612.8)
```

### Fallback (SVG Path Mode):
```
🗺️ Loading track map for: Road Atlanta
✅ Track assets loaded: { track_map: 'yes', racing_line: 'no' }
⚠️ No racing line data, using SVG path fallback
📏 Track path total length: 3456.78 units
✅ Car position tracker ready
🚗 Car position (SVG path): 23.4% → (1205.3, 612.8)
```

---

## 🐛 Troubleshooting

### Car dot doesn't appear
- Check console for errors
- Make sure telemetry is streaming: look for `CarIdxLapDistPct` values
- Try manually: `window.liveTracker.carPositionTracker.updatePosition(50)` (should move dot to 50%)

### Racing line not loading
- Check database: `SELECT track_id, racing_line FROM tracks WHERE track_id = 15;`
- Verify `racing_line` column exists and has JSONB data with `points` array
- Check server logs for database errors

### Green line doesn't match track
**If shapes are similar but offset:**
- Racing line start/finish might not align with SVG
- The generator uses start/finish detection, but it may be imperfect
- Try different track to compare

**If shapes are completely different:**
- Wrong track data in database
- Check: `SELECT track_id, point_count FROM tracks WHERE racing_line IS NOT NULL;`
- Compare track_id between strategy and database

### Car jumps around (not smooth)
- If using **racing line mode** and still jumping = racing line data is broken (points not ordered correctly)
- If using **SVG fallback** and jumping = expected (this is why we made racing line system!)

---

## 🎨 Alignment Testing Results

After testing, report back:

1. **Which track did you test?** (name + track_id)
2. **Does green line align with track?** (yes/no/close)
3. **Does car dot move smoothly?** (yes/jumps/doesn't move)
4. **Console errors?** (paste any red errors)

Based on results, we can:
- ✅ If aligned: Make racing line visible by default (change opacity from 0 to 0.8)
- ⚠️ If close: Adjust coordinate system or start/finish offset
- ❌ If misaligned: May need to hide SVG layers and use only racing line (white, not green)

---

## 🔧 Quick Fixes

### Make Racing Line Visible by Default
In `car-position-tracker.js`, line ~162, change:
```javascript
this.racingLineLayer.setAttribute('opacity', '0.8');  // Was: '0'
```

### Change Racing Line Color (if using it instead of SVG)
In `car-position-tracker.js`, line ~161, change:
```javascript
this.racingLineLayer.setAttribute('stroke', '#ffffff');  // Was: '#10b981' (green)
this.racingLineLayer.setAttribute('stroke-width', '3');   // Was: '2'
```

### Remove SVG Layers (use only racing line)
In `live-tracker.js`, line ~448, change:
```javascript
defaultLayers: [],  // Was: ['background', 'active', 'start-finish']
```

---

## 📝 What's Next?

Once alignment is confirmed:
1. Toggle layer visibility in UI (add checkbox in track map controls)
2. Adjust styling based on what works best visually
3. Test with multiple tracks to ensure consistency
4. Document which tracks have racing line data vs fallback

Good luck testing! 🏁
