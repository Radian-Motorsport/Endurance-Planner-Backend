const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const axios = require('axios');

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
app.use(express.static(path.join(__dirname, 'public')));

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
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                garage61_id INTEGER UNIQUE,
                base_name VARCHAR(255),
                variant VARCHAR(255),
                platform VARCHAR(100)
            );
        `;
        const createStrategiesTable = `
            CREATE TABLE IF NOT EXISTS strategies (
                id VARCHAR(36) PRIMARY KEY,
                strategy_data JSONB NOT NULL
            );
        `;
        await pool.query(createDriversTable);
        await pool.query(createCarsTable);
        await pool.query(createTracksTable);
        await pool.query(createStrategiesTable);
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
                    `INSERT INTO drivers (name, garage61_slug, firstName, lastName)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (name) DO UPDATE SET
                         garage61_slug = EXCLUDED.garage61_slug,
                         firstName = EXCLUDED.firstName,
                         lastName = EXCLUDED.lastName`,
                [driver.name, driver.garage61_slug || null, driver.firstName || null, driver.lastName || null]
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
                    `INSERT INTO tracks (name, garage61_id, base_name, variant, platform)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (garage61_id) DO UPDATE SET
                         name = EXCLUDED.name,
                         base_name = EXCLUDED.base_name,
                         variant = EXCLUDED.variant,
                         platform = EXCLUDED.platform`,
                [track.name, track.garage61_id ?? null, track.base_name || null, track.variant || null, track.platform || null]
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

// Test endpoint to check Garage61 token permissions
app.get('/api/garage61/me', async (req, res) => {
    try {
        const token = process.env.GARAGE61_TOKEN || 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5';
        const response = await axios.get('https://garage61.net/api/v1/me', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        
        console.log('🔑 Garage61 token permissions:', response.data);
        return res.status(200).json(response.data);
    } catch (err) {
        console.error('❌ Token verification failed:', err.response?.status, err.response?.data);
        return res.status(500).json({ 
            error: 'Token verification failed',
            status: err.response?.status,
            details: err.response?.data 
        });
    }
});

// --- Proxy to Garage61 to avoid CORS and keep token server-side ---
app.get('/api/garage61/laps', async (req, res) => {
    try {
        const { cars, tracks, driver } = req.query;
        if (!cars || !tracks) {
            return res.status(400).json({ error: 'Missing required query params: cars, tracks' });
        }

        // Prefer env var; fallback to legacy token (kept for continuity)
        const token = process.env.GARAGE61_TOKEN || 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5';
        if (!token) {
            return res.status(500).json({ error: 'Garage61 token not configured' });
        }

        // Use the correct Garage61 /laps endpoint with proper parameter format
        const url = 'https://garage61.net/api/v1/laps';
        
        // Build parameters according to Garage61 API documentation:
        // - drivers: only accepts "me" or "following"  
        // - extraDrivers: accepts user slugs like "john-sowerby"
        // - If no driver params given, returns yourself and all teammates
        const params = {
            cars: [parseInt(cars)],                   // Car IDs as array of numbers
            tracks: [parseInt(tracks)],               // Track IDs as array of numbers  
            group: 'none',                            // Return all laps (not just personal best)
            limit: 100,                               // More results to find best lap
            age: 30                                   // Include laps from last 30 days
        };
        
        // Add driver filtering only if a specific driver is requested
        if (driver && driver !== 'all') {
            if (driver === 'me') {
                params.drivers = ['me'];              // Special case for current user
            } else {
                params.extraDrivers = [driver];       // User slug for specific driver
            }
        }
        // If no driver specified, API returns all team laps automatically
        
        console.log(`🔗 Proxying to Garage61: ${url}`, JSON.stringify(params));
        
        const response = await axios.get(url, {
            params: params,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
            paramsSerializer: params => {
                // Properly serialize arrays for Garage61 API
                return Object.entries(params)
                    .map(([key, value]) => {
                        if (Array.isArray(value)) {
                            return value.map(v => `${key}=${encodeURIComponent(v)}`).join('&');
                        }
                        return `${key}=${encodeURIComponent(value)}`;
                    })
                    .join('&');
            }
        });
        
        console.log(`✅ Garage61 response: ${response.status}, ${response.data?.length || 0} laps`);
        return res.status(200).json(response.data);
    } catch (err) {
        console.error('❌ Garage61 proxy error:', err.response?.status, err.response?.statusText, err.message);
        
        // If the first request fails, try without driver filter (just car/track)
        if (err.response?.status === 404 || err.response?.status === 400) {
            try {
                console.log('🔄 Retrying without driver filter...');
                const fallbackParams = {
                    cars: [parseInt(cars)],
                    tracks: [parseInt(tracks)],
                    group: 'none',
                    limit: 100
                };
                
                const fallbackResponse = await axios.get(url, {
                    params: fallbackParams,
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 15000,
                    paramsSerializer: params => {
                        return Object.entries(params)
                            .map(([key, value]) => {
                                if (Array.isArray(value)) {
                                    return value.map(v => `${key}=${encodeURIComponent(v)}`).join('&');
                                }
                                return `${key}=${encodeURIComponent(value)}`;
                            })
                            .join('&');
                    }
                });
                
                console.log(`✅ Fallback success: ${fallbackResponse.data?.length || 0} laps`);
                return res.status(200).json(fallbackResponse.data);
            } catch (fallbackErr) {
                console.error('❌ Fallback also failed:', fallbackErr.response?.status);
            }
        }
        
        // Original error handling
        if (err.response) {
            const errorData = {
                error: 'Garage61 API error',
                status: err.response.status,
                statusText: err.response.statusText,
                data: err.response.data
            };
            console.error('Garage61 error details:', errorData);
            return res.status(err.response.status).json(errorData);
        }
        if (err.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'Garage61 request timed out after 15 seconds' });
        }
        return res.status(502).json({ error: 'Failed to reach Garage61', details: err.message });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});



