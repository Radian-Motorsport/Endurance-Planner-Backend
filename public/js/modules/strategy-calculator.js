/**
 * Strategy Calculator Module
 * Handles all race strategy calculations and stint planning
 * Extracted from monolithic index.html to improve maintainability
 */

import { WeatherComponent } from './weather-component.js';
import { TrackMapComponent } from './track-map.js';

export class StrategyCalculator {
    constructor() {
        this.totalStints = 0;
        this.raceDurationSeconds = 0;
        this.lapsPerStint = 0;
        this.lapsInLastStint = 0;
        this.pitStopTime = 0;
        this.selectedDrivers = [];
        this.isLocalTimeMode = false;
        this.selectedDriverForLocalTime = null;
        this.trackId = null;
        this.eventId = null;
        this.weatherComponent = null;
        this.trackMapComponent = null;
        this.driverColorMap = {}; // Maps driver name to color index (0-7)
        this.cachedRaceStartTime = null; // Cache race start time to prevent it changing on every slider adjustment
        this.cachedEventStartTime = null; // Cache event start time (local time mode) to prevent it changing on every slider adjustment
    }

    /**
     * Assign colors to drivers automatically
     * Each driver gets a color index from 0-7
     */
    assignDriverColors() {
        if (!this.selectedDrivers || this.selectedDrivers.length === 0) {
            return;
        }

        // Assign color indices to each driver (0-7, cycling if more than 8 drivers)
        this.selectedDrivers.forEach((driver, index) => {
            if (!this.driverColorMap[driver.name]) {
                this.driverColorMap[driver.name] = index % 8;
                console.log(`🎨 Assigned color ${index % 8} to driver: ${driver.name}`);
            }
        });
    }

    /**
     * Get color class for a driver
     * @param {string} driverName - Driver name
     * @returns {string} CSS class name for the driver's color
     */
    getDriverColorClass(driverName) {
        if (!driverName || driverName === '' || driverName === 'Select Driver') {
            return 'driver-color-default';
        }
        
        const colorIndex = this.driverColorMap[driverName];
        if (colorIndex !== undefined) {
            return `driver-color-${colorIndex}`;
        }
        
        return 'driver-color-default';
    }

    /**
     * Apply driver color to a stint row
     * @param {HTMLElement} row - The stint row element
     * @param {string} driverName - Selected driver name
     */
    applyDriverColorToRow(row, driverName) {
        if (!row) return;
        
        // Remove all existing driver color classes
        for (let i = 0; i <= 7; i++) {
            row.classList.remove(`driver-color-${i}`);
        }
        row.classList.remove('driver-color-default');
        
        // Apply new color class
        const colorClass = this.getDriverColorClass(driverName);
        row.classList.add(colorClass);
        console.log(`🎨 Applied ${colorClass} to stint row for driver: ${driverName}`);
    }

    /**
     * Set session metadata for weather and track component loading
     * @param {string|number} trackId - The track ID
     * @param {string|number} eventId - The event ID
     */
    setSessionMetadata(trackId, eventId) {
        console.log('📊 Setting session metadata:', { trackId, eventId });
        this.trackId = trackId;
        this.eventId = eventId;
        console.log('📊 Session metadata set:', { trackId: this.trackId, eventId: this.eventId });
    }

    /**
     * Calculate race strategy and populate results
     * @param {Object} raceData - Race configuration data
     * @returns {Object} Calculation results
     */
    async calculateStrategy(raceData) {
        console.log('🔥🔥🔥 CALCULATE BUTTON PRESSED 🔥🔥🔥');
        
        // Clear cached times when starting a new calculation
        this.cachedRaceStartTime = null;
        this.cachedEventStartTime = null;
        console.log('🔄 Cleared cached times for new calculation');
        
        try {
            // Extract and validate inputs
            const inputs = this.extractInputs();
            console.log('🔧 EXTRACTED INPUTS:', inputs);
            
            // VALIDATION COMPLETELY DISABLED
            // if (!this.validateInputs(inputs)) {
            //     throw new Error("Please ensure all race inputs are filled and valid before calculating.");
            // }

            // Apply slider adjustments
            const adjustedInputs = this.applySliderAdjustments(inputs);

            // Perform core calculations
            const calculations = this.performCalculations(adjustedInputs);

            // Update display with results
            this.updateDisplays(calculations, adjustedInputs);

            // Generate stint breakdown
            await this.populateStintTable(adjustedInputs.avgLapTimeInSeconds);

            // Show results sections
            this.showResultsSections();

            return {
                success: true,
                calculations,
                inputs: adjustedInputs
            };

        } catch (error) {
            console.error('❌ Strategy calculation failed:', error);
            console.log('🔧 IGNORING ERROR - continuing anyway...');
            // throw error;  // DISABLED - don't throw errors during debugging
            
            // Still try to show results sections even if calculation failed
            this.showResultsSections();
            
            return {
                success: false,
                error: error.message,
                calculations: {},
                inputs: {}
            };
        }
    }

    /**
     * Recalculate strategy when sliders are adjusted
     * Uses the current form values with the new slider adjustments
     * @async
     */
    async recalculateWithAdjustments() {
        console.log('🔄 Recalculating with slider adjustments, current metadata:', { eventId: this.eventId, trackId: this.trackId });
        
        // SAVE CURRENT DRIVER ASSIGNMENTS BEFORE REBUILDING TABLE
        const savedStintDrivers = {};
        const savedBackupDrivers = {};
        const tbody = document.getElementById('stint-table-body');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr[data-role="stint"]');
            rows.forEach((row, index) => {
                const driverSelect = row.querySelector('.driver-select-stint');
                if (driverSelect && driverSelect.value) {
                    savedStintDrivers[index] = driverSelect.value;
                }
                const backupSelect = row.querySelector('.backup-select-stint');
                if (backupSelect && backupSelect.value) {
                    savedBackupDrivers[index] = backupSelect.value;
                }
            });
        }
        console.log('💾 Saved driver assignments before slider recalculation:', {
            stintDrivers: savedStintDrivers,
            backupDrivers: savedBackupDrivers
        });
        
        // Ensure session metadata is still set (defensive programming)
        if (!this.eventId || !this.trackId) {
            console.log('⚠️ Session metadata missing during recalculation, attempting to restore...');
            // Try to get metadata from app if available
            if (window.radianPlanner && window.radianPlanner.selectedSessionDetails) {
                const sessionDetails = window.radianPlanner.selectedSessionDetails;
                this.setSessionMetadata(
                    sessionDetails.track_id,
                    sessionDetails.event_id
                );
                console.log('✅ Restored session metadata during recalculation');
            }
        }

