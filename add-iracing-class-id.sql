-- Update cars table to use iRacing class IDs and populate car classes
-- Run this script to migrate from class VARCHAR to iracing_class_id INTEGER

-- 1. Add the new column for iRacing class ID
ALTER TABLE cars 
ADD COLUMN IF NOT EXISTS iracing_class_id INTEGER;

-- 2. Remove the old class column if it exists
ALTER TABLE cars 
DROP COLUMN IF EXISTS class;

-- 3. Create car_classes table if it doesn't exist
CREATE TABLE IF NOT EXISTS car_classes (
    car_class_id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    relative_speed INTEGER DEFAULT 0,
    cars_in_class_count INTEGER DEFAULT 0,
    rain_enabled BOOLEAN DEFAULT false
);

-- 4. Add foreign key constraint (optional, but good practice)
-- ALTER TABLE cars 
-- ADD CONSTRAINT fk_cars_iracing_class 
-- FOREIGN KEY (iracing_class_id) REFERENCES car_classes(car_class_id);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cars_iracing_class_id ON cars(iracing_class_id);
CREATE INDEX IF NOT EXISTS idx_car_classes_name ON car_classes(name);

-- 6. Verify the structure
SELECT 'Cars table structure:' as info;
-- \d cars;

SELECT 'Car classes table structure:' as info;
-- \d car_classes;