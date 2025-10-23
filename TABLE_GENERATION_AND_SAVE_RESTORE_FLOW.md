# Strategy Table Generation, Save & Restore Flow

## Overview
This document details the complete data flow for generating the strategy table, saving strategies to the database, and restoring them from shared links.

---

## 1. PAGE 1: Initial Data Selection

### Required Data for Page 1 Functionality
Page 1 collects the foundational race information that will be used throughout the application.

#### **1.1 Series Selection**
- **User Action:** Select from `#series-select` dropdown
- **Data Stored:** `this.selectedSeries` (entire series object)
- **Key Fields:**
  - `series_id` - Unique identifier
  - `series_name` - Display name
  - `logo` - Series logo URL

#### **1.2 Event Selection**
- **User Action:** Select from `#event-select` dropdown (populated after series selection)
- **Data Stored:** `this.selectedSessionDetails` (entire event/session object)
- **Key Fields:**
  - `event_id` - Unique identifier
  - `event_name` - Display name
  - `start_date` - Event start date/time
  - `session_length` - Race duration in minutes
  - `track_id` - Associated track identifier

#### **1.3 Track Selection**
- **User Action:** Select from `#track-select` dropdown (populated after event selection)
- **Data Stored:** `this.selectedTrack` (entire track object)
- **Key Fields:**
  - `track_id` - Unique identifier
  - `name` - Track name
  - `garage61_id` - Garage61 API identifier (for lap time data)
  - `track_map_layers` - Track map visualization data

#### **1.4 Car Selection**
- **User Action:** Select from `#car-select` dropdown (filtered by car class)
- **Data Stored:** `this.selectedCar` (entire car object)
- **Key Fields:**
  - `car_id` - Unique identifier
  - `name` - Car name
  - `class_id` - Car class identifier
  - `garage61_id` - Garage61 API identifier (for lap time data)

#### **1.5 Driver Selection**
- **User Action:** Search and add drivers from database
- **Data Stored:** `this.selectedDrivers` (array of driver objects)
- **Key Fields per Driver:**
  - `driver_id` - Unique identifier
  - `name` - Driver name
  - `timezone` - Driver's timezone (for local time calculations)
  - `iracing_id` - iRacing customer ID

#### **1.6 Garage61 Integration (Automatic)**
- **Trigger:** After both car AND track are selected
- **Function Called:** `checkGarage61Data()`
- **Purpose:** Fetch historical lap time data from Garage61 API
- **Requirements:**
  - `selectedCar.garage61_id` must exist (not null)
  - `selectedTrack.garage61_id` must exist (not null)
- **Result:** Displays lap times table with fastest/average lap data

---

## 2. PAGE 2: Strategy Calculator Inputs

### Required Data for Page 2 Functionality
Page 2 uses data from Page 1 plus additional user inputs to calculate race strategy.

#### **2.1 Data Inherited from Page 1**
When transitioning to Page 2, the following data is passed:
- `selectedTrack` → Used for track-specific calculations
- `selectedCar` → Used for fuel/tire calculations
- `selectedDrivers` → Used to populate stint driver dropdowns
- `selectedSessionDetails` → Contains:
  - `track_id` → For weather data fetching
  - `event_id` → For event-specific data
  - `start_date` → For race start time calculations

#### **2.2 Page 2 User Input Fields**

**Race Duration:**
- `#race-duration-hours` (hidden input, set from session data)
- `#race-duration-minutes` (hidden input, set from session data)
- **Purpose:** Total race length in hours and minutes

**Average Lap Time:**
- `#avg-lap-time-minutes` (user input)
- `#avg-lap-time-seconds` (user input)
- **Purpose:** Expected average lap time for strategy calculations

**Fuel Consumption:**
- `#fuel-per-lap-display-input` (user input)
- **Purpose:** Liters of fuel consumed per lap

**Tank Capacity:**
- `#tank-capacity-display-input` (user input)
- **Purpose:** Total fuel tank capacity in liters

**Pit Stop Duration:**
- `#pit-stop-time` (user input)
- **Purpose:** Average pit stop time in seconds

