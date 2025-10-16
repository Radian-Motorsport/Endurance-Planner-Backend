const iRacingAPIManager = require('./api-manager');
const config = require('./config.json');

/**
 * Refresh drivers data from iRacing API
 * Updates team member information and stats
 */

async function refreshDriversData() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('👥 Starting drivers data refresh...');
        console.log(`📊 Target team members: ${config.teamMembers.length} drivers`);
        
        // Fetch team member data
        console.log('📊 Fetching team member data...');
        const memberIds = config.teamMembers.join(',');
        
        const driversResponse = await api.makeRequest('/data/member/get', {
            cust_ids: memberIds
        });
        
        if (!driversResponse || !driversResponse.members || !Array.isArray(driversResponse.members)) {
            throw new Error('Invalid drivers response from API');
        }
        
        console.log(`📊 Retrieved data for ${driversResponse.members.length} drivers`);
        
        // Process driver data
        const processedDrivers = driversResponse.members.map(driver => ({
            cust_id: driver.cust_id,
            display_name: driver.display_name,
            first_name: driver.first_name,
            last_name: driver.last_name,
            email: driver.email,
            location: {
                country: driver.location?.country,
                state: driver.location?.state,
                timezone: driver.location?.timezone
            },
            licenses: driver.licenses,
            irating: driver.irating,
            tt_rating: driver.tt_rating,
            pro_promotable: driver.pro_promotable,
            member_since: driver.member_since,
            last_login: driver.last_login,
            years_pro: driver.years_pro,
            helmet: driver.helmet,
            suit: driver.suit,
            car_number: driver.car_number,
            club_name: driver.club_name,
            club_id: driver.club_id,
            recent_awards: driver.recent_awards,
            ai_enabled: driver.ai_enabled
        }));
        
        // Sort by iRating for better overview
        processedDrivers.sort((a, b) => (b.irating || 0) - (a.irating || 0));
        
        // Save the data
        const timestamp = new Date().toISOString();
        const filename = await api.saveDataFile(driversResponse, 'radian-team-data');
        const processedFilename = await api.saveDataFile(processedDrivers, 'radian-team-processed');
        
        // Generate summary stats
        const iRatings = processedDrivers.map(d => d.irating || 0).filter(r => r > 0);
        const avgIRating = iRatings.length > 0 ? Math.round(iRatings.reduce((a, b) => a + b, 0) / iRatings.length) : 0;
        const maxIRating = Math.max(...iRatings);
        const minIRating = Math.min(...iRatings);
        
        // License analysis
        const licenseStats = {};
        processedDrivers.forEach(driver => {
            if (driver.licenses && driver.licenses.length > 0) {
                // Find road license (category_id: 2)
                const roadLicense = driver.licenses.find(lic => lic.category_id === 2);
                if (roadLicense) {
                    const licenseLevel = roadLicense.license_level;
                    licenseStats[licenseLevel] = (licenseStats[licenseLevel] || 0) + 1;
                }
            }
        });
        
        // Country distribution
        const countries = {};
        processedDrivers.forEach(driver => {
            const country = driver.location?.country || 'Unknown';
            countries[country] = (countries[country] || 0) + 1;
        });
        
        const summary = {
            timestamp,
            totalDrivers: processedDrivers.length,
            requestedDrivers: config.teamMembers.length,
            missingDrivers: config.teamMembers.length - processedDrivers.length,
            iRatingStats: {
                average: avgIRating,
                highest: maxIRating,
                lowest: minIRating,
                driversWithRating: iRatings.length
            },
            licenseDistribution: licenseStats,
            countryDistribution: countries,
            topDrivers: processedDrivers.slice(0, 10).map(d => ({
                name: d.display_name,
                cust_id: d.cust_id,
                irating: d.irating,
                location: d.location?.country
            })),
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(summary, 'drivers-refresh-summary');
        
        console.log('\\n🎉 Drivers data refresh complete!');
        console.log(`📁 Raw data: ${filename}`);
        console.log(`📁 Processed data: ${processedFilename}`);
        console.log(`📊 Summary: ${processedDrivers.length}/${config.teamMembers.length} drivers retrieved`);
        
        // Log team stats
        console.log('\\n📊 Team Statistics:');
        console.log(`   Average iRating: ${avgIRating}`);
        console.log(`   Highest iRating: ${maxIRating}`);
        console.log(`   Lowest iRating: ${minIRating}`);
        
        console.log('\\n🏆 License Distribution:');
        Object.entries(licenseStats).forEach(([level, count]) => {
            const levelNames = {
                1: 'Rookie', 2: 'D', 3: 'C', 4: 'B', 5: 'A', 6: 'Pro'
            };
            console.log(`   ${levelNames[level] || level}: ${count} drivers`);
        });
        
        console.log('\\n🌍 Country Distribution:');
        Object.entries(countries)
            .sort(([,a], [,b]) => b - a)
            .forEach(([country, count]) => {
                console.log(`   ${country}: ${count} drivers`);
            });
        
        console.log('\\n🏁 Top 5 Drivers:');
        processedDrivers.slice(0, 5).forEach((driver, index) => {
            console.log(`   ${index + 1}. ${driver.display_name} (${driver.irating || 'N/A'} iR)`);
        });
        
        return {
            success: true,
            driversRetrieved: processedDrivers.length,
            driversRequested: config.teamMembers.length,
            filename,
            processedFilename,
            summary
        };
        
    } catch (error) {
        console.error('❌ Drivers refresh failed:', error.message);
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(errorLog, 'drivers-refresh-error');
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    refreshDriversData()
        .then(result => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = refreshDriversData;