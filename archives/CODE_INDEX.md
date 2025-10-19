# RadianPlanner Code Index

This document provides a comprehensive index of the main `index.html` file (2997 lines) to help navigate and maintain the codebase.

## 📁 File Structure Overview

```
index.html (2997 lines)
├── CSS Styles (lines 1-200)
├── HTML Structure (lines 201-650)
├── JavaScript Functions (lines 651-2997)
└── Event Handlers & Initialization
```

---

## 🎨 CSS Styles (Lines 1-200)

### Core Styling
- **Lines 15-50**: Base Tailwind and custom styles
- **Lines 51-100**: Component-specific styles
- **Lines 101-150**: Driver color classes
- **Lines 154-175**: Daylight gradient classes (6 stages)
- **Lines 176-200**: Toggle switch and UI styles

### Daylight Color Classes
- `.daylight-night` (154-158): Deep blue/black night
- `.daylight-pre-dawn` (159-163): Red/purple pre-dawn transition
- `.daylight-dawn` (164-168): Orange/yellow sunrise
- `.daylight-day` (169-173): Bright yellow/white day
- `.daylight-dusk` (174-178): Red/orange sunset
- `.daylight-post-dusk` (179-183): Purple/red post-dusk transition

---

## 🏗️ HTML Structure (Lines 201-650)

### Page 1: Race Configuration (Lines 201-450)
- **Lines 201-250**: Header and navigation
- **Lines 251-300**: Race details form (car, track, duration, lap times)
- **Lines 301-350**: Fuel configuration sliders
- **Lines 351-400**: Driver management section
- **Lines 401-450**: Weather forecast inputs (3 image URLs)

### Page 2: Stint Planning (Lines 451-650)
- **Lines 451-500**: Race summary display
- **Lines 501-550**: Time mode toggle and configuration
  - **Lines 515-530**: Time mode toggle switch (Race/Local)
  - **Lines 531-570**: Local time adjusters (hidden by default)
  - **Lines 571-590**: Practice/qualifying time input
- **Lines 591-650**: Stint table structure

---

## 🔧 JavaScript Functions (Lines 651-2997)

### 🚀 Initialization & Setup (Lines 651-850)
| Function | Lines | Purpose |
|----------|-------|---------|
| `DOMContentLoaded` | 651-700 | Initialize app, set up event listeners |
| `setupEventListeners()` | 701-850 | Configure all input change handlers |

### 📊 Data Management (Lines 851-1200)
| Function | Lines | Purpose |
|----------|-------|---------|
| `fetchDataAndPopulate()` | 851-950 | Load cars/tracks from API |
| `populateCarDropdown()` | 951-1000 | Fill car selection dropdown |
| `populateTrackDropdown()` | 1001-1050 | Fill track selection dropdown |
| `calculateAndShowPage2()` | 1051-1150 | Main calculation and page transition |
| `calculateDaylightForPage2()` | 1151-1200 | Fetch daylight times from API |

### 🌅 Daylight System (Lines 1201-1350)
| Function | Lines | Purpose |
|----------|-------|---------|
| `getDaylightStatus()` | 1201-1250 | Determine daylight phase for stint time |
| `calculateDaylightForPage2()` | 1251-1300 | API call for sunrise/sunset times |
| Global variables | 1301-1350 | `globalSunriseTime`, `globalSunsetTime` |

### 🌦️ Weather System (Lines 1351-1500)
| Function | Lines | Purpose |
|----------|-------|---------|
| `displayWeatherImages()` | 1351-1450 | Show weather forecast images |
| `convertToRawGitHubUrl()` | 1451-1500 | Convert GitHub blob URLs to raw URLs |

### ⏰ Time Management (Lines 1501-1650)
| Function | Lines | Purpose |
|----------|-------|---------|
| `toggleTimeMode()` | 1501-1550 | Switch between race/local time modes |
| `formatTimeWithTimezone()` | 1551-1600 | Format times with timezone/DST |
| `updateTimesOnly()` | 1601-1650 | Refresh stint times without losing data |

### 👥 Driver Management (Lines 1651-1800)
| Function | Lines | Purpose |
|----------|-------|---------|
| `addDriverToList()` | 1651-1700 | Add selected driver to team |
| `removeDriver()` | 1701-1750 | Remove driver from team |
| `renderDriverList()` | 1751-1800 | Update driver list display |

### 📋 Stint Table Generation (Lines 1801-2100)
| Function | Lines | Purpose |
|----------|-------|---------|
| `populateStintTable()` | 1801-2000 | **MAIN FUNCTION** - Generate complete stint table |
| `updateTimesOnly()` | 2001-2050 | Update times while preserving driver assignments |
| `populateStintDrivers()` | 2051-2100 | Fill driver dropdowns for each stint |

