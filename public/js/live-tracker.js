// Live Strategy Tracker - Connects to RadianApp telemetry and displays race progress vs plan
// Loads strategies the exact same way the planner does and calculates stint tables

class LiveStrategyTracker {
    constructor() {
        this.socket = null;
        this.strategy = null;
        this.currentStrategyId = null;  // Track which strategy we're viewing
        this.currentStint = null;
        this.currentLap = 0;
        this.currentStintLap = 0;  // Laps completed in current stint (starts at 0)
        this.currentStintNumber = 0;  // Stint number (starts at 0)
        this.currentDriver = '--';  // Driver name from broadcaster
        this.sessionTimeRemain = 0;
        this.fuelLevel = 0;
        this.lastLapTime = 0;
        this.isConnected = false;
        this.sessionInfo = null;
        this.fuelPerLap = 0;
        this.pitStopDuration = 0;  // Pit stop time in seconds
        this.pitStopStartTime = null;  // When pit road was entered
        this.actualPitStopTime = 0;  // Actual measured pit stop duration
        
        // Fuel per lap calculation - track lap boundaries
        this.lastProcessedLap = -1;
        this.fuelAtLapStart = null;
        this.fuelUsageHistory = [];
        
        // Stint tracking - pit road transition detection
        this.wasOnPitRoad = true;  // Start as if in pits, so first pit exit triggers increment
        this.stintStartLap = 0;
        
        // Per-stint data storage
        this.currentStintLapTimes = [];  // Lap times for current stint
        this.currentStintFuelUse = [];   // Fuel use for each lap in current stint
        this.stintHistory = [];          // Array of completed stints with their data
        
        // Time mode (Auto = live telemetry, Manual = user countdown)
        this.timeMode = 'auto';  // 'auto' or 'manual'
        this.manualTimerInterval = null;
        this.manualTimeRemaining = 0;
        
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
        
        // Time mode controls
        this.elements.timeAutoBtn = document.getElementById('time-mode-auto');
        this.elements.timeManualBtn = document.getElementById('time-mode-manual');
        this.elements.manualControls = document.getElementById('manual-mode-controls');
        this.elements.manualHours = document.getElementById('manual-hours');
        this.elements.manualMinutes = document.getElementById('manual-minutes');
        this.elements.manualSeconds = document.getElementById('manual-seconds');
        this.elements.manualStartBtn = document.getElementById('manual-start-btn');
        this.elements.manualStopBtn = document.getElementById('manual-stop-btn');
        this.elements.manualResetBtn = document.getElementById('manual-reset-btn');
    }
    
