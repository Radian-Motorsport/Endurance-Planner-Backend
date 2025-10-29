const fs = require('fs');

// Read the fresh endurance schedules data
const schedulesData = JSON.parse(fs.readFileSync('endurance-schedules-2025-10-17T22-18-42-333Z.json', 'utf8'));

console.log(`Generating SQL to update events table with ${schedulesData.length} endurance series...`);

// Generate SQL for events table updates
let sql = `-- Update events table with fresh iRacing schedules data
-- Generated on ${new Date().toISOString()}
-- Total endurance series: ${schedulesData.length}

`;

let totalEvents = 0;

schedulesData.forEach(series => {
    if (series.schedules && series.schedules.length > 0) {
        console.log(`Processing ${series.season_name} - ${series.schedules.length} events`);
        
        series.schedules.forEach(event => {
            totalEvents++;
            
            // Handle null/undefined values and escape single quotes
            const escapeValue = (value) => {
                if (value === null || value === undefined) return 'NULL';
                if (typeof value === 'boolean') return value.toString().toUpperCase();
                if (typeof value === 'number') return value.toString();
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            };

            // Format dates properly
            const formatDate = (dateStr) => {
                if (!dateStr) return 'NULL';
                try {
                    const date = new Date(dateStr);
                    return `'${date.toISOString().split('T')[0]}'`; // Just the date part
                } catch {
                    return 'NULL';
                }
            };

            const formatTime = (dateStr) => {
                if (!dateStr) return 'NULL';
                try {
                    const date = new Date(dateStr);
                    return `'${date.toISOString().split('T')[1].split('.')[0]}'`; // Just the time part
                } catch {
                    return 'NULL';
                }
            };

            // Create a unique event ID based on season_id and race_week_num
            const eventId = parseInt(`${series.season_id}${String(event.race_week_num).padStart(2, '0')}`);

            sql += `INSERT INTO events (
    event_id, series_id, season_id, season_name, race_week_num, event_name, 
    start_date, end_date, track_id, track_name, track_config, garage61_track_id
) VALUES (
    ${eventId},
    ${series.series_id},
    ${series.season_id},
    ${escapeValue(series.season_name)},
    ${event.race_week_num || 'NULL'},
    ${escapeValue(event.season_name || series.season_name)},
    ${formatDate(event.start_date)},
    ${formatDate(event.end_date)},
    ${event.track_id || 'NULL'},
    ${escapeValue(event.track ? event.track.track_name : 'Unknown Track')},
    ${escapeValue(event.track ? event.track.config_name : 'Unknown Config')},
    NULL
)
ON CONFLICT (event_id) DO UPDATE SET
    series_id = EXCLUDED.series_id,
    season_id = EXCLUDED.season_id,
    season_name = EXCLUDED.season_name,
    race_week_num = EXCLUDED.race_week_num,
    event_name = EXCLUDED.event_name,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    track_id = EXCLUDED.track_id,
    track_name = EXCLUDED.track_name,
    track_config = EXCLUDED.track_config;
    -- garage61_track_id is NOT updated to preserve existing G61 data

`;
        });
    }
});

// Write the SQL file
fs.writeFileSync('update-events-from-iracing-schedules.sql', sql);

console.log(`SQL file generated: update-events-from-iracing-schedules.sql`);
console.log(`Total events processed: ${totalEvents}`);
console.log('This will insert new events and update existing ones with fresh iRacing schedules data.');