**Adjustment Sliders:**
- `#fuel-slider` (range: -2.0 to +2.0)
  - **Purpose:** Fine-tune fuel per lap without regenerating table
- `#lap-time-slider` (range: -3 to +3)
  - **Purpose:** Fine-tune lap time without regenerating table

#### **2.3 Session Metadata (Set Automatically)**
Before calculations, the following metadata is passed to `strategyCalculator`:
```javascript
strategyCalculator.setSessionMetadata(trackId, eventId)
```
- `trackId` → Used for weather API calls
- `eventId` → Used for event-specific data

---

## 3. TABLE GENERATION: Calculate Strategy Flow

### What Happens When "Calculate" is Clicked

#### **3.1 Pre-Calculation Setup**
```javascript
app.calculateStrategy() is called
```

**Step 1:** Validate Page 2 Inputs
- Race duration > 0
- Average lap time > 0
- Fuel per lap > 0
- Tank capacity > 0
- At least 1 driver selected

**Step 2:** Pass Drivers to Strategy Calculator
```javascript
strategyCalculator.setSelectedDrivers(this.selectedDrivers)
```
- **Critical:** This MUST happen before `populateStintTable()`
- Drivers are needed to populate stint driver dropdowns

**Step 3:** Pass Session Metadata (if not already set)
```javascript
strategyCalculator.setSessionMetadata(track_id, event_id)
```

#### **3.2 Strategy Calculation Process**

**strategyCalculator.calculateStrategy() executes:**

1. **Extract Inputs** (`extractInputs()`)
   - Reads all form values from DOM elements
   - Calculates total race duration in seconds
   - Calculates average lap time in seconds

2. **Apply Slider Adjustments** (`applySliderAdjustments()`)
   - Adds fuel slider value to base fuel per lap
   - Adds lap time slider value to base lap time

3. **Perform Core Calculations** (`performCalculations()`)
   - Calculates laps per tank: `floor(tankCapacity / fuelPerLap)`
   - Calculates total race laps: `floor(raceDuration / avgLapTime)`
   - Calculates number of stints: `ceil(totalLaps / lapsPerTank)`
   - Stores results in calculator instance properties

4. **Update Results Display** (`updateDisplays()`)
   - Shows total stints, total laps, fuel statistics
   - Updates summary cards

5. **Generate Stint Table** (`populateStintTable()`)
   - **THIS IS WHERE THE TABLE IS CREATED**

#### **3.3 Stint Table Generation Details**

**populateStintTable(avgLapTimeInSeconds):**

**Inputs Required:**
- `this.selectedDrivers` (array) - **MUST BE SET FIRST**
- `this.totalStints` - Number of stints calculated
- `this.lapsPerStint` - Laps per stint calculated
- `this.pitStopTime` - Pit stop duration
- `avgLapTimeInSeconds` - Average lap time
- `this.eventId` - For weather data (set via setSessionMetadata)
- `this.trackId` - For track map data (set via setSessionMetadata)

**Table Generation Process:**

For each stint (0 to totalStints):

1. **Calculate Stint Timing:**
   - Start time = previous stint end + pit stop time
   - End time = start time + (laps × lap time)
   - Calculate lap number range (start lap to end lap)

2. **Create Stint Row** (`createStintRow()`):
   - Stint number column
   - **Driver dropdown** - Populated with `generateDriverOptions()`:
     ```javascript
     this.selectedDrivers.forEach(driver => {
       <option value="${driver.name}">${driver.name}</option>
     })
     ```
   - **Backup driver dropdown** - Same driver list
   - Laps column
   - Start time column (formatted to display timezone)
   - End time column (formatted to display timezone)
   - Lap range column (e.g., "1-15")
   - Daylight status indicator (☀️ day / 🌙 night)

3. **Create Pit Stop Row** (after each stint except last):
   - Shows pit stop start/end times
   - Duration displayed
   - Advances time pointer for next stint

4. **Weather & Track Map Loading:**
   - `loadWeatherComponent()` - Fetches weather data for event
   - `loadTrackMapComponent()` - Loads track visualization

**Result:** Complete stint table with driver dropdowns populated and ready for manual driver assignment.

---

