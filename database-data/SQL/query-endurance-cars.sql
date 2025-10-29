-- Query to show endurance racing cars by class
-- Run this to see which cars are in your key racing classes

SELECT 'GT3 Cars' as category, '' as separator;
SELECT 
    cc.car_class_id,
    cc.name as class_name,
    c.name as car_name
FROM car_classes cc
LEFT JOIN cars c ON c.iracing_class_id = cc.car_class_id
WHERE cc.car_class_id IN (4083, 2708, 4091)
ORDER BY cc.car_class_id, c.name;

SELECT '' as separator, '' as separator;
SELECT 'GT4 Cars' as category, '' as separator;
SELECT 
    cc.car_class_id,
    cc.name as class_name,
    c.name as car_name
FROM car_classes cc
LEFT JOIN cars c ON c.iracing_class_id = cc.car_class_id
WHERE cc.car_class_id IN (4048, 4084)
ORDER BY cc.car_class_id, c.name;

SELECT '' as separator, '' as separator;
SELECT 'GTP Cars' as category, '' as separator;
SELECT 
    cc.car_class_id,
    cc.name as class_name,
    c.name as car_name
FROM car_classes cc
LEFT JOIN cars c ON c.iracing_class_id = cc.car_class_id
WHERE cc.car_class_id = 4029
ORDER BY c.name;

SELECT '' as separator, '' as separator;
SELECT 'Porsche Cup Cars' as category, '' as separator;
SELECT 
    cc.car_class_id,
    cc.name as class_name,
    c.name as car_name
FROM car_classes cc
LEFT JOIN cars c ON c.iracing_class_id = cc.car_class_id
WHERE cc.car_class_id = 3104
ORDER BY c.name;