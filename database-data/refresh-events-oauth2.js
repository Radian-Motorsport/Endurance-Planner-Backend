const fs = require('fs');

/**
 * Fetch fresh events/schedules data using OAuth2 and update existing events
 * This replaces the environment variable approach with direct OAuth2 authentication
 */

async function refreshEventsData() {
    try {
        console.log('🏁 Starting events data refresh with OAuth2...');
        
        // Step 1: Get OAuth2 token
        console.log('🔐 Authenticating with iRacing...');
        const authResponse = await fetch('https://members-ng.iracing.com/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'radian-limited',
                password: 'asparagus'
            })
        });

        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        console.log('✅ Authentication successful');
        console.log('🔑 Token expires:', authData.expires);

        // Step 2: Try to get current season data first
        console.log('📅 Fetching current season data...');
        
        // Try the series endpoint that worked for tracks
        const seriesResponse = await fetch('https://members-ng.iracing.com/data/series/get', {
            headers: {
                'Authorization': `Bearer ${authData.access_token}`
            }
        });

        console.log('Series response status:', seriesResponse.status);
        
        if (seriesResponse.ok) {
            const seriesResult = await seriesResponse.json();
            
            // Handle link response
            let seriesData;
            if (seriesResult.link) {
                console.log('📡 Got series data link, fetching...');
                const actualResponse = await fetch(seriesResult.link);
                seriesData = await actualResponse.json();
            } else {
                seriesData = seriesResult;
            }
            
            // Save series data
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            fs.writeFileSync(`series-data-oauth2-${timestamp}.json`, JSON.stringify(seriesData, null, 2));
            
            console.log(`📁 Series data saved (${Array.isArray(seriesData) ? seriesData.length : 'unknown'} series)`);
            
            // Now try to get season/schedule data
            console.log('📅 Fetching season schedules...');
            
            // Try season endpoint
            const seasonResponse = await fetch('https://members-ng.iracing.com/data/season/list', {
                headers: {
                    'Authorization': `Bearer ${authData.access_token}`
                }
            });
            
            console.log('Season response status:', seasonResponse.status);
            
            if (seasonResponse.ok) {
                const seasonResult = await seasonResponse.json();
                
                let seasonData;
                if (seasonResult.link) {
                    console.log('📡 Got season data link, fetching...');
                    const actualSeasonResponse = await fetch(seasonResult.link);
                    seasonData = await actualSeasonResponse.json();
                } else {
                    seasonData = seasonResult;
                }
                
                // Save season data
                fs.writeFileSync(`season-data-oauth2-${timestamp}.json`, JSON.stringify(seasonData, null, 2));
                
                console.log(`📁 Season data saved (${Array.isArray(seasonData) ? seasonData.length : 'unknown'} seasons)`);
                console.log('✅ Events data refresh completed successfully');
                
                return { series: seriesData, seasons: seasonData };
            }
        }
        
        throw new Error('Failed to fetch series/season data');
        
    } catch (error) {
        console.error('❌ Error refreshing events data:', error);
        
        // Save error for debugging
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        fs.writeFileSync(`events-refresh-error-oauth2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify(errorData, null, 2));
    }
}

refreshEventsData();