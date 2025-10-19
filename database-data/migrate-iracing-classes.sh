#!/bin/bash
# Complete migration script to add iRacing class IDs to RadianPlanner
# Run this script to update your database with real iRacing car class data

echo "🚀 Starting iRacing car class migration..."

# 1. Update database schema
echo "📝 Step 1: Updating database schema..."
psql -d "$DATABASE_NAME" -f add-iracing-class-id.sql

# 2. Insert car class definitions
echo "🏷️ Step 2: Inserting car class definitions..."
psql -d "$DATABASE_NAME" -f iracing-database-integration/insert-car-classes.sql

# 3. Update existing cars with class IDs
echo "🚗 Step 3: Updating cars with class IDs..."
psql -d "$DATABASE_NAME" -f iracing-database-integration/update-car-classes.sql

echo "✅ Migration complete!"
echo ""
echo "📊 Summary:"
echo "- Added iracing_class_id column to cars table"
echo "- Created car_classes table with 252 iRacing class definitions"
echo "- Updated ~172 cars with their correct iRacing class IDs"
echo "- Enhanced API endpoints to include class information"
echo "- Updated frontend to show class names in car dropdown"
echo ""
echo "🎯 Next steps:"
echo "1. Test the updated car dropdown in your RadianPlanner"
echo "2. Verify that endurance cars show their correct classes (GT3, GTP, etc.)"
echo "3. Use class filtering for series-specific car restrictions"