const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Use the DATABASE_URL environment variable from Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    
    const data = {
      drivers: driversResult.rows,
      cars: carsResult.rows,
      tracks: tracksResult.rows.map(t => ({ name: t.name })),
    };
    res.json(data);
  } catch (error) {
    console.error('Failed to retrieve data:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
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
      await pool.query('INSERT INTO drivers (name, irating, license) VALUES ($1, $2, $3)', [driver.name, driver.iRating, driver.license]);
    }
    
    // Insert new cars
    for (const car of cars) {
      await pool.query('INSERT INTO cars (name, fuel_per_lap, tank_capacity) VALUES ($1, $2, $3)', [car.name, car.fuelPerLap, car.tankCapacity]);
    }

    // Insert new tracks
    for (const track of tracks) {
      await pool.query('INSERT INTO tracks (name) VALUES ($1)', [track.name]);
    }
    
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Failed to save data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
