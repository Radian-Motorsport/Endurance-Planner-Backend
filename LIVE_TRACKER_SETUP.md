# Live Strategy Tracker - Setup Guide

## Overview
The Live Strategy Tracker connects RadianPlanner with RadianApp's live telemetry to display real-time race progress against your planned strategy.

## Architecture

```
RadianPlanner (Strategy Planning)
    ↓ Generate Share Link
    ↓
Live Tracker (live-tracker.html)
    ↓ Load Strategy via Share Link
    ↓
Socket.io Connection → RadianApp Telemetry Server
    ↓
Display Live Race Data vs Planned Strategy
```

## Files Created

1. **`live-tracker.html`** - Live tracker page with telemetry connection
2. **`public/js/live-tracker.js`** - Live tracker JavaScript logic
3. **Updated `index.html`** - Navigation now points to live-tracker.html

## How to Use

### Step 1: Create a Race Strategy
1. Go to RadianPlanner (index.html)
2. Select series, track, car, drivers
3. Fill in race inputs (duration, lap time, fuel, etc.)
4. Click "Calculate" to generate stint breakdown
5. Assign drivers to stints
6. Click "Generate Link" to create a shareable strategy

### Step 2: Load Strategy in Live Tracker
1. Copy the share link from RadianPlanner
2. Go to Live Tracker page (click "LIVE TRACKER" button or navigate to `live-tracker.html`)
3. Click "Load Strategy" button
4. Paste the share link
5. Click "Load"

### Step 3: Connect to Live Telemetry
- The tracker automatically connects to `https://radianapp.onrender.com`
- Status indicator shows connection state (green = connected, gray = disconnected)
- Live data updates automatically when iRacing is running

## Features

### Real-Time Data Display
- **Session Time** - Elapsed race time
- **Current Lap** - Current lap number from telemetry
- **Fuel Remaining** - Live fuel level
- **Last Lap Time** - Most recent lap time

### Strategy Comparison
- **Current Stint** - Which stint you're currently in
- **Lap Delta** - How many laps ahead/behind planned strategy
- **Next Pit Stop** - Laps until next planned pit stop

### Stint Table
- Shows all planned stints with driver assignments
- Color-coded rows:
  - **Blue** = Currently active stint
  - **Dimmed** = Completed stints
  - **Normal** = Upcoming stints

## Next Steps (Future Enhancements)

### Phase 2: Token-Based Driver Identification
Currently the tracker shows ANY telemetry from the server. To support multiple drivers/teams simultaneously:

1. **Add Token System to Desktop App**
   - Desktop app includes a driver ID or team token in telemetry POST
   - Server broadcasts telemetry with token

2. **Filter in Live Tracker**
   - Live tracker filters telemetry by matching token
   - Only shows data for the specific driver/team

3. **Token Input in Live Tracker**
   - Add "Driver ID" or "Team Token" input field
   - Filter incoming telemetry by this token

### Phase 3: Mid-Race Replanning
- "Recalculate" button to update strategy during race
- Adjust for actual fuel usage, lap times
- Account for incidents, damage, driver changes

### Phase 4: Multi-Driver Dashboard
- Display multiple drivers' progress simultaneously
- Team overview with all cars
- Pit stop coordination

## Technical Details

### Socket.io Events Used
- `connect` - Connection established
- `disconnect` - Connection lost
- `telemetry` - Live telemetry data stream
- `currentBroadcaster` - Current driver info

### Telemetry Fields Used
- `Lap` - Current lap number
- `SessionTimeRemain` - Time remaining in session
- `FuelLevel` - Current fuel level
- `LapLastLapTime` - Last completed lap time
- `IsOnTrack` - Driver on track status
- `OnPitRoad` - Pit road status

### Strategy Data Format
```json
{
  "metadata": {
    "series": "Series name",
    "track": "Track name",
    "car": "Car name",
    "exportedAt": "2025-10-29T12:00:00.000Z"
  },
  "stints": [
    {
      "stintNumber": 1,
      "startTime": "13:00",
      "endTime": "14:30",
      "startLap": 1,
      "endLap": 45,
      "laps": 45.0,
      "driver": "Driver Name",
      "backup": "Backup Driver Name"
    }
  ]
}
```

## Troubleshooting

### Tracker Won't Connect
- Check that RadianApp server is running at `https://radianapp.onrender.com`
- Check browser console for connection errors
- Click "Reconnect" button

### Strategy Won't Load
- Verify the share link is complete and correct
- Check that the strategy exists in the database
- Try generating a new share link

### No Live Data Showing
- Ensure iRacing is running with the desktop app broadcasting
- Check RadianApp's connections page to see active broadcasters
- Verify telemetry is being sent from desktop app

## Development Notes

The live tracker is completely independent of the old `livev2.html` page, which can now be safely deleted. The new tracker uses the existing share link infrastructure, so no database changes are needed.

The tracker is designed to work with the current telemetry system as-is. Future token-based filtering will require updates to both the desktop app and the RadianApp server, but the tracker UI is already structured to support it.
