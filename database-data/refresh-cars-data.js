const iRacingAPIManager = require('./api-manager');
const config = require('./config.json');

/**
 * Refresh cars data from iRacing API
 * Updates complete car database information
 */

async function refreshCarsData() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('🏎️  Starting cars data refresh...');
        
        // Get all car classes (which contain individual cars)
        console.log('📊 Fetching car classes data...');
        const carClassesResponse = await api.makeRequest('/data/carclass');
        
        if (!carClassesResponse || !Array.isArray(carClassesResponse)) {
            throw new Error('Invalid car classes response from API');
        }
        
        console.log(`📊 Retrieved ${carClassesResponse.length} car classes`);
        
        // Extract all individual cars from car classes
        let allCars = [];
        carClassesResponse.forEach(carClass => {
            if (carClass.cars && Array.isArray(carClass.cars)) {
                carClass.cars.forEach(car => {
                    // Add car class info to each car
                    allCars.push({
                        ...car,
                        car_class_id: carClass.car_class_id,
                        car_class_name: carClass.name,
                        car_class_short_name: carClass.short_name,
                        relative_speed: carClass.relative_speed,
                        car_class_power_adjust_allowed: carClass.power_adjust_allowed,
                        car_class_weight_penalty_allowed: carClass.weight_penalty_allowed
                    });
                });
            }
        });
        
        console.log(`🚗 Found ${allCars.length} total cars`);
        
        // Filter for racing cars (exclude AI, etc.)
        const racingCars = allCars.filter(car => 
            car.categories && 
            car.categories.some(cat => cat.category === 'road' || cat.category === 'sports_car')
        );
        
        console.log(`🏁 Found ${racingCars.length} road/sports cars`);
        
        // Save all cars data
        const timestamp = new Date().toISOString();
        const allCarsFilename = await api.saveDataFile(allCars, 'car-classes-data');
        
        // Save racing-only cars data
        const racingCarsFilename = await api.saveDataFile(racingCars, 'racing-cars-data');
        
        // Generate detailed summary
        const carsByCategory = {};
        const carsByManufacturer = {};
        
        racingCars.forEach(car => {
            // Count by categories
            if (car.categories) {
                car.categories.forEach(cat => {
                    carsByCategory[cat.category] = (carsByCategory[cat.category] || 0) + 1;
                });
            }
            
            // Count by manufacturer
            const make = car.car_make || 'Unknown';
            carsByManufacturer[make] = (carsByManufacturer[make] || 0) + 1;
        });
        
        const summary = {
            timestamp,
            totalCars: allCars.length,
            racingCars: racingCars.length,
            carClasses: carClassesResponse.length,
            carsByCategory,
            carsByManufacturer,
            sampleCars: racingCars.slice(0, 10).map(car => ({
                car_id: car.car_id,
                car_name: car.car_name,
                car_make: car.car_make,
                hp: car.hp,
                categories: car.categories
            })),
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(summary, 'cars-refresh-summary');
        
        console.log('\\n🎉 Cars data refresh complete!');
        console.log(`📁 All cars: ${allCarsFilename}`);
        console.log(`📁 Racing cars: ${racingCarsFilename}`);
        console.log(`📊 Summary: ${allCars.length} total cars, ${racingCars.length} racing cars`);
        
        // Log some category stats
        console.log('\\n📊 Cars by category:');
        Object.entries(carsByCategory).forEach(([category, count]) => {
            console.log(`   ${category}: ${count} cars`);
        });
        
        console.log('\\n🏭 Top manufacturers:');
        Object.entries(carsByManufacturer)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([make, count]) => {
                console.log(`   ${make}: ${count} cars`);
            });
        
        return {
            success: true,
            totalCars: allCars.length,
            racingCars: racingCars.length,
            allCarsFilename,
            racingCarsFilename,
            summary
        };
        
    } catch (error) {
        console.error('❌ Cars refresh failed:', error.message);
        
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            rateLimitStatus: api.getRateLimitStatus()
        };
        
        await api.saveDataFile(errorLog, 'cars-refresh-error');
        
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    refreshCarsData()
        .then(result => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = refreshCarsData;