const fs = require('fs');

/**
 * Fetch schedules data using OAuth2 client credentials (like we did for tracks)
 */

async function fetchSchedulesDataOAuth2() {
    try {
        console.log('📅 Starting schedules data refresh with OAuth2 client credentials...');
        
        const CLIENT_ID = 'radian-limited';
        const CLIENT_SECRET = 'viewable-SALAMI-net-mortician-Fever-asparagus';
        
        // Endurance series from config
        const enduranceSeriesIds = [331, 419, 237, 451, 275];
        const enduranceSeriesNames = {
            "331": "Global Endurance Tour",
            "419": "IMSA Endurance Series", 
            "237": "GT Endurance Series by Simucube",
            "451": "Creventic Endurance Series",
            "275": "Nurburgring Endurance Championship"
        };
        
        // Step 1: Get OAuth2 access token
        console.log('🔐 Getting OAuth2 access token...');
        
        const authFormData = new FormData();
        authFormData.append('grant_type', 'client_credentials');
        authFormData.append('client_id', CLIENT_ID);
        authFormData.append('client_secret', CLIENT_SECRET);
        authFormData.append('scope', 'read');
        
        const authResponse = await fetch('https://members-ng.iracing.com/auth/oauth2/token', {
            method: 'POST',
            body: authFormData
        });
        
        if (!authResponse.ok) {
            throw new Error(`OAuth2 auth failed: ${authResponse.status}`);
        }
        
        const authData = await authResponse.json();
        console.log('✅ OAuth2 authentication successful');
        console.log('🔑 Access token expires:', authData.expires);
        
        // Step 2: Try to fetch series/seasons data
        console.log('📡 Fetching series/seasons data...');
        
        const seriesResponse = await fetch('https://members-ng.iracing.com/data/series/seasons', {
            headers: {
                'Authorization': `Bearer ${authData.access_token}`
            }
        });
        
        console.log('Series response status:', seriesResponse.status);
        
        if (!seriesResponse.ok) {
            throw new Error(`Series API failed: ${seriesResponse.status}`);
        }
        
        const seriesResult = await seriesResponse.json();
        
        // Handle link response
        let seriesData;
        if (seriesResult.link) {
            console.log('📡 Got series data link, fetching actual data...');
            const actualDataResponse = await fetch(seriesResult.link);
            seriesData = await actualDataResponse.json();
        } else {
            seriesData = seriesResult;
        }
        
        // Save the raw data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.writeFileSync(`series-seasons-data-${timestamp}.json`, JSON.stringify(seriesData, null, 2));
        
        console.log(`📁 Series/seasons data saved (${Array.isArray(seriesData) ? seriesData.length : 'unknown'} items)`);
        
        if (Array.isArray(seriesData) && seriesData.length > 0) {
            console.log('📋 Sample fields:', Object.keys(seriesData[0]));
            
            // Filter for endurance series
            const enduranceData = seriesData.filter(item => 
                enduranceSeriesIds.includes(item.series_id)
            );
            
            if (enduranceData.length > 0) {
                const enduranceFilename = `endurance-series-seasons-${timestamp}.json`;
                fs.writeFileSync(enduranceFilename, JSON.stringify(enduranceData, null, 2));
                
                console.log(`🏁 Endurance series/seasons saved to ${enduranceFilename}`);
                console.log(`📊 Endurance series found: ${enduranceData.length}`);
                
                enduranceData.forEach(series => {
                    const seriesName = enduranceSeriesNames[series.series_id] || 'Unknown';
                    console.log(`   - ${seriesName} (ID: ${series.series_id})`);
                    if (series.season_name) console.log(`     Season: ${series.season_name}`);
                });
                
                return enduranceData;
            }
        }
        
        console.log('✅ Series/seasons data fetched successfully');
        return seriesData;
        
    } catch (error) {
        console.error('❌ Error fetching schedules data:', error);
        
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        fs.writeFileSync(`schedules-oauth2-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify(errorData, null, 2));
    }
}

fetchSchedulesDataOAuth2();