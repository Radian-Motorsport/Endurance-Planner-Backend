const fs = require('fs');

/**
 * Fetch schedules data using OAuth2 for endurance series
 * Based on the existing refresh-schedules-data.js but with OAuth2 auth
 */

async function fetchSchedulesData() {
    try {
        console.log('📅 Starting schedules data refresh with OAuth2...');
        
        // Endurance series from config
        const enduranceSeriesIds = [331, 419, 237, 451, 275];
        const enduranceSeriesNames = {
            "331": "Global Endurance Tour",
            "419": "IMSA Endurance Series", 
            "237": "GT Endurance Series by Simucube",
            "451": "Creventic Endurance Series",
            "275": "Nurburgring Endurance Championship"
        };
        
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

        // Step 2: Try different schedule endpoints
        const endpoints = [
            '/data/series/seasons',
            '/data/season/list', 
            '/data/series/get',
            '/data/season/race_guide'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`\\n📡 Trying endpoint: ${endpoint}`);
                
                const response = await fetch(`https://members-ng.iracing.com${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${authData.access_token}`
                    }
                });

                console.log(`   Status: ${response.status}`);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // Handle link response
                    let actualData;
                    if (result.link) {
                        console.log('   📡 Got data link, fetching actual data...');
                        const actualDataResponse = await fetch(result.link);
                        actualData = await actualDataResponse.json();
                    } else {
                        actualData = result;
                    }

                    // Save the raw data
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `schedules-${endpoint.replace(/[\/]/g, '-')}-${timestamp}.json`;
                    
                    fs.writeFileSync(filename, JSON.stringify(actualData, null, 2));
                    
                    console.log(`   📁 Raw data saved to ${filename}`);
                    console.log(`   📊 Data type:`, typeof actualData);
                    console.log(`   📊 Array length:`, Array.isArray(actualData) ? actualData.length : 'Not an array');
                    
                    if (Array.isArray(actualData) && actualData.length > 0) {
                        console.log('   📋 Sample fields:', Object.keys(actualData[0]));
                        
                        // Filter for endurance series if this looks like schedules/seasons data
                        if (actualData[0].series_id !== undefined) {
                            const enduranceData = actualData.filter(item => 
                                enduranceSeriesIds.includes(item.series_id)
                            );
                            
                            if (enduranceData.length > 0) {
                                const enduranceFilename = `endurance-schedules-${timestamp}.json`;
                                fs.writeFileSync(enduranceFilename, JSON.stringify(enduranceData, null, 2));
                                
                                console.log(`   🏁 Endurance data filtered and saved to ${enduranceFilename}`);
                                console.log(`   📊 Endurance series found: ${enduranceData.length}`);
                                
                                enduranceData.forEach(series => {
                                    const seriesName = enduranceSeriesNames[series.series_id] || 'Unknown';
                                    console.log(`      - ${seriesName} (ID: ${series.series_id})`);
                                });
                                
                                return enduranceData;
                            }
                        }
                    }
                    
                    console.log(`   ✅ Success with endpoint: ${endpoint}`);
                    return actualData;
                }
            } catch (error) {
                console.log(`   ❌ Failed with ${endpoint}:`, error.message);
            }
        }
        
        throw new Error('All schedule endpoints failed');
        
    } catch (error) {
        console.error('❌ Error fetching schedules data:', error);
        
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        fs.writeFileSync(`schedules-refresh-error-oauth2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify(errorData, null, 2));
    }
}

fetchSchedulesData();