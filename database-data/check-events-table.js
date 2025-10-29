const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'endurance_planner',
    password: 'password',
    port: 5432
});

async function checkEventsTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'events' 
            ORDER BY ordinal_position;
        `);
        
        console.log('Events table columns:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Also get sample data to see what's actually in there
        console.log('\n--- Checking if events table exists and has data ---');
        const sampleResult = await pool.query('SELECT * FROM events LIMIT 3;');
        console.log(`Table has ${sampleResult.rows.length} rows (showing first 3):`);
        if (sampleResult.rows.length > 0) {
            console.log(sampleResult.rows);
        }
        
    } catch (err) {
        console.error('Error:', err.message);
        console.log('Events table might not exist yet.');
    } finally {
        pool.end();
    }
}

checkEventsTable();