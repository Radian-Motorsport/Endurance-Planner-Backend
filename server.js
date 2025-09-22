const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Garage61 API Configuration
const garage61Config = {
  baseUrl: 'https://garage61.net/api/v1',
  token: process.env.GARAGE61_TOKEN || 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5',
  headers: {
    'Authorization': `Bearer ${process.env.GARAGE61_TOKEN || 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5'}`,
    'Content-Type': 'application/json'
  }
};

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

// --- GARAGE61 API INTEGRATION FOR TEAM TELEMETRY ---

// Helper function to make Garage61 API calls
async function callGarage61API(endpoint) {
    try {
        const response = await fetch(`${garage61Config.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: garage61Config.headers
        });

        if (!response.ok) {
            throw new Error(`Garage61 API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Garage61 API call failed:', error);
        throw error;
    }
}

// Get team performance data for endurance planning
async function getTeamPerformanceData(trackName, carClass = null, lastNSessions = 10) {
    try {
        console.log(`🏁 Fetching team performance data for ${trackName}...`);
        
        // Get recent sessions for the track
        let endpoint = `/sessions?track=${encodeURIComponent(trackName)}&limit=${lastNSessions}`;
        if (carClass) {
            endpoint += `&car=${encodeURIComponent(carClass)}`;
        }
        
        const sessions = await callGarage61API(endpoint);
        
        if (!sessions || sessions.length === 0) {
            return {
                success: false,
                message: `No recent sessions found for ${trackName}`,
                fallbackData: {
                    avgFuelPerLap: 2.8,
                    avgLapTime: 90,
                    sessionCount: 0
                }
            };
        }

        // Aggregate data from sessions
        const performanceData = await aggregateSessionData(sessions, trackName);
        
        console.log(`✅ Found ${sessions.length} sessions for ${trackName}`);
        return {
            success: true,
            trackName,
            sessionCount: sessions.length,
            ...performanceData
        };

    } catch (error) {
        console.error('Error fetching team performance:', error);
        return {
            success: false,
            error: error.message,
            fallbackData: {
                avgFuelPerLap: 2.8,
                avgLapTime: 90,
                sessionCount: 0
            }
        };
    }
}

// Aggregate telemetry data from multiple sessions
async function aggregateSessionData(sessions, trackName) {
    let totalFuelUsage = 0;
    let totalLapTime = 0;
    let lapCount = 0;
    let driverStats = {};

    for (const session of sessions) {
        try {
            // Get detailed session data including laps
            const sessionDetail = await callGarage61API(`/sessions/${session.id}`);
            
            if (sessionDetail && sessionDetail.laps) {
                for (const lap of sessionDetail.laps) {
                    // Only include clean, representative laps
                    if (lap.lapTime && lap.lapTime > 30 && lap.lapTime < 300) { // Reasonable lap time range
                        totalLapTime += lap.lapTime;
                        lapCount++;
                        
                        // Track per-driver stats
                        const driverName = lap.driverName || 'Unknown';
                        if (!driverStats[driverName]) {
                            driverStats[driverName] = {
                                lapCount: 0,
                                totalLapTime: 0,
                                totalFuelUsage: 0,
                                bestLap: lap.lapTime
                            };
                        }
                        
                        driverStats[driverName].lapCount++;
                        driverStats[driverName].totalLapTime += lap.lapTime;
                        if (lap.lapTime < driverStats[driverName].bestLap) {
                            driverStats[driverName].bestLap = lap.lapTime;
                        }
                        
                        // Estimate fuel usage (if not available directly)
                        if (lap.fuelUsed) {
                            totalFuelUsage += lap.fuelUsed;
                            driverStats[driverName].totalFuelUsage += lap.fuelUsed;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`Skipping session ${session.id} due to error:`, error.message);
        }
    }

    // Calculate averages
    const avgLapTime = lapCount > 0 ? totalLapTime / lapCount : 90;
    const avgFuelPerLap = lapCount > 0 && totalFuelUsage > 0 ? totalFuelUsage / lapCount : 2.8;

    // Calculate per-driver averages
    const driverAverages = {};
    for (const [driverName, stats] of Object.entries(driverStats)) {
        if (stats.lapCount > 2) { // Only include drivers with meaningful data
            driverAverages[driverName] = {
                avgLapTime: stats.totalLapTime / stats.lapCount,
                avgFuelPerLap: stats.totalFuelUsage > 0 ? stats.totalFuelUsage / stats.lapCount : avgFuelPerLap,
                bestLap: stats.bestLap,
                lapCount: stats.lapCount
            };
        }
    }

    return {
        avgFuelPerLap: parseFloat(avgFuelPerLap.toFixed(2)),
        avgLapTime: parseFloat(avgLapTime.toFixed(1)),
        totalLaps: lapCount,
        driverAverages,
        driverCount: Object.keys(driverAverages).length
    };
}

// --- NEW API ENDPOINTS FOR GARAGE61 INTEGRATION ---

// Get team performance data for a specific track
app.get('/api/garage61/team-performance/:track', async (req, res) => {
    try {
        const { track } = req.params;
        const { car, sessions = 10 } = req.query;
        
        const performanceData = await getTeamPerformanceData(track, car, parseInt(sessions));
        res.json(performanceData);
        
    } catch (error) {
        console.error('Error in team-performance endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch team performance data',
            fallbackData: { avgFuelPerLap: 2.8, avgLapTime: 90 }
        });
    }
});

// Get available tracks from recent sessions
app.get('/api/garage61/tracks', async (req, res) => {
    try {
        const sessions = await callGarage61API('/sessions?limit=50');
        const tracks = [...new Set(sessions.map(s => s.track))].filter(Boolean);
        
        res.json({
            success: true,
            tracks: tracks.sort(),
            sessionCount: sessions.length
        });
        
    } catch (error) {
        console.error('Error fetching tracks:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch track list',
            tracks: []
        });
    }
});

// Test Garage61 connection
app.get('/api/garage61/test', async (req, res) => {
    try {
        const userInfo = await callGarage61API('/me');
        res.json({
            success: true,
            message: 'Garage61 connection successful',
            user: userInfo.name || 'Unknown',
            tokenValid: true
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Garage61 connection failed',
            message: error.message,
            tokenValid: false
        });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});



