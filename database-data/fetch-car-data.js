const axios = require('axios');
const fs = require('fs');

/**
 * Fetch car data and car assets from the AWS S3 links
 */

async function fetchCarData() {
    try {
        console.log('🏎️  Fetching car data from AWS S3 links...');
        
        // Find the car data response files
        const files = fs.readdirSync('.').filter(f => f.startsWith('car-'));
        console.log('📁 Found car files:', files);
        
        const carDataFile = files.find(f => f.includes('car-data-'));
        const carAssetsFile = files.find(f => f.includes('car-assets-response-'));
        
        if (!carDataFile) {
            throw new Error('No car data response file found');
        }
        
        // Fetch car data (main car information)
        console.log('\n🚗 Fetching car data...');
        const carDataResponse = JSON.parse(fs.readFileSync(carDataFile, 'utf8'));
        console.log('🔗 Car data URL:', carDataResponse.link);
        
        const now = new Date();
        const carDataExpiry = new Date(carDataResponse.expires);
        
        if (now > carDataExpiry) {
            throw new Error('Car data link has expired');
        }
        
        console.log(`✅ Car data link valid for ${Math.round((carDataExpiry - now) / 1000)} more seconds`);
        
        const carDataResult = await axios.get(carDataResponse.link, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Car data fetched successfully');
        console.log('📊 Car data analysis:');
        console.log('   Type:', typeof carDataResult.data);
        
        const carData = carDataResult.data;
        
        if (Array.isArray(carData)) {
            console.log(`   Found ${carData.length} cars`);
            if (carData.length > 0) {
                console.log('   Sample car keys:', Object.keys(carData[0]));
                console.log('\n📋 Sample car:');
                console.log(JSON.stringify(carData[0], null, 2));
            }
        } else if (typeof carData === 'object') {
            console.log('   Object keys:', Object.keys(carData));
        }
        
        // Save car data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const carDataOutputFile = `car-main-data-${timestamp}.json`;
        fs.writeFileSync(carDataOutputFile, JSON.stringify(carData, null, 2));
        console.log(`💾 Car data saved to: ${carDataOutputFile}`);
        
        // Fetch car assets data if available
        let carAssetsData = null;
        if (carAssetsFile) {
            console.log('\n🖼️  Fetching car assets data...');
            const carAssetsResponse = JSON.parse(fs.readFileSync(carAssetsFile, 'utf8'));
            console.log('🔗 Car assets URL:', carAssetsResponse.link);
            
            const carAssetsExpiry = new Date(carAssetsResponse.expires);
            
            if (now < carAssetsExpiry) {
                console.log(`✅ Car assets link valid for ${Math.round((carAssetsExpiry - now) / 1000)} more seconds`);
                
                const carAssetsResult = await axios.get(carAssetsResponse.link, {
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                carAssetsData = carAssetsResult.data;
                console.log('✅ Car assets data fetched successfully');
                console.log('📊 Car assets analysis:');
                console.log('   Type:', typeof carAssetsData);
                
                if (typeof carAssetsData === 'object') {
                    const carAssetIds = Object.keys(carAssetsData);
                    console.log(`   Found ${carAssetIds.length} cars with asset data`);
                    
                    if (carAssetIds.length > 0) {
                        const firstCarAsset = carAssetsData[carAssetIds[0]];
                        console.log('   Sample car asset keys:', Object.keys(firstCarAsset));
                        
                        // Look for useful fields
                        const imageFields = Object.keys(firstCarAsset).filter(key => 
                            key.toLowerCase().includes('image') || 
                            key.toLowerCase().includes('logo') ||
                            key.toLowerCase().includes('folder')
                        );
                        
                        console.log('   Image/asset fields:', imageFields);
                    }
                }
                
                // Save car assets data
                const carAssetsOutputFile = `car-assets-final-${timestamp}.json`;
                fs.writeFileSync(carAssetsOutputFile, JSON.stringify(carAssetsData, null, 2));
                console.log(`💾 Car assets data saved to: ${carAssetsOutputFile}`);
                
            } else {
                console.log('❌ Car assets link has expired');
            }
        }
        
        console.log('\n📊 Summary:');
        console.log('✅ Car data: Retrieved and saved');
        console.log(carAssetsData ? '✅ Car assets: Retrieved and saved' : '❌ Car assets: Not available or expired');
        
        return { carData, carAssetsData };
        
    } catch (error) {
        console.error('❌ Failed to fetch car data:', error.message);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    fetchCarData()
        .then((result) => {
            if (result) {
                console.log('\n🎉 Car data fetch completed successfully!');
            } else {
                console.log('\n💥 Car data fetch failed');
            }
        })
        .catch(console.error);
}

module.exports = fetchCarData;