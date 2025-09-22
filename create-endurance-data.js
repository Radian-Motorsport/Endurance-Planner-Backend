const fs = require('fs');

// Read and parse the endurance tracks file (handle PowerShell format)
const enduranceTracksRaw = fs.readFileSync('garage61-endurance-tracks.json', 'utf8');
const enduranceTracks = JSON.parse(enduranceTracksRaw);

// Read cars 
const carsRaw = fs.readFileSync('garage61-filtered-cars.json', 'utf8');
const cars = JSON.parse(carsRaw);

// Read drivers
const driversRaw = fs.readFileSync('garage61-radian-team.json', 'utf8');
const drivers = JSON.parse(driversRaw);

// Clean drivers (remove driverNumber)
const cleanDrivers = drivers.map(driver => ({
    name: driver.name,
    firstName: driver.firstName,
    lastName: driver.lastName,
    garage61_slug: driver.garage61_slug
}));

// Format tracks properly
const cleanTracks = enduranceTracks.map(track => ({
    name: `${track.name} - ${track.variant}`,
    garage61_id: track.id,
    base_name: track.name,
    variant: track.variant,
    platform: track.platform
}));

const finalData = {
    drivers: cleanDrivers,
    cars: cars,
    tracks: cleanTracks
};

fs.writeFileSync('radianplanner-endurance-final.json', JSON.stringify(finalData, null, 2));
console.log(`✅ Created final data with ${cleanDrivers.length} drivers, ${cars.length} cars, ${cleanTracks.length} ENDURANCE tracks`);