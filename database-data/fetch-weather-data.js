const fs = require('fs');

async function fetchAndVisualizeWeatherData() {
    try {
        console.log('🌤️  Fetching weather forecast data...');
        
        const url = 'https://scorpio-assets.s3.amazonaws.com/members/messaging-services/non_expiring/weather-forecast/season/5765/rw2_evt5.json?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20251015T185748Z&X-Amz-SignedHeaders=host&X-Amz-Credential=AKIAUO6OO4A3WX3RTXUZ%2F20251015%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=604800&X-Amz-Signature=5956667466b7e9323323d783825a113ac48ae2460ae3db890c781c1ac5e7c393';
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const weatherData = await response.json();
        
        // Save raw data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `weather-data-season5765-rw2-evt5-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(weatherData, null, 2));
        
        console.log(`📁 Weather data saved to ${filename}`);
        console.log(`📊 Total forecast points: ${weatherData.length}`);
        
        // Analyze the data structure
        console.log('\\n🔍 Data Analysis:');
        console.log('================');
        
        if (weatherData.length > 0) {
            console.log('\\n📋 Available fields:');
            console.log(Object.keys(weatherData[0]).join(', '));
            
            // Time range analysis
            const timeOffsets = weatherData.map(d => d.time_offset);
            const minOffset = Math.min(...timeOffsets);
            const maxOffset = Math.max(...timeOffsets);
            
            console.log(`\\n⏰ Time Range:`);
            console.log(`   Start offset: ${minOffset} minutes (${(minOffset/60).toFixed(1)} hours)`);
            console.log(`   End offset: ${maxOffset} minutes (${(maxOffset/60).toFixed(1)} hours)`);
            console.log(`   Total duration: ${maxOffset - minOffset} minutes (${((maxOffset - minOffset)/60).toFixed(1)} hours)`);
            
            // Temperature analysis
            const airTemps = weatherData.map(d => d.air_temp);
            const minTemp = Math.min(...airTemps);
            const maxTemp = Math.max(...airTemps);
            
            console.log(`\\n🌡️  Temperature Range:`);
            console.log(`   Min: ${minTemp} (${(minTemp/100).toFixed(1)}°F)`);
            console.log(`   Max: ${maxTemp} (${(maxTemp/100).toFixed(1)}°F)`);
            console.log(`   Variation: ${maxTemp - minTemp} (${((maxTemp - minTemp)/100).toFixed(1)}°F)`);
            
            // Wind analysis
            const windSpeeds = weatherData.map(d => d.wind_speed);
            const minWind = Math.min(...windSpeeds);
            const maxWind = Math.max(...windSpeeds);
            
            console.log(`\\n💨 Wind Speed Range:`);
            console.log(`   Min: ${minWind} units`);
            console.log(`   Max: ${maxWind} units`);
            
            // Weather conditions
            const precipChances = weatherData.map(d => d.precip_chance);
            const maxPrecip = Math.max(...precipChances);
            const cloudCovers = weatherData.map(d => d.cloud_cover);
            const avgCloud = cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length;
            
            console.log(`\\n🌧️  Weather Conditions:`);
            console.log(`   Max precipitation chance: ${maxPrecip}%`);
            console.log(`   Average cloud cover: ${avgCloud.toFixed(0)}`);
            
            // Sample data points
            console.log(`\\n📈 Sample Data Points:`);
            console.log('====================');
            [0, Math.floor(weatherData.length/4), Math.floor(weatherData.length/2), Math.floor(3*weatherData.length/4), weatherData.length-1].forEach(i => {
                if (i < weatherData.length) {
                    const d = weatherData[i];
                    console.log(`\\nPoint ${i+1} (${d.time_offset} min offset):`);
                    console.log(`   Time: ${d.timestamp}`);
                    console.log(`   Temp: ${(d.air_temp/100).toFixed(1)}°F`);
                    console.log(`   Wind: ${d.wind_speed} @ ${d.wind_dir}°`);
                    console.log(`   Clouds: ${d.cloud_cover}, Precip: ${d.precip_chance}%`);
                    console.log(`   Sun: ${d.is_sun_up ? 'Up' : 'Down'}`);
                }
            });
        }
        
        return weatherData;
        
    } catch (error) {
        console.error('❌ Error fetching weather data:', error);
    }
}

fetchAndVisualizeWeatherData();