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
        console.log('🔑 Access token expires:', authData.expires);

        // Step 2: Fetch events/series data
        const eventsResponse = await fetch('https://members-ng.iracing.com/data/series/seasons', {
            headers: {
                'Authorization': `Bearer ${authData.access_token}`
            }
        });

        if (!eventsResponse.ok) {
            throw new Error(`Events API failed: ${eventsResponse.status}`);
        }

        const eventsResult = await eventsResponse.json();
        
        // Check if we got a link or direct data
        let eventsData;
        if (eventsResult.link) {
            console.log('📡 Got data link, fetching actual events data...');
            const actualDataResponse = await fetch(eventsResult.link);
            eventsData = await actualDataResponse.json();
        } else {
            eventsData = eventsResult;
        }

        // Save the data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `events-data-oauth2-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(eventsData, null, 2));
        
        console.log(`📁 Events data saved to ${filename}`);
        console.log(`📊 Number of series/seasons: ${eventsData.length}`);
        
        return eventsData;
        
    } catch (error) {
        console.error('❌ Error fetching events data:', error);
        fs.writeFileSync(`events-refresh-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, 
                         JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }, null, 2));
    }
}

fetchEventsData();