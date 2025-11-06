// Generate SQL UPDATE statements for all processed racing lines
// Racing lines are already correctly oriented from batch processing
const fs = require('fs');
const path = require('path');

const processedDir = path.join(__dirname, 'processed-maps');
const outputFile = path.join(__dirname, 'update-racing-lines.sql');

console.log('📊 Generating SQL UPDATE statements...\n');

const files = fs.readdirSync(processedDir)
  .filter(f => f.startsWith('track-') && f.endsWith('.json') && !f.includes('bridges'));

const statements = [];

statements.push('-- Racing line updates generated from batch processing');
statements.push('-- Total tracks: ' + files.length);
statements.push('-- Generated: ' + new Date().toISOString());
statements.push('');

let successCount = 0;
let skipCount = 0;

for (const file of files) {
  const trackId = file.match(/track-(\d+)\.json$/)?.[1];
  if (!trackId) {
    console.log(`⚠️  Skipping ${file} - couldn't extract track ID`);
    skipCount++;
    continue;
  }

  const filePath = path.join(processedDir, file);
  const points = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!Array.isArray(points) || points.length === 0) {
    console.log(`⚠️  Skipping track ${trackId} - invalid data`);
    skipCount++;
    continue;
  }

  // Racing lines are already correctly rotated and oriented from batch processing
  // No need for manual reversal

  // PostgreSQL expects JSONB format
  const jsonData = JSON.stringify({ points });
  
  // Escape single quotes for SQL
  const escapedJson = jsonData.replace(/'/g, "''");

  statements.push(`-- Track ${trackId}: ${points.length} points`);
  statements.push(`UPDATE tracks SET racing_line = '${escapedJson}'::jsonb WHERE track_id = ${trackId};`);
  statements.push('');

  successCount++;
}

statements.push('-- Summary:');
statements.push(`-- Successfully generated: ${successCount} updates`);
statements.push(`-- Skipped: ${skipCount} files`);

fs.writeFileSync(outputFile, statements.join('\n'), 'utf8');

console.log(`✅ Generated SQL file: ${outputFile}`);
console.log(`📊 Total updates: ${successCount}`);
console.log(`⚠️  Skipped: ${skipCount}`);
console.log('\nYou can now run this SQL file in DBeaver to update the database.');
