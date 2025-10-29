const fs = require('fs');

// Read the Garage61 track mapping
const g61TracksRaw = fs.readFileSync('garage61-all-tracks.json', 'utf8');
const g61Tracks = JSON.parse(g61TracksRaw);

console.log(`Creating SQL to restore garage61_track_id mappings...`);
console.log(`Found ${g61Tracks.length} Garage61 track mappings`);

// Create a mapping from iRacing track_id to Garage61 id
const trackMapping = {};
g61Tracks.forEach(track => {
    const iracingId = parseInt(track.platform_id);
    trackMapping[iracingId] = track.id;
});

console.log(`Created mapping for ${Object.keys(trackMapping).length} unique iRacing track IDs`);

// Generate SQL to update garage61_track_id in events table
let sql = `-- Restore garage61_track_id mappings in events table
-- Generated on ${new Date().toISOString()}
-- Based on Garage61 track mapping data

`;

// Create UPDATE statements for each mapping
Object.entries(trackMapping).forEach(([iracingId, g61Id]) => {
    sql += `UPDATE events 
SET garage61_track_id = ${g61Id} 
WHERE track_id = ${iracingId} AND garage61_track_id IS NULL;

`;
});

// Also create a general mapping view for reference
sql += `
-- Reference: iRacing ID to Garage61 ID mapping
-- Use this for manual verification
/*
`;

Object.entries(trackMapping).forEach(([iracingId, g61Id]) => {
    const track = g61Tracks.find(t => parseInt(t.platform_id) === parseInt(iracingId));
    sql += `iRacing ${iracingId} -> G61 ${g61Id} (${track.name} - ${track.variant})
`;
});

sql += `*/`;

// Write the SQL file
fs.writeFileSync('restore-garage61-track-mappings.sql', sql);

console.log('SQL file generated: restore-garage61-track-mappings.sql');
console.log('This will restore garage61_track_id for events that have matching iRacing track IDs.');

// Show some examples
console.log('\nSample mappings:');
const sampleMappings = Object.entries(trackMapping).slice(0, 10);
sampleMappings.forEach(([iracingId, g61Id]) => {
    const track = g61Tracks.find(t => parseInt(t.platform_id) === parseInt(iracingId));
    console.log(`  iRacing ${iracingId} -> G61 ${g61Id} (${track.name} - ${track.variant})`);
});