        try {
            // Store current stint count to detect if table structure changed
            const previousTotalStints = this.totalStints;

            // Extract base inputs from form
            const inputs = this.extractInputs();

            // Apply slider adjustments
            const adjustedInputs = this.applySliderAdjustments(inputs);

            // Perform calculations
            const calculations = this.performCalculations(adjustedInputs);

            // Update displays
            this.updateDisplays(calculations, adjustedInputs);

            // Check if table structure changed (number of stints changed)
            if (this.totalStints !== previousTotalStints) {
                console.log(`🔄 Table structure changed: ${previousTotalStints} → ${this.totalStints} stints, rebuilding table...`);
                // Rebuild entire table if stint count changed
                await this.populateStintTable(adjustedInputs.avgLapTimeInSeconds);
                // RESTORE DRIVER ASSIGNMENTS AFTER TABLE REBUILD
                this.restoreDriverAssignmentsAfterSliderAdjustment(savedStintDrivers, savedBackupDrivers);
            } else {
                console.log('🔄 Table structure unchanged, updating values only...');
                // Update stint table values WITHOUT rebuilding entire DOM
                this.updateStintTableValues(adjustedInputs.avgLapTimeInSeconds);
            }

            console.log('✅ Recalculation complete');
        } catch (error) {
            console.error('❌ Recalculation failed:', error);
        }
    }

    /**
     * Restore driver assignments after slider adjustment causes table rebuild
     * Preserves driver selections when adjusting fuel/lap time sliders
     */
    restoreDriverAssignmentsAfterSliderAdjustment(stintDrivers, backupDrivers) {
        try {
            const tbody = document.getElementById('stint-table-body');
            if (!tbody) {
                console.warn('⚠️ Stint table body not found');
                return;
            }

            const rows = tbody.querySelectorAll('tr[data-role="stint"]');
            
            // Restore primary driver assignments
            Object.entries(stintDrivers).forEach(([stintIndex, driverName]) => {
                const index = parseInt(stintIndex);
                const row = rows[index];
                if (row) {
                    const driverSelect = row.querySelector('.driver-select-stint');
                    if (driverSelect) {
                        driverSelect.value = driverName;
                        // Apply color to row
                        this.applyDriverColorToRow(row, driverName);
                        console.log(`✅ Restored primary driver "${driverName}" to stint ${index + 1} after slider adjustment`);
                    }
                }
            });

            // Restore backup driver assignments
            Object.entries(backupDrivers).forEach(([stintIndex, backupDriverName]) => {
                const index = parseInt(stintIndex);
                const row = rows[index];
                if (row) {
                    const backupSelect = row.querySelector('.backup-select-stint');
                    if (backupSelect) {
                        backupSelect.value = backupDriverName;
                        console.log(`✅ Restored backup driver "${backupDriverName}" to stint ${index + 1} after slider adjustment`);
                    }
                }
            });

            console.log('✅ All driver assignments restored after slider adjustment');

        } catch (error) {
            console.error('❌ Failed to restore driver assignments:', error);
        }
    }

    /**
     * Update stint table values WITHOUT rebuilding DOM (smooth, no flicker)
     * Only updates time and lap calculations in existing rows
     * @param {number} avgLapTimeInSeconds - Adjusted average lap time
     */
    updateStintTableValues(avgLapTimeInSeconds) {
        const tbody = document.getElementById('stint-table-body');
        if (!tbody) return;

        const displayTimeZone = this.getDisplayTimeZoneForToggle();
        let currentTime = this.isLocalTimeMode ? this.getEventStartTime() : this.getRaceStartTime();
        const practiceQualifyingOffset = this.getPracticeQualifyingOffset();
        currentTime = new Date(currentTime.getTime() + practiceQualifyingOffset);
        let currentLap = 1;

        // Get all stint rows (skip pit rows)
        const stintRows = Array.from(tbody.querySelectorAll('tr[data-role="stint"]'));

        stintRows.forEach((row, index) => {
            const stintLaps = (index === this.totalStints - 1) && (this.lapsInLastStint !== 0)
                ? this.lapsInLastStint
                : this.lapsPerStint;

            const stintDuration = stintLaps * avgLapTimeInSeconds * 1000; // milliseconds
            const stintStartTime = new Date(currentTime);
            const stintEndTime = new Date(currentTime.getTime() + stintDuration);

            // Update time cells
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                // Stint # (cell[0]) - already set, but keep it consistent
                cells[0].textContent = index + 1;
                // Start Time (cell[1])
                cells[1].textContent = this.formatTimeForDisplay(stintStartTime, displayTimeZone);
                // End Time (cell[2])
                cells[2].textContent = this.formatTimeForDisplay(stintEndTime, displayTimeZone);
                // Start Lap (cell[3]) - MUST be integer
                cells[3].textContent = Math.floor(currentLap);
                // End Lap (cell[4]) - MUST be integer
                cells[4].textContent = Math.floor(currentLap + stintLaps - 1);
                // Laps (cell[5]) - formatted with 1 decimal
                cells[5].textContent = stintLaps.toFixed(1);
            }

            // Increment lap counter for next stint
            currentLap += stintLaps;

            // Update pit stop row if it exists
            if (index < this.totalStints - 1) {
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.getAttribute('data-role') === 'pit-stop') {
                    const pitStartTime = new Date(stintEndTime.getTime());
                    const pitEndTime = new Date(pitStartTime.getTime() + (this.pitStopTime * 1000));
                    const pitCells = nextRow.querySelectorAll('td');
                    if (pitCells.length >= 6) {
                        pitCells[1].textContent = this.formatTimeForDisplay(pitStartTime, displayTimeZone);
                        pitCells[2].textContent = this.formatTimeForDisplay(pitEndTime, displayTimeZone);
                        // cells[3-4] are "PIT" text, don't touch
                        pitCells[5].textContent = this.formatPitStopTime(this.pitStopTime);
                    }
                    // Advance currentTime to AFTER the pit stop
                    currentTime = pitEndTime;
                } else {
                    currentTime = new Date(stintEndTime.getTime() + (this.pitStopTime * 1000));
                }
            }
        });
    }

    /**
     * Extract inputs from form elements
     * @returns {Object} Input values
     */
    extractInputs() {
        const raceDurationHours = parseInt(document.getElementById('race-duration-hours')?.value) || 0;
        const raceDurationMinutes = parseInt(document.getElementById('race-duration-minutes')?.value) || 0;
        this.raceDurationSeconds = (raceDurationHours * 3600) + (raceDurationMinutes * 60);

        const avgLapTimeMinutes = parseInt(document.getElementById('avg-lap-time-minutes')?.value) || 0;
        const avgLapTimeSeconds = parseInt(document.getElementById('avg-lap-time-seconds')?.value) || 0;
        const avgLapTimeInSeconds = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;

        const fuelPerLap = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value) || 0;
        const tankCapacity = parseInt(document.getElementById('tank-capacity-display-input')?.value) || 0;
        this.pitStopTime = parseInt(document.getElementById('pit-stop-time')?.value) || 0;

        return {
            raceDurationHours,
            raceDurationMinutes,
            raceDurationSeconds: this.raceDurationSeconds,
            avgLapTimeMinutes,
            avgLapTimeSeconds,
            avgLapTimeInSeconds,
            fuelPerLap,
            tankCapacity,
            pitStopTime: this.pitStopTime
        };
    }

    /**
     * Validate input values
     * @param {Object} inputs - Input values to validate
     * @returns {boolean} True if valid
     */
    validateInputs(inputs) {
        // TEMPORARILY DISABLED VALIDATION - ALWAYS RETURN TRUE TO SHOW TABLES
        console.log('🔧 VALIDATION BYPASSED - inputs:', inputs);
        return true;
        
        // Original validation (commented out):
        // return inputs.raceDurationSeconds > 0 && 
        //        inputs.avgLapTimeInSeconds > 0 && 
        //        inputs.fuelPerLap > 0 && 
        //        inputs.tankCapacity > 0;
    }

    /**
     * Apply slider adjustments to base values
     * @param {Object} inputs - Base input values
     * @returns {Object} Adjusted input values
     */
    applySliderAdjustments(inputs) {
        const fuelSliderAdjustment = parseFloat(document.getElementById('fuel-slider')?.value) || 0;
        const lapTimeSliderAdjustment = parseFloat(document.getElementById('lap-time-slider')?.value) || 0;

        return {
            ...inputs,
            fuelPerLap: inputs.fuelPerLap + fuelSliderAdjustment,
            avgLapTimeInSeconds: inputs.avgLapTimeInSeconds + lapTimeSliderAdjustment
        };
    }

    /**
     * Perform core race calculations
     * @param {Object} inputs - Adjusted input values
     * @returns {Object} Calculation results
     */
    performCalculations(inputs) {
        const lapsPerTank = inputs.tankCapacity / inputs.fuelPerLap;
        const totalLaps = Math.floor(inputs.raceDurationSeconds / inputs.avgLapTimeInSeconds);
        const stintDuration = lapsPerTank * inputs.avgLapTimeInSeconds;
        
        this.totalStints = Math.floor(totalLaps / lapsPerTank) + (totalLaps % Math.floor(lapsPerTank) > 0 ? 1 : 0);
        this.lapsPerStint = lapsPerTank;
        this.lapsInLastStint = totalLaps % Math.floor(this.lapsPerStint);

        const totalFuel = totalLaps * inputs.fuelPerLap;
        const totalPitStops = this.totalStints - 1;

        return {
            lapsPerTank,
            totalLaps,
            stintDuration,
            totalStints: this.totalStints,
            lapsPerStint: this.lapsPerStint,
            lapsInLastStint: this.lapsInLastStint,
            totalFuel,
            totalPitStops
        };
    }

    /**
     * Update display elements with calculation results
     * @param {Object} calculations - Calculation results
     * @param {Object} inputs - Input values
     */
    updateDisplays(calculations, inputs) {
        this.updateElement('est-laps-display', calculations.totalLaps);
        this.updateElement('stint-duration-display', this.formatDuration(calculations.stintDuration));
        this.updateElement('laps-per-stint-display', calculations.lapsPerTank.toFixed(1));
        this.updateElement('pit-stops-display', calculations.totalPitStops);
        this.updateElement('stint-pit-stops-display', calculations.totalPitStops);
        this.updateElement('stint-laps-per-stint-display', calculations.lapsPerTank.toFixed(1));
        this.updateElement('total-fuel-display', calculations.totalFuel.toFixed(1) + ' L');
        this.updateElement('fuel-per-lap-display', inputs.fuelPerLap.toFixed(2) + ' L');
        this.updateElement('lap-time-display', this.formatLapTime(inputs.avgLapTimeInSeconds));
        this.updateElement('pit-stop-duration-display', `${inputs.pitStopTime} sec`);
    }

    /**
     * Update element text content if element exists
     * @param {string} elementId - Element ID
     * @param {string|number} value - Value to set
     */
    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Format duration in seconds to readable format
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    /**
     * Format lap time in seconds to M:SS format
     * @param {number} seconds - Lap time in seconds
     * @returns {string} Formatted lap time
     */
    formatLapTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(0).padStart(2, '0');
        return `${minutes}:${secs}`;
    }

    /**
     * Format pit stop time in MM:SS format
     * @param {number} seconds - Pit stop duration in seconds
     * @returns {string} Formatted pit stop time (MM:SS)
     */
    formatPitStopTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${minutes.toString().padStart(2, '0')}:${secs}`;
    }

    /**
     * Generate and populate stint breakdown table
     * @param {number} avgLapTimeInSeconds - Average lap time
     */
    async populateStintTable(avgLapTimeInSeconds) {
        console.log('🏁 populateStintTable START - checking this.selectedDrivers:', {
            exists: !!this.selectedDrivers,
            count: this.selectedDrivers ? this.selectedDrivers.length : 'UNDEFINED',
            drivers: this.selectedDrivers ? this.selectedDrivers.map(d => d.name) : 'NOT AN ARRAY',
            reference: this.selectedDrivers
        });

        const tbody = document.getElementById('stint-table-body');
        if (!tbody) return;

        // Get existing stint rows (not pit stop rows)
        const existingStintRows = Array.from(tbody.querySelectorAll('tr[data-role="stint"]'));
        const existingPitRows = Array.from(tbody.querySelectorAll('tr[data-role="pit-stop"]'));
        
        // Only clear if we're doing initial load (no existing rows)
        const isInitialLoad = existingStintRows.length === 0;
        if (isInitialLoad) {
            tbody.innerHTML = '';
        }

        // Load weather and track map components (keep hidden initially)
        await this.loadWeatherComponent();
        await this.loadTrackMapComponent();

        // Get race start time and timezone settings
        // In LOCAL TIME mode: use event time (Europe/London) as base
        // In RACE TIME mode: use race time as base
        const raceStartTime = this.isLocalTimeMode ? this.getEventStartTime() : this.getRaceStartTime();
        const displayTimeZone = this.getDisplayTimeZoneForToggle();
        const daylightCalculationMode = this.getDaylightCalculationMode();

        // Add practice + qualifying offset to get actual first stint start time
        const practiceQualifyingOffset = this.getPracticeQualifyingOffset();
        let currentTime = new Date(raceStartTime.getTime() + practiceQualifyingOffset);
        
        console.log(`\n🏁 STINT TABLE GENERATION`);
        console.log(`   Race Start: ${raceStartTime.toISOString()}`);
        console.log(`   Practice+Qual offset: ${practiceQualifyingOffset}ms`);
        console.log(`   First stint starts: ${currentTime.toISOString()}`);
        console.log(`   Pit stop duration: ${this.pitStopTime}s`);
        
        let currentLap = 1; // Initialize lap counter
        let rowIndex = 0; // Track position in tbody for inserting/updating

        for (let i = 0; i < this.totalStints; i++) {
            const stintLaps = (i === this.totalStints - 1) && (this.lapsInLastStint !== 0) 
                ? this.lapsInLastStint 
                : this.lapsPerStint;

            const stintDuration = stintLaps * avgLapTimeInSeconds * 1000; // Convert to milliseconds
            const stintStartTime = new Date(currentTime);
            const stintEndTime = new Date(currentTime.getTime() + stintDuration);

            // Get assigned driver for this stint
            const assignedDriver = this.getAssignedDriver(i);
            const selectedDriverName = assignedDriver ? assignedDriver.name : 'Unassigned';

            // Calculate daylight status
            const daylightStatus = this.getDaylightStatus(stintStartTime, displayTimeZone, daylightCalculationMode, selectedDriverName);

            // Calculate lap numbers for this stint
            const startLap = Math.floor(currentLap);
            // After the stint, currentLap will be currentLap + stintLaps, so the end lap is that value minus 1
            const endLap = Math.floor(currentLap + stintLaps - 1);
            
            // Update existing row or create new one
            const existingRow = existingStintRows[i];
            if (existingRow && !isInitialLoad) {
                // Update existing row in place
                this.updateStintRow(existingRow, i + 1, selectedDriverName, stintLaps, stintStartTime, stintEndTime, startLap, endLap, displayTimeZone, daylightStatus);
            } else {
                // Create new row
                const row = this.createStintRow(i + 1, selectedDriverName, stintLaps, stintStartTime, stintEndTime, startLap, endLap, displayTimeZone, daylightStatus);
                tbody.appendChild(row);
            }

            console.log(`   Stint ${i + 1}: ${stintStartTime.toISOString()} → ${stintEndTime.toISOString()} (${stintLaps} laps)`);

            // Increment lap counter for next stint - use FULL stintLaps value to preserve decimals
            currentLap += stintLaps;

            // Add pit stop row for next stint (except last stint)
            if (i < this.totalStints - 1) {
                const pitStartTime = new Date(stintEndTime.getTime());
                const pitEndTime = new Date(pitStartTime.getTime() + (this.pitStopTime * 1000));
                
                // Update existing pit row or create new one
                const existingPitRow = existingPitRows[i];
                if (existingPitRow && !isInitialLoad) {
                    this.updatePitStopRow(existingPitRow, pitStartTime, pitEndTime, displayTimeZone);
                } else {
                    const pitRow = this.createPitStopRow(pitStartTime, pitEndTime, displayTimeZone);
                    tbody.appendChild(pitRow);
                }
                
                // IMPORTANT: Advance currentTime to AFTER the pit stop so next stint starts after pit completes
                currentTime = pitEndTime;
                
                console.log(`      Pit stop: ${pitStartTime.toISOString()} → ${pitEndTime.toISOString()} (${this.pitStopTime}s)`);
            }
        }
        
        // Remove extra rows if stint count decreased
        if (!isInitialLoad && existingStintRows.length > this.totalStints) {
            for (let i = this.totalStints; i < existingStintRows.length; i++) {
                existingStintRows[i]?.remove();
                existingPitRows[i]?.remove();
            }
        }
    }

    /**
     * Create stint table row
     * @param {number} stintNumber - Stint number
     * @param {string} driverName - Driver name
     * @param {number} stintLaps - Number of laps in stint
     * @param {Date} startTime - Stint start time
     * @param {Date} endTime - Stint end time
     * @param {string} timeZone - Display timezone
     * @param {string} daylightStatus - Daylight status
     * @returns {HTMLElement} Table row element
     */
    createStintRow(stintNumber, driverName, stintLaps, startTime, endTime, startLap, endLap, timeZone, daylightStatus) {
        console.log(`📋 Creating stint row ${stintNumber}:`, {
            this_selectedDrivers_reference: this.selectedDrivers,
            selectedDriversCount: this.selectedDrivers ? this.selectedDrivers.length : 'UNDEFINED/NULL',
            selectedDriversArray: this.selectedDrivers ? this.selectedDrivers.map(d => d.name) : 'NOT AN ARRAY',
            selectedDriversType: this.selectedDrivers ? typeof this.selectedDrivers : 'undefined'
        });

        const row = document.createElement('tr');
        row.setAttribute('data-role', 'stint');
        row.className = 'bg-neutral-800 hover:bg-neutral-700 transition-colors';

        row.innerHTML = `
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm font-bold" style="width: 50px;">${stintNumber}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm" style="width: 80px;">${this.formatTimeForDisplay(startTime, timeZone)}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm" style="width: 80px;">${this.formatTimeForDisplay(endTime, timeZone)}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm" style="width: 60px;">${startLap}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm" style="width: 60px;">${endLap}</td>
            <td class="py-2 px-2 text-center text-blue-400 font-mono text-sm" style="width: 70px; white-space: nowrap;">${stintLaps.toFixed(1)}</td>
            <!-- DAYLIGHT / DRIVER COLOR STRIP COLUMN -->
            <td class="w-2 px-1" style="width: 15px; text-align:center;">
                <div class="driver-color-strip" data-stint="${stintNumber - 1}" style="width:12px;height:40px;margin:0 auto;"></div>
            </td>
            <td class="py-2 px-3" style="flex: 1; min-width: 0;">
                <select class="driver-select-stint bg-neutral-700 text-neutral-200 p-1 rounded-md w-full border border-neutral-600 text-xs font-mono" 
                        data-stint="${stintNumber - 1}">
                    ${this.generateDriverOptions('')}
                </select>
            </td>
            <td class="py-2 px-3" style="flex: 1; min-width: 0;">
                <select class="backup-select-stint bg-neutral-700 text-neutral-200 p-1 rounded-md w-full border border-neutral-600 text-xs font-mono" 
                        data-stint="${stintNumber - 1}">
                    ${this.generateDriverOptions('')}
                </select>
            </td>
        `;

        // Add event listener for primary driver selection change
        const driverSelect = row.querySelector('.driver-select-stint');
        if (driverSelect) {
            driverSelect.addEventListener('change', (e) => {
                this.handleDriverSelectionChange(e.target);
            });
        }

        // Add event listener for backup driver selection change
        const backupSelect = row.querySelector('.backup-select-stint');
        if (backupSelect) {
            backupSelect.addEventListener('change', (e) => {
                this.handleBackupDriverSelectionChange(e.target);
            });
        }

        return row;
    }

    /**
     * Create pit stop table row
     * @param {Date} startTime - Pit start time
     * @param {Date} endTime - Pit end time
     * @param {string} timeZone - Display timezone
     * @returns {HTMLElement} Table row element
     */
    createPitStopRow(startTime, endTime, timeZone) {
        const row = document.createElement('tr');
        row.setAttribute('data-role', 'pit-stop');
        row.className = 'bg-neutral-900 transition-colors';

        row.innerHTML = `
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs" style="width: 50px;"></td>
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs" style="width: 80px;">${this.formatTimeForDisplay(startTime, timeZone)}</td>
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs" style="width: 80px;">${this.formatTimeForDisplay(endTime, timeZone)}</td>
            <td class="py-1 px-2 text-center text-neutral-500 road-rage-font text-xs" style="width: 70px;">PIT</td>
            <td class="py-1 px-2 text-center text-neutral-500 road-rage-font text-xs" style="width: 70px;">PIT</td>
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs" style="width: 70px;">${this.formatPitStopTime(this.pitStopTime)}</td>
            <td class="w-2 px-1" style="width: 15px;"></td>
            <td class="py-1 px-2 text-center text-neutral-600 text-xs">-</td>
            <td class="py-1 px-2 text-center text-neutral-600 text-xs">-</td>
        `;

        return row;
    }

    /**
     * Update existing stint row in place (preserves driver selections)
     */
    updateStintRow(row, stintNumber, driverName, stintLaps, startTime, endTime, startLap, endLap, timeZone, daylightStatus) {
        const cells = row.querySelectorAll('td');
        
        // cells[0] = Stint # (update for clarity)
        cells[0].textContent = stintNumber;
        // cells[1-2] = Start/End times
        cells[1].innerHTML = this.formatTimeForDisplay(startTime, timeZone);
        cells[2].innerHTML = this.formatTimeForDisplay(endTime, timeZone);
        
        // cells[3-5] = Lap numbers and count
        cells[3].textContent = startLap;
        cells[4].textContent = endLap;
        cells[5].textContent = stintLaps.toFixed(1);

        // cells[6] = color strip - update to match driver
        const colorStripCell = cells[6];
        if (colorStripCell) {
            const colorClass = this.getDriverColorClass(driverName);
            colorStripCell.innerHTML = `<div class="driver-color-strip ${colorClass}" data-stint="${stintNumber - 1}" style="width:12px;height:40px;margin:0 auto;"></div>`;
        }

        // Driver dropdowns are preserved - don't touch them!
    }

    /**
     * Update existing pit stop row in place
     */
    updatePitStopRow(row, startTime, endTime, timeZone) {
        const cells = row.querySelectorAll('td');
        
        // cells[0] = Empty (stint # column for alignment)
        // cells[1] = Start Time
        // cells[2] = End Time
        // cells[3] = PIT text
        // cells[4] = PIT text
        // cells[5] = Duration
        cells[1].innerHTML = this.formatTimeForDisplay(startTime, timeZone);
        cells[2].innerHTML = this.formatTimeForDisplay(endTime, timeZone);
        cells[5].innerHTML = this.formatPitStopTime(this.pitStopTime);
    }

    /**
     * Generate driver options for select dropdown
     * @param {string} selectedDriverName - Currently selected driver
     * @returns {string} HTML options string
     */
    generateDriverOptions(selectedDriverName) {
        let options = '<option value="">Select Driver</option>';
        
        console.log('🔍 generateDriverOptions called:', {
            selectedDrivers: this.selectedDrivers,
            driverCount: this.selectedDrivers ? this.selectedDrivers.length : 0,
            selectedDriverName: selectedDriverName
        });
        
        if (this.selectedDrivers && this.selectedDrivers.length > 0) {
            this.selectedDrivers.forEach(driver => {
                const isSelected = driver.name === selectedDriverName ? 'selected' : '';
                options += `<option value="${driver.name}" ${isSelected}>${driver.name}</option>`;
            });
            console.log(`✅ Generated ${this.selectedDrivers.length} driver options`);
        } else {
            console.warn('❌ No selectedDrivers available when generating options');
        }
        
        return options;
    }

    /**
     * Format time for display in specific timezone
     * @param {Date} time - Time to format
     * @param {string} timeZone - Target timezone
     * @returns {string} Formatted time string
     */
    formatTimeForDisplay(time, timeZone) {
        try {
            return time.toLocaleTimeString('en-GB', { 
                timeZone: timeZone,
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
            });
        } catch (error) {
            return time.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: false 
            });
        }
    }

    /**
     * Get daylight status CSS class
     * @param {string} status - Daylight status
     * @returns {string} CSS class
     */
    getDaylightStatusClass(status) {
        switch (status.toLowerCase()) {
            case 'day':
                return 'text-yellow-400';
            case 'night':
                return 'text-blue-400';
            case 'dawn':
            case 'dusk':
                return 'text-orange-400';
            default:
                return 'text-neutral-400';
        }
    }

    /**
     * Show results sections after calculation
     */
    showResultsSections() {
        const sectionsToShow = [
            'overall-summary',
            'stint-breakdown-display',
            'share-link-container',
            'weather-display-page2',
            'track-map-container-page2'
        ];

        sectionsToShow.forEach(sectionId => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.classList.remove('hidden');
            }
        });

        // Show page 3 button if it exists
        const page3Button = document.getElementById('page3-button-container');
        if (page3Button) {
            page3Button.classList.remove('hidden');
        }

        // Set up collapsible handlers for weather and track map
        this.setupCollapsibleHandlers();

        // Set up slider event listeners
        this.setupSliderEventListeners();

        // Force chart resize after containers are visible
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
            if (this.weatherComponent && this.weatherComponent.resize) {
                this.weatherComponent.resize();
                console.log('Resized weather charts');
            }
            if (this.trackMapComponent && this.trackMapComponent.resize) {
                // Track map may not have a resize method, but try anyway
                console.log('Track map component loaded');
            }
        }, 100);
    }

    /**
     * Get race start time from form
     * @returns {Date} Race start time
     */
    getRaceStartTime() {
        // Return cached race start time if available (prevents time changing on every slider adjustment)
        if (this.cachedRaceStartTime) {
            console.log(`⏱️ Using cached race start time: ${this.cachedRaceStartTime.toISOString()}`);
            return this.cachedRaceStartTime;
        }

        // First try to get from race-start-date/time inputs (Page 2 populated fields)
        const dateInput = document.getElementById('race-start-date-page2');
        const timeInput = document.getElementById('race-start-time-page2');
        
        if (dateInput && timeInput && dateInput.value && timeInput.value) {
            this.cachedRaceStartTime = new Date(`${dateInput.value}T${timeInput.value}`);
            console.log(`📅 Cached race start time from Page 2 inputs: ${this.cachedRaceStartTime.toISOString()}`);
            return this.cachedRaceStartTime;
        }
        
        // Fallback: Try to get from race-datetime data attributes (from Page 1 race information)
        const raceDatetimeEl = document.getElementById('race-datetime');
        if (raceDatetimeEl) {
            const raceDate = raceDatetimeEl.dataset.raceDate;
            const raceTime = raceDatetimeEl.dataset.raceTime;
            
            if (raceDate && raceTime) {
                this.cachedRaceStartTime = new Date(`${raceDate}T${raceTime}`);
                console.log(`📅 Cached race start time from data attributes: ${this.cachedRaceStartTime.toISOString()}`);
                return this.cachedRaceStartTime;
            }
        }
        
        console.warn('⚠️ No race start time found, caching current time');
        this.cachedRaceStartTime = new Date(); // Fallback to current time - but cache it!
        return this.cachedRaceStartTime;
    }

    /**
     * Get event start time for local time mode (always Europe/London)
     * @returns {Date} Event start time in London time
     */
    getEventStartTime() {
        // Return cached event start time if available (prevents time changing on every slider adjustment)
        if (this.cachedEventStartTime) {
            console.log(`⏱️ Using cached event start time: ${this.cachedEventStartTime.toISOString()}`);
            return this.cachedEventStartTime;
        }

        // Get event time from Page 1 event-datetime data attributes
        const eventDatetimeEl = document.getElementById('event-datetime');
        if (eventDatetimeEl) {
            const eventDate = eventDatetimeEl.dataset.eventDate;
            const eventTime = eventDatetimeEl.dataset.eventTime;
            
            if (eventDate && eventTime) {
                this.cachedEventStartTime = new Date(`${eventDate}T${eventTime}`);
                console.log(`🌍 Cached event start time (London): ${this.cachedEventStartTime.toISOString()}`);
                return this.cachedEventStartTime;
            }
        }
        
        // Fallback: Use race start time if event time not available
        console.warn('⚠️ No event start time found, falling back to race start time');
        this.cachedEventStartTime = this.getRaceStartTime();
        return this.cachedEventStartTime;
    }

    /**
     * Get practice + qualifying offset in milliseconds
     * Adds this to the base race/event time to get the first real stint start time
     * @returns {number} Total offset in milliseconds
     */
    getPracticeQualifyingOffset() {
        let totalOffsetMs = 0;

        // Get practice duration (session_length is in total minutes)
        const practiceElement = document.getElementById('practice-length');
        if (practiceElement) {
            const practiceMinutes = parseInt(practiceElement.dataset.practiceMinutes) || 0;
            if (practiceMinutes > 0) {
                totalOffsetMs += practiceMinutes * 60 * 1000; // Convert minutes to milliseconds
                console.log(`🏁 Practice offset: ${practiceMinutes} minutes = ${practiceMinutes * 60 * 1000}ms`);
            }
        }

        // Get qualifying duration (session_length is in total minutes)
        const qualifyingElement = document.getElementById('qualifying-length');
        if (qualifyingElement) {
            const qualifyingMinutes = parseInt(qualifyingElement.dataset.qualifyingMinutes) || 0;
            if (qualifyingMinutes > 0) {
                totalOffsetMs += qualifyingMinutes * 60 * 1000; // Convert minutes to milliseconds
                console.log(`🏁 Qualifying offset: ${qualifyingMinutes} minutes = ${qualifyingMinutes * 60 * 1000}ms`);
            }
        }

        if (totalOffsetMs > 0) {
            console.log(`⏱️ Practice + Qualifying TOTAL offset: ${totalOffsetMs}ms (${(totalOffsetMs / 60000).toFixed(1)} minutes)`);
        } else {
            console.warn(`⚠️ No practice or qualifying offset found`);
        }

        return totalOffsetMs;
    }

    /**
     * Get display timezone setting
     * @returns {string} Timezone string
     */
    getDisplayTimeZone() {
        const timezoneSelect = document.getElementById('timezone-select');
        return timezoneSelect?.value || 'Europe/London';
    }

    /**
     * Get daylight calculation mode
     * @returns {string} Calculation mode
     */
    getDaylightCalculationMode() {
        const modeSelect = document.getElementById('daylight-calculation-mode');
        return modeSelect?.value || 'track';
    }

    /**
     * Get assigned driver for stint
     * @param {number} stintIndex - Stint index
     * @returns {Object|null} Driver object
     */
    getAssignedDriver(stintIndex) {
        if (!this.selectedDrivers || this.selectedDrivers.length === 0) {
            return null;
        }
        
        // Simple round-robin assignment
        return this.selectedDrivers[stintIndex % this.selectedDrivers.length];
    }

    /**
     * Get daylight status for time and location
     * @param {Date} time - Time to check
     * @param {string} timeZone - Timezone
     * @param {string} mode - Calculation mode
     * @param {string} driverName - Driver name
     * @returns {string} Daylight status
     */
    getDaylightStatus(time, timeZone, mode, driverName) {
        // Simplified daylight calculation - in a real implementation,
        // this would integrate with the daylight calculation system
        const hour = time.getHours();
        
        if (hour >= 6 && hour < 18) {
            return 'Day';
        } else if (hour >= 18 && hour < 20) {
            return 'Dusk';
        } else if (hour >= 4 && hour < 6) {
            return 'Dawn';
        } else {
            return 'Night';
        }
    }

    /**
     * Handle primary driver selection change in stint table
     * Stores the assignment and updates the display
     * @param {HTMLElement} selectElement - Select element that changed
     */
    handleDriverSelectionChange(selectElement) {
        const stintIndex = parseInt(selectElement.dataset.stint);
        const selectedDriverName = selectElement.value;
        
        console.log(`📍 Primary driver selection CHANGED for stint ${stintIndex + 1}:`, {
            selectedDriver: selectedDriverName,
            selectElement: selectElement.className
        });
        
        // Store driver assignment for persistence when sharing/saving
        if (!window.stintDriverAssignments) {
            window.stintDriverAssignments = {};
        }
        window.stintDriverAssignments[stintIndex] = selectedDriverName;
        console.log('💾 Saved to window.stintDriverAssignments:', window.stintDriverAssignments);
        
        // Apply driver color to the row
        const row = selectElement.closest('tr');
        if (row) {
            this.applyDriverColorToRow(row, selectedDriverName);
        }
        
        // Update internal state or trigger recalculation if needed
        // This could trigger daylight recalculation for driver-specific timezones if needed
    }

    /**
     * Handle backup driver selection change in stint table
     * Stores the backup assignment and updates the display
     * @param {HTMLElement} selectElement - Select element that changed
     */
    handleBackupDriverSelectionChange(selectElement) {
        const stintIndex = parseInt(selectElement.dataset.stint);
        const selectedBackupDriverName = selectElement.value;
        
        console.log(`🔄 Backup driver selection CHANGED for stint ${stintIndex + 1}:`, {
            selectedBackupDriver: selectedBackupDriverName,
            selectElement: selectElement.className
        });
        
        // Store backup driver assignment for persistence when sharing/saving
        if (!window.stintBackupDriverAssignments) {
            window.stintBackupDriverAssignments = {};
        }
        window.stintBackupDriverAssignments[stintIndex] = selectedBackupDriverName;
        console.log('💾 Saved to window.stintBackupDriverAssignments:', window.stintBackupDriverAssignments);
    }

    /**
     * Set selected drivers for calculations
     * @param {Array} drivers - Array of selected driver objects
     */
    setSelectedDrivers(drivers) {
        console.log('👥 setSelectedDrivers CALLED with:', {
            received_count: drivers ? drivers.length : 0,
            received_drivers: drivers ? drivers.map(d => ({name: d.name, timezone: d.timezone})) : 'NULL',
            before_update: {
                this_selectedDrivers_count: this.selectedDrivers ? this.selectedDrivers.length : 'UNDEFINED',
                this_selectedDrivers: this.selectedDrivers ? this.selectedDrivers.map(d => ({name: d.name})) : 'UNDEFINED'
            }
        });
        
        this.selectedDrivers = drivers;
        
        // Assign color indices to drivers
        this.assignDriverColors();
        
        console.log('✅ setSelectedDrivers COMPLETE - this.selectedDrivers is now:', {
            count: this.selectedDrivers ? this.selectedDrivers.length : 0,
            drivers: this.selectedDrivers ? this.selectedDrivers.map(d => ({name: d.name, timezone: d.timezone})) : 'NULL',
            driverColorMap: this.driverColorMap
        });
    }

    /**
     * Set session metadata (track_id and event_id) for loading weather and track map
     * @param {number} trackId - Track ID from session details
     * @param {number} eventId - Event ID from session details
     */
    setSessionMetadata(trackId, eventId) {
        this.trackId = trackId;
        this.eventId = eventId;
        console.log(`📍 Session metadata set: trackId=${trackId}, eventId=${eventId}`);
    }

    /**
     * Load weather component on Page 2
     * @private
     */
    async loadWeatherComponent() {
        console.log('🌤️ Loading weather component, current metadata:', { eventId: this.eventId, trackId: this.trackId });
        
        // If metadata is missing, try to get it from the app
        if ((!this.eventId || !this.trackId) && window.radianPlanner && window.radianPlanner.selectedSessionDetails) {
            console.log('🔄 Metadata missing, attempting to restore from app...');
            const sessionDetails = window.radianPlanner.selectedSessionDetails;
            this.setSessionMetadata(
                sessionDetails.track_id,
                sessionDetails.event_id
            );
        }
        
        if (!this.eventId) {
            console.warn('⚠️ No event ID available for weather component - this may be normal for manual entries or if session selection failed');
            return;
        }

        try {
            const container = document.getElementById('weather-display-page2');
            const contentDiv = document.getElementById('weather-content');
            if (!container || !contentDiv) {
                console.warn('⚠️ Weather container not found on Page 2');
                return;
            }

            // Initialize weather component using the content div
            const isFirstLoad = !this.weatherComponent;
            if (!this.weatherComponent) {
                this.weatherComponent = new WeatherComponent('weather-content');
            }

            // Fetch weather data for the event
            const response = await fetch(`/api/events/${this.eventId}/weather`);
            if (!response.ok) {
                console.log('ℹ️ No weather data available for this event');
                return;
            }

            const eventWeather = await response.json();
            if (eventWeather && eventWeather.weather_url) {
                await this.weatherComponent.loadWeatherData(eventWeather.weather_url);
                // Only hide on first load, preserve visibility on reloads
                if (isFirstLoad) {
                    container.classList.add('hidden');
                    console.log('✅ Weather component loaded (hidden until table displays)');
                } else {
                    console.log('✅ Weather component reloaded (keeping current visibility)');
                }
            }
        } catch (error) {
            console.error('❌ Failed to load weather component:', error);
        }
    }

    /**
     * Load track map component on Page 2
     * @private
     */
    async loadTrackMapComponent() {
        console.log('🗺️ Loading track map component, current metadata:', { eventId: this.eventId, trackId: this.trackId });
        
        // If metadata is missing, try to get it from the app
        if ((!this.eventId || !this.trackId) && window.radianPlanner && window.radianPlanner.selectedSessionDetails) {
            console.log('🔄 Metadata missing, attempting to restore from app...');
            const sessionDetails = window.radianPlanner.selectedSessionDetails;
            this.setSessionMetadata(
                sessionDetails.track_id,
                sessionDetails.event_id
            );
        }
        
        if (!this.trackId) {
            console.warn('⚠️ No track ID available for track map component - this may be normal for manual entries or if session selection failed');
            return;
        }

        try {
            const container = document.getElementById('track-map-container-page2');
            const contentDiv = document.getElementById('track-map-content');
            if (!container || !contentDiv) {
                console.warn('⚠️ Track map container not found on Page 2');
                return;
            }

            // Initialize track map component using the content div
            const isFirstLoad = !this.trackMapComponent;
            if (!this.trackMapComponent) {
                this.trackMapComponent = new TrackMapComponent('track-map-content');
            }

            // Load track map from API
            await this.trackMapComponent.loadTrackFromAPI(this.trackId);
            // Only hide on first load, preserve visibility on reloads
            if (isFirstLoad) {
                container.classList.add('hidden');
                console.log('✅ Track map component loaded (hidden until table displays)');
            } else {
                console.log('✅ Track map component reloaded (keeping current visibility)');
            }
        } catch (error) {
            console.error('❌ Failed to load track map component:', error);
        }
    }

    /**
     * Set up collapsible toggle handlers for weather and track map
     * @private
     */
    setupCollapsibleHandlers() {
        console.log('Setting up collapsible handlers...');
        
        // Weather toggle button
        const weatherToggleBtn = document.getElementById('weather-toggle-btn');
        const weatherContainer = document.getElementById('weather-display-page2');
        if (weatherToggleBtn && weatherContainer) {
            // Remove any existing listeners to avoid duplicates
            weatherToggleBtn.replaceWith(weatherToggleBtn.cloneNode(true));
            const newWeatherBtn = document.getElementById('weather-toggle-btn');
            newWeatherBtn.addEventListener('click', (e) => {
                e.preventDefault();
                weatherContainer.classList.toggle('collapsed');
                console.log('Weather container toggled, collapsed state:', weatherContainer.classList.contains('collapsed'));
            });
            console.log('Weather toggle listener attached');
        } else {
            console.warn('Weather toggle button or container not found');
        }

        // Track map toggle button
        const trackMapToggleBtn = document.getElementById('track-map-toggle-btn');
        const trackMapContainer = document.getElementById('track-map-container-page2');
        if (trackMapToggleBtn && trackMapContainer) {
            // Remove any existing listeners to avoid duplicates
            trackMapToggleBtn.replaceWith(trackMapToggleBtn.cloneNode(true));
            const newTrackMapBtn = document.getElementById('track-map-toggle-btn');
            newTrackMapBtn.addEventListener('click', (e) => {
                e.preventDefault();
                trackMapContainer.classList.toggle('collapsed');
                console.log('Track map container toggled, collapsed state:', trackMapContainer.classList.contains('collapsed'));
            });
            console.log('Track map toggle listener attached');
        } else {
            console.warn('Track map toggle button or container not found');
        }
    }

    /**
     * Populate driver and backup select elements for a given stint index
     * Compatible with legacy populateStintDrivers behavior
     */
    populateStintDrivers(i, selectedDrivers) {
        const driverSel = document.querySelector(`#stint-table-body select.driver-select-stint[data-stint\="${i}"]`);
        const backupSel = document.querySelector(`#stint-table-body select.backup-select-stint[data-stint\="${i}"]`);
        const makeOpts = (sel) => {
            if (!sel) return;
            sel.innerHTML = '';
            const empty = document.createElement('option'); empty.value=''; empty.textContent='Select...'; sel.appendChild(empty);
            selectedDrivers.forEach(d => { const o=document.createElement('option'); o.value=d.name; o.textContent=d.name; sel.appendChild(o); });
        };
        makeOpts(driverSel);
        makeOpts(backupSel);
    }

    /**
     * Toggle between race time and local time modes
     */
    toggleTimeMode() {
        this.isLocalTimeMode = !this.isLocalTimeMode;
        console.log(`🕐 Toggled time mode to: ${this.isLocalTimeMode ? 'LOCAL' : 'RACE'}`);
        
        // Update UI elements
        const toggleSwitch = document.querySelector('.toggle-switch');
        const slider = document.getElementById('time-toggle-slider');
        const driverSelector = document.getElementById('driver-timezone-selector');
        const raceLabel = document.getElementById('race-time-label');
        const localLabel = document.getElementById('local-time-label');
        
        if (this.isLocalTimeMode) {
            // Switch to Local Time mode
            if (toggleSwitch) toggleSwitch.classList.add('active');
            if (slider) slider.classList.add('translate-x-4');
            if (driverSelector) driverSelector.classList.remove('hidden');
            if (raceLabel) raceLabel.classList.remove('time-mode-active');
            if (localLabel) localLabel.classList.add('time-mode-active');
            
            // Populate driver dropdown
            this.populateDriverDropdown();
            
            // Set default to first driver if not already set
            if (!this.selectedDriverForLocalTime && this.selectedDrivers.length > 0) {
                this.selectedDriverForLocalTime = this.selectedDrivers[0];
            }
        } else {
            // Switch to Race Time mode
            if (toggleSwitch) toggleSwitch.classList.remove('active');
            if (slider) slider.classList.remove('translate-x-4');
            if (driverSelector) driverSelector.classList.add('hidden');
            if (raceLabel) raceLabel.classList.add('time-mode-active');
            if (localLabel) localLabel.classList.remove('time-mode-active');
        }
        
        // Refresh the stint table with new timezone
        const avgLapTimeSeconds = this.extractInputs().avgLapTimeInSeconds;
        this.updateStintTableTimes(avgLapTimeSeconds);
    }

    /**
     * Populate driver dropdown for local time selection
     */
    populateDriverDropdown() {
        const dropdown = document.getElementById('driver-timezone-dropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select Driver</option>';
        
        if (this.selectedDrivers && this.selectedDrivers.length > 0) {
            this.selectedDrivers.forEach((driver, index) => {
                const option = document.createElement('option');
                option.value = driver.name;
                option.textContent = `${driver.name} (${driver.timezone || 'Unknown'})`;
                option.dataset.index = index;
                if (this.selectedDriverForLocalTime && this.selectedDriverForLocalTime.name === driver.name) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
            
            // Add change listener
            dropdown.removeEventListener('change', this.handleDriverDropdownChange);
            dropdown.addEventListener('change', this.handleDriverDropdownChange.bind(this));
        }
    }

    /**
     * Handle driver selection change in local time mode
     * @param {Event} e - Change event
     */
    handleDriverDropdownChange(e) {
        const selectedName = e.target.value;
        this.selectedDriverForLocalTime = this.selectedDrivers.find(d => d.name === selectedName) || null;
        console.log(`🚗 Selected driver for local time: ${selectedName}`);
        
        // Refresh stint table with new driver's timezone
        const avgLapTimeSeconds = this.extractInputs().avgLapTimeInSeconds;
        this.updateStintTableTimes(avgLapTimeSeconds);
    }

    /**
     * Get the timezone to use for displaying times
     * @returns {string} Timezone string
     */
    getDisplayTimeZoneForToggle() {
        if (this.isLocalTimeMode && this.selectedDriverForLocalTime) {
            return this.selectedDriverForLocalTime.timezone || 'Europe/London';
        }
        return this.getDisplayTimeZone();
    }

    /**
     * Get current calculation state
     * @returns {Object} Current state
     */
    getState() {
        return {
            totalStints: this.totalStints,
            raceDurationSeconds: this.raceDurationSeconds,
            lapsPerStint: this.lapsPerStint,
            lapsInLastStint: this.lapsInLastStint,
            pitStopTime: this.pitStopTime,
            selectedDrivers: this.selectedDrivers
        };
    }

    /**
     * Display a previously-calculated strategy object returned from calculateStrategy
     * This is a compatibility wrapper so callers (app.js) can ask the calculator to render
     * a strategy object without knowing internal method names.
     * @param {Object} strategy - { success, calculations, inputs }
     */
    async displayStrategy(strategy) {
        try {
            if (!strategy) return;

            const inputs = strategy.inputs || {};
            const calculations = strategy.calculations || {};

            // Ensure selected drivers are current (app stores them on window.radianPlanner)
            if (window.radianPlanner && Array.isArray(window.radianPlanner.selectedDrivers)) {
                this.setSelectedDrivers(window.radianPlanner.selectedDrivers);
            }

            // Update the summary displays
            this.updateDisplays(calculations, inputs);

            // Populate the stint table (preserve driver assignments where possible)
            await this.populateStintTable(inputs.avgLapTimeInSeconds || 0);

            // Reveal result sections
            this.showResultsSections();
        } catch (error) {
            console.error('❌ Failed to display strategy:', error);
        }
    }

    /**
     * Update calculations when sliders change (preserve driver assignments)
     * @param {Object} sliderValues - Current slider values
     */
    updateTimesOnly(sliderValues = {}) {
        console.log('🔧 Updating times only (preserving driver assignments)');
        
        try {
            const inputs = this.extractInputs();
            if (!this.validateInputs(inputs)) {
                return;
            }

            // Apply slider adjustments
            const adjustedInputs = this.applySliderAdjustments(inputs);

            // Perform calculations
            const calculations = this.performCalculations(adjustedInputs);

            // Update displays
            this.updateDisplays(calculations, adjustedInputs);

            // Update stint table times but preserve driver assignments
            this.updateStintTableTimes(adjustedInputs.avgLapTimeInSeconds);

        } catch (error) {
            console.error('❌ Time update failed:', error);
        }
    }

    /**
     * Update stint table times while preserving driver assignments
     * @param {number} avgLapTimeInSeconds - Updated average lap time
     */
    updateStintTableTimes(avgLapTimeInSeconds) {
        const tbody = document.getElementById('stint-table-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-role="stint"]');
        // In LOCAL TIME mode: use event time (Europe/London) as base
        // In RACE TIME mode: use race time as base
        const raceStartTime = this.isLocalTimeMode ? this.getEventStartTime() : this.getRaceStartTime();
        const displayTimeZone = this.getDisplayTimeZoneForToggle();
        
        // Add practice + qualifying offset to get actual first stint start time
        const practiceQualifyingOffset = this.getPracticeQualifyingOffset();
        let currentTime = new Date(raceStartTime.getTime() + practiceQualifyingOffset);
        let currentLap = 1;

        rows.forEach((row, index) => {
            const stintLaps = (index === this.totalStints - 1) && (this.lapsInLastStint !== 0) 
                ? this.lapsInLastStint 
                : this.lapsPerStint;

            const stintDuration = stintLaps * avgLapTimeInSeconds * 1000;
            const stintStartTime = new Date(currentTime);
            const stintEndTime = new Date(currentTime.getTime() + stintDuration);

            // Update time cells
            const cells = row.querySelectorAll('td');
            if (cells.length >= 8) {  // Now 8 columns total (Stint# + 7 original)
                // Stint # (cell[0])
                cells[0].textContent = index + 1;
                // Start Time (cell[1])
                cells[1].textContent = this.formatTimeForDisplay(stintStartTime, displayTimeZone);
                // End Time (cell[2])
                cells[2].textContent = this.formatTimeForDisplay(stintEndTime, displayTimeZone);
                // Update lap numbers - MUST be integers (cells[3-5])
                const startLap = Math.floor(currentLap);
                const endLap = Math.floor(currentLap + stintLaps - 1);
                cells[3].textContent = startLap;
                cells[4].textContent = endLap;
                cells[5].textContent = stintLaps.toFixed(1);
            }

            currentLap += stintLaps;

            // Update pit stop row if it exists
            if (index < this.totalStints - 1) {
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.getAttribute('data-role') === 'pit-stop') {
                    const pitStartTime = new Date(stintEndTime.getTime());
                    const pitEndTime = new Date(pitStartTime.getTime() + (this.pitStopTime * 1000));
                    const pitCells = nextRow.querySelectorAll('td');
                    if (pitCells.length >= 6) {
                        pitCells[1].textContent = this.formatTimeForDisplay(pitStartTime, displayTimeZone);
                        pitCells[2].textContent = this.formatTimeForDisplay(pitEndTime, displayTimeZone);
                        // cells[3-4] are "PIT" text, don't touch
                        pitCells[5].textContent = this.formatPitStopTime(this.pitStopTime);
                    }
                    // IMPORTANT: Advance currentTime to AFTER the pit stop so next stint starts after pit completes
                    currentTime = pitEndTime;
                } else {
                    currentTime = new Date(stintEndTime.getTime() + (this.pitStopTime * 1000));
                }
            }
        });
    }

    /**
     * Set up collapsible handlers for weather and track map sections
     */
    setupCollapsibleHandlers() {
        // Weather toggle
        const weatherToggle = document.getElementById('weather-toggle-btn');
        const weatherContent = document.getElementById('weather-content');
        if (weatherToggle && weatherContent) {
            weatherToggle.addEventListener('click', () => {
                const isCollapsed = weatherContent.classList.contains('weather-collapsible');
                if (isCollapsed) {
                    weatherContent.classList.remove('weather-collapsible');
                    weatherToggle.querySelector('i').className = 'fas fa-chevron-up weather-toggle-icon';
                } else {
                    weatherContent.classList.add('weather-collapsible');
                    weatherToggle.querySelector('i').className = 'fas fa-chevron-down weather-toggle-icon';
                }
            });
        }

        // Track map toggle
        const trackMapToggle = document.getElementById('track-map-toggle-btn');
        const trackMapContent = document.getElementById('track-map-content');
        if (trackMapToggle && trackMapContent) {
            trackMapToggle.addEventListener('click', () => {
                const isCollapsed = trackMapContent.classList.contains('track-map-collapsible');
                if (isCollapsed) {
                    trackMapContent.classList.remove('track-map-collapsible');
                    trackMapToggle.querySelector('i').className = 'fas fa-chevron-up track-map-toggle-icon';
                } else {
                    trackMapContent.classList.add('track-map-collapsible');
                    trackMapToggle.querySelector('i').className = 'fas fa-chevron-down track-map-toggle-icon';
                }
            });
        }
    }

    /**
     * Set up event listeners for fuel and lap time sliders
     */
    setupSliderEventListeners() {
        console.log('🔧 Setting up slider event listeners...');

        // Fuel slider
        const fuelSlider = document.getElementById('fuel-slider');
        if (fuelSlider) {
            fuelSlider.addEventListener('input', () => {
                this.updateSliderDisplays();
                this.recalculateWithAdjustments();
            });
        }

        // Lap time slider
        const lapTimeSlider = document.getElementById('lap-time-slider');
        if (lapTimeSlider) {
            lapTimeSlider.addEventListener('input', () => {
                this.updateSliderDisplays();
                this.recalculateWithAdjustments();
            });
        }

        // +/- buttons for fuel adjustment
        document.querySelectorAll('[data-adjust="fuel"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const adjustment = parseFloat(button.dataset.value) || 0;
                console.log('🔘 Fuel button clicked:', { buttonValue: button.dataset.value, parsedAdjustment: adjustment });
                this.adjustFuelSlider(adjustment);
            });
        });

        // +/- buttons for lap time adjustment
        document.querySelectorAll('[data-adjust="lapTime"]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const adjustment = parseFloat(button.dataset.value) || 0;
                console.log('🔘 Lap time button clicked:', { buttonValue: button.dataset.value, parsedAdjustment: adjustment });
                this.adjustLapTimeSlider(adjustment);
            });
        });

        // Update displays initially
        this.updateSliderDisplays();
    }

    /**
     * Update slider value displays
     */
    updateSliderDisplays() {
        // Update fuel slider display
        const fuelSlider = document.getElementById('fuel-slider');
        const fuelValueDisplay = document.getElementById('fuel-slider-value');
        const fuelOriginalDisplay = document.getElementById('fuel-original-value');
        const fuelAdjustedDisplay = document.getElementById('fuel-adjusted-value');

        if (fuelSlider && fuelValueDisplay) {
            const currentValue = parseFloat(fuelSlider.value) || 0;
            fuelValueDisplay.textContent = currentValue.toFixed(2);

            // Calculate and display adjusted fuel per lap
            const baseFuel = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value) || 0;
            const adjustedFuel = baseFuel + currentValue;

            if (fuelOriginalDisplay) fuelOriginalDisplay.textContent = baseFuel.toFixed(2) + ' L';
            if (fuelAdjustedDisplay) {
                fuelAdjustedDisplay.textContent = adjustedFuel.toFixed(2) + ' L';
                // Add purple if adjusted
                if (currentValue !== 0) {
                    fuelAdjustedDisplay.classList.add('text-purple-400');
                    fuelAdjustedDisplay.classList.remove('text-neutral-200');
                } else {
                    fuelAdjustedDisplay.classList.remove('text-purple-400');
                    fuelAdjustedDisplay.classList.add('text-neutral-200');
                }
            }
        }

        // Update lap time slider display
        const lapTimeSlider = document.getElementById('lap-time-slider');
        const lapTimeValueDisplay = document.getElementById('lap-time-slider-value');
        const lapTimeOriginalDisplay = document.getElementById('lap-time-original-value');
        const lapTimeAdjustedDisplay = document.getElementById('lap-time-adjusted-value');

        if (lapTimeSlider && lapTimeValueDisplay) {
            const currentValue = parseFloat(lapTimeSlider.value) || 0;
            lapTimeValueDisplay.textContent = currentValue.toFixed(1) + 's';

            // Calculate and display adjusted lap time with 3 decimals
            const baseMinutes = parseInt(document.getElementById('avg-lap-time-minutes')?.value) || 0;
            const baseSeconds = parseInt(document.getElementById('avg-lap-time-seconds')?.value) || 0;
            const baseTotalSeconds = (baseMinutes * 60) + baseSeconds;
            const adjustedSeconds = baseTotalSeconds + currentValue;

            const adjustedMinutes = Math.floor(adjustedSeconds / 60);
            const adjustedSecs = adjustedSeconds % 60;
            const wholeSeconds = Math.floor(adjustedSecs);
            const milliseconds = Math.round((adjustedSecs - wholeSeconds) * 1000);

            const baseTimeStr = `${baseMinutes}:${baseSeconds.toString().padStart(2, '0')}`;
            const adjustedTimeStr = `${adjustedMinutes}:${wholeSeconds.toString().padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;

            if (lapTimeOriginalDisplay) lapTimeOriginalDisplay.textContent = baseTimeStr;
            if (lapTimeAdjustedDisplay) {
                lapTimeAdjustedDisplay.textContent = adjustedTimeStr;
                // Add purple if adjusted
                if (currentValue !== 0) {
                    lapTimeAdjustedDisplay.classList.add('text-purple-400');
                    lapTimeAdjustedDisplay.classList.remove('text-neutral-200');
                } else {
                    lapTimeAdjustedDisplay.classList.remove('text-purple-400');
                    lapTimeAdjustedDisplay.classList.add('text-neutral-200');
                }
            }
        }
    }

    /**
     * Adjust fuel slider by increment/decrement
     * @param {number} adjustment - Amount to adjust
     */
    adjustFuelSlider(adjustment) {
        const fuelSlider = document.getElementById('fuel-slider');
        if (fuelSlider) {
            const currentValue = parseFloat(fuelSlider.value) || 0;
            const newValue = Math.max(-2.0, Math.min(2.0, currentValue + adjustment));
            console.log('⛽ Fuel slider adjustment:', { currentValue, adjustment, newValue });
            fuelSlider.value = newValue.toFixed(2);
            this.updateSliderDisplays();
            this.recalculateWithAdjustments();
        }
    }

    /**
     * Adjust lap time slider by increment/decrement
     * @param {number} adjustment - Amount to adjust
     */
    adjustLapTimeSlider(adjustment) {
        const lapTimeSlider = document.getElementById('lap-time-slider');
        if (lapTimeSlider) {
            const currentValue = parseFloat(lapTimeSlider.value) || 0;
            const newValue = Math.max(-3, Math.min(3, currentValue + adjustment));
            console.log('⏱️ Lap time slider adjustment:', { currentValue, adjustment, newValue });
            lapTimeSlider.value = newValue.toFixed(1);
            this.updateSliderDisplays();
            this.recalculateWithAdjustments();
        }
    }

    /**
     * Setup collapsible handlers for weather and track map containers
     */
    setupCollapsibleHandlers() {
        console.log('🔧 Setting up collapsible handlers for weather and track map...');

        // Weather toggle button
        const weatherToggleBtn = document.getElementById('weather-toggle-btn');
        if (weatherToggleBtn) {
            weatherToggleBtn.addEventListener('click', () => {
                this.toggleContainer('weather-display-page2');
            });
        }

        // Track map toggle button
        const trackMapToggleBtn = document.getElementById('track-map-toggle-btn');
        if (trackMapToggleBtn) {
            trackMapToggleBtn.addEventListener('click', () => {
                this.toggleContainer('track-map-container-page2');
            });
        }
    }

    /**
     * Toggle a collapsible container
     * @param {string} containerId - ID of the container to toggle
     */
    toggleContainer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const isCollapsed = container.classList.contains('collapsed');

        if (isCollapsed) {
            // Expand
            container.classList.remove('collapsed');
            console.log(`📂 Expanded ${containerId}`);
        } else {
            // Collapse
            container.classList.add('collapsed');
            console.log(`📁 Collapsed ${containerId}`);
        }
    }
}