## 4. STINT DRIVER ASSIGNMENT

### User Actions After Table Generation

#### **4.1 Primary Driver Assignment**
- **Element:** `.driver-select-stint` dropdowns in each stint row
- **User Action:** Select which driver will drive this stint
- **Data Storage:** 
  - Dropdown value: driver name
  - Also stored in `window.stintDriverAssignments[stintIndex]`

#### **4.2 Backup Driver Assignment**
- **Element:** `.backup-select-stint` dropdowns in each stint row
- **User Action:** Select backup driver for this stint
- **Data Storage:** 
  - Dropdown value: driver name
  - Also stored in `window.stintBackupDriverAssignments[stintIndex]`

#### **4.3 Time Toggle Selection**
- **Element:** Driver selection dropdown in time toggle
- **User Action:** Select driver whose local time to display
- **Data Storage:** `strategyCalculator.selectedDriverForLocalTime`
- **State:** `strategyCalculator.isLocalTimeMode` (boolean)

---

## 5. DATA TO BE SAVED: Generate Share Link

### What Gets Saved When User Clicks "Generate Share Link"

#### **5.1 Page 1 Data Collected**
```javascript
{
  selectedSeries: this.selectedSeries,           // Full series object
  selectedEvent: this.selectedSessionDetails,     // Full event/session object
  selectedTrack: this.selectedTrack,              // Full track object
  selectedCar: this.selectedCar,                  // Full car object
  selectedDrivers: this.selectedDrivers           // Array of full driver objects
}
```

#### **5.2 Page 2 Form Data Collected**
```javascript
formData: {
  raceDurationHours: '...',
  raceDurationMinutes: '...',
  avgLapTimeMinutes: '...',
  avgLapTimeSeconds: '...',
  fuelPerLap: '...',
  tankCapacity: '...',
  pitStopTime: '...',
  fuelSlider: '0',          // Slider adjustment value
  lapTimeSlider: '0'        // Slider adjustment value
}
```

#### **5.3 Strategy Calculator State**
```javascript
strategyState: {
  totalStints: number,                          // Number of stints calculated
  raceDurationSeconds: number,                   // Total race duration
  lapsPerStint: number,                          // Laps per stint
  pitStopTime: number,                           // Pit stop duration
  isLocalTimeMode: boolean,                      // Time display mode
  selectedDriverForLocalTime: 'driver name'      // Driver for local time display
}
```

#### **5.4 Stint Driver Assignments**
```javascript
stintDriverAssignments: {
  '0': 'Driver Name',     // Primary driver for stint 1
  '1': 'Driver Name',     // Primary driver for stint 2
  ...
}

stintBackupDriverAssignments: {
  '0': 'Backup Name',     // Backup driver for stint 1
  '1': 'Backup Name',     // Backup driver for stint 2
  ...
}
```
**Collection Method:**
- Reads from `.driver-select-stint` dropdowns in DOM
- Reads from `.backup-select-stint` dropdowns in DOM
- Indexed by stint number (0-based)

#### **5.5 UI State (Collapsed/Expanded Containers)**
```javascript
uiState: {
  weatherCollapsed: boolean,     // Weather container state
  trackMapCollapsed: boolean     // Track map container state
}
```

#### **5.6 Metadata**
```javascript
{
  createdAt: '2025-10-23T12:00:00.000Z',  // ISO timestamp
  version: '1.0'                           // Data structure version
}
```

### Complete Saved Strategy Object
```javascript
const strategyData = {
  selectedSeries: { series_id, series_name, logo },
  selectedEvent: { event_id, event_name, start_date, session_length, track_id },
  selectedTrack: { track_id, name, garage61_id, track_map_layers },
  selectedCar: { car_id, name, class_id, garage61_id },
  selectedDrivers: [{ driver_id, name, timezone, iracing_id }, ...],
  formData: { raceDurationHours, raceDurationMinutes, avgLapTimeMinutes, ... },
  strategyState: { totalStints, raceDurationSeconds, lapsPerStint, ... },
  stintDriverAssignments: { '0': 'Driver', '1': 'Driver', ... },
  stintBackupDriverAssignments: { '0': 'Backup', '1': 'Backup', ... },
  uiState: { weatherCollapsed: false, trackMapCollapsed: false },
  createdAt: '...',
  version: '1.0'
};
```

