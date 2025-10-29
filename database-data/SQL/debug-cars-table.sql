-- Simple test to check if cars table is working
-- Run this first to debug the issue

-- Check if table exists
SELECT name FROM sqlite_master WHERE type='table' AND name='cars';

-- Check table structure
PRAGMA table_info(cars);

-- Try a very simple insert
INSERT INTO cars (car_id, car_name) VALUES (999, 'Test Car');

-- Check if it went in
SELECT COUNT(*) as total_cars FROM cars;
SELECT * FROM cars WHERE car_id = 999;