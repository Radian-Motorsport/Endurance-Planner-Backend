const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios');
const SunCalc = require('suncalc');
const { 
    getEventWeather, 
    proxyWeatherData, 
    getEventsWithWeather, 
    updateEventWeather 
} = require('./weather-api');
const { exec } = require('child_process');
const DriverRefreshService = require('./refresh-drivers-oauth2');
const socketIo = require('socket.io');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    },
    transports: ['websocket', 'polling']
});

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log('🔌 Client connected to strategy updates:', socket.id);
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Use the DATABASE_URL environment variable from Render (optional)
let pool = null;
if (process.env.DATABASE_URL) {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        console.log('✅ Database connection pool created with URL:', process.env.DATABASE_URL.substring(0, 30) + '...');
        
        // Test the connection
        pool.query('SELECT NOW()', (err, result) => {
            if (err) {
                console.error('❌ Database connection test FAILED:', err.message);
            } else {
                console.log('✅ Database connection test SUCCESSFUL:', result.rows[0].now);
            }
        });
    } catch (error) {
        console.error('❌ Failed to create database pool:', error.message);
        pool = null;
    }
} else {
    console.log('⚠️  No database URL provided. Running without database features.');
}

// Increase JSON body size to handle full data imports
app.use(express.json({ limit: '2mb' }));

// Enable CORS for cross-origin API requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files with proper MIME types
app.use('/public', express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve assets folder
app.use('/assets', express.static('assets'));

// Serve root files (like index.html)
app.use(express.static('.'));

// Function to create all necessary tables if they don't exist
async function createTables() {
    if (!pool) {
        console.log('Skipping database table creation - no database connection.');
        return;
    }
    
    try {
        console.log('Creating database tables if they do not exist...');
        
        const createDriversTable = `
            CREATE TABLE IF NOT EXISTS drivers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                garage61_slug VARCHAR(255),
                firstName VARCHAR(255),
                lastName VARCHAR(255),
                country VARCHAR(255),
                timezone VARCHAR(255),
                sports_car_irating INTEGER,
                sports_car_safety_rating VARCHAR(10),
                sports_car_group_name VARCHAR(1)
            );
        `;
        const createCarsTable = `
            CREATE TABLE IF NOT EXISTS cars (
                id SERIAL PRIMARY KEY,
                car_name VARCHAR(255) NOT NULL,
                garage61_id INTEGER UNIQUE,
                platform VARCHAR(100),
                platform_id VARCHAR(100),
                iracing_class_id INTEGER
            );
        `;
        const createCarClassesTable = `
            CREATE TABLE IF NOT EXISTS car_classes (
                car_class_id INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                short_name VARCHAR(100),
                relative_speed INTEGER DEFAULT 0,
                car_count INTEGER DEFAULT 0
            );
        `;
        const createTracksTable = `
            CREATE TABLE IF NOT EXISTS tracks (
                garage61_id INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                track_length DECIMAL(10,3) DEFAULT 0.0
            );
        `;
        const createStrategiesTable = `
            CREATE TABLE IF NOT EXISTS strategies (
                id VARCHAR(36) PRIMARY KEY,
                strategy_data JSONB NOT NULL
            );
        `;
        
        // iRacing Endurance Racing Tables
        const createSeriesTable = `
            CREATE TABLE IF NOT EXISTS series (
                series_id INTEGER PRIMARY KEY,
                series_name VARCHAR(255) NOT NULL,
                description VARCHAR(500),
                category VARCHAR(100),
                active BOOLEAN DEFAULT true,
                multiclass BOOLEAN DEFAULT false,
                driver_changes BOOLEAN DEFAULT false,
                min_team_drivers INTEGER DEFAULT 1,
                max_team_drivers INTEGER DEFAULT 16
            );
        `;
        
        const createEventsTable = `
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                series_id INTEGER NOT NULL,
                track_id INTEGER NOT NULL,
                event_name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                start_time TIME NOT NULL,
                garage61_track_id INTEGER,
                FOREIGN KEY (series_id) REFERENCES series(id),
                FOREIGN KEY (garage61_track_id) REFERENCES tracks(garage61_id)
            );
        `;
        
        const createSessionsTable = `
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY,
                event_id INTEGER NOT NULL,
                session_name VARCHAR(255) NOT NULL,
                session_type VARCHAR(100) NOT NULL,
                start_date DATE NOT NULL,
                start_time TIME NOT NULL,
                duration_minutes INTEGER,
                FOREIGN KEY (event_id) REFERENCES events(id)
            );
        `;
        
        const createIdealFuelLapsTable = `
            CREATE TABLE IF NOT EXISTS ideal_fuel_laps (
                id SERIAL PRIMARY KEY,
                track_id INTEGER NOT NULL,
                car_name VARCHAR(255) NOT NULL,
                fuel_level JSONB NOT NULL,
                fuel_use_per_hour JSONB,
                speed JSONB,
                throttle JSONB,
                lap_time FLOAT,
                fuel_kg_per_ltr FLOAT,
                tank_capacity FLOAT,
                track_temp FLOAT,
                air_temp FLOAT,
                wind_velocity FLOAT,
                wind_direction FLOAT,
                humidity FLOAT,
                skies INTEGER,
                recorded_at TIMESTAMP DEFAULT NOW(),
                notes TEXT,
                UNIQUE(track_id, car_name)
            );
        `;
        
        await pool.query(createDriversTable);
        await pool.query(createCarsTable);
        await pool.query(createCarClassesTable);
        await pool.query(createTracksTable);
        await pool.query(createStrategiesTable);
        await pool.query(createSeriesTable);
        await pool.query(createEventsTable);
        await pool.query(createSessionsTable);
        await pool.query(createIdealFuelLapsTable);
        console.log('Database tables created/verified successfully.');
    } catch (err) {
        console.error('Error creating database tables:', err);
        console.log('Continuing without database features.');
    }
}

// Call the function on server start
createTables();


// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Add this new route to serve the livev2.html file
app.get('/livev2.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'livev2.html'));
});

