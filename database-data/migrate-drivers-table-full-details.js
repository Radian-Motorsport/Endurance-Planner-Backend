/**
 * Database migration to expand drivers table with full iRacing API data
 * Run this after updating the server.js schema
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/radian_planner',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateDriversTable() {
    try {
        console.log('🚀 Starting drivers table migration...');

        // Add new columns to drivers table - only add missing ones
        const alterQueries = [
            // Add cust_id if it doesn't exist (primary identifier from iRacing)
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cust_id INTEGER UNIQUE`,

            // Add sports_car_races if missing (not in original schema)
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sports_car_races INTEGER`,

            // Add any other missing columns that might be needed
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS country VARCHAR(255)`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS member_since TIMESTAMP`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS sports_car_license_level INTEGER`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS oval_irating INTEGER`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS dirt_oval_irating INTEGER`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS dirt_road_irating INTEGER`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS ai_driver BOOLEAN`,
            `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS data_fetched_at TIMESTAMP`
        ];

        console.log('📋 Adding new columns to drivers table...');
        for (const query of alterQueries) {
            try {
                await pool.query(query);
                console.log(`✅ Executed: ${query.split('ADD COLUMN')[1]?.trim() || query}`);
            } catch (error) {
                console.log(`⚠️  Skipped: ${query.split('ADD COLUMN')[1]?.trim() || query} - ${error.message}`);
            }
        }

        // Create index on cust_id for faster lookups
        try {
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_drivers_cust_id ON drivers(cust_id)`);
            console.log('✅ Created index on cust_id');
        } catch (error) {
            console.log(`⚠️  Index creation skipped: ${error.message}`);
        }

        console.log('🎉 Drivers table migration completed successfully!');

        // Show current table structure
        const structureQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'drivers'
            ORDER BY ordinal_position
        `;
        const structure = await pool.query(structureQuery);
        console.log('\n📊 Current drivers table structure:');
        structure.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : ''}`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDriversTable()
        .then(() => {
            console.log('✅ Migration script completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Migration script failed:', error.message);
            process.exit(1);
        });
}

module.exports = migrateDriversTable;