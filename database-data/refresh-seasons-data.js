const iRacingAPIManager = require('./api-manager');
const config = require('./config.json');

/**
 * Refresh seasons data from iRacing API
 * Updates season information for endurance racing series
 */

async function refreshSeasonsData() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('🏁 Starting seasons data refresh...');
        console.log(`📊 Target series: ${Object.values(config.enduranceSeries).join(', ')}`);
        
        // Get current seasons
        console.log('📅 Fetching current seasons...');
        const seasonsResponse = await api.makeRequest('/data/series/seasons');
        
        if (!seasonsResponse || !Array.isArray(seasonsResponse)) {
            throw new Error('Invalid seasons response from API');
        }
        
        console.log(`📊 Retrieved ${seasonsResponse.length} total seasons`);
        
        // Filter for endurance series
        const enduranceSeriesIds = Object.keys(config.enduranceSeries).map(Number);
        const enduranceSeasons = seasonsResponse.filter(season => 
            enduranceSeriesIds.includes(season.series_id)
        );
        
        console.log(`🎯 Found ${enduranceSeasons.length} endurance seasons`);
        
        // Log found seasons
        enduranceSeasons.forEach(season => {
            const seriesName = config.enduranceSeries[season.series_id];
            console.log(`   ✅ ${seriesName} (${season.series_id}): ${season.season_name}`);
        });
        
        // Save the data
        const timestamp = new Date().toISOString();
        const filename = await api.saveDataFile(enduranceSeasons, 'seasons-data');
        
        // Generate summary
        const summary = {
            timestamp,
            totalSeasons: seasonsResponse.length,
            enduranceSeasons: enduranceSeasons.length,
            seriesFound: enduranceSeasons.map(s => ({
                series_id: s.series_id,
                series_name: config.enduranceSeries[s.series_id],
                season_name: s.season_name,
                active: s.active,
                multiclass: s.multiclass,
                driver_changes: s.driver_changes
            })),
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(summary, 'seasons-refresh-summary');
        
        console.log('\\n🎉 Seasons data refresh complete!');
        console.log(`📁 Data saved: ${filename}`);
        console.log(`📊 Summary: ${summary.enduranceSeasons} endurance seasons found`);
        
        return {
            success: true,
            seasonsFound: enduranceSeasons.length,
            filename,
            summary
        };
        
    } catch (error) {
        console.error('❌ Seasons refresh failed:', error.message);
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(errorLog, 'seasons-refresh-error');
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    refreshSeasonsData()
        .then(result => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = refreshSeasonsData;