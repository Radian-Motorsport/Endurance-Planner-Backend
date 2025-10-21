/**
 * Driver Data Refresh Service using OAuth2
 * Refreshes iRacing driver data for all drivers in the database
 */

const iRacingOAuth2Client = require('./iracing-oauth2-client.js');
const axios = require('axios');

class DriverRefreshService {
    constructor() {
        this.client = new iRacingOAuth2Client('radian-limited', 'viewable-SALAMI-net-mortician-Fever-asparagus');
        this.authenticated = false;
    }

    async authenticate() {
        if (this.authenticated) return true;
        
        const email = process.env.IRACING_EMAIL;
        const password = process.env.IRACING_PASSWORD;
        
        if (!email || !password) {
            throw new Error('iRacing credentials not set in environment variables');
        }
        
        console.log('🔐 Authenticating with iRacing API...');
        this.authenticated = await this.client.authenticate(email, password);
        
        if (!this.authenticated) {
            throw new Error('Authentication failed');
        }
        
        console.log('✅ Authentication successful');
        return this.authenticated;
    }

    async fetchSignedURL(url) {
        const response = await axios.get(url, { timeout: 30000 });
        return response.data;
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
     * Refresh driver data for all drivers in database
     * @param {Object} pool - Database connection pool
     */
    async refreshAllDrivers(pool) {
        await this.authenticate();

        try {
            // Get all driver cust_ids from database
            console.log('📊 Fetching driver list from database...');
            const driversResult = await pool.query('SELECT cust_id, name FROM drivers ORDER BY cust_id');
            const drivers = driversResult.rows;
            
            console.log(`📋 Found ${drivers.length} drivers to refresh`);
            
            // Prepare cust_ids array for iRacing API
            const custIds = drivers.map(driver => driver.cust_id);
            
            // Use the proven working pattern from fetch-driver-data-by-id.js
            console.log('🌐 Fetching updated driver data from iRacing...');
            const custIdsParam = custIds.join(',');
            
            const endpoint = `/data/member/get?cust_ids=${custIdsParam}&include_licenses=true`;
            console.log(`� Requesting endpoint: ${endpoint}`);
            
            const urlResponse = await this.client.makeDataAPIRequest(endpoint);
            
            if (!urlResponse || !urlResponse.link) {
                throw new Error('No signed URL received');
            }
            
            console.log(`� Got signed URL, fetching team member data...`);
            
            // Fetch the actual data from the signed URL
            const data = await this.fetchSignedURL(urlResponse.link);
            
            console.log('✅ Team member data retrieved successfully!');
            console.log(`� Retrieved data for ${data.members?.length || 0} members`);

            if (!data || !data.members || !Array.isArray(data.members)) {
                throw new Error('Invalid response from iRacing API - no valid members data');
            }

            // Update database with fresh data using the license structure
            let updatedCount = 0;
            for (const member of data.members) {
                try {
                    // Extract sports car license data (like the working script does)
                    const sportsCarLicense = member.licenses?.find(l => l.category === 'sports_car');
                    
                    await pool.query(`
                        UPDATE drivers 
                        SET 
                            sports_car_irating = $1,
                            sports_car_safety_rating = $2,
                            data_fetched_at = CURRENT_TIMESTAMP
                        WHERE cust_id = $3
                    `, [
                        sportsCarLicense?.irating || null,
                        sportsCarLicense?.safety_rating || null,
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

    /**
     * Refresh driver data for all drivers in database with FULL DETAILS
     * @param {Object} pool - Database connection pool
     */
    async refreshAllDriversFullDetails(pool) {
        await this.authenticate();

        try {
            // Get all driver cust_ids from database
            console.log('📊 Fetching driver list from database...');
            const driversResult = await pool.query('SELECT cust_id, name FROM drivers ORDER BY cust_id');

            const drivers = driversResult.rows;

            console.log(`📋 Found ${drivers.length} drivers to refresh with full details`);

            // Prepare cust_ids array for iRacing API
            const custIds = drivers.map(driver => driver.cust_id);

            // Fetch detailed driver data from iRacing API
            console.log('🌐 Fetching detailed driver data from iRacing...');
            const custIdsParam = custIds.join(',');

            const endpoint = `/data/member/get?cust_ids=${custIdsParam}&include_licenses=true`;
            console.log(`📡 Requesting endpoint: ${endpoint}`);

            const urlResponse = await this.client.makeDataAPIRequest(endpoint);

            if (!urlResponse || !urlResponse.link) {
                throw new Error('No signed URL received');
            }

            console.log(`🔗 Got signed URL, fetching detailed team member data...`);

            // Fetch the actual data from the signed URL
            const data = await this.fetchSignedURL(urlResponse.link);

            console.log('✅ Detailed team member data retrieved successfully!');
            console.log(`👥 Retrieved data for ${data.members?.length || 0} members`);

            if (!data || !data.members || !Array.isArray(data.members)) {
                throw new Error('Invalid response from iRacing API - no valid members data');
            }

            // Update database with comprehensive driver data
            let updatedCount = 0;
            for (const member of data.members) {
                try {
                    // Extract license data for different categories
                    const sportsCarLicense = member.licenses?.find(l => l.category === 'sports_car');
                    const ovalLicense = member.licenses?.find(l => l.category === 'oval');
                    const dirtRoadLicense = member.licenses?.find(l => l.category === 'dirt_road');
                    const dirtOvalLicense = member.licenses?.find(l => l.category === 'dirt_oval');
                    const roadLicense = member.licenses?.find(l => l.category_id === 2); // Road license

                    // Prepare comprehensive update - PRESERVE existing garage61_slug, name, and timezone
                    const updateData = {
                        // Basic info from API
                        cust_id: member.cust_id,
                        display_name: member.display_name,

                        // Location - only update country, preserve timezone
                        country: member.location?.country,

                        // Account stats
                        member_since: member.member_since,
                        last_login: member.last_login,

                        // License data - Sports Car
                        sports_car_license_level: sportsCarLicense?.license_level,
                        sports_car_group_name: sportsCarLicense?.group_name,
                        sports_car_safety_rating: sportsCarLicense?.safety_rating,

                        // License data - Oval
                        oval_irating: ovalLicense?.irating,

                        // License data - Dirt categories
                        dirt_oval_irating: dirtOvalLicense?.irating,
                        dirt_road_irating: dirtRoadLicense?.irating,

                        // Other flags
                        ai_driver: member.ai_enabled,

                        // Metadata
                        data_fetched_at: new Date()
                    };

                    // Build dynamic update query - EXCLUDE garage61_slug, name, timezone to preserve them
                    const updateFields = Object.keys(updateData).filter(key => updateData[key] !== undefined);
                    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
                    const values = updateFields.map(field => updateData[field]);
                    values.push(member.cust_id); // Add cust_id for WHERE clause

                    const updateQuery = `
                        UPDATE drivers
                        SET ${setClause}
                        WHERE cust_id = $${values.length}
                    `;

                    await pool.query(updateQuery, values);
                    updatedCount++;

                    console.log(`✅ Updated ${member.display_name} (${member.cust_id}) with full details (preserved garage61_slug, name, timezone)`);                } catch (updateError) {
                    console.error(`❌ Failed to update driver ${member.cust_id} (${member.display_name || 'Unknown'}):`, updateError.message);
                }
            }

            console.log(`🎉 Successfully updated ${updatedCount}/${drivers.length} drivers with full details`);

            return {
                success: true,
                totalDrivers: drivers.length,
                updatedCount: updatedCount,
                timestamp: new Date().toISOString(),
                dataFields: Object.keys(updateData).length
            };

        } catch (error) {
            console.error('❌ Full details driver refresh failed:', error.message);
            throw error;
        }
    }

    /**
     * Get detailed information for a single driver by cust_id
     * @param {number} custId - iRacing customer ID
     * @returns {Object} - Detailed driver information
     */
    async getDriverDetails(custId) {
        await this.authenticate();

        try {
            console.log(`🔍 Fetching detailed data for driver cust_id: ${custId}`);

            const endpoint = `/data/member/get?cust_ids=${custId}&include_licenses=true`;
            console.log(`📡 Requesting endpoint: ${endpoint}`);

            const urlResponse = await this.client.makeDataAPIRequest(endpoint);

            if (!urlResponse || !urlResponse.link) {
                throw new Error('No signed URL received');
            }

            console.log(`🔗 Got signed URL, fetching driver data...`);

            // Fetch the actual data from the signed URL
            const data = await this.fetchSignedURL(urlResponse.link);

            if (!data || !data.members || !Array.isArray(data.members) || data.members.length === 0) {
                throw new Error(`No data found for driver cust_id: ${custId}`);
            }

            const driver = data.members[0];
            console.log(`✅ Retrieved detailed data for ${driver.display_name} (${driver.cust_id})`);

            // Process license data
            const licenses = {};
            if (driver.licenses && Array.isArray(driver.licenses)) {
                driver.licenses.forEach(license => {
                    licenses[license.category] = {
                        category_id: license.category_id,
                        category: license.category,
                        irating: license.irating,
                        safety_rating: license.safety_rating,
                        group_name: license.group_name,
                        license_level: license.license_level
                    };
                });
            }

            // Return comprehensive driver object
            return {
                cust_id: driver.cust_id,
                display_name: driver.display_name,
                first_name: driver.first_name,
                last_name: driver.last_name,
                email: driver.email,
                location: driver.location,
                licenses: licenses,
                irating: driver.irating,
                tt_rating: driver.tt_rating,
                pro_promotable: driver.pro_promotable,
                member_since: driver.member_since,
                last_login: driver.last_login,
                years_pro: driver.years_pro,
                helmet: driver.helmet,
                suit: driver.suit,
                car_number: driver.car_number,
                club_name: driver.club_name,
                club_id: driver.club_id,
                recent_awards: driver.recent_awards,
                ai_enabled: driver.ai_enabled,
                fetched_at: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ Failed to get driver details for cust_id ${custId}:`, error.message);
            throw error;
        }
    }


}

module.exports = DriverRefreshService;