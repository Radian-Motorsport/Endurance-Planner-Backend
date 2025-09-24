# RadianPlanner Database Data

# Garage61 API Integration System

A standalone system for retrieving lap time and telemetry data from the Garage61 API for the Radian Motorsport team.

## Overview

This system provides a clean interface to query Garage61's lap data API, handling authentication, CORS issues, and data formatting. It's designed to be used as building blocks for the RadianPlanner application.

## Components

### 1. **Server (server.js)**
- Node.js/Express CORS proxy server
- Handles Garage61 API authentication
- Runs on `localhost:3000`
- Proxies requests to `https://garage61.net/api/v1/laps`

### 2. **API Module (garage61-api.js)** *(Coming Soon)*
- Modular JavaScript functions for data retrieval
- Clean data objects (no HTML)
- Utility functions for data formatting
- Designed for import into other applications

### 3. **Demo Interface (garage61-lap-search.html)**
- HTML interface for testing and demonstration
- Shows complete telemetry data display
- Reference implementation for UI integration

## Setup Instructions

### Prerequisites
- Node.js installed
- Garage61 API Bearer token

### Installation
1. Navigate to the Garage61 directory:
   ```bash
   cd "c:\Users\John\Documents\GitHub\Garage61"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Access the demo interface:
   ```
   http://localhost:3000/garage61-lap-search.html
   ```

## API Usage

### Current Search Format
The system searches using this exact format:
```
https://garage61.net/api/v1/laps?cars=169&tracks=253&teams=radian-motorsport
```

### Parameters
- **cars**: Car ID (e.g., 169)
- **tracks**: Track ID (e.g., 253)
- **teams**: Always "radian-motorsport" for team data

### Authentication
Uses Bearer token stored in `server.js`:
```javascript
const GARAGE61_TOKEN = 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5';
```

## Data Structure

### Lap Object Structure
```javascript
{
  id: "01G16YZ3XDFMBB1RZEC6W4HQ4V",
  driver: {
    name: "Driver Name",
    slug: "driver-slug"
  },
  driverRating: 1248,
  event: "01G16Y57YZG35AMXE7CNV7DQ0V",
  lapTime: 6.314199924468994, // seconds
  trackTemp: 32.583343505859375, // °C
  trackUsage: 15, // percentage
  trackWetness: 0, // percentage
  airTemp: 18.739501953125, // °C
  clouds: 3, // 1=Clear, 2=Partly, 3=Mostly, 4=Overcast
  windVel: 0.5706329941749573, // m/s
  windDir: 0.9597501158714294, // radians
  relativeHumidity: 0.3471045196056366, // 0-1 scale
  fogLevel: 0,
  precipitation: 0,
  sectors: [
    {
      sectorTime: 21.578902631,
      incomplete: false
    },
    {
      sectorTime: 38.214390334,
      incomplete: false
    },
    {
      sectorTime: 28.140040368,
      incomplete: false
    }
  ],
  fuelLevel: 36.47564, // liters
  fuelUsed: 2.848433, // liters
  fuelAdded: 0,
  tireCompound: 1,
  // ... additional fields
}
```

## Data Formatting Functions

### Wind Direction Conversion
```javascript
// Converts radians to compass directions (N, NE, E, SE, S, SW, W, NW)
getWindDirection(radians)
```

### Wind Speed Conversion
```javascript
// Converts m/s to mph
windSpeedMph = windVel * 2.237
```

### Humidity Display
```javascript
// Converts 0-1 scale to percentage
humidityPercent = relativeHumidity * 100
```

### Lap Time Formatting
```javascript
// Converts seconds to MM:SS.sss format
formatLapTime(seconds) // e.g., "1:26.314"
```

### Sector Time Handling
```javascript
// Handles sectors array with sectorTime and incomplete properties
sectors.map(sector => `S${i+1}: ${sector.sectorTime.toFixed(3)}`)
```

## Integration with RadianPlanner

### Planned Usage Pattern
```javascript
// Import the API module
import { searchLapData, formatLapTime, getWindDirection } from './garage61-api.js';

// Search for multiple cars/tracks/drivers
const results = await searchLapData({
  cars: [169, 170],
  tracks: [253, 254],
  drivers: ['john-sowerby', 'mike-smith']
});

