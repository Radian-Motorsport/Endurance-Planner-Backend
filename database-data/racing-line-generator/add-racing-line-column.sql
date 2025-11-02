-- Add racing_line column to tracks table
-- This stores the processed racing line with sampled points, start/finish position, and metadata

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS racing_line JSONB;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tracks_racing_line ON tracks USING GIN (racing_line);

-- Add comment
COMMENT ON COLUMN tracks.racing_line IS 'Processed racing line data: {points: [{x,y}], point_count, start_finish: {x,y}, processed_at, version}';
