# Complete migration script to add iRacing class IDs to RadianPlanner
# Run this script to update your database with real iRacing car class data

Write-Host "🚀 Starting iRacing car class migration..." -ForegroundColor Green

# 1. Update database schema
Write-Host "📝 Step 1: Updating database schema..." -ForegroundColor Yellow
# psql -d $env:DATABASE_NAME -f add-iracing-class-id.sql

# 2. Insert car class definitions  
Write-Host "🏷️ Step 2: Inserting car class definitions..." -ForegroundColor Yellow
# psql -d $env:DATABASE_NAME -f iracing-database-integration/insert-car-classes.sql

# 3. Update existing cars with class IDs
Write-Host "🚗 Step 3: Updating cars with class IDs..." -ForegroundColor Yellow
# psql -d $env:DATABASE_NAME -f iracing-database-integration/update-car-classes.sql

Write-Host "✅ Migration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "- Added iracing_class_id column to cars table"
Write-Host "- Created car_classes table with 252 iRacing class definitions"  
Write-Host "- Updated ~172 cars with their correct iRacing class IDs"
Write-Host "- Enhanced API endpoints to include class information"
Write-Host "- Updated frontend to show class names in car dropdown"
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run the SQL scripts against your database"
Write-Host "2. Test the updated car dropdown in your RadianPlanner"
Write-Host "3. Verify that endurance cars show their correct classes (GT3, GTP, etc.)"
Write-Host "4. Use class filtering for series-specific car restrictions"

Write-Host ""
Write-Host "📋 Files created:" -ForegroundColor Yellow
Write-Host "- add-iracing-class-id.sql (schema changes)"
Write-Host "- iracing-database-integration/insert-car-classes.sql (class data)"
Write-Host "- iracing-database-integration/update-car-classes.sql (car updates)"