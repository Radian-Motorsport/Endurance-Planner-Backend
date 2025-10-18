/**
 * iRacing OAuth2 API Client
 * Implements the proper OAuth2 Password Limited Grant workflow
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

class iRacingOAuth2Client {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.baseURL = 'https://oauth.iracing.com';
        this.dataBaseURL = 'https://members-ng.iracing.com';
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiresAt = null;
        this.axiosInstance = null;
    }

    /**
     * Mask secret according to iRacing OAuth2 requirements
     * @param {string} secret - The secret to mask
     * @param {string} id - The identifier (client_id for client secret, username for password)
     * @returns {string} - Base64 encoded SHA256 hash
     */
    maskSecret(secret, id) {
        // Normalize the id (trim whitespace and lowercase)
        const normalizedId = id.trim().toLowerCase();
        
        // Concatenate secret + normalized_id
        const combined = `${secret}${normalizedId}`;
        
        // Create SHA256 hash
        const hasher = crypto.createHash('sha256');
        hasher.update(combined);
        
        // Return base64 encoded hash
        const masked = hasher.digest('base64');
        
        console.log('🔐 Secret masking:');
        console.log(`  ID (normalized): ${normalizedId}`);
        console.log(`  Combined length: ${combined.length}`);
        console.log(`  Masked secret: ${masked}`);
        
        return masked;
    }

    /**
     * Authenticate using OAuth2 Password Limited Grant
     * @param {string} username - iRacing email
     * @param {string} password - iRacing password
     * @returns {Promise<boolean>} - Success status
     */
    async authenticate(username, password) {
        try {
            console.log('🔐 Starting OAuth2 Password Limited Grant authentication...');
            console.log(`📧 Username: ${username}`);
            console.log(`🆔 Client ID: ${this.clientId}`);

            // Create axios instance for OAuth2 endpoint
            this.axiosInstance = axios.create({
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Mask the client secret and password according to OAuth2 spec
            const maskedClientSecret = this.maskSecret(this.clientSecret, this.clientId);
            const maskedPassword = this.maskSecret(password, username);

            // Prepare form data for password_limited grant
            const formData = new URLSearchParams({
                grant_type: 'password_limited',
                client_id: this.clientId,
                client_secret: maskedClientSecret,
                username: username.trim().toLowerCase(),
                password: maskedPassword,
                scope: 'iracing.auth'
            });

            console.log('🚀 Making OAuth2 token request...');
            console.log('📝 Form data keys:', Array.from(formData.keys()));

            const response = await this.axiosInstance.post('/oauth2/token', formData, {
                baseURL: this.baseURL
            });

            console.log('📊 OAuth2 response status:', response.status);
            console.log('📊 OAuth2 response data:', response.data);

            if (response.status === 200 && response.data.access_token) {
                // Store tokens
                this.accessToken = response.data.access_token;
                this.refreshToken = response.data.refresh_token;
                
                // Calculate expiry time
                const expiresIn = response.data.expires_in || 600; // Default 10 minutes
                this.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));

                console.log('✅ OAuth2 authentication successful!');
                console.log(`🕒 Access token expires at: ${this.tokenExpiresAt.toISOString()}`);
                console.log(`🔄 Refresh token available: ${!!this.refreshToken}`);

                return true;
            } else {
                console.log('❌ OAuth2 authentication failed - no access token received');
                return false;
            }

        } catch (error) {
            console.error('❌ OAuth2 authentication error:', error.message);
            
            if (error.response) {
                console.error('📊 Error status:', error.response.status);
                console.error('📊 Error data:', error.response.data);
                console.error('📊 Error headers:', error.response.headers);
                
                // Check for rate limiting
                if (error.response.headers['ratelimit-remaining']) {
                    console.log('⏱️ Rate limit info:');
                    console.log(`  Remaining: ${error.response.headers['ratelimit-remaining']}`);
                    console.log(`  Limit: ${error.response.headers['ratelimit-limit']}`);
                    console.log(`  Reset: ${error.response.headers['ratelimit-reset']}`);
                }
            }
            
            return false;
        }
    }

    /**
     * Check if access token is valid and not expired
     */
    isTokenValid() {
        return this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt;
    }

    /**
     * Refresh the access token using the refresh token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            console.log('❌ No refresh token available');
            return false;
        }

        try {
            console.log('🔄 Refreshing access token...');

            const maskedClientSecret = this.maskSecret(this.clientSecret, this.clientId);

            const formData = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: maskedClientSecret,
                refresh_token: this.refreshToken
            });

            const response = await this.axiosInstance.post('/oauth2/token', formData, {
                baseURL: this.baseURL
            });

            if (response.status === 200 && response.data.access_token) {
                this.accessToken = response.data.access_token;
                this.refreshToken = response.data.refresh_token; // New refresh token
                
                const expiresIn = response.data.expires_in || 600;
                this.tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000));

                console.log('✅ Access token refreshed successfully!');
                return true;
            }

            return false;

        } catch (error) {
            console.error('❌ Token refresh failed:', error.message);
            return false;
        }
    }

    /**
     * Make authenticated request to Data API
     */
    async makeDataAPIRequest(endpoint) {
        // Check if token is valid, refresh if needed
        if (!this.isTokenValid()) {
            console.log('🔄 Token expired or invalid, attempting refresh...');
            const refreshed = await this.refreshAccessToken();
            if (!refreshed) {
                console.log('❌ Could not refresh token');
                return null;
            }
        }

        try {
            console.log(`📡 Making Data API request: ${endpoint}`);

            const response = await axios.get(endpoint, {
                baseURL: this.dataBaseURL,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 30000
            });

            console.log(`✅ Data API request successful: ${response.status}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Data API request failed: ${error.message}`);
            if (error.response) {
                console.error('📊 Error status:', error.response.status);
                console.error('📊 Error data:', error.response.data);
            }
            return null;
        }
    }

    /**
     * Get API documentation
     */
    async getAPIDocumentation() {
        return await this.makeDataAPIRequest('/data/doc');
    }

    /**
     * Search for weather-related endpoints in documentation
     */
    findWeatherEndpoints(documentation) {
        const weatherKeywords = [
            'weather', 'forecast', 'temperature', 'precipitation', 'humidity',
            'wind', 'conditions', 'climate', 'atmospheric', 'environment',
            'session', 'track_state', 'surface', 'rain', 'cloud'
        ];

        console.log('🌦️  Searching for weather-related endpoints...');
        const results = [];

        const searchObject = (obj, path = '') => {
            if (typeof obj !== 'object' || obj === null) return;

            for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                const keyMatch = weatherKeywords.some(keyword => 
                    key.toLowerCase().includes(keyword.toLowerCase())
                );
                
                const valueMatch = typeof value === 'string' && weatherKeywords.some(keyword => 
                    value.toLowerCase().includes(keyword.toLowerCase())
                );

                if (keyMatch || valueMatch) {
                    results.push({
                        path: currentPath,
                        key: key,
                        value: value,
                        type: typeof value,
                        match: keyMatch ? 'key' : 'value'
                    });
                }

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    searchObject(value, currentPath);
                }
            }
        };

        searchObject(documentation);
        return results;
    }

    /**
     * Save results to file
     */
    saveResults(documentation, weatherEndpoints) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `iracing-oauth2-results-${timestamp}.json`;
        
        const results = {
            timestamp: new Date().toISOString(),
            authenticationMethod: 'OAuth2 Password Limited Grant',
            clientId: this.clientId,
            tokenInfo: {
                hasAccessToken: !!this.accessToken,
                hasRefreshToken: !!this.refreshToken,
                expiresAt: this.tokenExpiresAt?.toISOString()
            },
            fullDocumentation: documentation,
            weatherEndpoints: weatherEndpoints,
            summary: {
                totalEndpoints: typeof documentation === 'object' ? Object.keys(documentation).length : 0,
                weatherEndpointsFound: weatherEndpoints.length
            }
        };

        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        console.log(`💾 Results saved to: ${filename}`);
        return filename;
    }

    /**
     * Main exploration function
     */
    async explore(username, password) {
        console.log('🚀 iRacing OAuth2 API Explorer');
        console.log('===============================\n');

        // Authenticate
        const authSuccess = await this.authenticate(username, password);
        if (!authSuccess) {
            console.log('\n❌ OAuth2 authentication failed. Please check:');
            console.log('  - Client ID and Client Secret are correct');
            console.log('  - Email and password are correct');
            console.log('  - Client is registered for Password Limited Grant');
            console.log('  - User is added to the client\'s access list');
            return;
        }

        // Get API documentation
        console.log('\n📖 Fetching API documentation...');
        const documentation = await this.getAPIDocumentation();
        
        if (!documentation) {
            console.log('❌ Could not fetch API documentation');
            return;
        }

        // Search for weather endpoints
        const weatherEndpoints = this.findWeatherEndpoints(documentation);
        
        console.log(`\n🎉 OAuth2 Exploration Results:`);
        console.log(`📚 Documentation retrieved: ${typeof documentation === 'object' ? Object.keys(documentation).length : 0} sections`);
        console.log(`🌦️  Weather-related findings: ${weatherEndpoints.length}`);

        if (weatherEndpoints.length > 0) {
            console.log('\n🌦️  Weather-Related Endpoints Found:');
            weatherEndpoints.forEach((endpoint, index) => {
                console.log(`  ${index + 1}. ${endpoint.path}`);
                console.log(`     Key: ${endpoint.key}`);
                console.log(`     Value: ${endpoint.value}`);
                console.log(`     Match: ${endpoint.match}`);
                console.log('');
            });
        }

        // Save results
        const filename = this.saveResults(documentation, weatherEndpoints);
        console.log(`\n✅ Complete! Check ${filename} for full details.`);
        
        return { documentation, weatherEndpoints };
    }
}

// Export for use
module.exports = iRacingOAuth2Client;