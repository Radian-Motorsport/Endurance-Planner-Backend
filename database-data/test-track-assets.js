const iRacingAPIManager = require('./api-manager');

/**
 * Test iRacing Track Assets API endpoint
 * Check what data is available from https://members-ng.iracing.com/data/track/assets
 */

async function testTrackAssets() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('🏁 Testing iRacing Track Assets API...');
        console.log('📊 Endpoint: /data/track/assets');
        console.log('');
        
        // Authenticate first
        await api.authenticate();
        console.log('✅ Authentication successful');
        
        // Test track assets endpoint
        console.log('\n🗺️  Fetching track assets data...');
        const trackAssets = await api.makeRequest('/data/track/assets');
        
        if (trackAssets) {
            console.log('✅ Track assets API call successful');
            console.log('📊 Raw response structure:');
            console.log('   Type:', typeof trackAssets);
            console.log('   Keys:', Object.keys(trackAssets));
            
            // If it's an array
            if (Array.isArray(trackAssets)) {
                console.log(`   Array length: ${trackAssets.length}`);
                if (trackAssets.length > 0) {
                    console.log('   First item structure:', Object.keys(trackAssets[0]));
                    console.log('   Sample item:', JSON.stringify(trackAssets[0], null, 2));
                }
            }
            
            // If it's an object with nested data
            if (typeof trackAssets === 'object' && !Array.isArray(trackAssets)) {
                for (const [key, value] of Object.entries(trackAssets)) {
                    console.log(`   ${key}:`, typeof value, Array.isArray(value) ? `(array of ${value.length})` : '');
                    if (Array.isArray(value) && value.length > 0) {
                        console.log(`     Sample ${key} item:`, Object.keys(value[0]));
                    }
                }
            }
            
            // Save the response for inspection
            const filename = await api.saveDataFile(trackAssets, 'track-assets-response');
            console.log(`💾 Saved track assets data to: ${filename}`);
            
        } else {
            console.log('❌ No track assets data received');
        }
        
        return trackAssets;
        
    } catch (error) {
        console.error('❌ Track assets API test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   StatusText:', error.response.statusText);
            console.error('   Headers:', error.response.headers);
        }
        throw error;
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testTrackAssets()
        .then(() => {
            console.log('\n🎉 Track assets test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Track assets test failed:', error.message);
            process.exit(1);
        });
}

module.exports = testTrackAssets;