// Add this new route to serve the Championship.html file
app.get('/championship-tracker-v6.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'championship-tracker-v6.html'));
});

// And back to index
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get all data from the database
app.get('/api/data', async (req, res) => {
    try {
        if (!pool) {
            console.error('Database pool is null - DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
            return res.status(500).json({ error: 'Database not connected', hasUrl: !!process.env.DATABASE_URL });
        }
        
        console.log('Attempting database queries...');
        const driversResult = await pool.query('SELECT * FROM drivers');
        const carsResult = await pool.query('SELECT * FROM cars');
        const tracksResult = await pool.query('SELECT * FROM tracks');
        const seriesResult = await pool.query('SELECT * FROM series');
        console.log('Database queries successful');

        res.json({
            drivers: driversResult.rows,
            cars: carsResult.rows,
            tracks: tracksResult.rows,
            series: seriesResult.rows
        });
    } catch (err) {
        console.error('Error fetching data:', err.message, err.code);
        res.status(500).json({ error: 'Database query failed', details: err.message });
    }
});

// Individual API endpoints for frontend dropdown population
app.get('/api/drivers', async (req, res) => {
    try {
        if (!pool) {
            console.error('❌ Pool is null when /api/drivers called');
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        const result = await pool.query('SELECT * FROM drivers');
        console.log(`✅ /api/drivers returned ${result.rows.length} drivers`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching drivers:', err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/cars', async (req, res) => {
    try {
        if (!pool) {
            console.error('❌ Pool is null when /api/cars called');
            return res.status(503).json({ error: 'Database not connected' });
        }

        // Get cars with their class information
        const result = await pool.query(`
            SELECT 
                c.*,
                cc.name as class_name,
                cc.short_name as class_short_name,
                cc.relative_speed
            FROM cars c
            LEFT JOIN car_classes cc ON c.iracing_class_id = cc.car_class_id
            ORDER BY c.car_name
        `);
        console.log(`✅ /api/cars returned ${result.rows.length} cars`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching cars:', err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/car-classes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM car_classes ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching car classes:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Get cars by class ID
app.get('/api/cars/by-class/:classId', async (req, res) => {
    try {
        const classId = parseInt(req.params.classId);
        const result = await pool.query(`
            SELECT 
                c.*,
                cc.name as class_name,
                cc.short_name as class_short_name
            FROM cars c
            JOIN car_classes cc ON c.iracing_class_id = cc.car_class_id
            WHERE c.iracing_class_id = $1
            ORDER BY c.car_name
        `, [classId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching cars by class:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Get endurance racing cars (GT3, GT4, GTP, Porsche Cup)
app.get('/api/cars/endurance', async (req, res) => {
    try {
        const enduranceClassIds = [4083, 2708, 4091, 4048, 4084, 4029, 3104];
        const result = await pool.query(`
            SELECT 
                c.*,
                cc.name as class_name,
                cc.short_name as class_short_name,
                cc.car_class_id,
                CASE 
                    WHEN cc.car_class_id IN (4083, 2708, 4091) THEN 'GT3'
                    WHEN cc.car_class_id IN (4048, 4084) THEN 'GT4'
                    WHEN cc.car_class_id = 4029 THEN 'GTP'
                    WHEN cc.car_class_id = 3104 THEN 'Porsche Cup'
                    ELSE 'Other'
                END as category
            FROM cars c
            JOIN car_classes cc ON c.iracing_class_id = cc.car_class_id
            WHERE c.iracing_class_id = ANY($1)
            ORDER BY category, c.car_name
        `, [enduranceClassIds]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching endurance cars:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/tracks', async (req, res) => {
    try {
        if (!pool) {
            console.error('❌ Pool is null when /api/tracks called');
            return res.status(503).json({ error: 'Database not connected' });
        }

        const result = await pool.query('SELECT * FROM tracks');
        console.log(`✅ /api/tracks returned ${result.rows.length} tracks`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching tracks:', err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Track assets endpoint for track maps
app.get('/api/track-assets/:trackId', async (req, res) => {
    try {
        const trackId = parseInt(req.params.trackId);
        console.log('🗺️ Fetching track assets for track ID:', trackId);
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query(`
            SELECT track_map, background_svg, active_svg, inactive_svg, 
                   pitroad_svg, start_finish_svg, turns_svg
            FROM track_assets 
            WHERE track_id = $1
        `, [trackId]);
        
        if (result.rows.length === 0) {
            console.log('⚠️ No track assets found for track ID:', trackId);
            return res.status(404).json({ error: 'Track assets not found' });
        }
        
        // Fetch racing line data from tracks table
        let racingLine = null;
        try {
            const racingLineResult = await pool.query(`
                SELECT racing_line 
                FROM tracks 
                WHERE track_id = $1
            `, [trackId]);
            
            if (racingLineResult.rows.length > 0 && racingLineResult.rows[0].racing_line) {
                racingLine = racingLineResult.rows[0].racing_line;
                console.log('✅ Racing line data found for track ID:', trackId, 
                    `(${racingLine.point_count || racingLine.points?.length || 0} points)`);
            } else {
                console.log('⚠️ No racing line data found for track ID:', trackId);
            }
        } catch (racingLineErr) {
            console.warn('⚠️ Error fetching racing line (column may not exist):', racingLineErr.message);
        }
        
        // Convert individual SVG columns to track_map_layers format expected by frontend
        const trackAssets = result.rows[0];
        const track_map_layers = {
            'background': trackAssets.background_svg,
            'active': trackAssets.active_svg,
            'inactive': trackAssets.inactive_svg,
            'pitroad': trackAssets.pitroad_svg,
            'start-finish': trackAssets.start_finish_svg,
            'turns': trackAssets.turns_svg
        };
        
        // Return data in format expected by frontend
        const response = {
            track_map: trackAssets.track_map,
            track_map_layers: JSON.stringify(track_map_layers),
            background_svg: trackAssets.background_svg,
            active_svg: trackAssets.active_svg,
            inactive_svg: trackAssets.inactive_svg,
            pitroad_svg: trackAssets.pitroad_svg,
            start_finish_svg: trackAssets.start_finish_svg,
            turns_svg: trackAssets.turns_svg,
            racing_line: racingLine  // Add racing line data
        };
        
        console.log('✅ Track assets found for track ID:', trackId);
        res.json(response);
    } catch (err) {
        console.error('❌ Error fetching track assets:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ========================= WEATHER API ROUTES =========================

// Get weather URL for a specific event
app.get('/api/events/:eventId/weather', getEventWeather);

// Proxy weather data from iRacing API
app.get('/api/weather-proxy', proxyWeatherData);

// Get all events with weather data available
app.get('/api/events/with-weather', getEventsWithWeather);

// Update weather URL for an event
app.put('/api/events/:eventId/weather', updateEventWeather);

// ========================= END WEATHER API ROUTES =========================

// iRacing series endpoints
app.get('/api/series', async (req, res) => {
    try {
        console.log('🔍 Fetching series data...');
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query('SELECT series_id, series_name, logo FROM series WHERE active = true ORDER BY series_name');
        console.log('📊 Series query result:', result.rows.length, 'rows found');
        if (result.rows.length > 0) {
            console.log('📋 First series:', result.rows[0]);
        }
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching series:', err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/events/:seriesId', async (req, res) => {
    try {
        const { seriesId } = req.params;
        console.log('🔍 Fetching events for series ID:', seriesId);
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query(
            'SELECT * FROM events WHERE series_id = $1 ORDER BY start_date, event_name', 
            [seriesId]
        );
        console.log(`✅ Found ${result.rows.length} events for series ${seriesId}`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching events:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/api/sessions/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log('🔍 Fetching sessions for event ID:', eventId);
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query(
            'SELECT * FROM sessions WHERE event_id = $1 AND session_type = $2 AND active = true ORDER BY session_num', 
            [eventId, 'race']
        );
        console.log(`✅ Found ${result.rows.length} sessions for event ${eventId}`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching sessions:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Get all session types for an event (practice, qualifying, race)
app.get('/api/event-sessions/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log('🔍 Fetching all sessions for event ID:', eventId);
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query(
            'SELECT session_type, session_length FROM sessions WHERE event_id = $1 AND active = true', 
            [eventId]
        );
        console.log(`✅ Found ${result.rows.length} session types for event ${eventId}`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching event sessions:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Get detailed session information including event data
app.get('/api/session-details/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log('🔍 Fetching session details for session ID:', sessionId);
        
        if (!pool) {
            console.error('❌ Database pool is null');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const result = await pool.query(`
            SELECT 
                s.*,
                e.event_name,
                e.track_name,
                e.start_date as event_start_date,
                e.season_name,
                e.car_class_ids,
                e.track_id,
                ser.series_name,
                t.location,
                t.latitude,
                t.longitude,
                t.track_config_length,
                t.corners_per_lap,
                t.config_name,
                t.folder as track_folder,
                t.small_image as track_small_image,
                t.logo,
                t.garage61_id as track_garage61_id
            FROM sessions s
            JOIN events e ON s.event_id = e.event_id
            JOIN series ser ON e.series_id = ser.series_id
            LEFT JOIN tracks t ON e.track_id = t.track_id
            WHERE s.session_id = $1 AND s.active = true
        `, [sessionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const sessionData = result.rows[0];
        
        // If there are car_class_ids, fetch the car class details
        let carClasses = [];
        if (sessionData.car_class_ids && sessionData.car_class_ids.length > 0) {
            const classResult = await pool.query(`
                SELECT car_class_id, name, short_name, relative_speed
                FROM car_classes 
                WHERE car_class_id = ANY($1)
                ORDER BY name
            `, [sessionData.car_class_ids]);
            carClasses = classResult.rows;
        }
        
        // Add car classes to the response
        sessionData.available_car_classes = carClasses;
        
        console.log(`✅ Found session details for session ${sessionId} with ${carClasses.length} car classes`);
        res.json(sessionData);
    } catch (err) {
        console.error('❌ Error fetching session details:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Minimal admin DELETE endpoints (no auth yet). Use with care.
app.delete('/api/drivers/:name', async (req, res) => {
    try {
        const { name } = req.params;
        await pool.query('DELETE FROM drivers WHERE name = $1', [name]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting driver:', err);
        res.status(500).send('Internal Server Error');
    }
});

// PUT endpoint for updating individual drivers
app.put('/api/drivers/:originalName', async (req, res) => {
    try {
        const { originalName } = req.params;
        const { name, firstName, lastName, garage61_slug, timezone } = req.body;
        
        const result = await pool.query(
            'UPDATE drivers SET name = $1, firstName = $2, lastName = $3, garage61_slug = $4, timezone = $5 WHERE name = $6 RETURNING *',
            [name, firstName, lastName, garage61_slug, timezone, originalName]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send('Driver not found');
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating driver:', err);
        if (err.code === '23505') { // Unique constraint violation
            res.status(400).send('Driver name already exists');
        } else {
            res.status(500).send('Internal Server Error');
        }
    }
});

app.delete('/api/cars/:garage61_id', async (req, res) => {
    try {
        const id = parseInt(req.params.garage61_id, 10);
        await pool.query('DELETE FROM cars WHERE garage61_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting car:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/api/tracks/:garage61_id', async (req, res) => {
    try {
        const id = parseInt(req.params.garage61_id, 10);
        await pool.query('DELETE FROM tracks WHERE garage61_id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting track:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Garage61 API proxy endpoint
app.get('/api/garage61/laps', async (req, res) => {
    try {
        const GARAGE61_TOKEN = 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5';
        const GARAGE61_API_URL = 'https://garage61.net/api/v1/laps';
        const TEAM_NAME = 'radian-motorsport';

        const { cars, tracks, teams } = req.query;

        if (!cars || !tracks) {
            return res.status(400).json({
                success: false,
                error: 'Both cars and tracks parameters are required'
            });
        }

        const params = new URLSearchParams();
        params.append('cars', cars);
        params.append('tracks', tracks);
        params.append('teams', teams || TEAM_NAME);

        const url = `${GARAGE61_API_URL}?${params.toString()}`;
        
        console.log('Proxying Garage61 request to:', url);

        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${GARAGE61_TOKEN}`,
                'User-Agent': 'RadianPlanner/1.0'
            }
        });

        console.log('Garage61 response status:', response.status);
        console.log('Garage61 response data:', {
            total: response.data.total,
            itemCount: response.data.items ? response.data.items.length : 0
        });

        res.json(response.data);

    } catch (error) {
        console.error('Garage61 proxy error:', error.message);
        if (error.response) {
            console.error('Error response:', error.response.status, error.response.data);
        }
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to save all data to the database
app.post('/api/data', async (req, res) => {
    // Accept partial payloads; default to empty arrays so batch imports (drivers-only, etc.) work
    const drivers = Array.isArray(req.body?.drivers) ? req.body.drivers : [];
    const cars = Array.isArray(req.body?.cars) ? req.body.cars : [];
    const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks : [];

    const result = {
        inserted: { drivers: 0, cars: 0, tracks: 0 },
        errors: []
    };

        // Insert/update drivers (upsert on unique name)
    for (const driver of drivers) {
        if (!driver || !driver.name) continue;
        try {
            await pool.query(
                    `INSERT INTO drivers (name, garage61_slug, firstName, lastName, timezone)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (name) DO UPDATE SET
                         garage61_slug = EXCLUDED.garage61_slug,
                         firstName = EXCLUDED.firstName,
                         lastName = EXCLUDED.lastName,
                         timezone = EXCLUDED.timezone`,
                [driver.name, driver.garage61_slug || null, driver.firstName || null, driver.lastName || null, driver.timezone || null]
            );
            result.inserted.drivers++;
        } catch (e) {
            console.error('Driver insert failed:', driver, e.message);
            result.errors.push({ type: 'driver', name: driver.name, error: e.message, code: e.code, detail: e.detail });
        }
    }

        // Insert/update cars (upsert on unique garage61_id)
    for (const car of cars) {
        if (!car || !car.name) continue;
        try {
            await pool.query(
                    `INSERT INTO cars (name, garage61_id, platform, platform_id)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (garage61_id) DO UPDATE SET
                         name = EXCLUDED.name,
                         platform = EXCLUDED.platform,
                         platform_id = EXCLUDED.platform_id`,
                [car.name, car.garage61_id ?? null, car.platform || null, car.platform_id != null ? String(car.platform_id) : null]
            );
            result.inserted.cars++;
        } catch (e) {
            console.error('Car insert failed:', car, e.message);
            result.errors.push({ type: 'car', name: car.name, error: e.message, code: e.code, detail: e.detail });
        }
    }

        // Insert/update tracks (upsert on unique garage61_id)
    for (const track of tracks) {
        if (!track || !track.name) continue;
        try {
            await pool.query(
                    `INSERT INTO tracks (garage61_id, name, track_length)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (garage61_id) DO UPDATE SET
                         name = EXCLUDED.name,
                         track_length = EXCLUDED.track_length`,
                [track.garage61_id, track.name, track.track_length || 0.0]
            );
            result.inserted.tracks++;
        } catch (e) {
            console.error('Track insert failed:', track, e.message);
            result.errors.push({ type: 'track', name: track.name, error: e.message, code: e.code, detail: e.detail });
        }
    }

    // Respond with detailed outcome
    if (result.errors.length > 0) {
        return res.status(200).json({ status: 'partial', ...result });
    }
    return res.status(200).json({ status: 'ok', ...result });
});

// Optional: explicit reset endpoint (nuclear option) – drops and recreates tables on demand
app.post('/api/reset', async (req, res) => {
    try {
        const { resetSchema } = req.body || {};
        if (!resetSchema) {
            return res.status(400).json({ error: 'resetSchema=true required' });
        }
        if (!pool) {
            return res.status(500).json({ error: 'No database connection' });
        }

        // Require explicit env flag and secret for safety
        if (process.env.ALLOW_SCHEMA_RESET !== 'true') {
            return res.status(403).json({ error: 'Reset disabled' });
        }
        const provided = req.headers['x-reset-secret'] || req.query.secret;
        if (!process.env.RESET_SECRET || provided !== process.env.RESET_SECRET) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        console.warn('⚠️ NUCLEAR RESET: Dropping all tables by request...');
        await pool.query('DROP TABLE IF EXISTS strategies CASCADE');
        await pool.query('DROP TABLE IF EXISTS drivers CASCADE');
        await pool.query('DROP TABLE IF EXISTS cars CASCADE');
        await pool.query('DROP TABLE IF EXISTS tracks CASCADE');

        await createTables();
        return res.status(200).json({ status: 'reset-complete' });
    } catch (err) {
        console.error('Error resetting schema:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// --- NEW API ENDPOINTS FOR STRATEGY SHARING ---

// API endpoint to save a strategy to the database
app.post('/api/strategies', async (req, res) => {
    try {
        const strategyData = req.body;
        const uniqueId = require('crypto').randomUUID(); // Generate a unique ID

        console.log('📥 SERVER RECEIVED stints?', strategyData.stints ? `YES - ${strategyData.stints.length} stints` : 'NO');
        
        await pool.query('INSERT INTO strategies (id, strategy_data) VALUES ($1, $2)', [uniqueId, strategyData]);
        
        console.log('✅ SERVER INSERTED strategy ID:', uniqueId);
        
        res.status(201).json({ id: uniqueId });
    } catch (err) {
        console.error('Error saving strategy:', err);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoint to retrieve a saved strategy by its ID
app.get('/api/strategies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT strategy_data FROM strategies WHERE id = $1', [id]);
        
        if (result.rows.length > 0) {
            const retrieved = result.rows[0].strategy_data;
            console.log('📤 SERVER RETRIEVED stints?', retrieved.stints ? `YES - ${retrieved.stints.length} stints` : 'NO');
            res.json(retrieved);
        } else {
            res.status(404).send('Strategy not found');
        }
    } catch (err) {
        console.error('Error fetching strategy:', err);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoint to update an existing strategy
app.put('/api/strategies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const strategyData = req.body;
        
        const result = await pool.query('UPDATE strategies SET strategy_data = $1 WHERE id = $2 RETURNING id', [strategyData, id]);
        
        if (result.rows.length > 0) {
            // Broadcast strategy update to all connected clients
            io.emit('strategyUpdated', {
                strategyId: id,
                strategy: strategyData
            });
            console.log(`📡 Broadcasted strategy update for ID: ${id}`);
            
            res.json({ id: result.rows[0].id, message: 'Strategy updated successfully' });
        } else {
            res.status(404).send('Strategy not found');
        }
    } catch (err) {
        console.error('Error updating strategy:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Get recent strategies for display
app.get('/api/strategies/recent', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ error: 'Database not available' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                id,
                strategy_data->'selectedCar' as car_data,
                strategy_data->'selectedEvent' as event_data,
                strategy_data->'selectedDrivers' as drivers_data,
                strategy_data->>'updatedAt' as updated_at
            FROM strategies
            ORDER BY (strategy_data->>'updatedAt')::timestamp DESC
            LIMIT 10
        `);

        const strategies = result.rows.map(row => {
            const carData = row.car_data || {};
            const eventData = row.event_data || {};
            const driversData = row.drivers_data || [];
            
            return {
                id: row.id,
                carName: carData.car_name || carData.name || 'Unknown Car',
                trackName: eventData.track_name || 'Unknown Track',
                seasonName: eventData.season_name || '',
                sessionDate: eventData.session_date || null,
                drivers: driversData.map(d => d.name || d.display_name).filter(Boolean),
                updatedAt: row.updated_at
            };
        });

        res.json(strategies);
    } catch (error) {
        console.error('Failed to fetch recent strategies:', error);
        res.status(500).json({ 
            error: 'Failed to fetch strategies',
            message: error.message 
        });
    }
});

// 🌞 DAYLIGHT CALCULATION API ENDPOINTS
// ====================================

// Calculate daylight times for a specific track and date
app.get('/api/daylight/:trackId/:date?', async (req, res) => {
    try {
        const trackId = parseInt(req.params.trackId);
        const dateParam = req.params.date || new Date().toISOString().split('T')[0]; // Default to today
        const date = new Date(dateParam);
        
        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        // Get track coordinates from database
        const trackResult = await pool.query('SELECT name, latitude, longitude FROM tracks WHERE garage61_id = $1', [trackId]);
        
        if (trackResult.rows.length === 0) {
            return res.status(404).json({ error: 'Track not found' });
        }
        
        const track = trackResult.rows[0];
        if (!track.latitude || !track.longitude) {
            return res.status(400).json({ error: 'Track coordinates not available' });
        }
        
        // Calculate daylight times using SunCalc
        const times = SunCalc.getTimes(date, track.latitude, track.longitude);
        const position = SunCalc.getPosition(times.solarNoon, track.latitude, track.longitude);
        const elevationDeg = (position.altitude * 180) / Math.PI;
        
        const daylightData = {
            track: {
                name: track.name,
                latitude: track.latitude,
                longitude: track.longitude
            },
            date: dateParam,
            times: {
                sunrise: times.sunrise.toISOString(),
                sunset: times.sunset.toISOString(),
                solarNoon: times.solarNoon.toISOString(),
                dawn: times.dawn.toISOString(), // Civil twilight start
                dusk: times.dusk.toISOString(), // Civil twilight end
                nauticalDawn: times.nauticalDawn.toISOString(),
                nauticalDusk: times.nauticalDusk.toISOString(),
                nightEnd: times.nightEnd.toISOString(), // Astronomical twilight start
                night: times.night.toISOString() // Astronomical twilight end
            },
            summary: {
                daylightHours: ((times.sunset - times.sunrise) / 3600000).toFixed(2),
                civilTwilightHours: ((times.dusk - times.dawn) / 3600000).toFixed(2),
                solarNoonElevation: elevationDeg.toFixed(1)
            }
        };
        
        res.json(daylightData);
    } catch (err) {
        console.error('Error calculating daylight times:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Generate daylight reference table for latitude bands (for testing/reference)
app.get('/api/daylight/reference/:month?', (req, res) => {
    try {
        const month = parseInt(req.params.month) || new Date().getMonth() + 1; // Default to current month
        
        if (month < 1 || month > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }
        
        // Define latitude bands (-60° to +60° in 10° steps)
        const latitudeBands = Array.from({ length: 13 }, (_, i) => -60 + i * 10);
        const results = [];
        
        latitudeBands.forEach(lat => {
            const date = new Date(Date.UTC(2025, month - 1, 15)); // 15th of the specified month
            const times = SunCalc.getTimes(date, lat, 0); // longitude = 0 for reference
            
            const solarNoon = SunCalc.getPosition(times.solarNoon, lat, 0);
            const elevationDeg = (solarNoon.altitude * 180) / Math.PI;
            
            results.push({
                latitude: lat,
                month,
                sunrise: times.sunrise.toISOString().slice(11, 16),
                sunset: times.sunset.toISOString().slice(11, 16),
                daylightHours: ((times.sunset - times.sunrise) / 3600000).toFixed(2),
                civilTwilightStart: times.dawn.toISOString().slice(11, 16),
                civilTwilightEnd: times.dusk.toISOString().slice(11, 16),
                solarNoonElevation: elevationDeg.toFixed(1)
            });
        });
        
        res.json({
            month,
            generatedAt: new Date().toISOString(),
            data: results
        });
    } catch (err) {
        console.error('Error generating daylight reference table:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Daylight calculation for specific coordinates (for driver timezones)
app.post('/api/daylight', async (req, res) => {
    try {
        const { latitude, longitude, date } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }
        
        const queryDate = date ? new Date(date) : new Date();
        const times = SunCalc.getTimes(queryDate, latitude, longitude);
        
        res.json({
            sunrise: times.sunrise.toISOString(),
            sunset: times.sunset.toISOString(),
            solarNoon: times.solarNoon.toISOString(),
            location: { latitude, longitude },
            date: queryDate.toISOString()
        });
    } catch (error) {
        console.error('Error calculating daylight:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get daylight times for multiple tracks (bulk query)
app.post('/api/daylight/bulk', async (req, res) => {
    try {
        const { trackIds, date } = req.body;
        const queryDate = date ? new Date(date) : new Date();
        
        if (!trackIds || !Array.isArray(trackIds)) {
            return res.status(400).json({ error: 'trackIds array is required' });
        }
        
        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }
        
        // Get all track coordinates
        const placeholders = trackIds.map((_, i) => `$${i + 1}`).join(',');
        const tracksResult = await pool.query(
            `SELECT garage61_id, name, latitude, longitude FROM tracks WHERE garage61_id IN (${placeholders})`,
            trackIds
        );
        
        const results = [];
        
        tracksResult.rows.forEach(track => {
            if (track.latitude && track.longitude) {
                const times = SunCalc.getTimes(queryDate, track.latitude, track.longitude);
                const position = SunCalc.getPosition(times.solarNoon, track.latitude, track.longitude);
                const elevationDeg = (position.altitude * 180) / Math.PI;
                
                results.push({
                    trackId: track.garage61_id,
                    trackName: track.name,
                    sunrise: times.sunrise.toISOString(),
                    sunset: times.sunset.toISOString(),
                    daylightHours: ((times.sunset - times.sunrise) / 3600000).toFixed(2),
                    solarNoonElevation: elevationDeg.toFixed(1)
                });
            }
        });
        
        res.json({
            date: queryDate.toISOString().split('T')[0],
            tracks: results
        });
    } catch (err) {
        console.error('Error calculating bulk daylight times:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 🚧 iRacing service integration (COMMENTED OUT - WORK IN PROGRESS)
// const iracingRoutes = require('./iracing-routes');
// app.use('/api/iracing', iracingRoutes);

// Driver data refresh endpoints
const driverRefreshService = new DriverRefreshService();

// Refresh all drivers
app.post('/api/drivers/refresh-all', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        console.log('🔄 Starting refresh of all drivers...');
        const result = await driverRefreshService.refreshAllDrivers(pool);
        
        res.json({
            message: 'Driver refresh completed',
            ...result
        });
    } catch (error) {
        console.error('Driver refresh failed:', error.message);
        res.status(500).json({ 
            error: 'Driver refresh failed',
            message: error.message 
        });
    }
});

// Full details driver refresh endpoint
app.post('/api/drivers/refresh-all-full', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        console.log('🔄 Starting FULL DETAILS refresh of all drivers...');
        const result = await driverRefreshService.refreshAllDriversFullDetails(pool);

        res.json({
            message: 'Full details driver refresh completed',
            ...result
        });
    } catch (error) {
        console.error('Full details driver refresh failed:', error.message);
        res.status(500).json({
            error: 'Full details driver refresh failed',
            message: error.message
        });
    }
});

// ========================= WEATHER REFRESH ENDPOINT =========================

// Refresh all weather URLs from iRacing API
app.post('/api/weather/refresh-all', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        console.log('🌤️  Starting refresh of all weather URLs from iRacing API...');
        
        // Get all upcoming events with their season_id and race_week_num
        const result = await pool.query(
            'SELECT event_id, event_name, season_id, race_week_num FROM events WHERE start_date >= CURRENT_DATE AND season_id IS NOT NULL ORDER BY start_date ASC'
        );
        
        const events = result.rows;
        console.log(`📊 Found ${events.length} upcoming events to update with weather URLs`);
        
        if (events.length === 0) {
            console.log('⚠️  No upcoming events with season data found in database');
            return res.json({
                message: 'No upcoming events to refresh',
                updatedCount: 0,
                totalEvents: 0,
                warning: 'No events with season_id found'
            });
        }

        // Load the DriverRefreshService to use OAuth2 client
        const DriverRefreshService = require('./refresh-drivers-oauth2.js');
        const driverRefreshService = new DriverRefreshService();
        
        // Authenticate with iRacing
        console.log('🔐 Authenticating with iRacing API...');
        await driverRefreshService.authenticate();
        console.log('✅ Authentication successful');
        
        let updatedCount = 0;
        const failures = [];
        const axios = require('axios');

        // Group events by season_id to fetch schedule once per season
        const eventsBySeasonId = {};
        events.forEach(event => {
            if (!eventsBySeasonId[event.season_id]) {
                eventsBySeasonId[event.season_id] = [];
            }
            eventsBySeasonId[event.season_id].push(event);
        });

        console.log(`📋 Found ${Object.keys(eventsBySeasonId).length} unique seasons`);

        // For each season, fetch the schedule once
        for (const [seasonId, seasonEvents] of Object.entries(eventsBySeasonId)) {
            try {
                console.log(`\n🔄 Fetching schedule for season ${seasonId}...`);
                
                // Call the schedule endpoint
                const scheduleEndpoint = `/data/series/season_schedule?season_id=${seasonId}`;
                console.log(`  📡 Requesting: ${scheduleEndpoint}`);
                
                const scheduleResponse = await driverRefreshService.client.makeDataAPIRequest(scheduleEndpoint);
                
                if (!scheduleResponse || !scheduleResponse.link) {
                    console.warn(`⚠️  No schedule link in response for season ${seasonId}`);
                    seasonEvents.forEach(event => {
                        failures.push({
                            event_id: event.event_id,
                            event_name: event.event_name,
                            error: 'No schedule link in API response'
                        });
                    });
                    continue;
                }

                // Fetch the actual schedule data from the S3 link
                console.log(`  🔗 Fetching schedule data from S3 link...`);
                const scheduleData = await axios.get(scheduleResponse.link, { timeout: 30000 });
                const schedule = scheduleData.data;

                if (!schedule || !Array.isArray(schedule.schedules)) {
                    console.warn(`⚠️  Invalid schedule structure for season ${seasonId}`);
                    seasonEvents.forEach(event => {
                        failures.push({
                            event_id: event.event_id,
                            event_name: event.event_name,
                            error: 'Invalid schedule structure'
                        });
                    });
                    continue;
                }

                console.log(`  📊 Retrieved ${schedule.schedules.length} race weeks for season ${seasonId}`);

                // For each event in this season, find its race week and extract weather URL
                for (const event of seasonEvents) {
                    try {
                        // Find the matching race week
                        const raceWeek = schedule.schedules.find(week => week.race_week_num === event.race_week_num);
                        
                        if (!raceWeek) {
                            console.warn(`⚠️  Race week ${event.race_week_num} not found for event ${event.event_id}`);
                            failures.push({
                                event_id: event.event_id,
                                event_name: event.event_name,
                                error: `Race week ${event.race_week_num} not found in schedule`
                            });
                            continue;
                        }

                        // Extract weather URL from race week
                        const weatherUrl = raceWeek.weather?.weather_url;
                        
                        if (!weatherUrl) {
                            console.warn(`⚠️  No weather URL in race week ${event.race_week_num} for event ${event.event_id}`);
                            failures.push({
                                event_id: event.event_id,
                                event_name: event.event_name,
                                error: 'No weather URL in race week data'
                            });
                            continue;
                        }

                        // Update the event with the weather URL
                        await pool.query(
                            'UPDATE events SET weather_url = $1, updated_at = CURRENT_TIMESTAMP WHERE event_id = $2',
                            [weatherUrl, event.event_id]
                        );
                        
                        console.log(`✅ Updated weather URL for event ${event.event_id}: ${event.event_name}`);
                        updatedCount++;

                    } catch (eventError) {
                        console.error(`❌ Error processing event ${event.event_id}:`, eventError.message);
                        failures.push({
                            event_id: event.event_id,
                            event_name: event.event_name,
                            error: eventError.message
                        });
                    }
                }

            } catch (seasonError) {
                console.error(`❌ Error fetching schedule for season ${seasonId}:`, seasonError.message);
                seasonEvents.forEach(event => {
                    failures.push({
                        event_id: event.event_id,
                        event_name: event.event_name,
                        error: `Season fetch error: ${seasonError.message}`
                    });
                });
            }
        }
        
        res.json({
            message: 'Weather URL refresh completed',
            updatedCount,
            totalEvents: events.length,
            seasonsProcessed: Object.keys(eventsBySeasonId).length,
            successRate: `${((updatedCount / events.length) * 100).toFixed(1)}%`,
            failures: failures.length > 0 ? failures : undefined
        });
        
    } catch (error) {
        console.error('Weather refresh failed:', error.message);
        res.status(500).json({ 
            error: 'Weather refresh failed',
            message: error.message 
        });
    }
});

// ========================= END WEATHER REFRESH ENDPOINT =========================

// Individual driver details endpoint
app.get('/api/drivers/:custId/details', async (req, res) => {
    try {
        const custId = parseInt(req.params.custId);

        if (!custId || isNaN(custId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        console.log(`🔍 Fetching details for driver cust_id: ${custId}`);
        const driverDetails = await driverRefreshService.getDriverDetails(custId);

        res.json({
            success: true,
            driver: driverDetails
        });
    } catch (error) {
        console.error(`Driver details fetch failed for cust_id ${req.params.custId}:`, error.message);
        res.status(500).json({
            error: 'Driver details fetch failed',
            message: error.message
        });
    }
});

// Get driver details from database (without API call)
app.get('/api/drivers/:custId', async (req, res) => {
    try {
        const custId = parseInt(req.params.custId);

        if (!custId || isNaN(custId)) {
            return res.status(400).json({ error: 'Invalid customer ID' });
        }

        const query = `
            SELECT * FROM drivers
            WHERE cust_id = $1
        `;
        const result = await pool.query(query, [custId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({
            success: true,
            driver: result.rows[0]
        });
    } catch (error) {
        console.error(`Database driver fetch failed for cust_id ${req.params.custId}:`, error.message);
        res.status(500).json({
            error: 'Database driver fetch failed',
            message: error.message
        });
    }
});

// Add single driver by customer ID endpoint
app.post('/api/drivers/add', async (req, res) => {
    try {
        const { custId } = req.body;

        if (!custId || isNaN(parseInt(custId))) {
            return res.status(400).json({ error: 'Valid customer ID required' });
        }

        const customerId = parseInt(custId);

        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        console.log(`➕ Adding driver with cust_id: ${customerId}`);

        // Check if driver already exists
        const existingCheck = await pool.query('SELECT cust_id FROM drivers WHERE cust_id = $1', [customerId]);
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Driver already exists in database' });
        }

        // Get driver details from iRacing API
        const driverDetails = await driverRefreshService.getDriverDetails(customerId);

        // Insert into database with basic info (preserve existing columns)
        const insertQuery = `
            INSERT INTO drivers (
                cust_id, name, garage61_slug, timezone,
                display_name, country, member_since, last_login,
                sports_car_irating, sports_car_safety_rating, data_fetched_at
            ) VALUES (
                $1, $2, '', 'UTC',
                $3, $4, $5, $6,
                $7, $8, CURRENT_TIMESTAMP
            )
        `;

        const sportsCarLicense = driverDetails.licenses?.sports_car;
        await pool.query(insertQuery, [
            driverDetails.cust_id,
            driverDetails.display_name, // Use as name initially
            driverDetails.display_name,
            driverDetails.location?.country || null,
            driverDetails.member_since,
            driverDetails.last_login,
            sportsCarLicense?.irating || null,
            sportsCarLicense?.safety_rating || null
        ]);

        // Update config file to include the new driver
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, 'update-data', 'config.json');

        try {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (!configData.teamMembers.includes(customerId)) {
                configData.teamMembers.push(customerId);
                fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
                console.log(`✅ Added cust_id ${customerId} to config file`);
            }
        } catch (configError) {
            console.warn(`⚠️  Could not update config file: ${configError.message}`);
        }

        console.log(`✅ Successfully added driver: ${driverDetails.display_name} (${customerId})`);

        res.json({
            message: 'Driver added successfully',
            driver: {
                cust_id: driverDetails.cust_id,
                display_name: driverDetails.display_name,
                country: driverDetails.location?.country
            }
        });

    } catch (error) {
        console.error('Failed to add driver:', error.message);
        res.status(500).json({
            error: 'Failed to add driver',
            message: error.message
        });
    }
});

// ========================================
// IDEAL FUEL LAP API ENDPOINTS
// ========================================

// Save ideal fuel lap
app.post('/api/ideal-fuel-lap', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        const { trackId, carName, samples, metadata } = req.body;

        // Validate input
        if (!trackId || !carName || !samples || !Array.isArray(samples)) {
            return res.status(400).json({ error: 'Missing required fields: trackId, carName, samples' });
        }

        if (samples.length < 50) {
            return res.status(400).json({ error: 'Insufficient samples (need at least 50)' });
        }

        console.log(`💾 Saving ideal fuel lap: Track ${trackId}, Car ${carName}, ${samples.length} samples`);

        // Extract separate arrays for each telemetry field
        const fuelLevel = samples.map(s => s.fuelLevel);
        const fuelUsePerHour = samples.map(s => s.fuelUsePerHour);
        const speed = samples.map(s => s.speed);
        const throttle = samples.map(s => s.throttle);

        // UPSERT query (insert or update if track+car already exists)
        const query = `
            INSERT INTO ideal_fuel_laps (
                track_id, car_name,
                fuel_level, fuel_use_per_hour, speed, throttle,
                lap_time, fuel_kg_per_ltr, tank_capacity,
                track_temp, air_temp, wind_velocity, wind_direction,
                humidity, skies
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            ON CONFLICT (track_id, car_name)
            DO UPDATE SET
                fuel_level = EXCLUDED.fuel_level,
                fuel_use_per_hour = EXCLUDED.fuel_use_per_hour,
                speed = EXCLUDED.speed,
                throttle = EXCLUDED.throttle,
                lap_time = EXCLUDED.lap_time,
                fuel_kg_per_ltr = EXCLUDED.fuel_kg_per_ltr,
                tank_capacity = EXCLUDED.tank_capacity,
                track_temp = EXCLUDED.track_temp,
                air_temp = EXCLUDED.air_temp,
                wind_velocity = EXCLUDED.wind_velocity,
                wind_direction = EXCLUDED.wind_direction,
                humidity = EXCLUDED.humidity,
                skies = EXCLUDED.skies,
                recorded_at = NOW()
            RETURNING id;
        `;

        const result = await pool.query(query, [
            trackId,
            carName,
            JSON.stringify(fuelLevel),
            JSON.stringify(fuelUsePerHour),
            JSON.stringify(speed),
            JSON.stringify(throttle),
            metadata?.lapTime || null,
            metadata?.fuelKgPerLtr || null,
            metadata?.tankCapacity || null,
            metadata?.trackTemp || null,
            metadata?.airTemp || null,
            metadata?.windVel || null,
            metadata?.windDir || null,
            metadata?.humidity || null,
            metadata?.skies || null
        ]);

        console.log(`✅ Ideal fuel lap saved with ID: ${result.rows[0].id}`);

        res.json({
            message: 'Ideal fuel lap saved successfully',
            id: result.rows[0].id,
            trackId,
            carName,
            sampleCount: samples.length
        });

    } catch (error) {
        console.error('Failed to save ideal fuel lap:', error);
        res.status(500).json({
            error: 'Failed to save ideal fuel lap',
            message: error.message
        });
    }
});

// Get ideal fuel lap
app.get('/api/ideal-fuel-lap/:trackId/:carName', async (req, res) => {
    try {
        if (!pool) {
            return res.status(500).json({ error: 'Database not available' });
        }

        const { trackId, carName } = req.params;

        console.log(`🔍 Fetching ideal fuel lap: Track ${trackId}, Car ${carName}`);

        const query = `
            SELECT * FROM ideal_fuel_laps
            WHERE track_id = $1 AND car_name = $2
            LIMIT 1;
        `;

        const result = await pool.query(query, [parseInt(trackId), carName]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No ideal lap found for this track/car combination' });
        }

        const row = result.rows[0];

        // Reconstruct samples array from separate JSONB columns
        const fuelLevel = row.fuel_level;
        const fuelUsePerHour = row.fuel_use_per_hour;
        const speed = row.speed;
        const throttle = row.throttle;

        const samples = fuelLevel.map((fuel, i) => ({
            pct: i,
            fuelLevel: fuel,
            fuelUsePerHour: fuelUsePerHour[i],
            speed: speed[i],
            throttle: throttle[i]
        }));

        const response = {
            id: row.id,
            trackId: row.track_id,
            carName: row.car_name,
            samples,
            metadata: {
                lapTime: row.lap_time,
                fuelKgPerLtr: row.fuel_kg_per_ltr,
                tankCapacity: row.tank_capacity,
                trackTemp: row.track_temp,
                airTemp: row.air_temp,
                windVel: row.wind_velocity,
                windDir: row.wind_direction,
                humidity: row.humidity,
                skies: row.skies,
                recordedAt: row.recorded_at
            }
        };

        console.log(`✅ Found ideal lap with ${samples.length} samples`);
        res.json(response);

    } catch (error) {
        console.error('Failed to fetch ideal fuel lap:', error);
        res.status(500).json({
            error: 'Failed to fetch ideal fuel lap',
            message: error.message
        });
    }
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // console.log(`iRacing service will initialize automatically...`);
  console.log(`iRacing integration disabled (files in .gitignore)`);
});



