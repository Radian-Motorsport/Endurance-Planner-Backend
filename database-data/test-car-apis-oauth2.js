const iRacingOAuth2Client = require('../iracing-development/iracing-oauth2-client.js');

/**
 * Test iRacing Car API endpoints using OAuth2 client
 * Tests both /data/car/get and /data/car/assets
 */

async function testCarAPIsOAuth2() {
    try {
        console.log('🏎️  Testing iRacing Car API endpoints with OAuth2...');
        console.log('📊 Endpoints: /data/car/get and /data/car/assets');
        console.log('');
        
        // Initialize OAuth2 client
        const CLIENT_ID = 'radian-limited';
        const CLIENT_SECRET = 'viewable-SALAMI-net-mortician-Fever-asparagus';
        
        const client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
        
        // Load credentials
        const credentials = require('../iracing-development/iracing-credentials.js');
        
        // Authenticate
        console.log('🔐 Authenticating with OAuth2...');
        const authSuccess = await client.authenticate(
            credentials.credentials.email,
            credentials.credentials.password
        );
        
        if (!authSuccess) {
            throw new Error('OAuth2 authentication failed');
        }
        
        console.log('✅ OAuth2 authentication successful');
        
        // Test car/get endpoint
        console.log('\n🚗 Testing /data/car/get endpoint...');
        const carData = await client.makeDataAPIRequest('/data/car/get');
        
        if (carData) {
            console.log('✅ Car data API call successful');
            console.log('📊 Car data analysis:');
            console.log('   Type:', typeof carData);
            
            if (Array.isArray(carData)) {
                console.log(`   Array length: ${carData.length}`);
                if (carData.length > 0) {
                    console.log('\n📋 First car structure:');
                    const firstCar = carData[0];
                    console.log('   Keys:', Object.keys(firstCar));
                    console.log('\n🔍 Sample car:');
                    console.log(JSON.stringify(firstCar, null, 2));
                }
            } else if (typeof carData === 'object') {
                console.log('   Object keys:', Object.keys(carData));
                
                for (const [key, value] of Object.entries(carData)) {
                    if (Array.isArray(value)) {
                        console.log(`   ${key}: Array of ${value.length} items`);
                        if (value.length > 0) {
                            console.log(`     Sample ${key} keys:`, Object.keys(value[0]));
                        }
                    } else {
                        console.log(`   ${key}: ${typeof value}`);
                    }
                }
            }
            
            // Save car data
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const carDataFile = `car-data-${timestamp}.json`;
            const fs = require('fs');
            fs.writeFileSync(carDataFile, JSON.stringify(carData, null, 2));
            console.log(`\n💾 Car data saved to: ${carDataFile}`);
        } else {
            console.log('❌ No car data received');
        }
        
        // Test car/assets endpoint
        console.log('\n🖼️  Testing /data/car/assets endpoint...');
        const carAssets = await client.makeDataAPIRequest('/data/car/assets');
        
        if (carAssets) {
            console.log('✅ Car assets API call successful');
            console.log('📊 Car assets analysis:');
            console.log('   Type:', typeof carAssets);
            
            if (typeof carAssets === 'object' && carAssets.link) {
                console.log('   Car assets response is a link (like track assets)');
                console.log('   Link:', carAssets.link);
                console.log('   Expires:', carAssets.expires);
                
                // Check if link is still valid and fetch the actual data
                const expiryTime = new Date(carAssets.expires);
                const now = new Date();
                
                if (now < expiryTime) {
                    console.log(`   ✅ Link is valid for ${Math.round((expiryTime - now) / 1000)} more seconds`);
                    
                    // Fetch the actual car assets data
                    console.log('\n🚀 Fetching actual car assets data...');
                    const axios = require('axios');
                    const assetsResponse = await axios.get(carAssets.link, {
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    const actualCarAssets = assetsResponse.data;
                    console.log('✅ Car assets data fetched successfully');
                    console.log('📊 Actual car assets analysis:');
                    console.log('   Type:', typeof actualCarAssets);
                    
                    if (typeof actualCarAssets === 'object') {
                        const carIds = Object.keys(actualCarAssets);
                        console.log(`   Found ${carIds.length} cars with asset data`);
                        
                        if (carIds.length > 0) {
                            console.log('\n🏎️  First car asset structure:');
                            const firstCarId = carIds[0];
                            const firstCarAsset = actualCarAssets[firstCarId];
                            console.log(`   Car ID: ${firstCarId}`);
                            console.log('   Asset keys:', Object.keys(firstCarAsset));
                            
                            // Look for image/asset related fields
                            const assetFields = Object.keys(firstCarAsset).filter(key => 
                                key.toLowerCase().includes('image') || 
                                key.toLowerCase().includes('logo') ||
                                key.toLowerCase().includes('picture') ||
                                key.toLowerCase().includes('asset') ||
                                key.toLowerCase().includes('url') ||
                                key.toLowerCase().includes('folder') ||
                                key.toLowerCase().includes('screenshot') ||
                                key.toLowerCase().includes('photo')
                            );
                            
                            if (assetFields.length > 0) {
                                console.log('\n🖼️  Asset/Image related fields found:');
                                assetFields.forEach(field => {
                                    console.log(`   ${field}: ${firstCarAsset[field]}`);
                                });
                            }
                            
                            console.log('\n📋 Sample car asset:');
                            console.log(JSON.stringify(firstCarAsset, null, 2));
                        }
                    }
                    
                    // Save car assets data
                    const carAssetsFile = `car-assets-data-${timestamp}.json`;
                    fs.writeFileSync(carAssetsFile, JSON.stringify(actualCarAssets, null, 2));
                    console.log(`\n💾 Car assets data saved to: ${carAssetsFile}`);
                    
                } else {
                    console.log('   ❌ Car assets link has expired');
                }
                
            } else {
                console.log('   Direct car assets data (not a link)');
                if (Array.isArray(carAssets)) {
                    console.log(`   Array length: ${carAssets.length}`);
                } else if (typeof carAssets === 'object') {
                    console.log('   Object keys:', Object.keys(carAssets));
                }
            }
            
            // Save car assets response
            const carAssetsResponseFile = `car-assets-response-${timestamp}.json`;
            fs.writeFileSync(carAssetsResponseFile, JSON.stringify(carAssets, null, 2));
            console.log(`\n💾 Car assets response saved to: ${carAssetsResponseFile}`);
            
        } else {
            console.log('❌ No car assets data received');
        }
        
        return { carData, carAssets };
        
    } catch (error) {
        console.error('❌ Car APIs OAuth2 test failed:', error.message);
        return null;
    }
}

// Run the test
if (require.main === module) {
    testCarAPIsOAuth2()
        .then((result) => {
            if (result) {
                console.log('\n🎉 Car APIs test completed successfully!');
            } else {
                console.log('\n💥 Car APIs test failed');
            }
        })
        .catch(console.error);
}

module.exports = testCarAPIsOAuth2;