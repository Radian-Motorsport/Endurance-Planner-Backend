// Live Strategy Tracker - Connects to RadianApp telemetry and displays race progress vs plan

class LiveStrategyTracker {
    constructor() {
        this.socket = null;
        this.strategy = null;
        this.currentStint = null;
        this.currentLap = 0;
        this.currentStintLap = 0;  // Laps completed in current stint (starts at 0)
        this.currentStintNumber = 1;  // Stint number (starts at 1)
        this.sessionTimeRemain = 0;
        this.fuelLevel = 0;
        this.lastLapTime = 0;
        this.isConnected = false;
        this.sessionInfo = null;
        this.fuelPerLap = 0;
        
        // Fuel per lap calculation - track lap boundaries
        this.lastProcessedLap = -1;
        this.fuelAtLapStart = null;
        this.fuelUsageHistory = [];
        
        // Stint tracking - pit road transition detection
        this.wasOnPitRoad = false;
        this.stintStartLap = 0;
        
        // Per-stint data storage
        this.currentStintLapTimes = [];  // Lap times for current stint
        this.currentStintFuelUse = [];   // Fuel use for each lap in current stint
        this.stintHistory = [];          // Array of completed stints with their data
        
        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
        this.connectToTelemetry();
        
        // Check for strategy in URL on load
        this.checkURLForStrategy();
    }
    
    initializeElements() {
        // Status elements
        this.elements.telemetryStatus = document.getElementById('telemetry-status');
        this.elements.telemetryStatusText = document.getElementById('telemetry-status-text');
        this.elements.currentDriver = document.getElementById('current-driver');
        
        // Session info
        this.elements.sessionTrack = document.getElementById('session-track');
        this.elements.sessionCar = document.getElementById('session-car');
        this.elements.sessionType = document.getElementById('session-type');
        this.elements.sessionSeries = document.getElementById('session-series');
        
        // Live stats
        this.elements.sessionTime = document.getElementById('session-time');
        this.elements.totalLaps = document.getElementById('current-lap');  // Now shows total laps
        this.elements.stintNumber = document.getElementById('stint-number');
        this.elements.stintLap = document.getElementById('stint-lap');
        this.elements.fuelRemaining = document.getElementById('fuel-remaining');
        this.elements.lastLapTime = document.getElementById('last-lap-time');
        this.elements.fuelPerLap = document.getElementById('fuel-per-lap');
        
        // Stint data displays
        this.elements.avgLapTime = document.getElementById('avg-lap-time');
        this.elements.avgFuelPerLap = document.getElementById('avg-fuel-per-lap');
        this.elements.stintLapTimesList = document.getElementById('stint-lap-times-list');
        this.elements.stintFuelList = document.getElementById('stint-fuel-list');
        this.elements.stintHistoryList = document.getElementById('stint-history-list');
        
        // Strategy comparison
        this.elements.currentStintNumber = document.getElementById('current-stint-number');
        this.elements.totalStints = document.getElementById('total-stints');
        this.elements.lapDelta = document.getElementById('lap-delta');
        this.elements.nextPitLap = document.getElementById('next-pit-lap');
        
        // Table
        this.elements.stintTableBody = document.getElementById('stint-table-body');
        
        // Modal
        this.elements.loadModal = document.getElementById('load-modal');
        this.elements.strategyInput = document.getElementById('strategy-input');
    }
    
    setupEventListeners() {
        // Load strategy button
        document.getElementById('load-strategy-btn').addEventListener('click', () => {
            this.elements.loadModal.classList.remove('hidden');
        });
        
        // Load confirm
        document.getElementById('load-confirm-btn').addEventListener('click', () => {
            this.loadStrategyFromInput();
        });
        
        // Load cancel
        document.getElementById('load-cancel-btn').addEventListener('click', () => {
            this.elements.loadModal.classList.add('hidden');
        });
        
        // Reconnect button
        document.getElementById('reconnect-btn').addEventListener('click', () => {
            this.connectToTelemetry();
        });
    }
    
