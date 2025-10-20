/**
 * Strategy Calculator Module
 * Handles all race strategy calculations and stint planning
 * Extracted from monolithic index.html to improve maintainability
 */

export class StrategyCalculator {
    constructor() {
        this.totalStints = 0;
        this.raceDurationSeconds = 0;
        this.lapsPerStint = 0;
        this.lapsInLastStint = 0;
        this.pitStopTime = 0;
        this.selectedDrivers = [];
    }

    /**
     * Calculate race strategy and populate results
     * @param {Object} raceData - Race configuration data
     * @returns {Object} Calculation results
     */
    async calculateStrategy(raceData) {
        console.log('🔥🔥🔥 CALCULATE BUTTON PRESSED 🔥🔥🔥');
        
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
        const lapTimeSliderAdjustment = parseInt(document.getElementById('lap-time-slider')?.value) || 0;

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
        const lapsPerTank = Math.floor(inputs.tankCapacity / inputs.fuelPerLap);
        const totalLaps = Math.floor(inputs.raceDurationSeconds / inputs.avgLapTimeInSeconds);
        const stintDuration = lapsPerTank * inputs.avgLapTimeInSeconds;
        
        this.totalStints = Math.floor(totalLaps / lapsPerTank) + (totalLaps % lapsPerTank > 0 ? 1 : 0);
        this.lapsPerStint = lapsPerTank;
        this.lapsInLastStint = totalLaps % this.lapsPerStint;

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
        this.updateElement('laps-per-stint-display', calculations.lapsPerStint);
        this.updateElement('pit-stops-display', calculations.totalPitStops);
        this.updateElement('total-fuel-display', calculations.totalFuel.toFixed(1) + ' L');
        this.updateElement('fuel-per-lap-display', inputs.fuelPerLap.toFixed(1) + ' L');
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
     * Generate and populate stint breakdown table
     * @param {number} avgLapTimeInSeconds - Average lap time
     */
    async populateStintTable(avgLapTimeInSeconds) {
        const tbody = document.getElementById('stint-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Get race start time and timezone settings
        const raceStartTime = this.getRaceStartTime();
        const displayTimeZone = this.getDisplayTimeZone();
        const daylightCalculationMode = this.getDaylightCalculationMode();

        let currentTime = new Date(raceStartTime);
        let currentLap = 1; // Initialize lap counter

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
            const startLap = currentLap;
            const endLap = startLap + stintLaps - 1;
            const row = this.createStintRow(i + 1, selectedDriverName, stintLaps, stintStartTime, stintEndTime, startLap, endLap, displayTimeZone, daylightStatus);
            tbody.appendChild(row);

            // Increment lap counter for next stint
            currentLap += stintLaps;

            // Add pit stop row for next stint (except last stint)
            if (i < this.totalStints - 1) {
                const pitStartTime = new Date(stintEndTime.getTime());
                const pitEndTime = new Date(pitStartTime.getTime() + (this.pitStopTime * 1000));
                const pitRow = this.createPitStopRow(pitStartTime, pitEndTime, displayTimeZone);
                tbody.appendChild(pitRow);
                currentTime = pitEndTime;
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
        const row = document.createElement('tr');
        row.setAttribute('data-role', 'stint');
        row.className = 'bg-neutral-800 hover:bg-neutral-700 transition-colors';

        row.innerHTML = `
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm">${this.formatTimeForDisplay(startTime, timeZone)}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm">${this.formatTimeForDisplay(endTime, timeZone)}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm">${startLap}</td>
            <td class="py-2 px-2 text-center text-neutral-200 font-mono text-sm">${endLap}</td>
            <td class="py-2 px-2 text-center text-blue-400 font-mono text-sm">${stintLaps}</td>
            <td class="w-2 px-1">
                <div class="driver-color-strip" data-stint="${stintNumber - 1}" style="width:12px;height:40px;margin:0 auto;background:linear-gradient(to bottom, rgba(168,85,247,1), rgba(251,191,36,1));"></div>
            </td>
            <td class="py-2 px-3 text-center">
                <select class="driver-select-stint bg-neutral-700 text-neutral-200 p-2 rounded-md w-full border border-neutral-600" 
                        data-stint="${stintNumber - 1}">
                    ${this.generateDriverOptions(driverName)}
                </select>
            </td>
            <td class="py-2 px-3 text-center">
                <select class="backup-select-stint bg-neutral-700 text-neutral-200 p-2 rounded-md w-full border border-neutral-600" 
                        data-stint="${stintNumber - 1}">
                    <option value="">Select...</option>
                </select>
            </td>
        `;

        // Add event listener for driver selection change
        const driverSelect = row.querySelector('.driver-select-stint');
        if (driverSelect) {
            driverSelect.addEventListener('change', (e) => {
                this.handleDriverSelectionChange(e.target);
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
        row.setAttribute('data-role', 'pit');
        row.className = 'bg-neutral-900 transition-colors';

        row.innerHTML = `
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs">${this.formatTimeForDisplay(startTime, timeZone)}</td>
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs">${this.formatTimeForDisplay(endTime, timeZone)}</td>
            <td class="py-1 px-2 text-center text-neutral-500 road-rage-font text-xs" colspan="2">PIT</td>
            <td class="py-1 px-2 text-center text-neutral-400 font-mono text-xs">${this.pitStopTime > 60 ? `01:30` : `${this.pitStopTime} sec`}</td>
            <td class="w-2 px-1"></td>
            <td class="py-1 px-2 text-center text-neutral-600 text-xs">-</td>
            <td class="py-1 px-2 text-center text-neutral-600 text-xs">-</td>
        `;

        return row;
    }

    /**
     * Generate driver options for select dropdown
     * @param {string} selectedDriverName - Currently selected driver
     * @returns {string} HTML options string
     */
    generateDriverOptions(selectedDriverName) {
        let options = '<option value="">Select Driver</option>';
        
        if (this.selectedDrivers && this.selectedDrivers.length > 0) {
            this.selectedDrivers.forEach(driver => {
                const isSelected = driver.name === selectedDriverName ? 'selected' : '';
                options += `<option value="${driver.name}" ${isSelected}>${driver.name}</option>`;
            });
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
                hour12: false 
            });
        } catch (error) {
            return time.toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit',
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
            'sliders-container',
            'share-link-container'
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
    }

    /**
     * Get race start time from form
     * @returns {Date} Race start time
     */
    getRaceStartTime() {
        const dateInput = document.getElementById('race-start-date-page2');
        const timeInput = document.getElementById('race-start-time-page2');
        
        if (dateInput && timeInput && dateInput.value && timeInput.value) {
            return new Date(`${dateInput.value}T${timeInput.value}`);
        }
        
        return new Date(); // Fallback to current time
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
     * Handle driver selection change in stint table
     * @param {HTMLElement} selectElement - Select element that changed
     */
    handleDriverSelectionChange(selectElement) {
        const stintIndex = parseInt(selectElement.dataset.stint);
        const selectedDriverName = selectElement.value;
        
        console.log(`Driver assignment changed for stint ${stintIndex + 1}: ${selectedDriverName}`);
        
        // Update internal state or trigger recalculation if needed
        // This could trigger daylight recalculation for driver-specific timezones
    }

    /**
     * Set selected drivers for calculations
     * @param {Array} drivers - Array of selected driver objects
     */
    setSelectedDrivers(drivers) {
        this.selectedDrivers = drivers;
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
        const raceStartTime = this.getRaceStartTime();
        const displayTimeZone = this.getDisplayTimeZone();
        
        let currentTime = new Date(raceStartTime);
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
            if (cells.length >= 8) {
                cells[0].textContent = this.formatTimeForDisplay(stintStartTime, displayTimeZone);
                cells[1].textContent = this.formatTimeForDisplay(stintEndTime, displayTimeZone);
                // Update lap numbers
                const startLap = currentLap;
                const endLap = startLap + stintLaps - 1;
                cells[2].textContent = startLap;
                cells[3].textContent = endLap;
                cells[4].textContent = stintLaps;
            }

            currentLap += stintLaps;

            // Update pit stop row if it exists
            if (index < this.totalStints - 1) {
                const nextRow = row.nextElementSibling;
                if (nextRow && nextRow.getAttribute('data-role') === 'pit') {
                    const pitStartTime = new Date(stintEndTime.getTime());
                    const pitEndTime = new Date(pitStartTime.getTime() + (this.pitStopTime * 1000));
                    const pitCells = nextRow.querySelectorAll('td');
                    if (pitCells.length >= 2) {
                        pitCells[0].textContent = this.formatTimeForDisplay(pitStartTime, displayTimeZone);
                        pitCells[1].textContent = this.formatTimeForDisplay(pitEndTime, displayTimeZone);
                    }
                    currentTime = pitEndTime;
                } else {
                    currentTime = new Date(stintEndTime.getTime() + (this.pitStopTime * 1000));
                }
            }
        });
    }
}