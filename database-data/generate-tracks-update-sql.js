const fs = require('fs');

// Read the fresh track data
const trackData = JSON.parse(fs.readFileSync('actual-track-data-2025-10-17T22-03-19-855Z.json', 'utf8'));

console.log(`Generating SQL to update ${trackData.length} tracks...`);

// Generate INSERT statements with ON CONFLICT UPDATE
let sql = `-- Update tracks table with fresh iRacing data
-- Generated on ${new Date().toISOString()}
-- Total tracks: ${trackData.length}

`;

trackData.forEach(track => {
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
            return `'${date.toISOString()}'`;
        } catch {
            return 'NULL';
        }
    };

    sql += `INSERT INTO tracks (
    track_id, track_name, config_name, track_dirpath, track_config_length, 
    location, latitude, longitude, time_zone, corners_per_lap, category, 
    category_id, track_type, track_type_text, rain_enabled, night_lighting, 
    fully_lit, has_svg_map, supports_grip_compound, max_cars, grid_stalls, 
    number_pitstalls, pit_road_speed_limit, qualify_laps, solo_laps, 
    allow_rolling_start, allow_standing_start, allow_pitlane_collisions, 
    restart_on_left, start_on_left, has_start_zone, has_short_parade_lap, 
    has_opt_path, is_dirt, is_oval, price, package_id, sku, 
    free_with_subscription, is_ps_purchasable, purchasable, retired, 
    tech_track, award_exempt, created, opens, closes, folder, 
    small_image, logo, site_url, search_filters, priority, track_types
) VALUES (
    ${track.track_id},
    ${escapeValue(track.track_name)},
    ${escapeValue(track.config_name)},
    ${escapeValue(track.track_dirpath)},
    ${track.track_config_length || 'NULL'},
    ${escapeValue(track.location)},
    ${track.latitude || 'NULL'},
    ${track.longitude || 'NULL'},
    ${escapeValue(track.time_zone)},
    ${track.corners_per_lap || 'NULL'},
    ${escapeValue(track.category)},
    ${track.category_id || 'NULL'},
    ${track.track_type || 'NULL'},
    ${escapeValue(track.track_type_text)},
    ${track.rain_enabled},
    ${track.night_lighting},
    ${track.fully_lit},
    ${track.has_svg_map},
    ${track.supports_grip_compound},
    ${track.max_cars || 'NULL'},
    ${track.grid_stalls || 'NULL'},
    ${track.number_pitstalls || 'NULL'},
    ${track.pit_road_speed_limit || 'NULL'},
    ${track.qualify_laps || 'NULL'},
    ${track.solo_laps || 'NULL'},
    ${track.allow_rolling_start},
    ${track.allow_standing_start},
    ${track.allow_pitlane_collisions},
    ${track.restart_on_left},
    ${track.start_on_left},
    ${track.has_start_zone},
    ${track.has_short_parade_lap},
    ${track.has_opt_path},
    ${track.is_dirt},
    ${track.is_oval},
    ${track.price || 'NULL'},
    ${track.package_id || 'NULL'},
    ${track.sku || 'NULL'},
    ${track.free_with_subscription},
    ${track.is_ps_purchasable},
    ${track.purchasable},
    ${track.retired},
    ${track.tech_track},
    ${track.award_exempt},
    ${formatDate(track.created)},
    ${escapeValue(track.opens)},
    ${escapeValue(track.closes)},
    ${escapeValue(track.folder)},
    ${escapeValue(track.small_image)},
    ${escapeValue(track.logo)},
    ${escapeValue(track.site_url)},
    ${escapeValue(track.search_filters)},
    ${track.priority || 'NULL'},
    ${escapeValue(JSON.stringify(track.track_types))}
)
ON CONFLICT (track_id) DO UPDATE SET
    track_name = EXCLUDED.track_name,
    config_name = EXCLUDED.config_name,
    track_dirpath = EXCLUDED.track_dirpath,
    track_config_length = EXCLUDED.track_config_length,
    location = EXCLUDED.location,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    time_zone = EXCLUDED.time_zone,
    corners_per_lap = EXCLUDED.corners_per_lap,
    category = EXCLUDED.category,
    category_id = EXCLUDED.category_id,
    track_type = EXCLUDED.track_type,
    track_type_text = EXCLUDED.track_type_text,
    rain_enabled = EXCLUDED.rain_enabled,
    night_lighting = EXCLUDED.night_lighting,
    fully_lit = EXCLUDED.fully_lit,
    has_svg_map = EXCLUDED.has_svg_map,
    supports_grip_compound = EXCLUDED.supports_grip_compound,
    max_cars = EXCLUDED.max_cars,
    grid_stalls = EXCLUDED.grid_stalls,
    number_pitstalls = EXCLUDED.number_pitstalls,
    pit_road_speed_limit = EXCLUDED.pit_road_speed_limit,
    qualify_laps = EXCLUDED.qualify_laps,
    solo_laps = EXCLUDED.solo_laps,
    allow_rolling_start = EXCLUDED.allow_rolling_start,
    allow_standing_start = EXCLUDED.allow_standing_start,
    allow_pitlane_collisions = EXCLUDED.allow_pitlane_collisions,
    restart_on_left = EXCLUDED.restart_on_left,
    start_on_left = EXCLUDED.start_on_left,
    has_start_zone = EXCLUDED.has_start_zone,
    has_short_parade_lap = EXCLUDED.has_short_parade_lap,
    has_opt_path = EXCLUDED.has_opt_path,
    is_dirt = EXCLUDED.is_dirt,
    is_oval = EXCLUDED.is_oval,
    price = EXCLUDED.price,
    package_id = EXCLUDED.package_id,
    sku = EXCLUDED.sku,
    free_with_subscription = EXCLUDED.free_with_subscription,
    is_ps_purchasable = EXCLUDED.is_ps_purchasable,
    purchasable = EXCLUDED.purchasable,
    retired = EXCLUDED.retired,
    tech_track = EXCLUDED.tech_track,
    award_exempt = EXCLUDED.award_exempt,
    created = EXCLUDED.created,
    opens = EXCLUDED.opens,
    closes = EXCLUDED.closes,
    folder = EXCLUDED.folder,
    small_image = EXCLUDED.small_image,
    logo = EXCLUDED.logo,
    site_url = EXCLUDED.site_url,
    search_filters = EXCLUDED.search_filters,
    priority = EXCLUDED.priority,
    track_types = EXCLUDED.track_types;

`;
});

// Write the SQL file
fs.writeFileSync('update-tracks-from-iracing-api.sql', sql);

console.log('SQL file generated: update-tracks-from-iracing-api.sql');
console.log('This will insert new tracks and update existing ones with fresh iRacing data.');