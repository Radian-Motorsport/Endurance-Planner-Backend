# RadianPlanner iRacing Data Update System

Comprehensive system for automatically refreshing iRacing API data for RadianPlanner endurance racing platform.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd update-data
npm install
```

### 2. Set Credentials
```bash
# Windows
set IRACING_EMAIL=your@email.com
set IRACING_PASSWORD=yourpassword

# Linux/Mac
export IRACING_EMAIL=your@email.com
export IRACING_PASSWORD=yourpassword
```

### 3. Test Connection
```bash
npm run test
```

### 4. Run Data Refresh
```bash
# Quick refresh (seasons + schedules)
npm run quick

# Full refresh (all data)
npm run full

# Weekly refresh (seasons + schedules + drivers)
npm run weekly
```

## 📁 System Components

### Core Files
- **`api-manager.js`** - Handles authentication, rate limiting, and API requests
- **`data-pipeline.js`** - Orchestrates all refresh operations
- **`config.json`** - Configuration for series, team members, and settings

### Refresh Scripts
- **`refresh-seasons-data.js`** - Updates season information
- **`refresh-schedules-data.js`** - Updates race schedules  
- **`refresh-cars-data.js`** - Updates car database
- **`refresh-tracks-data.js`** - Updates track database
- **`refresh-drivers-data.js`** - Updates team member data

### Utilities
- **`test-api.js`** - Tests API connection and authentication
- **`package.json`** - Dependencies and npm scripts

## 🎯 Target Data

### Endurance Racing Series
- **Global Endurance Tour** (331)
- **IMSA Endurance Series** (419) 
- **GT Endurance Series by Simucube** (237)
- **Creventic Endurance Series** (451)
- **Nurburgring Endurance Championship** (275)

### Team Members
- **24 Radian Motorsport drivers** with complete stats and ratings

## 📊 Usage Examples

### Individual Operations
```bash
# Update only seasons data
npm run seasons

# Update only schedules
npm run schedules

# Update only team drivers
npm run drivers

# Update car database
npm run cars

# Update track database  
npm run tracks
```

### Pipeline Operations
```bash
# Full refresh - all data (uses 5+ API calls)
node data-pipeline.js full

# Quick refresh - racing data only (uses 2 API calls)  
node data-pipeline.js quick

# Weekly refresh - racing + driver data (uses 3 API calls)
node data-pipeline.js weekly
```

## ⚡ Rate Limit Management

### iRacing API Limits
- **12 requests per hour** maximum
- **Automatic rate limit checking** before each request
- **Request counting** with hourly reset
- **Error handling** for rate limit exceeded

### Smart Request Strategy
- **High Priority**: Seasons, Schedules (always run first)
- **Medium Priority**: Drivers (weekly updates)
- **Low Priority**: Cars, Tracks (monthly updates)

### Rate Limit Tips
```bash
# Check current usage before running
node test-api.js

# Use quick refresh for daily updates
npm run quick

# Use full refresh only monthly
npm run full
```

## 📂 Output Files

### Data Files (with timestamps)
- `seasons-data-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- `schedules-data-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- `car-classes-data-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- `tracks-data-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- `radian-team-data-YYYY-MM-DDTHH-mm-ss-sssZ.json`

### Latest Files (overwritten)
- `seasons-data.json`
- `schedules-data.json` 
- `car-classes-data.json`
- `tracks-data.json`
- `radian-team-data.json`

### Summary Reports
- `pipeline-summary-YYYY-MM-DDTHH-mm-ss-sssZ.json`
- `*-refresh-summary-YYYY-MM-DDTHH-mm-ss-sssZ.json`

## 🔧 Configuration

### Edit `config.json` to modify:
- **Target series IDs** - Add/remove endurance series
- **Team member list** - Add/remove driver customer IDs
- **Update frequency** - Adjust refresh schedules
- **API limits** - Modify rate limit settings

### Example Configuration Changes
```json
{
  "enduranceSeries": {
    "331": "Global Endurance Tour",
    "419": "IMSA Endurance Series"
  },
  "teamMembers": [349255, 1175717, 934674],
  "updateSchedule": {
    "seasons": "daily",
    "schedules": "daily",
    "drivers": "weekly"
  }
}
```

## 🚨 Error Handling

### Common Issues
1. **Authentication Failed**
   - Check email/password environment variables
   - Verify iRacing account is active

2. **Rate Limit Exceeded**
   - Wait for hourly reset
   - Use `npm run quick` instead of `npm run full`

3. **Network Errors**
   - Check internet connection
   - iRacing API may be temporarily down

### Error Logs
- Automatic error logging to `*-refresh-error-*.json` files
- Console output with detailed error messages
- Recommendations for resolution

## 📈 Automation Ideas

### Daily Cron Job (Linux/Mac)
```bash
# Add to crontab: run quick refresh every day at 6 AM
0 6 * * * cd /path/to/update-data && npm run quick
```

### Windows Task Scheduler
- **Program**: `node`
- **Arguments**: `data-pipeline.js quick`
- **Start in**: `C:\\path\\to\\update-data`
- **Schedule**: Daily

### Integration with RadianPlanner
```bash
# After successful refresh, trigger database updates
npm run quick && cd ../iracing-database-integration && node generate-racing-schema-inserts.js
```

## 🔗 Integration Points

### With Database System
1. Run data refresh: `npm run quick`
2. Generate SQL: `node ../iracing-database-integration/generate-racing-schema-inserts.js`
3. Deploy to database: Run generated SQL files

### With Garage61 Integration
- Uses existing `garage61-all-tracks.json` for track mapping
- Maintains team member garage61_slug relationships
- Supports cross-platform data correlation

## 📊 Monitoring

### Pipeline Summary Reports
- **Operation status** - Success/failure for each refresh
- **Duration tracking** - Performance monitoring
- **Rate limit usage** - API quota management
- **Error analysis** - Failure pattern identification

### Health Checks
```bash
# Test API connectivity
npm run test

# Check last refresh status
cat pipeline-summary-*.json | tail -1
```

## 🎯 Best Practices

### Recommended Schedule
- **Daily**: `npm run quick` (seasons + schedules)
- **Weekly**: `npm run drivers` (team member updates)  
- **Monthly**: `npm run cars` and `npm run tracks`

### Data Management
- Keep timestamped files for history
- Monitor file sizes for API changes
- Regular cleanup of old files (>30 days)

### Security
- Never commit credentials to git
- Use environment variables for sensitive data
- Regularly rotate iRacing password

---

## 🚀 Ready to Use!

This system provides complete automation for iRacing data refresh with proper rate limiting, error handling, and integration points for the RadianPlanner database system.