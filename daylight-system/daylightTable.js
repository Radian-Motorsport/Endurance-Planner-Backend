// 🌞 Daylight Reference Table Generator (Endurance Racing)
// --------------------------------------------------------
// This script calculates daylight conditions—sunrise, sunset, civil twilight, and solar noon elevation—
// for latitude bands from -60° to +60° in 10° steps, across all 12 months (15th of each month).
// It's designed for endurance racing scenarios where daylight affects visibility, strategy, and telemetry gating.

// 📦 SETUP:
// 1. Open this file in Visual Studio Code.
// 2. Run: npm install suncalc
// 3. Execute: node daylightTable.js
// 4. Optional: Save output to file → node daylightTable.js > daylightTable.json

// 📚 Uses the SunCalc library: https://github.com/mourner/suncalc

const SunCalc = require('suncalc');

// Define latitude bands (-60° to +60° in 10° steps)
const latitudeBands = Array.from({ length: 13 }, (_, i) => -60 + i * 10);

// Define months (1 to 12)
const months = Array.from({ length: 12 }, (_, i) => i + 1);

// Store results
const results = [];

// Loop through each latitude and month
latitudeBands.forEach(lat => {
  months.forEach(month => {
    const date = new Date(Date.UTC(2025, month - 1, 15)); // 15th of each month
    const times = SunCalc.getTimes(date, lat, 0); // longitude = 0 for simplicity

    const solarNoon = SunCalc.getPosition(times.solarNoon, lat, 0);
    const elevationDeg = (solarNoon.altitude * 180) / Math.PI;

    results.push({
      latitude: lat,
      month,
      sunrise: times.sunrise.toISOString().slice(11, 16),
      sunset: times.sunset.toISOString().slice(11, 16),
      daylightHours: ((times.sunset - times.sunrise) / 3600000).toFixed(2),
      civilTwilightStart: times.dawn.toISOString().slice(11, 16),
      civilTwilightEnd: times.dusk.toISOString().slice(11, 16),
      solarNoonElevation: elevationDeg.toFixed(1)
    });
  });
});

// Output full JSON table to console
console.log(JSON.stringify(results, null, 2));

/*
📁 OUTPUT FORMAT:
Each entry looks like this:
{
  "latitude": 45,
  "month": 6,
  "sunrise": "04:45",
  "sunset": "21:15",
  "daylightHours": "16.50",
  "civilTwilightStart": "04:00",
  "civilTwilightEnd": "22:00",
  "solarNoonElevation": "68.2"
}

🛠️ CUSTOMIZATION OPTIONS:
- Change longitude from 0 to match specific tracks.
- Adjust date granularity (e.g., weekly or daily).
- Export to CSV or integrate into dashboards.
- Add golden hour logic using SunCalc.getTimes().
*/
