# RadianPlanner Database Data

This folder contains the curated JSON data files that populate the RadianPlanner database. All data is integrated with Garage 61 for lap time and fuel consumption analytics.

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

Only use if database is completely corrupted:

```powershell
# Reset database schema (THIS WILL DELETE ALL DATA!)
$resetPayload = @{ resetSchema = $true } | ConvertTo-Json
Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/reset" -Method Post -Body $resetPayload -ContentType "application/json"

# Then re-import everything using the disaster recovery steps above
```

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