// Script to properly import endurance tracks
const fs = require('fs');

try {
    // Read the current working data
    const currentData = JSON.parse(fs.readFileSync('radianplanner-data-clean.json', 'utf8'));
    
    // Read the endurance tracks file - handle PowerShell JSON format
    const enduranceTracksText = fs.readFileSync('garage61-endurance-tracks.json', 'utf8');
    // Clean up PowerShell formatting
    const cleanedText = enduranceTracksText.replace(/:\s+(\d+|"[^"]*")/g, ': $1');
    const enduranceTracks = JSON.parse(cleanedText);
    
    // Convert endurance tracks to database format
    const properTracks = enduranceTracks.map(track => ({
        name: `${track.name} - ${track.variant}`,
        garage61_id: track.id,
        base_name: track.name,
        variant: track.variant,
        platform: track.platform
    }));
    
    // Create final data with endurance tracks
    const finalData = {
        drivers: currentData.drivers,
        cars: currentData.cars,
        tracks: properTracks
    };
    
    fs.writeFileSync('radianplanner-with-endurance-tracks.json', JSON.stringify(finalData, null, 2));
    console.log(`✅ SUCCESS: Created data with ${properTracks.length} ENDURANCE tracks`);
    console.log(`First track: ${properTracks[0].name}`);
    console.log(`Last track: ${properTracks[properTracks.length-1].name}`);
    
} catch (error) {
    console.error('❌ Error:', error.message);
    
    // Fallback: manually create the tracks
    console.log('Creating manual fallback...');
    
    const manualTracks = [
        {name: "Autodromo Nazionale Monza - Combined", garage61_id: 232, base_name: "Autodromo Nazionale Monza", variant: "Combined", platform: "iracing"},
        {name: "Autodromo Nazionale Monza - Grand Prix", garage61_id: 77, base_name: "Autodromo Nazionale Monza", variant: "Grand Prix", platform: "iracing"},
        {name: "Brands Hatch Circuit - Grand Prix", garage61_id: 36, base_name: "Brands Hatch Circuit", variant: "Grand Prix", platform: "iracing"},
        {name: "Circuit de Spa-Francorchamps - Endurance", garage61_id: 446, base_name: "Circuit de Spa-Francorchamps", variant: "Endurance", platform: "iracing"}
    ];
    
    const fallbackData = {
        drivers: [{name: "Adam Economu", firstName: "Adam", lastName: "Economu", garage61_slug: "adam-economu"}],
        cars: [{name: "Acura ARX-06 GTP", garage61_id: 153, platform: "iracing", platform_id: "170"}],
        tracks: manualTracks
    };
    
    fs.writeFileSync('radianplanner-endurance-fallback.json', JSON.stringify(fallbackData, null, 2));
    console.log('✅ Created fallback with sample endurance tracks');
}