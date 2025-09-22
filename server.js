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

const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Use a port provided by Render, or default to 3000 for local testing
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));

// --- The Race State: This is the single source of truth for all clients ---
let raceState = {
    raceTimeRemaining: 0,
    avgLapTime: 0,
    fuelPerLap: 0,
    tankCapacity: 0,
    estLaps: 0,
    stintDuration: 0,
    lapsPerStint: 0,
    totalPitStops: 0,
    totalFuel: 0,
    nextPitStop: 0,
    raceIsRunning: false,
    stintData: [], // To store details of each completed stint
    lastUpdateTime: Date.now()
};

// --- Race Timer and Update Logic ---
setInterval(() => {
    if (raceState.raceIsRunning) {
        const now = Date.now();
        const elapsedTime = (now - raceState.lastUpdateTime) / 1000;
        raceState.raceTimeRemaining -= elapsedTime;
        raceState.nextPitStop -= elapsedTime;
        raceState.lastUpdateTime = now;

        // Check for race finish
        if (raceState.raceTimeRemaining <= 0) {
            raceState.raceTimeRemaining = 0;
            raceState.raceIsRunning = false;
        }

        // Check for pit stop
        if (raceState.nextPitStop <= 0 && raceState.raceTimeRemaining > 0) {
            // A pit stop is needed, add new stint data to the list
            raceState.stintData.push({
                stintNumber: raceState.stintData.length + 1,
                startTime: raceState.nextPitStop + raceState.stintDuration,
                endTime: 0, // Placeholder
                duration: raceState.stintDuration,
                laps: raceState.lapsPerStint,
                fuel: raceState.tankCapacity
            });
            // Reset the next pit stop timer
            raceState.nextPitStop = raceState.stintDuration;
        }

        // Broadcast the updated state to all connected clients
        const stateMessage = JSON.stringify(raceState);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(stateMessage);
            }
        });
    }
}, 1000); // Update every second

// --- WebSocket Event Handlers ---
wss.on('connection', ws => {
    console.log('New client connected');

    // Send the current race state to the newly connected client
    ws.send(JSON.stringify(raceState));

    ws.on('message', message => {
        const data = JSON.parse(message);
        console.log(`Received message: ${JSON.stringify(data)}`);

        if (data.type === 'recalculate') {
            const { raceDuration, avgLapTime, fuelPerLap, tankCapacity } = data.data;

            // Recalculate all strategy metrics
            raceState.raceTimeRemaining = raceDuration;
            raceState.avgLapTime = avgLapTime;
            raceState.fuelPerLap = fuelPerLap;
            raceState.tankCapacity = tankCapacity;
            
            // Perform the calculations and update raceState
            raceState.estLaps = raceDuration / avgLapTime;
            raceState.stintDuration = (tankCapacity / fuelPerLap) * avgLapTime;
            raceState.lapsPerStint = Math.floor(tankCapacity / fuelPerLap);
            raceState.totalPitStops = Math.floor(raceDuration / raceState.stintDuration);
            raceState.totalFuel = raceState.fuelPerLap * raceState.estLaps;
            raceState.nextPitStop = raceState.stintDuration;

            // Reset stint data for a new race
            raceState.stintData = [];

            // Broadcast the new strategy to all clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(raceState));
                }
            });

        } else if (data.type === 'toggleRace') {
            raceState.raceIsRunning = !raceState.raceIsRunning;
            // When starting, reset the update time
            if (raceState.raceIsRunning) {
                raceState.lastUpdateTime = Date.now();
            }

        } else if (data.type === 'pitExit') {
            // Logic for pit exit
            // You can add more complex logic here later, like adding fuel
            raceState.nextPitStop = raceState.stintDuration;

        } else if (data.type === 'adjustFuel') {
            // Adjust the fuel consumption
            // Note: This needs to be more complex to affect the next pit stop time properly
            raceState.fuelPerLap = raceState.fuelPerLap + data.value;
            // Recalculate stints and next pit stop based on new fuel usage
            // This is an advanced topic; for now, the timer will just keep counting down
        
        } else if (data.type === 'adjustLapTime') {
            // Adjust the lap time
            // Note: This needs to be more complex to affect all calculations properly
            raceState.avgLapTime = raceState.avgLapTime + data.value;
            // Recalculate all metrics
        }
    });

    ws.on('close', () => {
        console.log('Client has disconnected');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

