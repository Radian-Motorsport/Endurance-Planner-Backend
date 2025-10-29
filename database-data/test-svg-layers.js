const axios = require('axios');
const fs = require('fs');

/**
 * Test what the SVG track map layers look like
 * Fetch some sample SVG files to understand the structure
 */

async function testTrackMapSVGs() {
    try {
        console.log('🗺️  Testing track map SVG layers...');
        
        // Read track assets data to get some track map URLs
        const trackAssetsFile = fs.readdirSync('./update-data').find(f => f.startsWith('track-assets-data-'));
        if (!trackAssetsFile) {
            throw new Error('No track assets data file found');
        }
        
        const trackData = JSON.parse(fs.readFileSync(`./update-data/${trackAssetsFile}`, 'utf8'));
        
        // Get a few tracks with track maps
        const sampleTracks = Object.entries(trackData)
            .filter(([id, data]) => data.track_map && data.track_map_layers)
            .slice(0, 3); // Test first 3 tracks
        
        console.log(`📊 Found ${sampleTracks.length} tracks with track maps to test`);
        
        for (const [trackId, trackInfo] of sampleTracks) {
            console.log(`\n🏁 Testing Track ID ${trackId}: ${trackInfo.track_map}`);
            console.log(`📋 Available layers:`, Object.keys(trackInfo.track_map_layers));
            
            // Test fetching each layer
            for (const [layerName, svgFile] of Object.entries(trackInfo.track_map_layers)) {
                try {
                    const svgUrl = `${trackInfo.track_map}${svgFile}`;
                    console.log(`\n🎨 Fetching ${layerName}: ${svgUrl}`);
                    
                    const response = await axios.get(svgUrl, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    console.log(`✅ ${layerName} - Status: ${response.status}, Size: ${response.data.length} chars`);
                    
                    // Show first part of SVG content
                    const preview = response.data.substring(0, 200);
                    console.log(`📝 Preview: ${preview}...`);
                    
                    // Save the SVG for inspection
                    const filename = `track-${trackId}-${layerName}.svg`;
                    fs.writeFileSync(filename, response.data);
                    console.log(`💾 Saved as: ${filename}`);
                    
                } catch (error) {
                    console.log(`❌ Failed to fetch ${layerName}: ${error.message}`);
                }
            }
            
            // Only test first track to avoid too many requests
            break;
        }
        
        console.log('\n📋 SVG Layer Analysis:');
        console.log('The track map layers typically work like this:');
        console.log('  - background.svg: Base track outline and background');
        console.log('  - inactive.svg: Track sections that are inactive/not used');
        console.log('  - active.svg: Main racing line/active track sections');
        console.log('  - pitroad.svg: Pit road and pit area');
        console.log('  - start-finish.svg: Start/finish line marker');
        console.log('  - turns.svg: Turn numbers and corner markings');
        console.log('');
        console.log('💡 These are likely meant to be overlaid/combined for interactive maps');
        console.log('💡 Each layer can be shown/hidden independently for different views');
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to test SVG layers:', error.message);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testTrackMapSVGs()
        .then((result) => {
            if (result) {
                console.log('\n🎉 SVG layer test completed!');
                console.log('Check the saved .svg files to see what each layer looks like');
            } else {
                console.log('\n💥 SVG layer test failed');
            }
        })
        .catch(console.error);
}

module.exports = testTrackMapSVGs;