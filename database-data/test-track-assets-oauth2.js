const iRacingOAuth2Client = require('../iracing-development/iracing-oauth2-client.js');

/**
 * Test iRacing Track Assets API using OAuth2 client
 */

async function testTrackAssetsOAuth2() {
    try {
        console.log('🏁 Testing iRacing Track Assets API with OAuth2...');
        console.log('📊 Endpoint: /data/track/assets');
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
        
        // Test track assets endpoint
        console.log('\n🗺️  Fetching track assets data...');
        const trackAssets = await client.makeDataAPIRequest('/data/track/assets');
        
        if (trackAssets) {
            console.log('✅ Track assets API call successful');
            console.log('📊 Response analysis:');
            console.log('   Type:', typeof trackAssets);
            
            if (Array.isArray(trackAssets)) {
                console.log(`   Array length: ${trackAssets.length}`);
                if (trackAssets.length > 0) {
                    console.log('\n📋 First track asset structure:');
                    const firstAsset = trackAssets[0];
                    console.log('   Keys:', Object.keys(firstAsset));
                    console.log('\n🔍 Sample track asset:');
                    console.log(JSON.stringify(firstAsset, null, 2));
                    
                    // Look for image/asset related fields
                    const imageFields = Object.keys(firstAsset).filter(key => 
                        key.toLowerCase().includes('image') || 
                        key.toLowerCase().includes('logo') ||
                        key.toLowerCase().includes('picture') ||
                        key.toLowerCase().includes('asset') ||
                        key.toLowerCase().includes('url') ||
                        key.toLowerCase().includes('folder')
                    );
                    
                    if (imageFields.length > 0) {
                        console.log('\n🖼️  Image/Asset related fields found:');
                        imageFields.forEach(field => {
                            console.log(`   ${field}: ${firstAsset[field]}`);
                        });
                    }
                }
            } else if (typeof trackAssets === 'object') {
                console.log('   Object keys:', Object.keys(trackAssets));
                
                for (const [key, value] of Object.entries(trackAssets)) {
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
            
            // Save the response
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `track-assets-oauth2-${timestamp}.json`;
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(trackAssets, null, 2));
            console.log(`\n💾 Track assets data saved to: ${filename}`);
            
            return trackAssets;
            
        } else {
            console.log('❌ No track assets data received');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Track assets OAuth2 test failed:', error.message);
        return null;
    }
}

// Run the test
if (require.main === module) {
    testTrackAssetsOAuth2()
        .then((result) => {
            if (result) {
                console.log('\n🎉 Track assets test completed successfully!');
            } else {
                console.log('\n💥 Track assets test failed');
            }
        })
        .catch(console.error);
}

module.exports = testTrackAssetsOAuth2;