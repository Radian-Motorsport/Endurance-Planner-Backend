const iRacingOAuth2Client = require('../iracing-development/iracing-oauth2-client.js');

async function fetchTrackDataOAuth2() {
    try {
        console.log('🏁 Fetching track data with OAuth2...');
        console.log('📊 Endpoint: /data/track/get');
        console.log('');
        
        // Initialize OAuth2 client
        const CLIENT_ID = 'radian-limited';
        const CLIENT_SECRET = 'viewable-SALAMI-net-mortician-Fever-asparagus';
        
        const client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
        
        // Load credentials
        const credentials = require('../iracing-development/iracing-credentials.js');
        
        // Authenticate
        console.log('🔐 Authenticating with OAuth2...');
        const authSuccess = await client.authenticate(
            credentials.credentials.email,
            credentials.credentials.password
        );
        
        if (!authSuccess) {
            throw new Error('OAuth2 authentication failed');
        }
        
        console.log('✅ OAuth2 authentication successful');
        
        // Fetch track data
        console.log('\n🗺️  Fetching track data...');
        const trackData = await client.makeDataAPIRequest('/data/track/get');
        
        if (trackData) {
            console.log('✅ Track data API call successful');
            console.log('📊 Response analysis:');
            console.log(`   Type: ${typeof trackData}`);
            
            if (Array.isArray(trackData)) {
                console.log(`   Array length: ${trackData.length}`);
                if (trackData.length > 0) {
                    console.log(`   First item keys: [${Object.keys(trackData[0]).join(', ')}]`);
                }
            } else if (typeof trackData === 'object') {
                console.log(`   Object keys: [${Object.keys(trackData).join(', ')}]`);
            }
            
            // Save to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `track-data-oauth2-${timestamp}.json`;
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(trackData, null, 2));
            console.log(`\n💾 Track data saved to: ${filename}`);
            
        } else {
            console.log('❌ No track data received');
        }
        
        console.log('\n🎉 Track data test completed successfully!');
        
    } catch (error) {
        console.error('❌ Track data test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
fetchTrackDataOAuth2();