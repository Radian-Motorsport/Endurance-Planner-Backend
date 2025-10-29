const fs = require('fs');

async function fetchEventsData() {
    try {
        console.log('🏁 Fetching fresh events data from iRacing API...');
        
        // Step 1: Get OAuth2 token
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

        // Try different endpoints
        const endpoints = [
            '/data/series/get',
            '/data/season/list',
            '/data/series/seasons',
            '/data/season/race_guide'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`📡 Trying endpoint: ${endpoint}`);
                
                const response = await fetch(`https://members-ng.iracing.com${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${authData.access_token}`
                    }
                });

                console.log(`Status: ${response.status}`);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // Check if we got a link or direct data
                    let actualData;
                    if (result.link) {
                        console.log('📡 Got data link, fetching actual data...');
                        const actualDataResponse = await fetch(result.link);
                        actualData = await actualDataResponse.json();
                    } else {
                        actualData = result;
                    }

                    // Save the data
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `events-data-${endpoint.replace(/[\/]/g, '-')}-${timestamp}.json`;
                    
                    fs.writeFileSync(filename, JSON.stringify(actualData, null, 2));
                    
                    console.log(`📁 Data saved to ${filename}`);
                    console.log(`📊 Data type:`, typeof actualData);
                    console.log(`📊 Data length:`, Array.isArray(actualData) ? actualData.length : 'Not an array');
                    
                    if (Array.isArray(actualData) && actualData.length > 0) {
                        console.log('📋 Sample fields:', Object.keys(actualData[0]));
                    }
                    
                    console.log('✅ Success with endpoint:', endpoint);
                    return actualData;
                }
            } catch (error) {
                console.log(`❌ Failed with ${endpoint}:`, error.message);
            }
        }
        
        throw new Error('All endpoints failed');
        
    } catch (error) {
        console.error('❌ Error fetching events data:', error);
        fs.writeFileSync(`events-refresh-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }, null, 2));
    }
}

fetchEventsData();