// Process results for display
results.forEach(lap => {
  const formattedTime = formatLapTime(lap.lapTime);
  const windDir = getWindDirection(lap.windDir);
  // ... render in RadianPlanner UI
});
```

### Benefits for RadianPlanner
- **Multiple Selection**: Handle multiple cars, tracks, drivers in one call
- **Raw Data**: Get clean JavaScript objects, not HTML
- **Flexible Display**: Apply your own styling and UI components
- **Error Handling**: Better control over loading states and errors
- **Performance**: Client-side filtering and sorting of results

## File Structure
```
Garage61/
├── server.js                 # CORS proxy server
├── garage61-lap-search.html  # Demo interface
├── garage61-api.js          # API module (coming soon)
├── package.json             # Node.js dependencies
└── README.md               # This file
```

## Server Configuration

### Dependencies
- **express**: Web server framework
- **cors**: CORS handling
- **node-fetch**: HTTP requests to Garage61 API

### Endpoints
- `GET /api/garage61/laps` - Proxy to Garage61 API
- `GET /garage61-lap-search.html` - Demo interface

## Troubleshooting

### Common Issues
1. **Port 3000 in use**: Kill existing node processes with `taskkill /F /IM node.exe`
2. **CORS errors**: Ensure server is running before accessing the interface
3. **API authentication**: Verify the bearer token is valid
4. **No results**: Check that car/track IDs exist and team has data for that combination

### Error Messages
- `Failed to fetch lap data`: Server not running or API unreachable
- `No lap data found`: Valid request but no laps match the criteria
- `API Error: 401`: Invalid or expired bearer token
- `API Error: 403`: Insufficient permissions for requested data

## Next Steps

1. **Create garage61-api.js module** with exportable functions
2. **Integrate into RadianPlanner** application
3. **Add caching** for frequently requested data
4. **Error handling** improvements
5. **Rate limiting** to respect API limits

## Notes

- System designed specifically for **radian-motorsport** team data
- API returns all team laps for car/track combination
- Client-side filtering handles driver selection
- Server handles CORS and authentication automatically
- Demo interface shows full telemetry data capabilities

## Current Data Files

### `garage61-radian-team.json` (33 drivers)
Contains the Radian Motorsport team driver roster in the CORRECT format.
- **Structure**: Each driver has `name`, `garage61_slug`, `firstName`, `lastName`
- **Source**: Processed from Garage 61 team data
- **Last Updated**: Current database contains 33 drivers

### `garage61-filtered-cars.json` (32 cars)
Contains GT3, GT4, GTP, and LMP2 cars suitable for endurance racing in the CORRECT format.
- **Structure**: Each car has `name`, `garage61_id`, `platform`, `platform_id`
- **Platforms**: iRacing, ACC, RF2, AMS2
- **Last Updated**: Current database contains 32 cars

### `garage61-endurance-tracks.json` (26 tracks)
Contains tracks specifically selected for endurance racing suitability in the CORRECT format.
- **Structure**: Each track has `name`, `garage61_id`, `base_name`, `variant`, `platform`
- **Focus**: Long-distance racing circuits (Le Mans, Silverstone, Spa, etc.)
- **Last Updated**: Current database contains 26 endurance tracks

## Database Schema

The PostgreSQL database uses these tables:

```sql
-- Drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    garage61_slug VARCHAR(255),
    firstName VARCHAR(255),
    lastName VARCHAR(255)
);

-- Cars table  
CREATE TABLE cars (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    garage61_id INTEGER UNIQUE,
    platform VARCHAR(100),
    platform_id VARCHAR(100)
);

