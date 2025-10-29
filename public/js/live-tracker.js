// Live Strategy Tracker - Connects to RadianApp telemetry and displays race progress vs plan

class LiveStrategyTracker {
    constructor() {
        this.socket = null;
        this.strategy = null;
        this.currentStint = null;
        this.currentLap = 0;
        this.sessionTimeRemain = 0;
        this.fuelLevel = 0;
        this.lastLapTime = 0;
        this.isConnected = false;
        
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
        
        // Live stats
        this.elements.sessionTime = document.getElementById('session-time');
        this.elements.currentLap = document.getElementById('current-lap');
        this.elements.fuelRemaining = document.getElementById('fuel-remaining');
        this.elements.lastLapTime = document.getElementById('last-lap-time');
        
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
    
    handleTelemetryUpdate(data) {
        if (!data || !data.values) return;
        
        const values = data.values;
        
        // Update live stats
        this.currentLap = values.Lap || 0;
        this.sessionTimeRemain = values.SessionTimeRemain || 0;
        this.fuelLevel = values.FuelLevel || 0;
        this.lastLapTime = values.LapLastLapTime || 0;
        
        // Update UI
        this.updateLiveStats();
        
        // Update strategy comparison if strategy is loaded
        if (this.strategy) {
            this.updateStrategyComparison();
        }
    }
    
    updateLiveStats() {
        // Session time (convert from seconds remaining to elapsed)
        const totalSessionTime = 28800; // 8 hours in seconds (you can get this from sessionInfo)
        const elapsedTime = totalSessionTime - this.sessionTimeRemain;
        this.elements.sessionTime.textContent = this.formatTime(elapsedTime);
        
        // Current lap
        this.elements.currentLap.textContent = this.currentLap || '--';
        
        // Fuel
        this.elements.fuelRemaining.textContent = this.fuelLevel ? `${this.fuelLevel.toFixed(1)} L` : '-- L';
        
        // Last lap time
        this.elements.lastLapTime.textContent = this.lastLapTime ? this.formatLapTime(this.lastLapTime) : '--:--';
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
}

// Initialize tracker when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.liveTracker = new LiveStrategyTracker();
});
