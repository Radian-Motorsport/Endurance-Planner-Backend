# RadianPlanner Database Data

This folder contains the curated JSON data files that populate the RadianPlanner database. All data is integrated with Garage 61 for lap time and fuel consumption analytics.

## Current Data Files

### `garage61-filtered-cars.json` (32 cars)
Contains GT3, GT4, GTP, and LMP2 cars suitable for endurance racing.
- **Structure**: Each car has `name`, `garage61_id`, `platform`, `platform_id`
- **Platforms**: iRacing, ACC, RF2, AMS2
- **Last Updated**: Current database contains 32 cars

### `garage61-endurance-tracks.json` (26 tracks)
Contains tracks specifically selected for endurance racing suitability.
- **Structure**: Each track has `name`, `garage61_id`, `base_name`, `variant`, `platform`
- **Focus**: Long-distance racing circuits (Le Mans, Silverstone, Spa, etc.)
- **Last Updated**: Current database contains 26 endurance tracks

### `garage61-radian-team.json` (33 drivers)
Contains the Radian Motorsport team driver roster.
- **Structure**: Each driver has `name`, `garage61_slug`, `firstName`, `lastName`
- **Source**: Garage 61 user profiles
- **Last Updated**: Current database contains 33 drivers

## Database Schema

The PostgreSQL database uses these tables:

```sql
-- Drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    garage61_slug VARCHAR(255) UNIQUE,
    firstName VARCHAR(255),
    lastName VARCHAR(255)
);

-- Cars table  
CREATE TABLE cars (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    garage61_id INTEGER UNIQUE,
    platform VARCHAR(100),
    platform_id INTEGER
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

## Adding New Data

### Adding New Cars

1. **Find the car in Garage 61**: Search https://garage61.net for the specific car
2. **Get the Garage 61 ID**: Found in the URL (e.g., `/car/123` means ID is 123)
3. **Add to JSON**: Edit `garage61-filtered-cars.json`:

```json
{
    "name": "McLaren 720S GT3",
    "garage61_id": 456,
    "platform": "ACC",
    "platform_id": 12
}
```

4. **Import to Database**: Use the admin interface at `/` or API endpoint:
   ```powershell
   $carData = Get-Content "database-data\garage61-filtered-cars.json" | ConvertFrom-Json
   Invoke-RestMethod -Uri "https://endurance-planner-api.onrender.com/api/data" -Method Post -Body (@{ type="cars"; data=$carData } | ConvertTo-Json -Depth 10) -ContentType "application/json"
   ```

### Adding New Tracks

1. **Verify Endurance Suitability**: Ensure track is suitable for long-distance racing
2. **Find in Garage 61**: Get the track's Garage 61 ID and variant information
3. **Add to JSON**: Edit `garage61-endurance-tracks.json`:

```json
{
    "name": "Circuit de la Sarthe - Full Circuit",
    "garage61_id": 789,
    "base_name": "Circuit de la Sarthe",
    "variant": "Full Circuit",
    "platform": "iRacing"
}
```

4. **Import to Database**: Same process as cars, but use `type="tracks"`

### Adding New Drivers

1. **Get Garage 61 Profile**: Each driver needs a Garage 61 account
2. **Extract User Slug**: Found in profile URL (e.g., `/user/john-smith` means slug is `john-smith`)
3. **Add to JSON**: Edit `garage61-radian-team.json`:

```json
{
    "name": "John Smith",
    "garage61_slug": "john-smith",
    "firstName": "John",
    "lastName": "Smith"
}
```

4. **Import to Database**: Same process, use `type="drivers"`

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

## Maintenance

### Database Reset (if needed)
The server automatically drops and recreates tables on startup if schema changes are detected.

### Data Validation
- All Garage 61 IDs must be unique within their category
- Names should match Garage 61 exactly for consistency
- Platform information should be accurate for proper integration

### Backup Strategy
- JSON files in this folder serve as the master data source
- Always backup before making changes
- Use version control (Git) to track changes

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