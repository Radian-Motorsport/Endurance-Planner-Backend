-- Add class column to cars table
-- Run this script if you have an existing cars table

ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS class VARCHAR(100);

-- Optional: Set a default class for existing cars if needed
-- UPDATE cars SET class = 'Unknown' WHERE class IS NULL;

-- Verify the column was added
-- SELECT * FROM cars LIMIT 5;