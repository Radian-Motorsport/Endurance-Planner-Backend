/**
 * Simple credential verification test
 * Test with basic authentication to see exact error
 */

const axios = require('axios');

async function quickTest() {
    console.log('Quick credential test...');
    
    // Let's try a basic test first
    const email = 'grannville@hotmail.co.uk';
    const password = 'CAMpagnolo9!';
    
    console.log(`Email: ${email}`);
    console.log(`Password length: ${password.length} characters`);
    console.log(`Password starts with: ${password.substring(0, 3)}...`);
    
    try {
        const response = await axios.post('https://members-ng.iracing.com/auth', {
            email: email.trim().toLowerCase(), // Ensure clean email
            password: password
        });
        
        console.log('Response:', response.data);
        
        // Let's also check what happens if we try to access member info directly
        console.log('\nTrying to access member info...');
        
        try {
            const memberResponse = await axios.get('https://members-ng.iracing.com/data/member/info');
            console.log('Member info (should fail):', memberResponse.data);
        } catch (memberError) {
            console.log('Member info error (expected):', memberError.response?.status, memberError.response?.data);
        }
        
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
    }
}

quickTest();