    setupEventListeners() {
        // Navigation buttons
        document.getElementById('nav-back-planner')?.addEventListener('click', () => {
            const strategyId = this.currentStrategyId;
            if (strategyId) {
                // Go back to planner with strategy link
                window.location.href = `/?strategy=${strategyId}`;
            } else {
                // Go to main planner
                window.location.href = '/';
            }
        });
        
        document.getElementById('nav-load-strategy')?.addEventListener('click', () => {
            this.elements.loadModal.classList.remove('hidden');
        });
        
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
        
        // Time mode toggle
        this.elements.timeAutoBtn?.addEventListener('click', () => this.setTimeMode('auto'));
        this.elements.timeManualBtn?.addEventListener('click', () => this.setTimeMode('manual'));
        
        // Manual timer controls
        this.elements.manualStartBtn?.addEventListener('click', () => this.startManualTimer());
        this.elements.manualStopBtn?.addEventListener('click', () => this.stopManualTimer());
        this.elements.manualResetBtn?.addEventListener('click', () => this.resetManualTimer());
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
            this.currentDriver = info.driver || '--';
            this.elements.currentDriver.textContent = this.currentDriver;
        });
        
        // Listen for session info
        this.socket.on('sessionInfo', (data) => {
            console.log('📊 Received sessionInfo:', data);
            this.handleSessionInfo(data);
        });
        
        // Listen for strategy updates from the planner
        this.socket.on('strategyUpdated', (data) => {
            console.log('🔄 Strategy updated from planner:', data);
            if (this.currentStrategyId && data.strategyId === this.currentStrategyId) {
                // This is an update to our current strategy
                this.loadStrategy(data.strategy);
                console.log('✅ Live tracker strategy refreshed');
            }
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
    
    setTimeMode(mode) {
        this.timeMode = mode;
        console.log(`⏱️ Time mode set to: ${mode}`);
        
        // Update button states
        if (this.elements.timeAutoBtn && this.elements.timeManualBtn) {
            if (mode === 'auto') {
                this.elements.timeAutoBtn.classList.add('bg-blue-600');
                this.elements.timeAutoBtn.classList.remove('bg-neutral-700');
                this.elements.timeManualBtn.classList.remove('bg-blue-600');
                this.elements.timeManualBtn.classList.add('bg-neutral-700');
                this.elements.manualControls.classList.add('hidden');
            } else {
                this.elements.timeManualBtn.classList.add('bg-blue-600');
                this.elements.timeManualBtn.classList.remove('bg-neutral-700');
                this.elements.timeAutoBtn.classList.remove('bg-blue-600');
                this.elements.timeAutoBtn.classList.add('bg-neutral-700');
                this.elements.manualControls.classList.remove('hidden');
                this.resetManualTimer();
            }
        }
    }
    
    startManualTimer() {
        if (this.manualTimerInterval) {
            this.stopManualTimer();
        }
        
        // Get current values from inputs
        const hours = parseInt(this.elements.manualHours?.value || '8');
        const minutes = parseInt(this.elements.manualMinutes?.value || '0');
        const seconds = parseInt(this.elements.manualSeconds?.value || '0');
        
        this.manualTimeRemaining = (hours * 3600) + (minutes * 60) + seconds;
        console.log(`⏱️ Manual timer started: ${this.formatTime(this.manualTimeRemaining)}`);
        
        this.manualTimerInterval = setInterval(() => {
            if (this.manualTimeRemaining > 0) {
                this.manualTimeRemaining--;
                // Force telemetry update to refresh display
                this.handleTelemetryUpdate({ values: {} });
            } else {
                this.stopManualTimer();
                console.log('⏱️ Manual timer finished');
            }
        }, 1000);
    }
    
    stopManualTimer() {
        if (this.manualTimerInterval) {
            clearInterval(this.manualTimerInterval);
            this.manualTimerInterval = null;
            console.log('⏱️ Manual timer stopped');
        }
    }
    
    resetManualTimer() {
        this.stopManualTimer();
        const hours = parseInt(this.elements.manualHours?.value || '8');
        const minutes = parseInt(this.elements.manualMinutes?.value || '0');
        const seconds = parseInt(this.elements.manualSeconds?.value || '0');
        this.manualTimeRemaining = (hours * 3600) + (minutes * 60) + seconds;
        // Force display update to show reset value
        this.handleTelemetryUpdate({ values: {} });
        console.log(`⏱️ Manual timer reset to: ${this.formatTime(this.manualTimeRemaining)}`);
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
        
        // Update live stats - use manual timer if in manual mode, otherwise use telemetry
        if (this.timeMode === 'manual') {
            this.sessionTimeRemain = this.manualTimeRemaining;
        } else {
            this.sessionTimeRemain = values.SessionTimeRemain || 0;
        }
        
        // Update remaining stats
        this.currentLap = values.Lap || 0;
        this.fuelLevel = values.FuelLevel || 0;
        this.lastLapTime = values.LapLastLapTime || 0;
        
        // Detect pit road transitions
        const isOnPitRoad = values.OnPitRoad || false;
        
        // When entering pit road
        if (this.wasOnPitRoad === false && isOnPitRoad === true) {
            this.pitStopStartTime = Date.now();
            console.log('🛠️  Pit stop started');
        }
        
        // When exiting pit road (driver just exited pits - NEW STINT STARTED)
        if (this.wasOnPitRoad === true && isOnPitRoad === false) {
            // Calculate actual pit stop duration
            if (this.pitStopStartTime) {
                this.actualPitStopTime = Math.round((Date.now() - this.pitStopStartTime) / 1000);
                this.pitStopDuration = this.actualPitStopTime;
                console.log(`🛠️  Pit stop ended - Duration: ${this.actualPitStopTime}s`);
                
                // Update the pit row with actual time
                this.updatePitRowWithActualTime();
            }
            
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
        this.actualPitStopTime = 0;  // Reset pit stop time for new stint
        this.pitStopStartTime = null;  // Reset pit timer
        // Update table status now that stint number has changed
        this.updateStintTableStatus();
    }
    
    finishCurrentStint() {
        if (this.currentStintLap > 0) {
            // Calculate total stint time (lap times + pit stop time if applicable)
            const totalLapTime = this.currentStintLapTimes.reduce((a, b) => a + b, 0);
            const totalStintTime = totalLapTime + this.actualPitStopTime;
            
            // Only save if we completed at least one lap in the stint
            const stintData = {
                stintNumber: this.currentStintNumber,
                lapCount: this.currentStintLap,
                lapTimes: [...this.currentStintLapTimes],
                fuelUse: [...this.currentStintFuelUse],
                pitStopTime: this.actualPitStopTime || 0,
                avgLapTime: this.getAverageLapTime(this.currentStintLapTimes),
                avgFuelPerLap: this.getAverageFuelPerLap(this.currentStintFuelUse),
                totalLapTime: totalLapTime || 0,
                totalStintTime: totalStintTime || 0
            };
            this.stintHistory.push(stintData);
            console.log(`✅ Stint #${this.currentStintNumber} completed:`, stintData);
            console.log(`   Lap times: ${JSON.stringify(this.currentStintLapTimes)}`);
            console.log(`   Total lap time: ${totalLapTime}s, Pit time: ${this.actualPitStopTime}s`);
            
            // Update display immediately
            this.updateStintDataDisplay();
            // Update table status
            this.updateStintTableStatus();
            
            // Recalculate remaining stints based on actual performance
            if (this.strategy && this.strategy.stints && this.stintHistory.length > 0) {
                this.recalculateRemainingStints();
            }
        }
    }
    
    updatePitRowWithActualTime() {
        const tbody = this.elements.stintTableBody;
        if (!tbody) return;
        
        // Find the pit row for the current stint (the one before the next stint starts)
        const pitRows = tbody.querySelectorAll('tr[data-role="pit-stop"]');
        const pitRowIndex = this.currentStintNumber - 2;  // -1 for 0-based, -1 for pit after stint
        
        if (pitRowIndex >= 0 && pitRowIndex < pitRows.length) {
            const pitRow = pitRows[pitRowIndex];
            const cells = pitRow.querySelectorAll('td');
            // Update the duration cell (index 5 - the pit stop duration column)
            if (cells[5]) {
                cells[5].textContent = `${this.actualPitStopTime}s`;
                cells[5].classList.add('text-green-400');  // Highlight with actual time
                console.log(`✅ Updated pit row ${pitRowIndex} with actual pit time: ${this.actualPitStopTime}s`);
            }
        }
    }
    
    updateLiveStats() {
        // Session time - just display remaining time directly
        this.elements.sessionTime.textContent = this.formatTime(this.sessionTimeRemain);
        
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
        
        // Pit stop time
        const pitStopEl = document.getElementById('pit-stop-time');
        if (pitStopEl && this.pitStopDuration) {
            pitStopEl.textContent = `${this.pitStopDuration}s`;
        }
        
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
                        <div class="text-sm font-mono border-b border-neutral-700 pb-2 mb-2">
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-blue-400">Stint #${stint.stintNumber}</span>
                                <span class="text-emerald-400">${stint.totalStintTime ? this.formatLapTime(stint.totalStintTime) : '--'}</span>
                            </div>
                            <div class="text-xs text-neutral-400 mt-1">
                                Laps: <span class="text-white">${stint.lapCount}</span> | 
                                Avg: <span class="text-white">${this.formatLapTime(stint.avgLapTime)}</span> | 
                                Fuel: <span class="text-white">${stint.avgFuelPerLap.toFixed(2)}L</span>
                            </div>
                            <div class="text-xs text-neutral-500 mt-1">
                                Pit: ${stint.pitStopTime}s | Lap Time: ${stint.totalLapTime ? this.formatLapTime(stint.totalLapTime) : '--'}
                            </div>
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
        const tbody = this.elements.stintTableBody;
        const stintRows = tbody.querySelectorAll('tr[data-role="stint"]');
        
        stintRows.forEach(row => {
            const statusCell = row.querySelector('.status-cell');
            const stintNumber = parseInt(row.getAttribute('data-stint'));  // 1-based from table
            
            // Remove all status classes
            row.classList.remove('stint-completed', 'stint-active', 'stint-upcoming');
            statusCell.classList.remove('text-green-500', 'text-blue-400', 'text-neutral-500');
            
            if (stintNumber < this.currentStintNumber) {
                // Completed - before current
                row.classList.add('stint-completed');
                row.classList.add('opacity-50');
                statusCell.textContent = '✓ Completed';
                statusCell.classList.add('text-green-500');
            } else if (this.currentStintNumber > 0 && stintNumber === this.currentStintNumber) {
                // Active - matches current stint number
                row.classList.add('stint-active');
                statusCell.textContent = '→ Active';
                statusCell.classList.add('text-blue-400');
            } else {
                // Upcoming - after current
                row.classList.add('stint-upcoming');
                statusCell.textContent = '○ Upcoming';
                statusCell.classList.add('text-neutral-500');
            }
        });
    }
    
    async loadStrategyFromInput() {
        const input = this.elements.strategyInput.value.trim();
        
        if (!input) {
            alert('Please enter a strategy share link or ID');
            return;
        }
        
        console.log('📥 Loading strategy input...');
        
        // Extract strategy ID from input
        let strategyId = input;
        
        // Extract ID from full share link if provided
        if (input.includes('?strategy=')) {
            const url = new URL(input);
            strategyId = url.searchParams.get('strategy');
        }
        
        try {
            console.log('🔍 Fetching strategy ID:', strategyId);
            const response = await fetch(`/api/strategies/${strategyId}`);
            
            if (response.ok) {
                const strategy = await response.json();
                console.log('✅ Strategy loaded from server');
                this.loadStrategy(strategy);
                
                // Store strategy ID in sessionStorage for persistence
                this.currentStrategyId = strategyId;
                sessionStorage.setItem('currentStrategyId', strategyId);
                this.updateStrategyHeader();
                
                // Close modal
                this.elements.loadModal.classList.add('hidden');
                this.elements.strategyInput.value = '';
                return;
            } else {
                alert('Strategy not found. Check the share link or ID.');
            }
        } catch (error) {
            console.error('❌ Failed to load strategy:', error);
            alert('Failed to load strategy. Paste a valid share link or strategy ID.');
        }
    }
    
    updateStrategyHeader() {
        const infoEl = document.getElementById('current-strategy-info');
        if (infoEl && this.currentStrategyId) {
            infoEl.textContent = `Loaded: ${this.currentStrategyId.substring(0, 8)}...`;
        }
    }
    
    checkURLForStrategy() {
        const params = new URLSearchParams(window.location.search);
        let strategyId = params.get('strategy');
        
        // Fallback to sessionStorage if not in URL
        if (!strategyId) {
            strategyId = sessionStorage.getItem('currentStrategyId');
        }
        
        if (strategyId) {
            console.log('📥 Strategy ID found:', strategyId);
            this.currentStrategyId = strategyId;
            sessionStorage.setItem('currentStrategyId', strategyId);
            this.updateStrategyHeader();
            this.elements.strategyInput.value = strategyId;
            this.loadStrategyFromInput();
        }
    }
    
    loadStrategy(strategy) {
        console.log('✅ Strategy loaded:', strategy);
        this.strategy = strategy;
        
        // Use pre-calculated stints from planner (already in strategy.stints)
        if (strategy.stints && Array.isArray(strategy.stints)) {
            console.log('✅ Using pre-calculated stints from planner');
            this.populateStintTable();
        } else if (strategy.strategyState && strategy.formData) {
            // Fallback: recalculate if stints not present
            console.log('⚠️ Pre-calculated stints not found, recalculating...');
            this.calculateStints();
        } else {
            console.warn('❌ No stints or strategy state found');
            this.populateStintTable();
        }
    }
    
    calculateStints() {
        if (!this.strategy.strategyState || !this.strategy.formData) return;
        
        const state = this.strategy.strategyState;
        const formData = this.strategy.formData;
        
        // Calculate basic stint parameters
        const totalStints = state.totalStints;
        const raceDuration = state.raceDurationSeconds;
        const lapsPerStint = state.lapsPerStint;
        const pitStopTime = state.pitStopTime || 90; // Default pit stop time
        const avgLapTime = formData.avgLapTime || 300; // Average lap time in seconds
        
        const stints = [];
        let currentLap = 1;
        let currentTime = 0;
        
        for (let i = 1; i <= totalStints; i++) {
            const stintDriver = this.strategy.stintDriverAssignments?.[i-1] || 'Unassigned';
            const startLap = Math.floor(currentLap);
            const endLap = Math.floor(currentLap + lapsPerStint - 1);
            const laps = endLap - startLap + 1;
            
            // Calculate times based on: startTime = (startLap - 1) * avgLapTime, endTime = endLap * avgLapTime
            const startTime = this.formatTimeSeconds((startLap - 1) * avgLapTime);
            const endTime = this.formatTimeSeconds(endLap * avgLapTime);
            
            stints.push({
                stintNumber: i,
                driver: stintDriver,
                startLap: startLap,
                endLap: endLap,
                laps: laps,
                startTime: startTime,
                endTime: endTime
            });
            
            // Next stint starts after this one ends + pit stop time
            currentLap = endLap + 1;
            currentTime = (endLap * avgLapTime) + pitStopTime;
        }
        
        this.strategy.stints = stints;
        this.populateStintTable();
    }
    
    formatTimeSeconds(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    populateStintTable() {
        if (!this.strategy) return;
        
        const stints = this.strategy.stints;
        
        if (!stints || !Array.isArray(stints) || stints.length === 0) {
            const tbody = this.elements.stintTableBody;
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-neutral-500 py-4">No stints loaded</td></tr>';
            return;
        }
        
        const tbody = this.elements.stintTableBody;
        tbody.innerHTML = '';
        
        // Get pit stop time from strategy
        const pitStopTime = this.strategy.strategyState?.pitStopTime || 90;
        this.pitStopDuration = pitStopTime;
        
        stints.forEach((stint, index) => {
            // Create stint row
            const stintRow = document.createElement('tr');
            stintRow.setAttribute('data-role', 'stint');
            stintRow.setAttribute('data-stint', stint.stintNumber);
            stintRow.setAttribute('data-stint-index', index);
            stintRow.className = 'bg-neutral-800 hover:bg-neutral-700 transition-colors';
            
            stintRow.innerHTML = `
                <td class="px-3 py-2 font-bold text-sm">#${stint.stintNumber}</td>
                <td class="px-3 py-2 font-mono text-xs">${stint.startTime}</td>
                <td class="px-3 py-2 font-mono text-xs">${stint.endTime}</td>
                <td class="px-3 py-2 text-right font-mono text-sm">${stint.startLap}</td>
                <td class="px-3 py-2 text-right font-mono text-sm">${stint.endLap}</td>
                <td class="px-3 py-2 text-right font-mono text-blue-400 text-sm">${stint.laps}</td>
                <td class="px-3 py-2 text-sm">${stint.driver || 'Unassigned'}</td>
                <td class="px-3 py-2 text-sm status-cell text-neutral-500">--</td>
            `;
            
            tbody.appendChild(stintRow);
            
            // Create pit stop row (except after last stint)
            if (index < stints.length - 1) {
                const pitRow = document.createElement('tr');
                pitRow.setAttribute('data-role', 'pit-stop');
                pitRow.setAttribute('data-stint', stint.stintNumber);
                pitRow.className = 'bg-neutral-900 transition-colors';
                
                pitRow.innerHTML = `
                    <td class="px-3 py-1 text-neutral-600 text-xs"></td>
                    <td class="px-3 py-1 text-neutral-500 text-xs">--</td>
                    <td class="px-3 py-1 text-neutral-500 text-xs">--</td>
                    <td class="px-3 py-1 text-center text-neutral-500 text-xs">PIT</td>
                    <td class="px-3 py-1 text-center text-neutral-500 text-xs">PIT</td>
                    <td class="px-3 py-1 text-right text-neutral-400 font-mono text-xs">${pitStopTime}s</td>
                    <td class="px-3 py-1 text-neutral-600 text-xs">-</td>
                    <td class="px-3 py-1 text-neutral-600 text-xs">-</td>
                `;
                
                tbody.appendChild(pitRow);
            }
        });
    }
    
    /**
     * Get average pit stop time with 10% variance filter
     * Ignores outliers (accidents/repairs) that exceed baseline by 10%
     */
    getAveragePitStopTime() {
        if (!this.strategy || !this.strategy.strategyState) {
            return 90; // Default fallback
        }
        
        // Use baseline from planner pit stop time
        const baseline = this.strategy.strategyState.pitStopTime || 90;
        
        if (this.stintHistory.length === 0) {
            return baseline;
        }
        
        const threshold = baseline * 0.1; // 10% variance
        
        // Filter pit times within threshold of baseline
        const validPitTimes = this.stintHistory
            .map(s => s.pitStopTime)
            .filter(time => Math.abs(time - baseline) <= threshold);
        
        if (validPitTimes.length === 0) {
            // No valid samples, return baseline
            console.log(`⚠️ No pit stops within threshold, using baseline: ${baseline}s`);
            return baseline;
        }
        
        const avg = validPitTimes.reduce((a, b) => a + b, 0) / validPitTimes.length;
        console.log(`📊 Pit stop average: ${avg.toFixed(1)}s (baseline: ${baseline}s, valid samples: ${validPitTimes.length}/${this.stintHistory.length})`);
        return avg;
    }
    
    /**
     * Recalculate remaining stints based on actual performance
     * Uses running averages from completed stints
     */
    recalculateRemainingStints() {
        if (!this.strategy || !this.strategy.stints || this.stintHistory.length === 0) return;
        
        // Calculate running averages
        const totalLapTime = this.stintHistory.reduce((sum, s) => sum + s.totalLapTime, 0);
        const totalLaps = this.stintHistory.reduce((sum, s) => sum + s.lapCount, 0);
        const actualAvgLapTime = totalLaps > 0 ? totalLapTime / totalLaps : 300;
        
        const totalFuel = this.stintHistory.reduce((sum, s) => sum + s.fuelUse.reduce((a, b) => a + b, 0), 0);
        const actualAvgFuelPerLap = totalLaps > 0 ? totalFuel / totalLaps : 1.0;
        
        const avgPitStopTime = this.getAveragePitStopTime();
        
        console.log(`🔄 Recalculating stints with actuals:`, {
            avgLapTime: actualAvgLapTime.toFixed(2),
            avgFuelPerLap: actualAvgFuelPerLap.toFixed(2),
            avgPitStopTime: avgPitStopTime.toFixed(1)
        });
        
        // Get tank capacity and remaining session time
        const tankCapacity = this.strategy.formData?.tankCapacity || 100;
        const remainingSessionTime = this.sessionTimeRemain;
        
        // Calculate laps per stint based on fuel and tank
        const lapsPerTank = Math.floor(tankCapacity / actualAvgFuelPerLap);
        
        // Recalculate remaining stints
        const totalStints = this.strategy.stints.length;
        const completedStints = this.stintHistory.length;
        const remainingStints = totalStints - completedStints;
        
        if (remainingStints <= 0) {
            console.log('✅ All stints completed');
            return;
        }
        
        // Calculate new stint structure
        const lastEndLap = this.strategy.stints[completedStints - 1].endLap;
        let newCurrentLap = lastEndLap + 1;
        let currentTime = (lastEndLap * actualAvgLapTime) + avgPitStopTime;
        
        console.log(`📍 Recalculating from lap ${newCurrentLap}, ${(remainingSessionTime / 60).toFixed(1)} min remaining`);
        
        // Update remaining stints in strategy
        for (let i = completedStints; i < totalStints; i++) {
            const originalStint = this.strategy.stints[i];
            const startLap = Math.floor(newCurrentLap);
            const endLap = Math.floor(startLap + lapsPerTank - 1);
            
            const startTime = this.formatTimeSeconds((startLap - 1) * actualAvgLapTime);
            const endTime = this.formatTimeSeconds(endLap * actualAvgLapTime);
            
            this.strategy.stints[i] = {
                ...originalStint,
                startLap: startLap,
                endLap: endLap,
                laps: endLap - startLap + 1,
                startTime: startTime,
                endTime: endTime
            };
            
            console.log(`✏️  Stint #${i + 1} recalculated: laps ${startLap}-${endLap} (${endLap - startLap + 1} laps)`);
            
            newCurrentLap = endLap + 1;
        }
        
        // Refresh table display
        this.populateStintTable();
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
