@echo off
echo 🚀 Setting up tracks database...
echo.

REM Check if DATABASE_URL is set
if not defined DATABASE_URL (
    echo ❌ DATABASE_URL environment variable is not set
    echo Please set it first:
    echo set DATABASE_URL=postgresql://user:pass@host:port/database
    pause
    exit /b 1
)

echo ✅ DATABASE_URL is set
echo.

echo 📋 Step 1: Creating table structure...
REM You can run the SQL manually in DBeaver or use psql if available

echo 📊 Step 2: Populating track data from JSON...
python database-data\populate-tracks-db.py

if %errorlevel% neq 0 (
    echo ❌ Failed to populate tracks
    pause
    exit /b 1
)

echo.
echo 🎉 Tracks database setup completed!
echo.
pause