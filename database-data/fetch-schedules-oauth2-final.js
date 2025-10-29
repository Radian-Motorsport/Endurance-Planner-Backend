const iRacingOAuth2Client = require('../iracing-development/iracing-oauth2-client.js');

async function fetchSchedulesDataOAuth2() {
    try {
        console.log('📅 Fetching schedules/series data with OAuth2...');
        console.log('📊 Endpoint: /data/series/seasons');
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
        
        // Endurance series config
        const enduranceSeriesIds = [331, 419, 237, 451, 275];
        const enduranceSeriesNames = {
            "331": "Global Endurance Tour",
            "419": "IMSA Endurance Series", 
            "237": "GT Endurance Series by Simucube",
            "451": "Creventic Endurance Series",
            "275": "Nurburgring Endurance Championship"
        };
        
        // Fetch series/seasons data
        console.log('\\n📅 Fetching series/seasons data...');
        const seriesData = await client.makeDataAPIRequest('/data/series/seasons');
        
        if (seriesData) {
            console.log('✅ Series/seasons data API call successful');
            console.log('📊 Response analysis:');
            console.log(`   Type: ${typeof seriesData}`);
            
            if (Array.isArray(seriesData)) {
                console.log(`   Array length: ${seriesData.length}`);
                if (seriesData.length > 0) {
                    console.log(`   First item keys: [${Object.keys(seriesData[0]).join(', ')}]`);
                }
            } else if (typeof seriesData === 'object') {
                console.log(`   Object keys: [${Object.keys(seriesData).join(', ')}]`);
            }
            
            // Save to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fs = require('fs');
            
            const filename = `series-seasons-oauth2-${timestamp}.json`;
            fs.writeFileSync(filename, JSON.stringify(seriesData, null, 2));
            
            console.log(`\\n📁 Series/seasons data saved to ${filename}`);
            
            // Filter for endurance series
            if (Array.isArray(seriesData)) {
                const enduranceData = seriesData.filter(item => 
                    enduranceSeriesIds.includes(item.series_id)
                );
                
                if (enduranceData.length > 0) {
                    const enduranceFilename = `endurance-schedules-oauth2-${timestamp}.json`;
                    fs.writeFileSync(enduranceFilename, JSON.stringify(enduranceData, null, 2));
                    
                    console.log(`🏁 Endurance data filtered and saved to ${enduranceFilename}`);
                    console.log(`📊 Endurance series found: ${enduranceData.length}`);
                    
                    enduranceData.forEach(series => {
                        const seriesName = enduranceSeriesNames[series.series_id] || 'Unknown';
                        console.log(`   - ${seriesName} (ID: ${series.series_id})`);
                        if (series.season_name) console.log(`     Season: ${series.season_name}`);
                    });
                    
                    return enduranceData;
                }
            }
            
            return seriesData;
        } else {
            throw new Error('No series data received');
        }
        
    } catch (error) {
        console.error('❌ Error fetching schedules data:', error);
        
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        const fs = require('fs');
        fs.writeFileSync(`schedules-oauth2-final-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify(errorData, null, 2));
    }
}

fetchSchedulesDataOAuth2();