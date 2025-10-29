const iRacingAPIManager = require('./api-manager');
const config = require('./config.json');

/**
 * Refresh tracks data from iRacing API
 * Updates complete track database information
 */

async function refreshTracksData() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('🏁 Starting tracks data refresh...');
        
        // Get all tracks
        console.log('🗺️  Fetching tracks data...');
        const tracksResponse = await api.makeRequest('/data/track');
        
        if (!tracksResponse || !Array.isArray(tracksResponse)) {
            throw new Error('Invalid tracks response from API');
        }
        
        console.log(`📊 Retrieved ${tracksResponse.length} tracks`);
        
        // Filter for road racing tracks (endurance focus)
        const roadTracks = tracksResponse.filter(track => 
            track.category === 'road'
        );
        
        console.log(`🛣️  Found ${roadTracks.length} road racing tracks`);
        
        // Filter for active tracks
        const activeTracks = tracksResponse.filter(track => 
            !track.retired
        );
        
        console.log(`✅ Found ${activeTracks.length} active tracks`);
        
        // Save all tracks data
        const timestamp = new Date().toISOString();
        const allTracksFilename = await api.saveDataFile(tracksResponse, 'tracks-data');
        
        // Save road tracks only
        const roadTracksFilename = await api.saveDataFile(roadTracks, 'road-tracks-data');
        
        // Generate detailed summary
        const tracksByCategory = {};
        const tracksByLocation = {};
        const configCounts = {};
        
        tracksResponse.forEach(track => {
            // Count by category
            const category = track.category || 'unknown';
            tracksByCategory[category] = (tracksByCategory[category] || 0) + 1;
            
            // Count by location
            const location = track.location || 'Unknown';
            tracksByLocation[location] = (tracksByLocation[location] || 0) + 1;
            
            // Count configurations per track name
            const trackName = track.track_name || 'Unknown';
            configCounts[trackName] = (configCounts[trackName] || 0) + 1;
        });
        
        // Find tracks with most configurations
        const topConfiguredTracks = Object.entries(configCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        const summary = {
            timestamp,
            totalTracks: tracksResponse.length,
            roadTracks: roadTracks.length,
            activeTracks: activeTracks.length,
            retiredTracks: tracksResponse.filter(t => t.retired).length,
            tracksByCategory,
            tracksByLocation: Object.entries(tracksByLocation)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 15), // Top 15 locations
            topConfiguredTracks,
            sampleTracks: roadTracks.slice(0, 10).map(track => ({
                track_id: track.track_id,
                track_name: track.track_name,
                config_name: track.config_name,
                location: track.location,
                category: track.category,
                rain_enabled: track.rain_enabled,
                night_lighting: track.night_lighting
            })),
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(summary, 'tracks-refresh-summary');
        
        console.log('\\n🎉 Tracks data refresh complete!');
        console.log(`📁 All tracks: ${allTracksFilename}`);
        console.log(`📁 Road tracks: ${roadTracksFilename}`);
        console.log(`📊 Summary: ${tracksResponse.length} total tracks, ${roadTracks.length} road tracks`);
        
        // Log category stats
        console.log('\\n📊 Tracks by category:');
        Object.entries(tracksByCategory).forEach(([category, count]) => {
            console.log(`   ${category}: ${count} tracks`);
        });
        
        // Log top locations
        console.log('\\n🌍 Top track locations:');
        Object.entries(tracksByLocation)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([location, count]) => {
                console.log(`   ${location}: ${count} tracks`);
            });
        
        // Log most configured tracks
        console.log('\\n🏗️  Most configured tracks:');
        topConfiguredTracks.slice(0, 5).forEach(([name, count]) => {
            console.log(`   ${name}: ${count} configurations`);
        });
        
        return {
            success: true,
            totalTracks: tracksResponse.length,
            roadTracks: roadTracks.length,
            allTracksFilename,
            roadTracksFilename,
            summary
        };
        
    } catch (error) {
        console.error('❌ Tracks refresh failed:', error.message);
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(errorLog, 'tracks-refresh-error');
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    refreshTracksData()
        .then(result => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = refreshTracksData;