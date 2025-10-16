const iRacingAPIManager = require('./api-manager');
const config = require('./config.json');

/**
 * Refresh schedules data from iRacing API
 * Updates race schedules for endurance racing series
 */

async function refreshSchedulesData() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('📅 Starting schedules data refresh...');
        
        // First get current seasons to know which season IDs to fetch schedules for
        console.log('🔍 Getting current endurance seasons...');
        const seasonsResponse = await api.makeRequest('/data/series/seasons');
        
        const enduranceSeriesIds = Object.keys(config.enduranceSeries).map(Number);
        const enduranceSeasons = seasonsResponse.filter(season => 
            enduranceSeriesIds.includes(season.series_id) && season.active
        );
        
        console.log(`📊 Found ${enduranceSeasons.length} active endurance seasons`);
        
        const schedulesData = {};
        let totalSchedules = 0;
        
        // Fetch schedules for each season
        for (const season of enduranceSeasons) {
            try {
                const seriesName = config.enduranceSeries[season.series_id];
                console.log(`\\n🏁 Fetching schedules for ${seriesName}...`);
                console.log(`   Season: ${season.season_name} (ID: ${season.season_id})`);
                
                // Rate limit check
                const rateLimitStatus = api.getRateLimitStatus();
                if (rateLimitStatus.requestsRemaining <= 0) {
                    console.log('⏱️  Rate limit reached, stopping here');
                    break;
                }
                
                // Fetch schedule for this season
                const scheduleResponse = await api.makeRequest('/data/series/seasons', {
                    season_id: season.season_id,
                    include_schedules: true
                });
                
                if (scheduleResponse && scheduleResponse.schedules) {
                    schedulesData[season.season_id] = {
                        season: season,
                        schedule: scheduleResponse,
                        seriesName: seriesName
                    };
                    
                    const scheduleCount = scheduleResponse.schedules ? scheduleResponse.schedules.length : 0;
                    totalSchedules += scheduleCount;
                    
                    console.log(`   ✅ Retrieved ${scheduleCount} race weeks`);
                } else {
                    console.log(`   ⚠️  No schedules found for season ${season.season_id}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Failed to fetch schedule for season ${season.season_id}:`, error.message);
                continue;
            }
        }
        
        // Save the combined schedules data
        const timestamp = new Date().toISOString();
        const filename = await api.saveDataFile(schedulesData, 'schedules-data');
        
        // Generate summary
        const summary = {
            timestamp,
            totalSeasons: enduranceSeasons.length,
            seasonsWithSchedules: Object.keys(schedulesData).length,
            totalSchedules,
            seriesProcessed: Object.values(schedulesData).map(data => ({
                series_id: data.season.series_id,
                series_name: data.seriesName,
                season_id: data.season.season_id,
                season_name: data.season.season_name,
                schedules_count: data.schedule.schedules ? data.schedule.schedules.length : 0
            })),
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(summary, 'schedules-refresh-summary');
        
        console.log('\\n🎉 Schedules data refresh complete!');
        console.log(`📁 Data saved: ${filename}`);
        console.log(`📊 Summary: ${Object.keys(schedulesData).length} seasons with ${totalSchedules} total race weeks`);
        
        return {
            success: true,
            seasonsProcessed: Object.keys(schedulesData).length,
            totalSchedules,
            filename,
            summary
        };
        
    } catch (error) {
        console.error('❌ Schedules refresh failed:', error.message);
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(errorLog, 'schedules-refresh-error');
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    refreshSchedulesData()
        .then(result => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = refreshSchedulesData;