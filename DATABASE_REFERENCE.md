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
    series_id INTEGER NOT NULL REFERENCES series(series_id),
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

### 3. SESSIONS TABLE
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
- `event_id` (PRIMARY KEY)
- `series_id` (FOREIGN KEY to series)
- `season_name` (season info)
- `event_name` (for display)
- `start_date` (for sorting/display)
- `track_name` (track info)
- `active` (filter condition)

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

## IMPORTANT NOTES
- **DO NOT** assume column names - always reference this document
- **DO NOT** use `series_name` in events table - it doesn't exist there
- **USE** `season_name` in events table for season information
- **ALWAYS** include `active = true` filters unless fetching inactive records
- **ALWAYS** use proper foreign key relationships (series_id, event_id)