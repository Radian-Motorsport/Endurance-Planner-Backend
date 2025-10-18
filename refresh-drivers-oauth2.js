/**
 * Driver Data Refresh Service using OAuth2
 * Refreshes iRacing driver data for all drivers in the database
 */

const iRacingOAuth2Client = require('./iracing-development/iracing-oauth2-client');
const fs = require('fs');
const path = require('path');

class DriverRefreshService {
    constructor() {
        this.client = null;
        this.isAuthenticated = false;
    }

    /**
     * Load configuration from private config repo or .env file
     */
    async loadConfig() {
        try {
            // Try to load from multiple config locations
            const configPaths = [
                path.join(__dirname, '../RadianPlanner-Config/.env'),  // Private repo
                path.join(__dirname, 'config/.env'),                   // Local config folder
                path.join(__dirname, '.env'),                          // Local .env file
                path.join(process.cwd(), '.env')                       // Process working directory
            ];

            for (const configPath of configPaths) {
                if (fs.existsSync(configPath)) {
                    console.log(`📋 Loading config from: ${configPath}`);
                    
                    // Simple .env parser
                    const envContent = fs.readFileSync(configPath, 'utf8');
                    const lines = envContent.split('\n');
                    
                    lines.forEach(line => {
                        line = line.trim();
                        if (line && !line.startsWith('#')) {
                            const [key, ...valueParts] = line.split('=');
                            if (key && valueParts.length > 0) {
                                const value = valueParts.join('=').trim();
                                // Only set if not already in environment
                                if (!process.env[key.trim()]) {
                                    process.env[key.trim()] = value;
                                }
                            }
                        }
                    });
                    
                    console.log('✅ Configuration loaded successfully');
                    return;
                }
            }
            
            console.log('⚠️  No config file found, using environment variables only');
            
        } catch (error) {
            console.error('❌ Error loading config:', error.message);
        }
    }

    /**
     * Initialize OAuth2 client with credentials from environment or config file
     */
    async initialize() {
        // Try to load from private config repo first, then environment variables
        await this.loadConfig();
        
        // Get OAuth2 credentials
        const CLIENT_ID = process.env.IRACING_CLIENT_ID || 'radian-limited';
        const CLIENT_SECRET = process.env.IRACING_CLIENT_SECRET || 'viewable-SALAMI-net-mortician-Fever-asparagus';
        const EMAIL = process.env.IRACING_EMAIL;
        const PASSWORD = process.env.IRACING_PASSWORD;

        if (!EMAIL || !PASSWORD) {
            throw new Error('iRacing credentials not found. Please set up environment variables or private config repo.');
        }

        this.client = new iRacingOAuth2Client(CLIENT_ID, CLIENT_SECRET);
        
        console.log('🔐 Authenticating with iRacing OAuth2...');
        const authSuccess = await this.client.authenticate(EMAIL, PASSWORD);
        
        if (!authSuccess) {
            throw new Error('OAuth2 authentication failed');
        }
        
        this.isAuthenticated = true;
        console.log('✅ OAuth2 authentication successful');
    }

    /**
     * Refresh driver data for all drivers in database
     * @param {Object} pool - Database connection pool
     */
    async refreshAllDrivers(pool) {
        if (!this.isAuthenticated) {
            await this.initialize();
        }

        try {
            // Get all driver cust_ids from database
            console.log('📊 Fetching driver list from database...');
            const driversResult = await pool.query('SELECT cust_id, name FROM drivers ORDER BY cust_id');
            const drivers = driversResult.rows;
            
            console.log(`📋 Found ${drivers.length} drivers to refresh`);
            
            // Prepare cust_ids array for iRacing API
            const custIds = drivers.map(driver => driver.cust_id);
            
            // Fetch updated data from iRacing
            console.log('🌐 Fetching updated driver data from iRacing...');
            const memberData = await this.client.makeDataAPIRequest('/data/member/get?cust_ids=' + custIds.join(','));

            if (!memberData || !memberData.members) {
                throw new Error('Invalid response from iRacing API');
            }

            console.log(`✅ Received data for ${memberData.members.length} drivers`);
            
            // Update database with fresh data
            let updatedCount = 0;
            for (const member of memberData.members) {
                try {
                    await pool.query(`
                        UPDATE drivers 
                        SET 
                            sports_car_irating = $1,
                            sports_car_safety_rating = $2,
                            updated_at = NOW()
                        WHERE cust_id = $3
                    `, [
                        member.sports_car_irating || null,
                        member.sports_car_safety_rating || null,
                        member.cust_id
                    ]);
                    updatedCount++;
                } catch (updateError) {
                    console.error(`❌ Failed to update driver ${member.cust_id}:`, updateError.message);
                }
            }

            console.log(`🎉 Successfully updated ${updatedCount}/${drivers.length} drivers`);
            
            return {
                success: true,
                totalDrivers: drivers.length,
                updatedCount: updatedCount,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Driver refresh failed:', error.message);
            throw error;
        }
    }


}

module.exports = DriverRefreshService;