**This object is sent to:**
```
POST /api/strategies
```
**Returns:** `{ id: 'strategy_uuid' }`

**Share URL Generated:**
```
https://domain.com?strategy=strategy_uuid
```

---

## 6. SHARED LINK RESTORATION: Complete Flow

### What Happens When Shared Link is Opened

When user opens `?strategy=strategy_uuid`, the application executes `checkForSharedStrategy()`.

#### **6.1 Fetch Strategy Data**
```javascript
const response = await fetch(`/api/strategies/${strategyId}`);
const strategyData = await response.json();
```

#### **6.2 Restore Page 1 Selections (In Order)**

**Step 1: Restore Series**
```javascript
if (strategyData.selectedSeries) {
  document.getElementById('series-select').value = strategyData.selectedSeries.series_id;
  await handleSeriesSelection(strategyData.selectedSeries.series_id);
}
```
- Sets dropdown value
- Calls `handleSeriesSelection()` which:
  - Finds series object from `allData.series`
  - Stores in `this.selectedSeries`
  - Displays series logo
  - Populates events dropdown

**Step 2: Restore Event**
```javascript
if (strategyData.selectedEvent) {
  document.getElementById('event-select').value = strategyData.selectedEvent.event_id;
  await handleEventSelection(strategyData.selectedEvent.event_id);
}
```
- Sets dropdown value
- Calls `handleEventSelection()` which:
  - Populates sessions dropdown

**Step 3: Restore Track**
```javascript
if (strategyData.selectedTrack) {
  document.getElementById('track-select').value = strategyData.selectedTrack.name;
  handleTrackSelection(strategyData.selectedTrack.name);
}
```
- Sets dropdown value
- Calls `handleTrackSelection()` which:
  - Finds track object from `allData.tracks`
  - Stores in `this.selectedTrack`
  - Shows track information

**Step 4: Restore Car**
```javascript
if (strategyData.selectedCar) {
  await populateCarsByClass(strategyData.selectedCar.class_id);
  document.getElementById('car-select').value = strategyData.selectedCar.car_id;
  await handleCarSelection(strategyData.selectedCar.car_id);
}
```
- Populates car dropdown with correct class
- Sets dropdown value
- Calls `handleCarSelection()` which:
  - Finds car object from `allData.cars`
  - Stores in `this.selectedCar`
  - Shows car information

**Step 5: Check Garage61 Data**
```javascript
checkGarage61Data();
```
- Called explicitly after car and track are set
- Fetches lap time data from Garage61 API
- Displays lap times table

**Step 6: Restore Drivers**
```javascript
if (strategyData.selectedDrivers && Array.isArray(strategyData.selectedDrivers)) {
  this.selectedDrivers = strategyData.selectedDrivers;
  this.updateDriversList();
}
```
- Restores driver array to app instance
- Updates driver list display on Page 1

#### **6.3 Restore Session Metadata**
```javascript
if (this.strategyCalculator && strategyData.selectedEvent && strategyData.selectedTrack) {
  this.strategyCalculator.setSessionMetadata(
    strategyData.selectedTrack.track_id,
    strategyData.selectedEvent.event_id
  );
  
  await this.strategyCalculator.loadWeatherComponent();
  await this.strategyCalculator.loadTrackMapComponent();
}
```
- Sets track and event IDs on strategy calculator
- Pre-loads weather data
- Pre-loads track map data

#### **6.4 Restore Page 2 Form Data**
```javascript
if (strategyData.formData) {
  applyPage2FormData(strategyData.formData);
}
```

**applyPage2FormData() sets all form inputs:**
```javascript
document.getElementById('race-duration-hours').value = formData.raceDurationHours;
document.getElementById('race-duration-minutes').value = formData.raceDurationMinutes;
document.getElementById('avg-lap-time-minutes').value = formData.avgLapTimeMinutes;
document.getElementById('avg-lap-time-seconds').value = formData.avgLapTimeSeconds;
document.getElementById('fuel-per-lap-display-input').value = formData.fuelPerLap;
document.getElementById('tank-capacity-display-input').value = formData.tankCapacity;
document.getElementById('pit-stop-time').value = formData.pitStopTime;
document.getElementById('fuel-slider').value = formData.fuelSlider || '0';
document.getElementById('lap-time-slider').value = formData.lapTimeSlider || '0';
```

