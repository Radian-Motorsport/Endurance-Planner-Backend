const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Use the DATABASE_URL environment variable from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to create all necessary tables if they don't exist
async function createTables() {
    try {
        const createDriversTable = `
            CREATE TABLE IF NOT EXISTS drivers (
                name VARCHAR(255) PRIMARY KEY,
                drivernumber INT
            );
        `;
        const createCarsTable = `
            CREATE TABLE IF NOT EXISTS cars (
                name VARCHAR(255) PRIMARY KEY
            );
        `;
        const createTracksTable = `
            CREATE TABLE IF NOT EXISTS tracks (
                name VARCHAR(255) PRIMARY KEY
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
    }
}

// Call the function on server start
createTables();

// Serve the main HTML file
app.get('/', (req, res) => {
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
    await pool.query('TRUNCATE TABLE drivers, cars, tracks RESTART IDENTITY');

    // Insert new drivers
    for (const driver of drivers) {
      await pool.query('INSERT INTO drivers (name, drivernumber) VALUES ($1, $2)', [driver.name, driver.drivernumber]);
    }

    // Insert new cars
    for (const car of cars) {
      await pool.query('INSERT INTO cars (name) VALUES ($1)', [car.name]);
    }

    // Insert new tracks
    for (const track of tracks) {
      await pool.query('INSERT INTO tracks (name) VALUES ($1)', [track.name]);
    }

    res.status(200).send('Data saved successfully');
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).send('Internal Server Error');
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