### 💾 Save/Load System (Lines 2101-2400)
| Function | Lines | Purpose |
|----------|-------|---------|
| `generateShareLink()` | 2101-2200 | Save strategy and create share link |
| `saveStrategyUpdate()` | 2201-2300 | Update existing saved strategy |
| `loadStrategyFromUrl()` | 2301-2400 | Load shared strategy from URL parameter |

### 🔧 Utility Functions (Lines 2401-2600)
| Function | Lines | Purpose |
|----------|-------|---------|
| `showPage1()` | 2401-2450 | Navigate to configuration page |
| `showPage2()` | 2451-2500 | Navigate to stint planning page |
| `updateStintRowColor()` | 2501-2550 | Apply driver colors to table rows |
| `formatTime()` | 2551-2600 | General time formatting utilities |

### 🛠️ Admin Functions (Lines 2601-2997)
| Function | Lines | Purpose |
|----------|-------|---------|
| `renderAdminLists()` | 2601-2700 | Display admin car/track management |
| `deleteCar()` | 2701-2750 | Remove car from database |
| `deleteTrack()` | 2751-2800 | Remove track from database |
| `populateStintDrivers()` | 2801-2900 | Driver dropdown population |
| Helper functions | 2901-2997 | Various utility functions |

---

## 🔄 Key Data Flow

### Race Configuration Flow
```
Page 1 Inputs → calculateAndShowPage2() → populateStintTable() → Page 2 Display
```

### Time Mode Toggle Flow
```
Toggle Switch → toggleTimeMode() → updateTimesOnly() → populateStintTable() → Table Refresh
```

### Save/Load Flow
```
Save: Current State → generateShareLink() → API → Share URL
Load: URL Parameter → loadStrategyFromUrl() → Restore All Inputs
```

---

## 🎯 Critical Functions to Know

### 1. `populateStintTable()` (Lines 1801-2000)
- **Most important function** - generates the entire stint breakdown
- Handles both race time and local time modes
- Calculates pit stops, driver assignments, daylight phases
- Preserves driver assignments when called with `preserveDriverAssignments = true`

### 2. `toggleTimeMode()` (Lines 1501-1550)
- Switches between race time (page 1 input) and local time (page 2 input)
- Controls visibility of timezone/local time adjusters
- Updates UI labels and triggers table refresh

### 3. `calculateAndShowPage2()` (Lines 1051-1150)
- Main transition function from page 1 to page 2
- Validates inputs and calculates race parameters
- Triggers daylight calculation and weather display

### 4. `updateTimesOnly()` (Lines 1601-1650)
- Safe way to refresh stint times without losing driver assignments
- Called by all time-related input change events
- Uses `preserveDriverAssignments = true`

---

## 🚨 Important Variables

### Global State
- `isRaceTimeMode` (boolean): Current time display mode
- `globalSunriseTime`, `globalSunsetTime`: Daylight calculation data
- `selectedDrivers`: Array of selected team drivers
- `window.currentStrategyId`: ID for save/update operations

### Key Elements
- `#stint-table-body`: Main table where stints are rendered
- `#local-time-adjusters`: Timezone controls (hidden in race mode)
- `#time-mode-toggle`: Switch between race/local time

---

## 📈 Optimization Opportunities

### Potential Improvements
1. **Split into modules**: Separate files for different functionality
2. **Extract CSS**: Move styles to separate stylesheet
3. **API wrapper**: Centralize all fetch calls
4. **State management**: Better organization of global variables
5. **Error handling**: More robust error management throughout

### Suggested File Structure
```
index.html (HTML only)
├── styles/
│   ├── main.css
│   └── components.css
├── scripts/
│   ├── main.js
│   ├── stint-calculator.js
│   ├── time-management.js
│   ├── driver-management.js
│   ├── weather-system.js
│   └── save-load.js
└── utils/
    ├── api.js
    └── formatters.js
```

---

## 🔍 Quick Navigation Tips

### Find Functions By Purpose
- **Time-related**: Search for "Time" or "timezone"
- **Driver-related**: Search for "Driver" or "stint-driver"
- **Save/Load**: Search for "api/strategies" or "localStorage"
- **Daylight**: Search for "daylight" or "sunrise"
- **Weather**: Search for "weather" or "github"

### Find HTML Elements
- **Input fields**: Search for `id="` + element name
- **Buttons**: Search for `onclick=` + function name
- **Containers**: Search for specific class names like `bg-neutral-`

---

*Last updated: October 12, 2025*
*File size: 2997 lines*
*Main functions: 45+*