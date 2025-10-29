const axios = require('axios');
const fs = require('fs');

/**
 * Fetch the actual track assets data from the AWS S3 link
 */

async function fetchTrackAssetsData() {
    try {
        console.log('🌐 Fetching actual track assets data from AWS S3...');
        
        // Read the response file to get the link
        const files = fs.readdirSync('.').filter(f => f.startsWith('track-assets-oauth2-'));
        if (files.length === 0) {
            throw new Error('No track assets response file found');
        }
        
        const latestFile = files.sort().reverse()[0];
        console.log(`📁 Reading from: ${latestFile}`);
        
        const response = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        const assetsUrl = response.link;
        
        console.log('🔗 Assets URL:', assetsUrl);
        console.log('⏰ Expires:', response.expires);
        
        // Check if link is still valid
        const expiryTime = new Date(response.expires);
        const now = new Date();
        
        if (now > expiryTime) {
            throw new Error('Assets link has expired');
        }
        
        console.log(`✅ Link is valid for ${Math.round((expiryTime - now) / 1000)} more seconds`);
        
        // Fetch the actual assets data
        console.log('\n🚀 Fetching track assets data...');
        const assetsResponse = await axios.get(assetsUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('✅ Track assets data fetched successfully');
        console.log('📊 Response status:', assetsResponse.status);
        console.log('📊 Content type:', assetsResponse.headers['content-type']);
        console.log('📊 Data type:', typeof assetsResponse.data);
        
        const assetsData = assetsResponse.data;
        
        if (Array.isArray(assetsData)) {
            console.log(`📋 Array with ${assetsData.length} track assets`);
            
            if (assetsData.length > 0) {
                console.log('\n🏁 First track asset structure:');
                const firstTrack = assetsData[0];
                console.log('   Keys:', Object.keys(firstTrack));
                
                // Look for image/asset related fields
                const assetFields = Object.keys(firstTrack).filter(key => 
                    key.toLowerCase().includes('image') || 
                    key.toLowerCase().includes('logo') ||
                    key.toLowerCase().includes('picture') ||
                    key.toLowerCase().includes('asset') ||
                    key.toLowerCase().includes('url') ||
                    key.toLowerCase().includes('folder') ||
                    key.toLowerCase().includes('map') ||
                    key.toLowerCase().includes('screenshot') ||
                    key.toLowerCase().includes('photo')
                );
                
                if (assetFields.length > 0) {
                    console.log('\n🖼️  Asset/Image related fields found:');
                    assetFields.forEach(field => {
                        console.log(`   ${field}: ${firstTrack[field]}`);
                    });
                }
                
                console.log('\n📋 Sample track asset:');
                console.log(JSON.stringify(firstTrack, null, 2));
                
                // Show a few more examples if available
                if (assetsData.length > 1) {
                    console.log('\n📋 Second track asset:');
                    console.log(JSON.stringify(assetsData[1], null, 2));
                }
                
                if (assetsData.length > 2) {
                    console.log('\n📋 Third track asset:');
                    console.log(JSON.stringify(assetsData[2], null, 2));
                }
            }
        } else if (typeof assetsData === 'object') {
            console.log('📦 Object structure:');
            console.log('   Keys:', Object.keys(assetsData));
            
            for (const [key, value] of Object.entries(assetsData)) {
                if (Array.isArray(value)) {
                    console.log(`   ${key}: Array of ${value.length} items`);
                } else {
                    console.log(`   ${key}: ${typeof value}`);
                }
            }
        }
        
        // Save the assets data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `track-assets-data-${timestamp}.json`;
        fs.writeFileSync(filename, JSON.stringify(assetsData, null, 2));
        console.log(`\n💾 Track assets data saved to: ${filename}`);
        
        return assetsData;
        
    } catch (error) {
        console.error('❌ Failed to fetch track assets data:', error.message);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    fetchTrackAssetsData()
        .then((result) => {
            if (result) {
                console.log('\n🎉 Track assets data fetch completed successfully!');
            } else {
                console.log('\n💥 Track assets data fetch failed');
            }
        })
        .catch(console.error);
}

module.exports = fetchTrackAssetsData;