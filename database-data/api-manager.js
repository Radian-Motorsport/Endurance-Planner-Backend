const fs = require('fs').promises;
const axios = require('axios');

/**
 * iRacing API Manager
 * Handles authentication, rate limiting, and core API operations
 */

class iRacingAPIManager {
    constructor() {
        this.baseURL = 'https://members-ng.iracing.com';
        this.authToken = null;
        this.tokenExpiry = null;
        this.requestCount = 0;
        this.requestWindow = new Date();
        this.maxRequestsPerHour = 12;
        
        // Credentials - replace with your actual values
        this.credentials = {
            email: process.env.IRACING_EMAIL || '',
            password: process.env.IRACING_PASSWORD || '',
            client_id: 'radian-limited'
        };
    }

    /**
     * Check if we're within rate limits
     */
    checkRateLimit() {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        // Reset counter if it's been more than an hour
        if (this.requestWindow < hourAgo) {
            this.requestCount = 0;
            this.requestWindow = now;
        }
        
        if (this.requestCount >= this.maxRequestsPerHour) {
            const waitTime = 60 - Math.floor((now - this.requestWindow) / (60 * 1000));
            throw new Error(`Rate limit exceeded. Wait ${waitTime} minutes before next request.`);
        }
    }

    /**
     * Authenticate with iRacing API
     */
    async authenticate() {
        try {
            console.log('🔐 Authenticating with iRacing API...');
            
            if (!this.credentials.email || !this.credentials.password) {
                throw new Error('iRacing credentials not set. Set IRACING_EMAIL and IRACING_PASSWORD environment variables.');
            }

            const response = await axios.post(`${this.baseURL}/auth`, {
                email: this.credentials.email,
                password: this.credentials.password,
                client_id: this.credentials.client_id
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.authcode) {
                this.authToken = response.data.authcode;
                this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours
                console.log('✅ Authentication successful');
                return true;
            } else {
                throw new Error('Authentication failed - no authcode received');
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if token needs refresh
     */
    async ensureAuthenticated() {
        const now = new Date();
        if (!this.authToken || !this.tokenExpiry || now >= this.tokenExpiry) {
            await this.authenticate();
        }
    }

    /**
     * Make authenticated API request
     */
    async makeRequest(endpoint, params = {}) {
        try {
            await this.ensureAuthenticated();
            this.checkRateLimit();

            console.log(`🌐 API Request: ${endpoint}`);
            
            const url = new URL(`${this.baseURL}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            });

            const response = await axios.get(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            this.requestCount++;
            console.log(`📊 Rate limit: ${this.requestCount}/${this.maxRequestsPerHour} requests used`);

            return response.data;
        } catch (error) {
            console.error(`❌ API request failed for ${endpoint}:`, error.message);
            throw error;
        }
    }

    /**
     * Save data to JSON file with timestamp
     */
    async saveDataFile(data, filename) {
        try {
            const timestamp = new Date().toISOString();
            const timestampedFilename = `${filename}-${timestamp.replace(/[:.]/g, '-')}.json`;
            
            await fs.writeFile(timestampedFilename, JSON.stringify(data, null, 2));
            
            // Also save without timestamp for latest version
            await fs.writeFile(`${filename}.json`, JSON.stringify(data, null, 2));
            
            console.log(`💾 Saved: ${timestampedFilename}`);
            console.log(`💾 Updated: ${filename}.json`);
            
            return timestampedFilename;
        } catch (error) {
            console.error(`❌ Failed to save ${filename}:`, error.message);
            throw error;
        }
    }

    /**
     * Get rate limit status
     */
    getRateLimitStatus() {
        const now = new Date();
        const minutesInWindow = Math.floor((now - this.requestWindow) / (60 * 1000));
        const remainingRequests = this.maxRequestsPerHour - this.requestCount;
        
        return {
            requestsUsed: this.requestCount,
            requestsRemaining: remainingRequests,
            minutesInCurrentWindow: minutesInWindow,
            tokenExpiry: this.tokenExpiry
        };
    }
}

module.exports = iRacingAPIManager;