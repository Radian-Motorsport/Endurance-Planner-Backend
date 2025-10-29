const fs = require('fs');

async function fetchActualTrackData() {
    try {
        // Read the response with the link
        const linkData = JSON.parse(fs.readFileSync('track-data-oauth2-2025-10-17T22-02-06-734Z.json', 'utf8'));
        
        console.log('Fetching actual track data from:', linkData.link);
        
        // Fetch the actual track data
        const response = await fetch(linkData.link);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const trackData = await response.json();
        
        // Save the actual track data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `actual-track-data-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(trackData, null, 2));
        
        console.log(`Track data saved to ${filename}`);
        console.log(`Number of tracks: ${trackData.length}`);
        
        return trackData;
        
    } catch (error) {
        console.error('Error fetching track data:', error);
    }
}

fetchActualTrackData();