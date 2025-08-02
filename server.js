const express = require('express');
const path = require('path');
const fs = require('fs/promises'); // Use fs.promises for async file operations

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'db.json');

app.use(express.json()); // Enable JSON body parsing for POST requests
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (if any)

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to get all data
app.get('/api/data', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Failed to read db.json:', error);
    res.status(500).json({ error: 'Failed to load data' });
  }
});

// API endpoint to save all data
app.post('/api/data', async (req, res) => {
  try {
    const dataToSave = req.body;
    await fs.writeFile(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Failed to write to db.json:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