#### **6.5 Restore Strategy Calculator State**
```javascript
if (strategyData.strategyState && this.strategyCalculator) {
  Object.assign(this.strategyCalculator, strategyData.strategyState);
}
```
- Restores: `totalStints`, `raceDurationSeconds`, `lapsPerStint`, `pitStopTime`, `isLocalTimeMode`, `selectedDriverForLocalTime`

#### **6.6 Restore UI State**
```javascript
if (strategyData.uiState) {
  // Weather container
  if (strategyData.uiState.weatherCollapsed) {
    document.getElementById('weather-display-page2').classList.add('collapsed');
  }
  
  // Track map container
  if (strategyData.uiState.trackMapCollapsed) {
    document.getElementById('track-map-container-page2').classList.add('collapsed');
  }
}
```

#### **6.7 Navigate to Page 2 and Calculate**
```javascript
if (strategyData.formData) {
  this.uiManager.showPage2();
  
  // Store stint assignments for restoration after table generation
  window.stintDriverAssignments = strategyData.stintDriverAssignments;
  window.stintBackupDriverAssignments = strategyData.stintBackupDriverAssignments;
  
  setTimeout(async () => {
    // CRITICAL: Pass drivers to strategyCalculator BEFORE calculating
    if (this.strategyCalculator && this.selectedDrivers) {
      this.strategyCalculator.setSelectedDrivers(this.selectedDrivers);
    }
    
    await this.calculateStrategy();
    
    // Restore stint driver assignments after table is generated
    this.restoreStintDriverAssignments(strategyData);
    
  }, 500);
}
```

**Critical Sequence:**
1. Switch to Page 2 UI
2. Store stint assignments in `window` object (temporary storage)
3. Wait 500ms for UI to fully render
4. **Pass drivers to calculator** (enables dropdown population)
5. Call `calculateStrategy()` (generates table with populated dropdowns)
6. Restore stint driver assignments (sets dropdown values)

#### **6.8 Restore Stint Driver Assignments**

**restoreStintDriverAssignments(strategyData):**

```javascript
const tbody = document.getElementById('stint-table-body');
const rows = tbody.querySelectorAll('tr[data-role="stint"]');

// Restore primary driver assignments
Object.entries(strategyData.stintDriverAssignments).forEach(([stintIndex, driverName]) => {
  const row = rows[parseInt(stintIndex)];
  const driverSelect = row.querySelector('.driver-select-stint');
  if (driverSelect) {
    driverSelect.value = driverName;
  }
});

// Restore backup driver assignments
Object.entries(strategyData.stintBackupDriverAssignments).forEach(([stintIndex, backupName]) => {
  const row = rows[parseInt(stintIndex)];
  const backupSelect = row.querySelector('.backup-select-stint');
  if (backupSelect) {
    backupSelect.value = backupName;
  }
});
```

**Result:** Each stint row has the correct driver and backup driver selected in dropdowns.

---

## 7. EXPECTED RESULT AFTER RESTORATION

### Page 1 (Not Visible - Data Loaded)
- ✅ Series selection restored
- ✅ Event selection restored  
- ✅ Track selection restored
- ✅ Car selection restored
- ✅ Drivers list restored
- ✅ Garage61 lap times displayed

### Page 2 (Visible to User)
- ✅ All form inputs populated with saved values
- ✅ Sliders set to saved positions
- ✅ Strategy calculated automatically
- ✅ Stint table generated with correct number of stints
- ✅ Driver dropdowns populated with team drivers
- ✅ Primary driver selections restored for each stint
- ✅ Backup driver selections restored for each stint
- ✅ Time display mode restored (local/race time)
- ✅ Weather component displayed (if available)
- ✅ Track map component displayed (if available)
- ✅ Weather container collapse state restored
- ✅ Track map container collapse state restored
- ✅ All timing calculations accurate
- ✅ Daylight indicators correct

