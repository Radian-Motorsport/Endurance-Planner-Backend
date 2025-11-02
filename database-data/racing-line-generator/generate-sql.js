const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'processed-maps');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let sql = '-- Bulk update racing_line data for all tracks\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n';
sql += '-- Total tracks: ' + files.length + '\n\n';

files.forEach(file => {
  const trackId = parseInt(file.replace('track-', '').replace('.json', ''));
  const jsonData = fs.readFileSync(path.join(dir, file), 'utf8');
  const escaped = jsonData.replace(/'/g, "''");
  sql += `UPDATE tracks SET racing_line = '${escaped}'::jsonb WHERE track_id = ${trackId};\n`;
});

const outputPath = path.join(__dirname, 'update-racing-lines.sql');
fs.writeFileSync(outputPath, sql);
console.log(`✅ Generated ${outputPath} with ${files.length} UPDATE statements`);