-- Tracks table
CREATE TABLE tracks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    garage61_id INTEGER UNIQUE,
    base_name VARCHAR(255),
    variant VARCHAR(255),
    platform VARCHAR(100)
);
```

## CRITICAL: JSON File Format Requirements

**⚠️ THE JSON FILES MUST BE IN THE EXACT FORMAT SHOWN BELOW OR THE SYSTEM WILL BREAK ⚠️**

### Drivers JSON Format (REQUIRED):
```json
[
    {
        "name": "John Smith",
        "garage61_slug": "john-smith",
        "firstName": "John",
        "lastName": "Smith"
    }
]
```

### Cars JSON Format (REQUIRED):
```json
[
    {
        "name": "McLaren 720S GT3",
        "garage61_id": 456,
        "platform": "ACC",
        "platform_id": 12
    }
]
```

### Tracks JSON Format (REQUIRED):
```json
[
    {
        "name": "Silverstone Circuit - GP",
        "garage61_id": 789,
        "base_name": "Silverstone Circuit",
        "variant": "GP",
        "platform": "iRacing"
    }
]
```

## Adding New Data

### Adding New Cars

1. **Find the car in Garage 61**: Search https://garage61.net for the specific car
2. **Get the Garage 61 ID**: Found in the URL (e.g., `/car/123` means ID is 123)
3. **Add to JSON**: Edit `garage61-filtered-cars.json` using the EXACT format above
4. **Import to Database**: Use the CORRECT import method:

```powershell
$allDrivers = Get-Content "database-data\garage61-radian-team.json" | ConvertFrom-Json
$allCars = Get-Content "database-data\garage61-filtered-cars.json" | ConvertFrom-Json
$allTracks = Get-Content "database-data\garage61-endurance-tracks.json" | ConvertFrom-Json
$payload = @{ drivers = $allDrivers; cars = $allCars; tracks = $allTracks } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body $payload -ContentType "application/json"
```

### Adding New Tracks

1. **Verify Endurance Suitability**: Ensure track is suitable for long-distance racing
2. **Find in Garage 61**: Get the track's Garage 61 ID and variant information
3. **Add to JSON**: Edit `garage61-endurance-tracks.json` using the EXACT format above
4. **Import to Database**: Use the import method above

### Adding New Drivers

1. **Get Garage 61 Profile**: Each driver needs a Garage 61 account
2. **Extract User Slug**: Found in profile URL (e.g., `/user/john-smith` means slug is `john-smith`)
3. **Add to JSON**: Edit `garage61-radian-team.json` using the EXACT format above
4. **Import to Database**: Use the import method above

## Data Sources & Integration

### Garage 61 API
- **Purpose**: Lap time and fuel consumption data
- **Authentication**: Requires valid API token
- **Rate Limits**: Respect API rate limiting
- **Documentation**: Contact Garage 61 for API documentation

### Data Curation Process
1. **Car Selection**: Focus on endurance-suitable categories (GT3, GT4, GTP, LMP2)
2. **Track Selection**: Prioritize circuits known for endurance racing
3. **Driver Management**: Maintain current team roster
4. **Regular Updates**: Check for new cars/tracks quarterly

## ⚠️ DISASTER RECOVERY PROCEDURES ⚠️

### If Dropdowns Are Empty

**DO NOT PANIC** - Follow these steps in order:

1. **Check Current Database Status**:
```powershell
$drivers = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/drivers"
$cars = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/cars"  
$tracks = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/tracks"
Write-Host "DRIVERS: $($drivers.Count) / 33"
Write-Host "CARS: $($cars.Count) / 32" 
Write-Host "TRACKS: $($tracks.Count) / 26"
```

2. **If Counts Are Zero**: Database needs to be repopulated
```powershell
# Navigate to RadianPlanner folder
cd "C:\Users\John\Documents\GitHub\RadianPlanner"

# Load all data files
$allDrivers = Get-Content "database-data\garage61-radian-team.json" | ConvertFrom-Json
$allCars = Get-Content "database-data\garage61-filtered-cars.json" | ConvertFrom-Json
$allTracks = Get-Content "database-data\garage61-endurance-tracks.json" | ConvertFrom-Json

# Import ALL data at once (CORRECT METHOD)
$payload = @{ drivers = $allDrivers; cars = $allCars; tracks = $allTracks } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body $payload -ContentType "application/json"
```

3. **If Batch Import Fails**: Use smaller batches
```powershell
# Import drivers in batches of 10
for($i = 0; $i -lt $allDrivers.Count; $i += 10) {
    $batch = $allDrivers[$i..($i+9)]
    $payload = @{ drivers = $batch } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body $payload -ContentType "application/json"
}

# Import cars in batches of 10
for($i = 0; $i -lt $allCars.Count; $i += 10) {
    $batch = $allCars[$i..($i+9)]
    $payload = @{ cars = $batch } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body $payload -ContentType "application/json"
}