### User Can Immediately:
- View complete strategy
- Modify stint assignments
- Adjust sliders to fine-tune
- Continue editing strategy
- Re-save updated strategy

---

## 8. CRITICAL DEPENDENCIES

### For Table Generation to Work:
1. `strategyCalculator.setSelectedDrivers()` MUST be called BEFORE `populateStintTable()`
2. `strategyCalculator.setSessionMetadata()` MUST be called BEFORE weather/track loading
3. All Page 2 form inputs MUST have values before `calculateStrategy()`
4. At least one driver MUST be in `selectedDrivers` array

### For Shared Link Restoration to Work:
1. All Page 1 selections MUST be restored BEFORE Page 2
2. Drivers MUST be passed to calculator BEFORE calculate is called
3. Stint assignments MUST be restored AFTER table is generated
4. Form inputs MUST match the IDs that `extractInputs()` reads from

### Data Flow Sequence (MUST FOLLOW THIS ORDER):
```
1. Load strategy data from API
2. Restore Page 1 selections (series → event → track → car)
3. Check Garage61 data
4. Restore drivers array
5. Set session metadata on calculator
6. Load weather/track components
7. Restore Page 2 form inputs
8. Restore strategy calculator state
9. Restore UI state
10. Show Page 2
11. Store stint assignments temporarily
12. Wait for UI render
13. Pass drivers to calculator ← CRITICAL
14. Calculate strategy (generates table)
15. Restore stint driver dropdown selections
```

**If this sequence is violated, the table may not generate correctly or dropdowns may be empty.**

---

## 9. COMMON ISSUES & FIXES

### Issue: Dropdowns are Empty
- **Cause:** `setSelectedDrivers()` not called before `populateStintTable()`
- **Fix:** Ensure drivers are passed to calculator in the setTimeout before `calculateStrategy()`

### Issue: Stint Assignments Not Restored
- **Cause:** `restoreStintDriverAssignments()` called before table is generated
- **Fix:** Call restoration AFTER `calculateStrategy()` completes

### Issue: Form Data Not Applied
- **Cause:** Form input ID mismatch between save/restore
- **Fix:** Verify `collectPage2FormData()` and `applyPage2FormData()` use identical IDs

### Issue: Garage61 Data Not Loading
- **Cause:** `checkGarage61Data()` not called after car/track restoration
- **Fix:** Explicitly call after both car and track are set

### Issue: Weather/Track Not Loading
- **Cause:** `setSessionMetadata()` not called before component load
- **Fix:** Call `setSessionMetadata()` before `loadWeatherComponent()` and `loadTrackMapComponent()`

---

## 10. TESTING CHECKLIST

### Manual Test Procedure:

**Setup Phase:**
1. Select series, event, track, car on Page 1
2. Add 3-4 drivers
3. Verify Garage61 lap times display
4. Navigate to Page 2
5. Fill in all form inputs
6. Click Calculate - verify table generates
7. Assign drivers to stints manually
8. Set backup drivers
9. Toggle time mode
10. Collapse/expand weather/track containers

**Save Phase:**
11. Click "Generate Share Link"
12. Verify URL contains `?strategy=xxx`
13. Copy share link

**Restore Phase:**
14. Open new browser tab (or incognito)
15. Paste share link
16. Wait for automatic loading

**Verification:**
- [ ] Series logo displays
- [ ] Event details shown
- [ ] Track information shown
- [ ] Car information shown
- [ ] Drivers list shows all team drivers
- [ ] Garage61 lap times table displays
- [ ] Page 2 form inputs match saved values
- [ ] Table generated automatically
- [ ] Correct number of stints
- [ ] Driver dropdowns contain all drivers
- [ ] Primary driver selections match original
- [ ] Backup driver selections match original
- [ ] Time mode matches original
- [ ] Weather container state matches
- [ ] Track map container state matches
- [ ] All calculations accurate

---

## Document Version
- **Version:** 1.0
- **Last Updated:** 2025-10-23
- **Maintained By:** Development Team

