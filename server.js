// server.js
const express = require('express');
const fs = require('fs').promises; // Use the promise-based version of fs
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = 'data';

app.use(cors());
app.use(express.json());

async function ensureDataDirectory() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log(`Directory created: ${DATA_DIR}`);
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
}

app.post('/api/strategy', async (req, res) => {
    try {
        const strategyData = req.body;
        let strategyId = strategyData.id;

        if (!strategyId) {
            strategyId = uuidv4();
            strategyData.id = strategyId;
        }

        const filePath = path.join(DATA_DIR, `${strategyId}.json`);
        await fs.writeFile(filePath, JSON.stringify(strategyData, null, 2));

        res.status(200).json({ id: strategyId, message: 'Strategy saved successfully.' });
    } catch (error) {
        console.error('Failed to save strategy:', error);
        res.status(500).json({ message: 'Error saving strategy.' });
    }
});

app.get('/api/strategy/:id', async (req, res) => {
    const { id } = req.params;
    const filePath = path.join(DATA_DIR, `${id}.json`);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        console.error(`Strategy with ID ${id} not found:`, error);
        res.status(404).json({ message: 'Strategy not found.' });
    }
});

app.listen(PORT, async () => {
    await ensureDataDirectory();
    console.log(`Server is running on port ${PORT}`);
});