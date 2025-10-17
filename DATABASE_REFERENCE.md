# RadianPlanner Database Schema Reference

## Table Structure Overview

### 1. SERIES TABLE
```sql
series (
    series_id INTEGER PRIMARY KEY,
    series_name TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'endurance',
    active BOOLEAN DEFAULT true,
    multiclass BOOLEAN DEFAULT false,
    driver_changes BOOLEAN DEFAULT false,
    min_team_drivers INTEGER DEFAULT 1,
    max_team_drivers INTEGER DEFAULT 16,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 2. EVENTS TABLE
```sql
events (
    event_id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL,
    season_id INTEGER,
    season_name TEXT,
    race_week_num INTEGER,
    event_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    track_id INTEGER,
    track_name TEXT NOT NULL,
    track_config TEXT,
    garage61_track_id INTEGER,
    race_time_limit INTEGER,
    car_class_ids INTEGER[],
    weather_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### 3. TRACKS TABLE
```sql
tracks (
    track_id INTEGER PRIMARY KEY,
    track_name TEXT NOT NULL,
    config_name TEXT,
    track_dirpath TEXT,
    garage61_id INTEGER,
    location TEXT,
    latitude FLOAT,
    longitude FLOAT,
    time_zone TEXT,
    track_config_length FLOAT,
    corners_per_lap INTEGER,
    category TEXT,
    category_id INTEGER,
    track_type INTEGER,
    track_type_text TEXT,
    rain_enabled BOOLEAN DEFAULT false,
    night_lighting BOOLEAN DEFAULT false,
    fully_lit BOOLEAN DEFAULT false,
    has_svg_map BOOLEAN DEFAULT false,
    supports_grip_compound BOOLEAN DEFAULT false,
    max_cars INTEGER,
    grid_stalls INTEGER,
    number_pitstalls INTEGER,
    pit_road_speed_limit INTEGER,
    qualify_laps INTEGER,
    solo_laps INTEGER,
    allow_rolling_start BOOLEAN DEFAULT true,
    allow_standing_start BOOLEAN DEFAULT true,
    allow_pitlane_collisions BOOLEAN DEFAULT true,
    restart_on_left BOOLEAN DEFAULT false,
    start_on_left BOOLEAN DEFAULT false,
    has_start_zone BOOLEAN DEFAULT false,
    has_short_parade_lap BOOLEAN DEFAULT false,
    has_opt_path BOOLEAN DEFAULT false,
    is_dirt BOOLEAN DEFAULT false,
    is_oval BOOLEAN DEFAULT false,
    price FLOAT DEFAULT 0,
    package_id INTEGER,
    sku INTEGER,
    free_with_subscription BOOLEAN DEFAULT false,
    is_ps_purchasable BOOLEAN DEFAULT false,
    purchasable BOOLEAN DEFAULT true,
    retired BOOLEAN DEFAULT false,
    tech_track BOOLEAN DEFAULT false,
    award_exempt BOOLEAN DEFAULT false,
    created TEXT,
    opens TEXT,
    closes TEXT,
    folder TEXT,
    small_image TEXT,
    logo TEXT,
    site_url TEXT,
    search_filters TEXT,
    scoring INTEGER,
    priority INTEGER,
    track_types TEXT
)
```

### 4. SESSIONS TABLE
```sql
sessions (
    session_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    session_type TEXT NOT NULL, -- 'practice', 'qualifying', 'race'
    session_name TEXT,
    session_num INTEGER DEFAULT 1,
    session_date TIMESTAMP,
    session_length INTEGER, -- Minutes
    session_laps INTEGER,
    qual_attached BOOLEAN DEFAULT false,
    warmup_length INTEGER DEFAULT 0,
    weather_summary JSONB,
    simulated_start_time TIMESTAMP,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## API Endpoint Mappings

### Series Dropdown
- **Endpoint**: `/api/series`
- **Query**: `SELECT DISTINCT series_id, series_name FROM series WHERE active = true ORDER BY series_name`
- **Frontend**: Use `series_id` for value, `series_name` for display text

### Events Dropdown (for selected series)
- **Endpoint**: `/api/events/:seriesId`
- **Query**: `SELECT * FROM events WHERE series_id = $1 AND active = true ORDER BY start_date, event_name`
- **Frontend**: Use `event_id` for value, combine `event_name` + `start_date` for display text

### Tracks Dropdown
- **Endpoint**: `/api/tracks`
- **Query**: `SELECT track_id, track_name, config_name, category, retired FROM tracks WHERE retired = false ORDER BY track_name, config_name`
- **Frontend**: Use `track_id` for value, combine `track_name` + `config_name` for display text

### Sessions Dropdown (for selected event)
- **Endpoint**: `/api/sessions/:eventId`
- **Query**: `SELECT * FROM sessions WHERE event_id = $1 AND active = true ORDER BY session_type, session_num`
- **Frontend**: Use `session_id` for value, `session_name` or `session_type` for display text

## Column Reference Quick List

### SERIES columns:
- `series_id` (PRIMARY KEY)
- `series_name` (for display)
- `active` (filter condition)

### EVENTS columns:
- `event_id` (PRIMARY KEY) - Serial auto-increment ID
- `series_id` (FOREIGN KEY to series)
- `season_id` (iRacing season identifier)
- `season_name` (season info from iRacing)
- `race_week_num` (week number in season)
- `event_name` (for display)
- `start_date`, `end_date` (event timing)
- `track_id` (iRacing track identifier)
- `track_name`, `track_config` (track information)
- `garage61_track_id` (link to Garage61 data - PRESERVE THIS!)
- `race_time_limit` (race duration)
- `car_class_ids` (allowed car classes)
- `weather_url` (weather data link)
- `active` (filter condition)

### TRACKS columns:
- `track_id` (PRIMARY KEY)
- `track_name` (main track name)
- `config_name` (track configuration)
- `garage61_id` (link to Garage61 data)
- `category` (road/oval/dirt)
- `location` (geographical location)
- `track_config_length` (track length in miles)
- `retired` (filter for active tracks)
- `scoring` (Garage61 scoring data)

### SESSIONS columns:
- `session_id` (PRIMARY KEY)
- `event_id` (FOREIGN KEY to events)
- `session_type` (practice/qualifying/race)
- `session_name` (for display)
- `session_date` (for sorting)
- `active` (filter condition)

## Relationship Flow
```
Series (series_id) 
  └── Events (series_id → event_id)
      └── Sessions (event_id → session_id)
```

## DATA REFRESH PROCEDURES

### Refreshing Tracks Data from iRacing API
**Last Updated**: 2025-10-17T22:03:19Z

1. **Use OAuth2 Client**: Located at `iracing-development/iracing-oauth2-client.js`
2. **Endpoint**: `/data/track/get`
3. **Authentication**: OAuth2 Password Limited Grant with credentials from `iracing-development/iracing-credentials.js`
4. **Script**: `update-data/fetch-track-data-oauth2.js`

**Process**:
```javascript
const client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
await client.authenticate(email, password);
const trackData = await client.makeDataAPIRequest('/data/track/get');
```

**Result**: 452 tracks fetched successfully with all current iRacing data including:
- Track names, configurations, locations
- Image paths (folder, small_image, logo)
- Track properties (length, category, features)
- Racing details (pit limits, car counts, etc.)

### Refreshing Events/Schedules Data from iRacing API  
**Last Updated**: 2025-10-17T22:18:42Z

1. **Use OAuth2 Client**: Same as tracks (`iracing-development/iracing-oauth2-client.js`)
2. **Endpoint**: `/data/series/seasons`
3. **Script**: `update-data/fetch-schedules-oauth2-final.js` followed by `update-data/fetch-actual-schedules.js`
4. **Filter**: Endurance series IDs [331, 419, 237, 451, 275]

**Process**:
```javascript
// Step 1: Get schedules link
const client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
await client.authenticate(email, password);
const response = await client.makeDataAPIRequest('/data/series/seasons');

// Step 2: Fetch actual data from S3 link
const actualData = await fetch(response.link);
const schedules = await actualData.json();

// Step 3: Filter for endurance series
const enduranceData = schedules.filter(item => 
    enduranceSeriesIds.includes(item.series_id)
);

// Step 4: Generate SQL for events table
// Uses event_id as PRIMARY KEY (not id!)
// Preserves garage61_track_id column
```

**Result**: 144 total series filtered to 5 endurance series with 38 events total:
- GT Endurance Series by Simucube (12 events)
- Global Endurance Tour (6 events) 
- IMSA Endurance Series (6 events)
- Nurburgring Endurance Championship (9 events)
- Creventic Endurance Series (5 events)

### OAuth2 Authentication Requirements
- **Client ID**: `radian-limited`
- **Client Secret**: `viewable-SALAMI-net-mortician-Fever-asparagus`
- **Email/Password**: Stored in `iracing-development/iracing-credentials.js`
- **Base URL**: `https://oauth.iracing.com` (auth), `https://members-ng.iracing.com` (data)
- **Token Expiry**: 600 seconds (10 minutes)
- **Refresh Token**: Available for extended sessions

### Generated SQL Files
- `update-tracks-from-iracing-api.sql` - Updates tracks table with fresh track data
- `update-events-from-iracing-schedules.sql` - Updates events table with fresh schedules

**SQL Pattern**: Uses `INSERT ... ON CONFLICT DO UPDATE` to merge fresh data with existing records without losing custom columns.

**CRITICAL**: Events table uses `event_id` as PRIMARY KEY, NOT `id`! Always use `event_id` in queries and SQL generation.

## IMPORTANT NOTES
- **DO NOT** assume column names - always reference this document
- **DO NOT** use `series_name` in events table - it doesn't exist there
- **USE** `season_name` in events table for season information
- **ALWAYS** include `active = true` filters unless fetching inactive records
- **ALWAYS** use proper foreign key relationships (series_id, event_id)
- **DATA REFRESH**: Use OAuth2 client for all iRacing API calls, not environment variables