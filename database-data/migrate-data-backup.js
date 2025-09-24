const fs = require('fs');
const path = require('path');

// Load data from db.json
const dbData = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

// Function to populate database via API call
async function migrateData() {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    try {
        const response = await fetch(`${appUrl}/api/data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dbData)
        });

        if (response.ok) {
            console.log('✅ Database populated successfully!');
        } else {
            console.error('❌ Failed to populate database:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('❌ Error migrating data:', error);
    }
}

// Run migration
migrateData();