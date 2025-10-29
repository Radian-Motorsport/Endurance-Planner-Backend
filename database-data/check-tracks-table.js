const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'endurance_planner',
    password: 'password',
    port: 5432
});

async function checkTracksTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tracks' 
            ORDER BY ordinal_position;
        `);
        
        console.log('Tracks table columns:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Also get sample data
        const sampleResult = await pool.query('SELECT * FROM tracks LIMIT 3;');
        console.log('\nSample data:');
        console.log(sampleResult.rows);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkTracksTable();