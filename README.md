# Endurance Planner Backend

A Node.js backend service for the Radian Motorsport endurance race planning system, designed to work with Render PostgreSQL for persistent strategy storage.

## 🏁 Project Overview

This backend serves the live endurance planner interface and provides API endpoints for:
- **Strategy Management**: Save/load race strategies with persistent storage
- **Live Race Planning**: Real-time stint calculations and pit stop optimization
- **Data Management**: Store drivers, cars, tracks, and race configurations
- **Health Monitoring**: Database connectivity and service status checks

## 📁 Project Structure

```
Endurance-Planner-Backend/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── public/
│   ├── liveupdating.html     # Live race planner UI (972 lines)
│   └── [other HTML files]   # Additional frontend pages
└── README.md                 # This file
```

## 🔧 Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (hosted on Render)
- **Frontend**: Vanilla HTML/CSS/JS with Tailwind CSS
- **Hosting**: Render.com
- **Region**: Frankfurt (EU Central) - matching other Radian services

## 📊 Database Schema

### Tables Created Automatically:
```sql
-- Driver information
CREATE TABLE drivers (
    name VARCHAR(255) PRIMARY KEY,
    drivernumber INT
);

-- Car/vehicle data  
CREATE TABLE cars (
    name VARCHAR(255) PRIMARY KEY
);

-- Track information
CREATE TABLE tracks (
    name VARCHAR(255) PRIMARY KEY
);

-- Strategy storage (main feature)
CREATE TABLE strategies (
    id VARCHAR(36) PRIMARY KEY,           -- UUID
    strategy_data JSONB NOT NULL,        -- Full strategy as JSON
    created_at TIMESTAMP DEFAULT NOW(),  -- When created
    updated_at TIMESTAMP DEFAULT NOW()   -- When modified
);
```

## 🚀 API Endpoints

### Core Data Management
- `GET /api/data` - Retrieve all drivers, cars, and tracks
- `POST /api/data` - Save drivers, cars, and tracks (replaces existing)

### Strategy Management
- `POST /api/strategies` - Save a race strategy
  - Returns: `{"id": "uuid-here"}`
  - Body: Complete strategy JSON object
- `GET /api/strategies/:id` - Load a specific strategy by ID
  - Returns: Full strategy data as JSON

### Health & Monitoring
- `GET /health` - Database connectivity check
  - Returns: `{"status": "healthy", "database": "connected", ...}`

### Frontend Pages
- `GET /` - Main landing page
- `GET /liveupdating.html` - Live race planner interface
- `GET /livev2.html` - Alternative live planner
- `GET /championship-tracker-v6.html` - Championship tracking

## ⚙️ Environment Variables

### Required:
- `DATABASE_URL` - PostgreSQL connection string from Render
  - Format: `postgresql://user:pass@host.render.internal:5432/database`
  - **Note**: Use Internal URL (`.render.internal`) for better performance

### Optional:
- `PORT` - Server port (defaults to 3000)

## 🔗 Render Setup Progress

### ✅ Completed:
- [x] Enhanced server.js with better database handling
- [x] Added connection pool settings for reliability  
- [x] Implemented graceful error handling
- [x] Added health check endpoint
- [x] Enhanced logging with clear status messages
- [x] Added created_at/updated_at timestamps to strategies table

### ⏳ In Progress:
- [ ] **Render PostgreSQL Creation** - Currently stuck on "Unknown" status
  - **Issue**: Render having temporary issues creating DBs in Frankfurt region
  - **Settings**: Basic-256mb, Frankfurt (EU Central), PostgreSQL 17
  - **Status**: Waiting for Render platform issue resolution

### 📋 Next Steps (When DB is Ready):
1. Copy Internal Database URL from Render PostgreSQL service
2. Add `DATABASE_URL` environment variable to web service
3. Deploy and verify connection via `/health` endpoint
4. Test strategy save/load functionality

## 🧪 Local Development

### Prerequisites:
```bash
npm install express pg cors uuid
```

### Running Locally:
```bash
# Without database (will error - need DATABASE_URL)
npm start

# With local PostgreSQL:
DATABASE_URL="postgresql://user:pass@localhost:5432/planner" npm start
```

### Expected Startup Logs:
```
🔗 Connecting to database...
🔧 Creating database tables...
✅ Database tables checked/created successfully.
✅ Database connection verified at: [timestamp]
🚀 Server initialization completed successfully!
Server is running on http://localhost:3000
```

## 🔍 Live Planner Features

The `/liveupdating.html` interface provides:

### Core Functionality:
- **Real-time race timer** with countdown
- **Stint calculations** based on fuel consumption and lap times
- **Pit stop simulation** with automatic and manual triggers
- **Dynamic adjustments** via sliders (fuel usage, lap time)
- **Repair time management** for unplanned stops

### Key Functions (JavaScript):
```javascript
// Core timer and race management
startRace() / stopRace() / toggleRace()
updateTimer() // Main loop - runs every second

// Strategy calculations  
calculateStintDuration()
populateStintTableFromLiveInputs()

// Pit stop simulation
simulateAutomaticPitEntry()
simulatePitExit()

// UI management
formatTime() / formatLapTime()
setupEventHandlers()
```

### Data Flow:
1. **User inputs**: Race duration, fuel per lap, tank size, lap time
2. **Calculations**: Laps per stint, stint duration, total pit stops
3. **Live tracking**: Current stint, pit timers, race countdown
4. **Strategy table**: Visual timeline of all stints and pit stops

## 🐛 Known Issues & Considerations

### Current Blockers:
- **Database provisioning** - Render Frankfurt region having issues
- **No fallback storage** - Server requires DATABASE_URL to start

### Future Improvements:
- [ ] Add in-memory fallback for development
- [ ] Implement strategy sharing via URLs  
- [ ] Add authentication for strategy management
- [ ] Real-time collaboration features
- [ ] Historical strategy analysis
- [ ] Integration with main RadianApp telemetry system

### Performance Notes:
- Strategy storage uses JSONB for flexible data structures
- Connection pooling configured for 20 max connections
- Health checks prevent cascading failures
- Frankfurt region chosen for low latency to other Radian services

## 🚨 Troubleshooting

### "DATABASE_URL environment variable is not set!"
- Ensure DATABASE_URL is added to Render web service environment variables
- Use the **Internal** database URL (ends with `.render.internal`)

### "Error creating database tables"
- Check database user has CREATE TABLE permissions
- Verify DATABASE_URL format is correct
- Check Render PostgreSQL service is in "Available" status

### Health check returns "unhealthy"
- Database connection failed
- Check Render PostgreSQL service status  
- Verify environment variables are set correctly
- Try using External database URL for testing

### "Unknown" database status for 20+ minutes
- Regional capacity issues (common in Frankfurt during peak hours)
- Platform-wide PostgreSQL provisioning problems
- Consider trying different region as temporary workaround

## 🔗 Related Services

This backend is part of the larger Radian Motorsport ecosystem:
- **RadianApp**: Main telemetry dashboard with integrated planner
- **RadianBuilder**: Electron wrapper for desktop deployment
- **Endurance-Planner-Backend**: This standalone service

All services designed to work together and share data structures for consistency.

---

**Last Updated**: September 22, 2025  
**Status**: Waiting for Render PostgreSQL provisioning to complete  
**Next Action**: Add DATABASE_URL environment variable when DB is ready