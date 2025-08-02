const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_FILE = 'db.json';

// Middleware
app.use(cors());
app.use(express.json());

// Read data from the "database"
function readDb() {
  const data = fs.readFileSync(DB_FILE);
  return JSON.parse(data);
}

// Write data to the "database"
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API Routes
app.get('/api/data', (req, res) => {
  const data = readDb();
  res.json(data);
});

app.post('/api/drivers', (req, res) => {
  const newDriver = req.body;
  const db = readDb();
  db.drivers.push(newDriver);
  writeDb(db);
  res.status(201).json(newDriver);
});

app.post('/api/cars', (req, res) => {
  const newCar = req.body;
  const db = readDb();
  db.cars.push(newCar);
  writeDb(db);
  res.status(201).json(newCar);
});

app.post('/api/tracks', (req, res) => {
  const newTrack = req.body;
  const db = readDb();
  db.tracks.push(newTrack);
  writeDb(db);
  res.status(201).json(newTrack);
});

// A simple API to save/load a full strategy
app.post('/api/strategy', (req, res) => {
    const newStrategy = req.body;
    const db = readDb();
    
    // Assign a simple ID for now
    const newId = Math.random().toString(36).substring(2, 9);
    newStrategy.id = newId;

    // A mock "strategies" array in the db.json
    if (!db.strategies) {
        db.strategies = [];
    }
    db.strategies.push(newStrategy);
    writeDb(db);
    res.status(201).json({ id: newId });
});

app.get('/api/strategy/:id', (req, res) => {
    const db = readDb();
    const strategy = db.strategies.find(s => s.id === req.params.id);
    if (strategy) {
        res.json(strategy);
    } else {
        res.status(404).send('Strategy not found');
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
