const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios');
const SunCalc = require('suncalc');

const app = express();
const PORT = process.env.PORT || 3000;

// Use the DATABASE_URL environment variable from Render (optional)
let pool = null;
if (process.env.DATABASE_URL) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    console.log('Database connection configured.');
} else {
    console.log('No database URL provided. Running without database features.');
}

// Increase JSON body size to handle full data imports
app.use(express.json({ limit: '2mb' }));
// Serve static files
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
                lastName VARCHAR(255)
            );
        `;
        const createCarsTable = `
            CREATE TABLE IF NOT EXISTS cars (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                garage61_id INTEGER UNIQUE,
                platform VARCHAR(100),
                platform_id VARCHAR(100)
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
                id INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                short_name VARCHAR(100),
                category VARCHAR(100)
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
        
        await pool.query(createDriversTable);
        await pool.query(createCarsTable);
        await pool.query(createTracksTable);
        await pool.query(createStrategiesTable);
        await pool.query(createSeriesTable);
        await pool.query(createEventsTable);
        await pool.query(createSessionsTable);
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
        const driversResult = await pool.query('SELECT * FROM drivers');
        const carsResult = await pool.query('SELECT * FROM cars');
        const tracksResult = await pool.query('SELECT * FROM tracks');

        res.json({
            drivers: driversResult.rows,
            cars: carsResult.rows,
            tracks: tracksResult.rows
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Individual API endpoints for frontend dropdown population
app.get('/api/drivers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM drivers');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching drivers:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/cars', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cars');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching cars:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/tracks', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tracks');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching tracks:', err);
        res.status(500).send('Internal Server Error');
    }
});

// iRacing series endpoints
app.get('/api/series', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM series ORDER BY series_name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching series:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/events/:seriesId', async (req, res) => {
    try {
        const { seriesId } = req.params;
        const result = await pool.query(
            'SELECT * FROM events WHERE series_id = $1 ORDER BY start_date, start_time', 
            [seriesId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/sessions/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const result = await pool.query(
            'SELECT * FROM sessions WHERE event_id = $1 ORDER BY session_name', 
            [eventId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching sessions:', err);
        res.status(500).send('Internal Server Error');
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

        await pool.query('INSERT INTO strategies (id, strategy_data) VALUES ($1, $2)', [uniqueId, strategyData]);
        
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
            res.json(result.rows[0].strategy_data);
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
            res.json({ id: result.rows[0].id, message: 'Strategy updated successfully' });
        } else {
            res.status(404).send('Strategy not found');
        }
    } catch (err) {
        console.error('Error updating strategy:', err);
        res.status(500).send('Internal Server Error');
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // console.log(`iRacing service will initialize automatically...`);
  console.log(`iRacing integration disabled (files in .gitignore)`);
});