# Import tracks in batches of 10
for($i = 0; $i -lt $allTracks.Count; $i += 10) {
    $batch = $allTracks[$i..($i+9)]
    $payload = @{ tracks = $batch } | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body $payload -ContentType "application/json"
}
```

4. **Final Verification**: Should show full counts
```powershell
$allDrivers = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/drivers"
$allCars = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/cars"
$allTracks = Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/tracks"
Write-Host "🏆 VERIFICATION RESULTS:"
Write-Host "✅ DRIVERS: $($allDrivers.Count) / 33"
Write-Host "✅ CARS: $($allCars.Count) / 32"
Write-Host "✅ TRACKS: $($allTracks.Count) / 26"
if ($allDrivers.Count -eq 33 -and $allCars.Count -eq 32 -and $allTracks.Count -eq 26) {
    Write-Host "🎉 ALL DROPDOWNS ARE NOW FULLY POPULATED!"
} else {
    Write-Host "❌ Import incomplete - check for errors above"
}
```

### Schema Reset (NUCLEAR OPTION)

Only use if database is completely corrupted. The endpoint is protected.

```powershell
# Server must have env vars set:
#   ALLOW_SCHEMA_RESET=true
#   RESET_SECRET=<long secret>

$headers = @{ 'x-reset-secret' = '<long secret>' }
$resetPayload = @{ resetSchema = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/reset" -Headers $headers -Method Post -Body $resetPayload -ContentType "application/json"

# Then re-import everything using the disaster recovery steps above
```

## Admin Editing Guide (Do-it-yourself)

The admin page lets you add, update, and remove items. Edits now persist because the backend performs upserts.

- Add or edit entries in Admin and click Save (calls POST /api/data).
- Upsert behavior:
    - Drivers: unique by `name` → updates slug/first/last name.
    - Cars: unique by `garage61_id` → updates name, platform, platform_id.
    - Tracks: unique by `garage61_id` → updates name, base_name, variant, platform.
- Optional delete endpoints (use with care):
    - DELETE /api/drivers/:name
    - DELETE /api/cars/:garage61_id
    - DELETE /api/tracks/:garage61_id

Tips
- After a change, refresh the page to repopulate dropdowns.
- If a POST returns partial status, some rows failed—check errors array and fix fields.

## Persistence Notes

- Server no longer drops tables on startup. Data persists across redeploys.
- Import endpoint accepts partial payloads (drivers-only, cars-only, tracks-only).
- JSON body limit increased to 2 MB.

## Known Issues & Solutions

### Issue: "duplicate key value violates unique constraint"
**Solution**: Data already exists. Use `ON CONFLICT DO NOTHING` in server code (already implemented).

### Issue: "Request payload too large"  
**Solution**: Use batch import method shown in disaster recovery section.

### Issue: JSON format errors
**Solution**: Validate JSON files match the EXACT format shown in the requirements section above.

### Issue: Empty dropdowns after successful import
**Solution**: Clear browser cache and refresh page. Data takes 30-60 seconds to populate dropdowns after import.

## Maintenance Schedule

- **Weekly**: Verify dropdown counts are correct
- **Monthly**: Check for new Garage 61 data updates
- **Before Race Events**: Ensure all team drivers are in database
- **After Car Updates**: Verify new car releases are added to filtered cars list

## API Endpoints

- `GET /api/drivers` - List all drivers
- `GET /api/cars` - List all cars  
- `GET /api/tracks` - List all tracks
- `POST /api/data` - Import new data (requires `type` and `data` fields)

## Troubleshooting

### Common Issues
1. **Duplicate Garage 61 IDs**: Each ID must be unique within its category
2. **Missing Required Fields**: All fields in the schema are required
3. **JSON Format Errors**: Validate JSON before importing
4. **API Import Failures**: Check server logs and network connectivity

### Validation Commands
```powershell
# Test JSON validity
Get-Content "garage61-filtered-cars.json" | ConvertFrom-Json

# Check current database counts
Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/cars" | Measure-Object
```

---

**Last Updated**: September 2025  
**Maintainer**: Radian Motorsport  
**Database Version**: Garage 61 Integrated v2.0