const iRacingAPIManager = require('./api-manager');

/**
 * Test iRacing API connection and authentication
 */

async function testAPI() {
    const api = new iRacingAPIManager();
    
    try {
        console.log('🧪 Testing iRacing API Connection...');
        console.log('📧 Make sure IRACING_EMAIL and IRACING_PASSWORD environment variables are set');
        console.log('');
        
        // Test authentication
        console.log('🔐 Testing authentication...');
        await api.authenticate();
        console.log('✅ Authentication successful');
        
        // Test basic API call
        console.log('\\n📊 Testing basic API call...');
        const constants = await api.makeRequest('/data/constants');
        
        if (constants) {
            console.log('✅ API call successful');
            console.log(`📊 Response contains: ${Object.keys(constants).length} data categories`);
            
            // Show some sample data
            if (constants.category) {
                console.log(`🏁 Categories available: ${constants.category.length}`);
                console.log('   Sample categories:', constants.category.slice(0, 5).map(c => c.category).join(', '));
            }
        }
        
        // Test rate limit status
        console.log('\\n⏱️  Rate limit status:');
        const rateLimitStatus = api.getRateLimitStatus();
        console.log(`   Requests used: ${rateLimitStatus.requestsUsed}/${api.maxRequestsPerHour}`);
        console.log(`   Requests remaining: ${rateLimitStatus.requestsRemaining}`);
        
        console.log('\\n🎉 All tests passed! API is ready for use.');
        
        return {
            success: true,
            authenticated: true,
            apiWorking: true,
            rateLimitStatus
        };
        
    } catch (error) {
        console.error('❌ API test failed:', error.message);
        
        // Provide helpful error messages
        if (error.message.includes('credentials not set')) {
            console.log('\\n💡 Solution: Set environment variables:');
            console.log('   Windows: set IRACING_EMAIL=your@email.com');
            console.log('   Windows: set IRACING_PASSWORD=yourpassword');
            console.log('   Linux/Mac: export IRACING_EMAIL=your@email.com');
            console.log('   Linux/Mac: export IRACING_PASSWORD=yourpassword');
        } else if (error.message.includes('Rate limit')) {
            console.log('\\n💡 Solution: Wait for rate limit reset or reduce request frequency');
        } else if (error.message.includes('Authentication failed')) {
            console.log('\\n💡 Solution: Check your iRacing credentials and account status');
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test
if (require.main === module) {
    testAPI()
        .then(result => {
            if (result.success) {
                console.log('\\n✅ Test completed successfully');
                process.exit(0);
            } else {
                console.log('\\n❌ Test failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Test script error:', error.message);
            process.exit(1);
        });
}

module.exports = testAPI;