    connectToTelemetry() {
        console.log('🔌 Connecting to RadianApp telemetry...');
        
        // Connect to RadianApp production server
        this.socket = io('https://radianapp.onrender.com');
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to telemetry server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from telemetry server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            this.updateConnectionStatus(false);
        });
        
        // Listen for telemetry data
        this.socket.on('telemetry', (data) => {
            this.handleTelemetryUpdate(data);
        });
        
        // Listen for driver info
        this.socket.on('currentBroadcaster', (info) => {
            this.elements.currentDriver.textContent = info.driver || '--';
        });
        
        // Listen for session info
        this.socket.on('sessionInfo', (data) => {
            console.log('📊 Received sessionInfo:', data);
            this.handleSessionInfo(data);
        });
    }
    
    updateConnectionStatus(connected) {
        if (connected) {
            this.elements.telemetryStatus.classList.remove('status-offline');
            this.elements.telemetryStatus.classList.add('status-on-track');
            this.elements.telemetryStatusText.textContent = 'Connected';
        } else {
            this.elements.telemetryStatus.classList.remove('status-on-track');
            this.elements.telemetryStatus.classList.add('status-offline');
            this.elements.telemetryStatusText.textContent = 'Disconnected';
        }
    }
    
    handleSessionInfo(sessionData) {
        this.sessionInfo = sessionData;
        
        console.log('🏁 Processing session info:', {
            track: sessionData?.WeekendInfo?.TrackDisplayName,
            trackId: sessionData?.WeekendInfo?.TrackID,
            eventType: sessionData?.WeekendInfo?.EventType,
            seriesId: sessionData?.WeekendInfo?.SeriesID
        });
        
        // Extract and display key session data
        const trackName = sessionData?.WeekendInfo?.TrackDisplayName || '--';
        const eventType = sessionData?.WeekendInfo?.EventType || '--';
        const seriesId = sessionData?.WeekendInfo?.SeriesID || '--';
        
        // Get driver's car info
        let carName = '--';
        if (sessionData?.DriverInfo?.Drivers && sessionData.DriverInfo.Drivers.length > 0) {
            const driverCar = sessionData.DriverInfo.Drivers[0];
            carName = driverCar.CarScreenName || driverCar.CarPath || '--';
        }
        
        // Update UI
        this.elements.sessionTrack.textContent = trackName;
        this.elements.sessionCar.textContent = carName;
        this.elements.sessionType.textContent = eventType;
        this.elements.sessionSeries.textContent = `Series ${seriesId}`;
        
        console.log('✅ Session info displayed:', {
            track: trackName,
            car: carName,
            event: eventType,
            series: seriesId
        });
    }
    
    handleTelemetryUpdate(data) {
        if (!data || !data.values) return;
        
        const values = data.values;
        
        // Update live stats
        this.currentLap = values.Lap || 0;
        this.sessionTimeRemain = values.SessionTimeRemain || 0;
        this.fuelLevel = values.FuelLevel || 0;
        this.lastLapTime = values.LapLastLapTime || 0;
        
        // Detect pit road transition - when driver exits pits (OnPitRoad: true -> false)
        const isOnPitRoad = values.OnPitRoad || false;
        if (this.wasOnPitRoad === true && isOnPitRoad === false) {
            // Driver just exited pit road - NEW STINT STARTED
            this.finishCurrentStint();  // Save current stint data
            this.startNewStint();       // Initialize new stint
            console.log(`🏁 NEW STINT #${this.currentStintNumber} started!`);
        }
        this.wasOnPitRoad = isOnPitRoad;
        
        // Calculate fuel per lap when lap boundaries are crossed
        if (this.currentLap > this.lastProcessedLap) {
            // Lap has incremented - lap just completed
            if (this.fuelAtLapStart !== null && this.fuelAtLapStart > 0) {
                // Calculate fuel used in the lap that just completed
                const fuelUsedInLap = this.fuelAtLapStart - this.fuelLevel;
                
                // Only record if fuel was actually consumed (not pit stop or refuel)
                if (fuelUsedInLap > 0 && fuelUsedInLap < 10) {
                    this.fuelUsageHistory.push(fuelUsedInLap);
                    // Keep rolling buffer of last 10 laps for trend
                    if (this.fuelUsageHistory.length > 10) {
                        this.fuelUsageHistory.shift();
                    }
                    // Use latest lap fuel consumption
                    this.fuelPerLap = fuelUsedInLap;
                    
                    // Store in current stint data
                    this.currentStintFuelUse.push(fuelUsedInLap);
                    this.currentStintLapTimes.push(this.lastLapTime);
                    
                    // Increment stint lap count (completed laps)
                    this.currentStintLap++;
                    
                    console.log(`📊 Lap ${this.lastProcessedLap + 1} (Stint lap ${this.currentStintLap}): ${fuelUsedInLap.toFixed(2)}L, ${this.formatLapTime(this.lastLapTime)}`);
                }
            }
            
            // Record fuel at start of new lap
            this.fuelAtLapStart = this.fuelLevel;
            this.lastProcessedLap = this.currentLap;
        }
        
        // Update UI
        this.updateLiveStats();
        
        // Update strategy comparison if strategy is loaded
        if (this.strategy) {
            this.updateStrategyComparison();
        }
    }
    
    startNewStint() {
        this.currentStintNumber++;
        this.currentStintLap = 0;  // Reset to 0 laps completed
        this.stintStartLap = this.currentLap;
        this.currentStintLapTimes = [];
        this.currentStintFuelUse = [];
        this.fuelAtLapStart = this.fuelLevel;
    }
    
    finishCurrentStint() {
        if (this.currentStintLap > 0) {
            // Only save if we completed at least one lap in the stint
            const stintData = {
                stintNumber: this.currentStintNumber,
                lapCount: this.currentStintLap,
                lapTimes: [...this.currentStintLapTimes],
                fuelUse: [...this.currentStintFuelUse],
                avgLapTime: this.getAverageLapTime(this.currentStintLapTimes),
                avgFuelPerLap: this.getAverageFuelPerLap(this.currentStintFuelUse)
            };
            this.stintHistory.push(stintData);
            console.log(`✅ Stint #${this.currentStintNumber} completed:`, stintData);
        }
    }
    
    updateLiveStats() {
        // Session time (convert from seconds remaining to elapsed)
        const totalSessionTime = 28800; // 8 hours in seconds (you can get this from sessionInfo)
        const elapsedTime = totalSessionTime - this.sessionTimeRemain;
        this.elements.sessionTime.textContent = this.formatTime(elapsedTime);
        
        // Total laps in session
        this.elements.totalLaps.textContent = this.currentLap || '--';
        
        // Current stint number
        this.elements.stintNumber.textContent = this.currentStintNumber || '--';
        
        // Stint laps completed
        this.elements.stintLap.textContent = this.currentStintLap >= 0 ? this.currentStintLap : '--';
        
        // Fuel
        this.elements.fuelRemaining.textContent = this.fuelLevel ? `${this.fuelLevel.toFixed(1)} L` : '-- L';
        
        // Last lap time
        this.elements.lastLapTime.textContent = this.lastLapTime ? this.formatLapTime(this.lastLapTime) : '--:--';
        
        // Latest lap fuel per lap
        this.elements.fuelPerLap.textContent = this.fuelPerLap > 0 ? `${this.fuelPerLap.toFixed(2)} L` : '-- L';
        
        // Average lap time for current stint
        const avgLapTime = this.getAverageLapTime(this.currentStintLapTimes);
        this.elements.avgLapTime.textContent = avgLapTime > 0 ? this.formatLapTime(avgLapTime) : '--:--';
        
        // Average fuel for current stint
        const avgFuel = this.getAverageFuelPerLap(this.currentStintFuelUse);
        this.elements.avgFuelPerLap.textContent = avgFuel > 0 ? `${avgFuel.toFixed(2)} L` : '-- L';
        
        // Update stint data displays
        this.updateStintDataDisplay();
    }
    
    updateStintDataDisplay() {
        // Display lap times for current stint
        if (this.elements.stintLapTimesList && this.currentStintLapTimes.length > 0) {
            this.elements.stintLapTimesList.innerHTML = this.currentStintLapTimes
                .map((time, idx) => `<div class="text-xs font-mono">L${idx + 1}: ${this.formatLapTime(time)}</div>`)
                .join('');
        } else if (this.elements.stintLapTimesList) {
            this.elements.stintLapTimesList.innerHTML = '<div class="text-xs text-neutral-500">No data yet</div>';
        }
        
        // Display fuel use for current stint
        if (this.elements.stintFuelList && this.currentStintFuelUse.length > 0) {
            this.elements.stintFuelList.innerHTML = this.currentStintFuelUse
                .map((fuel, idx) => `<div class="text-xs font-mono">L${idx + 1}: ${fuel.toFixed(2)}L</div>`)
                .join('');
        } else if (this.elements.stintFuelList) {
            this.elements.stintFuelList.innerHTML = '<div class="text-xs text-neutral-500">No data yet</div>';
        }
        
        // Display stint history
        if (this.elements.stintHistoryList) {
            if (this.stintHistory.length > 0) {
                this.elements.stintHistoryList.innerHTML = this.stintHistory
                    .map(stint => `
                        <div class="text-xs space-y-0">
                            <div class="font-bold text-blue-400">Stint #${stint.stintNumber}</div>
                            <div class="text-neutral-400">Laps: ${stint.lapCount} | Avg: ${this.formatLapTime(stint.avgLapTime)} | Fuel: ${stint.avgFuelPerLap.toFixed(2)}L</div>
                        </div>
                    `)
                    .join('');
            } else {
                this.elements.stintHistoryList.innerHTML = '<div class="text-neutral-500 text-xs">No completed stints</div>';
            }
        }
    }
    
    updateStrategyComparison() {
        if (!this.strategy || !this.strategy.stints) return;
        
        // Find current stint based on current lap
        const currentStint = this.findCurrentStint(this.currentLap);
        
        if (currentStint) {
            this.currentStint = currentStint;
            
            // Update stint number
            this.elements.currentStintNumber.textContent = currentStint.stintNumber;
            this.elements.totalStints.textContent = this.strategy.stints.length;
            
            // Calculate lap delta (actual vs planned)
            const plannedLap = this.getPlannedLapForTime(this.sessionTimeRemain);
            const delta = this.currentLap - plannedLap;
            
            this.elements.lapDelta.textContent = delta > 0 ? `+${delta}` : delta;
            this.elements.lapDelta.classList.remove('delta-positive', 'delta-negative', 'delta-neutral');
            if (delta > 0) {
                this.elements.lapDelta.classList.add('delta-positive');
            } else if (delta < 0) {
                this.elements.lapDelta.classList.add('delta-negative');
            } else {
                this.elements.lapDelta.classList.add('delta-neutral');
            }
            
            // Next pit stop
            const lapsToNextPit = currentStint.endLap - this.currentLap;
            this.elements.nextPitLap.textContent = lapsToNextPit > 0 ? lapsToNextPit : '--';
        }
        
        // Update stint table rows
        this.updateStintTableStatus();
    }
    
    findCurrentStint(currentLap) {
        if (!this.strategy || !this.strategy.stints) return null;
        
        for (const stint of this.strategy.stints) {
            if (currentLap >= stint.startLap && currentLap <= stint.endLap) {
                return stint;
            }
        }
        
        return null;
    }
    
    getPlannedLapForTime(sessionTimeRemain) {
        // This would need the race start time and elapsed time
        // For now, return a simple estimation
        return Math.floor(this.currentLap); // Placeholder
    }
    
    updateStintTableStatus() {
        const rows = this.elements.stintTableBody.querySelectorAll('tr[data-stint]');
        
        rows.forEach(row => {
            const stintNum = parseInt(row.getAttribute('data-stint'));
            const stint = this.strategy.stints.find(s => s.stintNumber === stintNum);
            
            if (!stint) return;
            
            // Remove all status classes
            row.classList.remove('stint-completed', 'stint-active', 'stint-upcoming');
            
            // Apply status based on current lap
            if (this.currentLap > stint.endLap) {
                row.classList.add('stint-completed');
            } else if (this.currentLap >= stint.startLap && this.currentLap <= stint.endLap) {
                row.classList.add('stint-active');
            } else {
                row.classList.add('stint-upcoming');
            }
        });
    }
    
    async loadStrategyFromInput() {
        const input = this.elements.strategyInput.value.trim();
        
        if (!input) {
            alert('Please enter a strategy ID or share link');
            return;
        }
        
        // Extract ID from URL or use as-is
        let strategyId = input;
        if (input.includes('?id=')) {
            const url = new URL(input);
            strategyId = url.searchParams.get('id');
        }
        
        console.log('📥 Loading strategy:', strategyId);
        
        try {
            // Fetch strategy from server
            const response = await fetch(`/api/strategies/${strategyId}`);
            
            if (!response.ok) {
                throw new Error('Strategy not found');
            }
            
            const strategy = await response.json();
            this.loadStrategy(strategy);
            
            // Close modal
            this.elements.loadModal.classList.add('hidden');
            this.elements.strategyInput.value = '';
            
        } catch (error) {
            console.error('❌ Failed to load strategy:', error);
            alert('Failed to load strategy. Please check the ID and try again.');
        }
    }
    
    checkURLForStrategy() {
        const params = new URLSearchParams(window.location.search);
        const strategyId = params.get('id');
        
        if (strategyId) {
            console.log('📥 Strategy ID found in URL:', strategyId);
            this.elements.strategyInput.value = strategyId;
            this.loadStrategyFromInput();
        }
    }
    
    loadStrategy(strategy) {
        console.log('✅ Strategy loaded:', strategy);
        this.strategy = strategy;
        
        // Populate stint table
        this.populateStintTable();
    }
    
    populateStintTable() {
        if (!this.strategy || !this.strategy.stints) return;
        
        const tbody = this.elements.stintTableBody;
        tbody.innerHTML = '';
        
        this.strategy.stints.forEach(stint => {
            const row = document.createElement('tr');
            row.setAttribute('data-stint', stint.stintNumber);
            row.className = 'stint-upcoming';
            
            row.innerHTML = `
                <td class="px-3 py-3 font-bold">#${stint.stintNumber}</td>
                <td class="px-3 py-3">
                    <span class="px-2 py-1 rounded text-xs bg-neutral-700">Upcoming</span>
                </td>
                <td class="px-3 py-3">${stint.driver || 'Unassigned'}</td>
                <td class="px-3 py-3 text-right font-mono">${stint.startLap}</td>
                <td class="px-3 py-3 text-right font-mono">${stint.endLap}</td>
                <td class="px-3 py-3 text-right font-mono">${stint.laps.toFixed(1)}</td>
                <td class="px-3 py-3 font-mono text-sm">${this.formatDateTime(stint.startTime)}</td>
                <td class="px-3 py-3 font-mono text-sm">${this.formatDateTime(stint.endTime)}</td>
                <td class="px-3 py-3 text-neutral-500">--</td>
            `;
            
            tbody.appendChild(row);
        });
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    formatLapTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${minutes}:${String(secs).padStart(6, '0')}`;
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    /**
     * Get average lap time from array
     * @param {Array<number>} lapTimes - Array of lap times in seconds
     * @returns {number} Average lap time
     */
    getAverageLapTime(lapTimes) {
        if (!lapTimes || lapTimes.length === 0) return 0;
        const sum = lapTimes.reduce((a, b) => a + b, 0);
        return sum / lapTimes.length;
    }
    
    /**
     * Get average fuel per lap from array
     * @param {Array<number>} fuelUse - Array of fuel usage in liters
     * @returns {number} Average fuel per lap
     */
    getAverageFuelPerLap(fuelUse) {
        if (!fuelUse || fuelUse.length === 0) return 0;
        const sum = fuelUse.reduce((a, b) => a + b, 0);
        return sum / fuelUse.length;
    }
}

// Initialize tracker when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.liveTracker = new LiveStrategyTracker();
});
