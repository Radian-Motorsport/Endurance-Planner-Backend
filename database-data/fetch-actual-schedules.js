const fs = require('fs');

async function fetchActualSchedulesData() {
    try {
        // Read the response with the link
        const linkData = JSON.parse(fs.readFileSync('series-seasons-oauth2-2025-10-17T22-18-16-484Z.json', 'utf8'));
        
        console.log('📡 Fetching actual schedules data from S3 link...');
        
        // Fetch the actual schedules data
        const response = await fetch(linkData.link);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const schedulesData = await response.json();
        
        // Save the actual schedules data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `actual-schedules-data-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(schedulesData, null, 2));
        
        console.log(`📁 Schedules data saved to ${filename}`);
        console.log(`📊 Number of series/seasons: ${schedulesData.length}`);
        
        // Endurance series config
        const enduranceSeriesIds = [331, 419, 237, 451, 275];
        const enduranceSeriesNames = {
            "331": "Global Endurance Tour",
            "419": "IMSA Endurance Series", 
            "237": "GT Endurance Series by Simucube",
            "451": "Creventic Endurance Series",
            "275": "Nurburgring Endurance Championship"
        };
        
        // Filter for endurance series
        const enduranceData = schedulesData.filter(item => 
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
                if (series.season_name) console.log(`     Season: ${series.season_name}`);
                if (series.schedules) console.log(`     Schedules: ${series.schedules.length} events`);
            });
        }
        
        return schedulesData;
        
    } catch (error) {
        console.error('❌ Error fetching actual schedules data:', error);
    }
}

fetchActualSchedulesData();