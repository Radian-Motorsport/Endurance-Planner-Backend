const iRacingOAuth2Client = require('../iracing-development/iracing-oauth2-client.js');
const axios = require('axios');
const fs = require('fs');

/**
 * Fetch car assets data using OAuth2
 */

async function fetchCarAssetsOnly() {
    try {
        console.log('🖼️  Fetching car assets data...');
        
        // Initialize OAuth2 client
        const CLIENT_ID = 'radian-limited';
        const CLIENT_SECRET = 'viewable-SALAMI-net-mortician-Fever-asparagus';
        
        const client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
        
        // Load credentials
        const credentials = require('../iracing-development/iracing-credentials.js');
        
        // Authenticate
        console.log('🔐 Authenticating...');
        const authSuccess = await client.authenticate(
            credentials.credentials.email,
            credentials.credentials.password
        );
        
        if (!authSuccess) {
            throw new Error('Authentication failed');
        }
        
        // Get car assets
        const carAssetsResponse = await client.makeDataAPIRequest('/data/car/assets');
        
        if (carAssetsResponse && carAssetsResponse.link) {
            console.log('✅ Car assets link obtained');
            
            // Check if valid
            const expiryTime = new Date(carAssetsResponse.expires);
            const now = new Date();
            
            if (now < expiryTime) {
                console.log(`⏰ Link valid for ${Math.round((expiryTime - now) / 1000)} seconds`);
                
                // Fetch actual data
                const assetsResult = await axios.get(carAssetsResponse.link, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                const carAssetsData = assetsResult.data;
                console.log('✅ Car assets data fetched');
                console.log(`📊 Found ${Object.keys(carAssetsData).length} cars with assets`);
                
                // Save the data
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `car-assets-data-${timestamp}.json`;
                fs.writeFileSync(filename, JSON.stringify(carAssetsData, null, 2));
                console.log(`💾 Saved to: ${filename}`);
                
                return carAssetsData;
                
            } else {
                console.log('❌ Link expired');
                return null;
            }
        } else {
            console.log('❌ No car assets link received');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    }
}

// Run
if (require.main === module) {
    fetchCarAssetsOnly();
}

module.exports = fetchCarAssetsOnly;