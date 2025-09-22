const fs = require('fs');

// Load and validate our data structure
const data = JSON.parse(fs.readFileSync('radianplanner-data-correct.json', 'utf8'));

console.log('=== DATA VALIDATION ===');
console.log(`Drivers: ${data.drivers.length}`);
console.log(`Cars: ${data.cars.length}`);
console.log(`Tracks: ${data.tracks.length}`);

console.log('\n=== FIRST DRIVER ===');
console.log(JSON.stringify(data.drivers[0], null, 2));

console.log('\n=== FIRST CAR ===');
console.log(JSON.stringify(data.cars[0], null, 2));

console.log('\n=== FIRST TRACK ===');
console.log(JSON.stringify(data.tracks[0], null, 2));

// Check for missing required fields
console.log('\n=== FIELD VALIDATION ===');

const driverMissingFields = data.drivers.filter(d => !d.name || !d.garage61_slug || !d.firstName || !d.lastName);
const carMissingFields = data.cars.filter(c => !c.name || !c.garage61_id || !c.platform || !c.platform_id);
const trackMissingFields = data.tracks.filter(t => !t.name || !t.garage61_id || !t.base_name || !t.variant || !t.platform);

console.log(`Drivers with missing fields: ${driverMissingFields.length}`);
console.log(`Cars with missing fields: ${carMissingFields.length}`);
console.log(`Tracks with missing fields: ${trackMissingFields.length}`);

if (trackMissingFields.length > 0) {
    console.log('\nTracks with missing fields:');
    trackMissingFields.forEach(track => console.log(track));
}