const express = require('express');
const path = require('path');
const { Pool } = require('pg');

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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to create all necessary tables if they don't exist
async function createTables() {
    if (!pool) {
        console.log('Skipping database table creation - no database connection.');
        return;
    }
    
    try {
        const createDriversTable = `
            CREATE TABLE IF NOT EXISTS drivers (
                name VARCHAR(255) PRIMARY KEY,
                garage61_slug VARCHAR(255),
                firstName VARCHAR(255),
                lastName VARCHAR(255)
            );
        `;
        const createCarsTable = `
            CREATE TABLE IF NOT EXISTS cars (
                name VARCHAR(255) PRIMARY KEY,
                garage61_id INT,
                platform VARCHAR(100),
                platform_id VARCHAR(100)
            );
        `;
        const createTracksTable = `
            CREATE TABLE IF NOT EXISTS tracks (
                name VARCHAR(255) PRIMARY KEY,
                garage61_id INT,
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
        console.log('Database tables checked/created successfully.');
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

// API endpoint to save all data to the database
app.post('/api/data', async (req, res) => {
  try {
    const { drivers, cars, tracks } = req.body;

    // Clear existing data
    await pool.query('TRUNCATE TABLE drivers RESTART IDENTITY');
    await pool.query('TRUNCATE TABLE cars RESTART IDENTITY');
    await pool.query('TRUNCATE TABLE tracks RESTART IDENTITY');

    // Insert new drivers
    for (const driver of drivers) {
      await pool.query('INSERT INTO drivers (name, garage61_slug, firstName, lastName) VALUES ($1, $2, $3, $4)', 
        [driver.name, driver.garage61_slug, driver.firstName, driver.lastName]);
    }

    // Insert new cars
    for (const car of cars) {
      await pool.query('INSERT INTO cars (name, garage61_id, platform, platform_id) VALUES ($1, $2, $3, $4)', 
        [car.name, car.garage61_id, car.platform, car.platform_id]);
    }

    // Insert new tracks
    for (const track of tracks) {
      await pool.query('INSERT INTO tracks (name, garage61_id, base_name, variant, platform) VALUES ($1, $2, $3, $4, $5)', 
        [track.name, track.garage61_id, track.base_name, track.variant, track.platform]);
    }

    res.status(200).send('Data saved successfully');
  } catch (err) {
    console.error('Error saving data:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});



