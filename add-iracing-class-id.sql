-- Update cars table to use iRacing class IDs instead of string class names
-- Run this script to migrate from class VARCHAR to iracing_class_id INTEGER

-- First, add the new column
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS iracing_class_id INTEGER;

-- Remove the old class column if it exists
ALTER TABLE cars 
DROP COLUMN IF EXISTS class;

-- Create an index for better performance when filtering by class
CREATE INDEX IF NOT EXISTS idx_cars_iracing_class_id ON cars(iracing_class_id);

-- Verify the structure
-- \d cars;