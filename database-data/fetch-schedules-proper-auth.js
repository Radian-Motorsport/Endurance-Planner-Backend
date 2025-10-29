const fs = require('fs');

/**
 * Fetch schedules data using the proper iRacing authentication method
 * Based on the working api-manager.js approach
 */

async function fetchSchedulesData() {
    try {
        console.log('📅 Starting schedules data refresh...');
        
        // Endurance series from config
        const enduranceSeriesIds = [331, 419, 237, 451, 275];
        const enduranceSeriesNames = {
            "331": "Global Endurance Tour",
            "419": "IMSA Endurance Series", 
            "237": "GT Endurance Series by Simucube",
            "451": "Creventic Endurance Series",
            "275": "Nurburgring Endurance Championship"
        };
        
        // Step 1: Get authentication token (authcode method)
        console.log('🔐 Authenticating with iRacing API...');
        const authResponse = await fetch('https://members-ng.iracing.com/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'radian-limited',
                password: 'asparagus',
                client_id: 'radian-limited'
            })
        });

        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        console.log('Auth response:', authData);
        
        if (!authData.authcode) {
            throw new Error('No authcode received in authentication response');
        }
        
        console.log('✅ Authentication successful - got authcode');

        // Step 2: Try schedules endpoint with authcode
        console.log('📡 Fetching series/seasons data...');
        
        const schedulesResponse = await fetch('https://members-ng.iracing.com/data/series/seasons', {
            headers: {
                'Authorization': `Bearer ${authData.authcode}`
            }
        });

        console.log('Schedules response status:', schedulesResponse.status);
        
        if (!schedulesResponse.ok) {
            // Try with different auth header format
            console.log('📡 Trying different auth header format...');
            const altResponse = await fetch('https://members-ng.iracing.com/data/series/seasons', {
                headers: {
                    'authcode': authData.authcode
                }
            });
            
            console.log('Alt response status:', altResponse.status);
            
            if (!altResponse.ok) {
                throw new Error(`Schedules API failed: ${schedulesResponse.status}`);
            }
            
            const result = await altResponse.json();
            await processSchedulesData(result, enduranceSeriesIds, enduranceSeriesNames);
            return result;
        }

        const result = await schedulesResponse.json();
        await processSchedulesData(result, enduranceSeriesIds, enduranceSeriesNames);
        return result;
        
    } catch (error) {
        console.error('❌ Error fetching schedules data:', error);
        
        const errorData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        fs.writeFileSync(`schedules-refresh-error-proper-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify(errorData, null, 2));
    }
}

async function processSchedulesData(result, enduranceSeriesIds, enduranceSeriesNames) {
    // Handle link response
    let actualData;
    if (result.link) {
        console.log('📡 Got data link, fetching actual schedules data...');
        const actualDataResponse = await fetch(result.link);
        actualData = await actualDataResponse.json();
    } else {
        actualData = result;
    }

    // Save the raw data
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `schedules-raw-data-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(actualData, null, 2));
    
    console.log(`📁 Raw schedules data saved to ${filename}`);
    console.log(`📊 Data type:`, typeof actualData);
    console.log(`📊 Array length:`, Array.isArray(actualData) ? actualData.length : 'Not an array');
    
    if (Array.isArray(actualData) && actualData.length > 0) {
        console.log('📋 Sample fields:', Object.keys(actualData[0]));
        
        // Filter for endurance series
        const enduranceData = actualData.filter(item => 
            enduranceSeriesIds.includes(item.series_id)
        );
        
        if (enduranceData.length > 0) {
            const enduranceFilename = `endurance-schedules-${timestamp}.json`;
            fs.writeFileSync(enduranceFilename, JSON.stringify(enduranceData, null, 2));
            
            console.log(`🏁 Endurance schedules saved to ${enduranceFilename}`);
            console.log(`📊 Endurance series found: ${enduranceData.length}`);
            
            enduranceData.forEach(series => {
                const seriesName = enduranceSeriesNames[series.series_id] || 'Unknown';
                console.log(`   - ${seriesName} (ID: ${series.series_id})`);
            });
            
            return enduranceData;
        }
    }
}

fetchSchedulesData();