# 🌞 Daylight Calculation System

This system provides precise sunrise/sunset calculations for endurance racing strategy, helping teams plan driver changes and race conditions around daylight transitions.

## 📁 System Components

### **Core Files:**
- `daylightTable.js` - Reference table generator for latitude bands
- `track-coordinates.json` - GPS coordinates for 28 major racing circuits
- `update-tracks-coordinates.sql` - Database schema update script (in .gitignore)

### **Integration Points:**
- **Backend API**: Three daylight calculation endpoints in `server.js`
- **Frontend Display**: Automatic sunrise/sunset on page 2 of race planner
- **Database**: Latitude/longitude columns in tracks table

---

## 🚀 API Endpoints

### **1. Single Track Calculation**
```
GET /api/daylight/{trackId}/{date}
```
**Example:** `/api/daylight/232/2025-10-12` (Monza on Oct 12)

**Response:**
```json
{
  "track": {
    "name": "Autodromo Nazionale Monza Combined",
    "latitude": 45.6156,
    "longitude": 9.2811
  },
  "date": "2025-10-12",
  "times": {
    "sunrise": "2025-10-12T05:47:00.000Z",
    "sunset": "2025-10-12T16:58:00.000Z",
    "solarNoon": "2025-10-12T11:22:00.000Z"
  },
  "summary": {
    "daylightHours": "11.18",
    "solarNoonElevation": "41.2"
  }
}
```

### **2. Reference Table Generator**
```
GET /api/daylight/reference/{month}
```
**Example:** `/api/daylight/reference/6` (June reference)

Generates daylight data for latitude bands from -60° to +60° in 10° steps.

### **3. Bulk Track Processing**
```
POST /api/daylight/bulk
Content-Type: application/json

{
  "trackIds": [232, 95, 80],
  "date": "2025-10-12"
}
```

---

## 🏁 Race Planner Integration

### **Automatic Display:**
When users select a track and date on the race planner:
1. **Page 1**: Select track, date, and race start time
2. **Page 2**: Automatically displays:
   - 📅 Race Date
   - 🕐 Start Time
   - 🌅 Sunrise (calculated)
   - 🌇 Sunset (calculated)

### **Strategic Applications:**
- **Driver Changes**: Plan around sunset for night driving specialists
- **Pit Strategy**: Account for visibility changes during long stints
- **Safety Planning**: Know exact twilight periods for increased caution
- **Global Racing**: Compare daylight across different latitude tracks

---

## 📊 Track Coordinate Data

### **Coverage:**
28 major racing circuits with precise GPS coordinates:
- **Formula 1**: Silverstone, Monza, Spa-Francorchamps, etc.
- **Endurance**: Le Mans, Nürburgring, Watkins Glen, etc.
- **Global Tracks**: COTA, Suzuka, Mount Panorama, etc.

### **Precision:**
- **4 decimal places** (±11 meter accuracy)
- **Perfect for daylight calculations** (sunrise/sunset only need general location)
- **Race track scale appropriate** (tracks span several kilometers)

---

## 🛠️ Technical Implementation

### **Dependencies:**
- `suncalc` - Astronomical calculations library
- `express` - API endpoint framework
- `pg` - PostgreSQL database integration

### **Database Schema:**
```sql
ALTER TABLE tracks 
ADD COLUMN latitude DECIMAL(10,7),
ADD COLUMN longitude DECIMAL(10,7);
```

### **Calculation Method:**
Uses the SunCalc library for astronomical accuracy:
- Solar position calculations
- Civil twilight (dawn/dusk)
- Nautical and astronomical twilight
- Solar elevation angles

---

## 🌍 Latitude Band Reference

The reference table generator provides seasonal daylight patterns:

| Latitude | Example Location | June Daylight | December Daylight |
|----------|------------------|---------------|-------------------|
| 60°N     | Northern Scotland | 18.8 hours   | 5.9 hours        |
| 50°N     | Nürburgring      | 16.4 hours    | 8.2 hours        |
| 40°N     | Road America     | 14.9 hours    | 9.6 hours        |
| 30°N     | COTA             | 13.8 hours    | 10.4 hours       |
| 0°       | Equator          | 12.1 hours    | 12.1 hours       |
| -30°S    | Argentina        | 10.4 hours    | 13.8 hours       |

---

## 📝 Usage Examples

### **Endurance Race Planning:**
```javascript
// 24h Le Mans - plan driver rotations around sunset
const leMansId = 95;
const raceDate = "2025-06-14";
// Sunset around 21:30 local time - perfect for driver change
```

### **Strategic Decision Making:**
- **12h Sebring**: Plan final stint timing around sunrise (6:45 AM)
- **24h Nürburgring**: Expect 16+ hours of daylight in summer
- **6h COTA**: Short winter days mean mostly daylight racing

---

## 🔮 Future Enhancements

### **Potential Features:**
- **Local time conversion** based on track timezone
- **Golden hour calculations** for optimal photography
- **Weather integration** for cloud cover effects
- **Historical data** for multi-year race planning
- **Mobile-responsive** daylight widget

### **Integration Ideas:**
- **iRacing integration** for virtual endurance races
- **Live telemetry** connection for real-time conditions
- **Race broadcasting** for optimal camera angles

---

## 📄 License & Credits

**SunCalc Library**: https://github.com/mourner/suncalc
**Track Data Sources**: Various racing circuit official websites
**Coordinate Verification**: Cross-referenced with multiple GPS databases

---

*Built for endurance racing strategy optimization 🏁*