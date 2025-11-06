const axios = require('axios');

async function inspectBackgrounds() {
    // Sample URLs from track assets
    const tracks = [
        { id: 1, url: 'https://members-assets.iracing.com/public/track-maps/tracks_limerock/1-limerock-full/background.svg', name: 'Lime Rock' },
        { id: 2, url: 'https://members-assets.iracing.com/public/track-maps/tracks_virginia/2-virginia-full/background.svg', name: 'Virginia Full' },
        { id: 3, url: 'https://members-assets.iracing.com/public/track-maps/tracks_virginia/3-virginia-patriot/background.svg', name: 'Virginia Patriot' },
        { id: 7, url: 'https://members-assets.iracing.com/public/track-maps/tracks_watkins/7-watkins-full/background.svg', name: 'Watkins Glen' },
        { id: 8, url: 'https://members-assets.iracing.com/public/track-maps/tracks_infineonraces/8-infineon-full/background.svg', name: 'Infineon' }
    ];

    console.log('Inspecting background SVG groups across multiple tracks:\n');

    for (const track of tracks) {
        try {
            const response = await axios.get(track.url, { timeout: 5000 });
            const svg = response.data;
            const groups = svg.match(/<g\s+id="([^"]+)"/g) || [];
            const uniqueGroups = [...new Set(groups.map(g => g.match(/"([^"]+)"/)[1]))];
            console.log(`✅ ${track.name} (Track ${track.id}):`);
            uniqueGroups.forEach(g => console.log(`   - ${g}`));
        } catch (err) {
            console.log(`❌ ${track.name}: ${err.message}`);
        }
    }
}

inspectBackgrounds().catch(console.error);
