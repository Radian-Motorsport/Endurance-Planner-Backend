/**
 * FuelTraceRecorder - Records ideal fuel consumption lap with full telemetry
 * 
 * Records at 1% lap distance intervals:
 * - Fuel level, fuel use rate, speed, throttle
 * Plus weather/session metadata
 */

export class FuelTraceRecorder {
    constructor(socket, sessionInfo) {
        this.socket = socket;
        this.sessionInfo = sessionInfo;
        
        // Recording state
        this.isArmed = false;           // Button pressed, waiting for lap start
        this.isRecording = false;       // Currently recording lap
        this.samples = [];              // Array of 101 samples
        this.metadata = null;           // Weather/session metadata
        this.lastLapDistPct = 0;        // Track lap boundary
        this.currentBucket = -1;        // Current percentage bucket (0-100)
        
        // Player context
        this.playerCarIdx = null;
        this.trackId = null;
        this.carId = null;
        this.carName = null;
        
        // UI elements
        this.statusIndicator = null;
        this.statusText = null;
        this.recordButton = null;
        
        this.setupListeners();
    }
    
    /**
     * Initialize UI elements
     */
    initUI(buttonId, statusIndicatorId, statusTextId) {
        this.recordButton = document.getElementById(buttonId);
        this.statusIndicator = document.getElementById(statusIndicatorId);
        this.statusText = document.getElementById(statusTextId);
        
        if (this.recordButton) {
            this.recordButton.addEventListener('click', () => this.toggleRecording());
        }
        
        // Add view button handler
        const viewButton = document.getElementById('fuel-recorder-view-button');
        if (viewButton) {
            viewButton.addEventListener('click', () => this.toggleDataDisplay());
        }
        
        this.updateUI('idle');
    }
    
    /**
     * Toggle stored data display
     */
    async toggleDataDisplay() {
        const dataDisplay = document.getElementById('fuel-recorder-data-display');
        if (!dataDisplay) return;
        
        if (dataDisplay.classList.contains('hidden')) {
            // Show and load data
            dataDisplay.classList.remove('hidden');
            await this.loadAndDisplayStoredData();
        } else {
            // Hide
            dataDisplay.classList.add('hidden');
        }
    }
    
    /**
     * Load and display stored data for current session
     */
    async loadAndDisplayStoredData() {
        if (!this.trackId || !this.carName) {
            this.showDataMessage('No session loaded yet');
            return;
        }
        
        try {
            const response = await fetch(`/api/ideal-fuel-lap/${this.trackId}/${encodeURIComponent(this.carName)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.displayStoredData(data);
            } else if (response.status === 404) {
                // Silently handle - no data available yet
                this.showDataMessage('📭 No ideal lap recorded for this track/car combination');
            } else {
                this.showDataMessage('❌ Error loading data');
            }
        } catch (err) {
            // Silently handle network errors for missing fuel data
            this.showDataMessage('No fuel data available');
        }
    }
    
    /**
     * Display stored data in UI
     */
    displayStoredData(data) {
        const el = (id) => document.getElementById(id);
        
        // Calculate fuel used
        const fuelStart = data.samples[0]?.fuelLevel ?? 0;
        const fuelEnd = data.samples[data.samples.length - 1]?.fuelLevel ?? 0;
        const fuelUsed = (fuelStart - fuelEnd).toFixed(2);
        
        // Format lap time
        const lapTime = data.metadata.lapTime ? this.formatTime(data.metadata.lapTime) : '--';
        
        // Format recorded date
        const recordedDate = data.metadata.recordedAt ? 
            new Date(data.metadata.recordedAt).toLocaleString() : '--';
        
        // Primary stats
        if (el('stored-track-name')) el('stored-track-name').textContent = `Track ${data.trackId}`;
        if (el('stored-car-name')) el('stored-car-name').textContent = data.carName;
        if (el('stored-lap-time')) el('stored-lap-time').textContent = lapTime;
        if (el('stored-fuel-used')) el('stored-fuel-used').textContent = `${fuelUsed} L`;
        if (el('stored-track-temp')) el('stored-track-temp').textContent = 
            data.metadata.trackTemp ? `${data.metadata.trackTemp.toFixed(1)}°C` : '--';
        if (el('stored-sample-count')) el('stored-sample-count').textContent = data.samples.length;
        
        // Secondary stats
        if (el('stored-air-temp')) el('stored-air-temp').textContent = 
            data.metadata.airTemp ? `${data.metadata.airTemp.toFixed(1)}°C` : '--';
        if (el('stored-wind')) el('stored-wind').textContent = 
            data.metadata.windVel ? `${(data.metadata.windVel * 3.6).toFixed(1)} km/h` : '--';
        if (el('stored-humidity')) el('stored-humidity').textContent = 
            data.metadata.humidity ? `${(data.metadata.humidity * 100).toFixed(0)}%` : '--';
        if (el('stored-tank-capacity')) el('stored-tank-capacity').textContent = 
            data.metadata.tankCapacity ? `${data.metadata.tankCapacity.toFixed(1)} L` : '--';
        if (el('stored-recorded-at')) el('stored-recorded-at').textContent = recordedDate;
    }
    
    /**
     * Show message in data display area
     */
    showDataMessage(message) {
        const el = (id) => document.getElementById(id);
        
        if (el('stored-track-name')) el('stored-track-name').textContent = message;
        if (el('stored-car-name')) el('stored-car-name').textContent = '--';
        if (el('stored-lap-time')) el('stored-lap-time').textContent = '--';
        if (el('stored-fuel-used')) el('stored-fuel-used').textContent = '--';
        if (el('stored-track-temp')) el('stored-track-temp').textContent = '--';
        if (el('stored-sample-count')) el('stored-sample-count').textContent = '--';
    }
    
    /**
     * Format seconds to MM:SS.mmm
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    }
    
    /**
     * Update session info when received
     */
    updateSessionInfo(sessionData) {
        this.sessionInfo = sessionData;
        
        // Extract player car context
        this.playerCarIdx = sessionData?.DriverInfo?.DriverCarIdx;
        this.trackId = sessionData?.WeekendInfo?.TrackID;
        
        if (this.playerCarIdx != null && sessionData?.DriverInfo?.Drivers) {
            const playerCar = sessionData.DriverInfo.Drivers[this.playerCarIdx];
            if (playerCar) {
                this.carName = playerCar.CarScreenName || playerCar.CarPath;
                // Note: carId would come from database lookup by carName
                // For now we'll use carName as identifier
            }
        }
    }
    
    /**
     * Setup telemetry listeners
     */
    setupListeners() {
        this.socket.on('telemetry', (data) => {
            if (!this.isArmed && !this.isRecording) return;
            
            const values = data?.values;
            if (!values) return;
            
            // Get player's lap distance
            const carIdxLapDistPct = values.CarIdxLapDistPct;
            if (!carIdxLapDistPct || this.playerCarIdx == null) return;
            
            const lapDistPct = carIdxLapDistPct[this.playerCarIdx];
            if (lapDistPct == null || lapDistPct < 0) return;
            
            // Detect lap start (crossing from high to low percentage)
            const crossedStart = this.lastLapDistPct > 0.9 && lapDistPct < 0.1;
            
            if (this.isArmed && crossedStart) {
                // Start recording
                this.startRecording(values);
            }
            
            if (this.isRecording) {
                // Record sample
                this.recordSample(lapDistPct, values);
                
                // Check for lap completion
                if (crossedStart && this.samples.length > 50) {
                    // Completed full lap (and crossed start again)
                    this.finishRecording();
                }
            }
            
            this.lastLapDistPct = lapDistPct;
        });
    }
    
    /**
     * Toggle recording state (button click)
     */
    toggleRecording() {
        if (this.isRecording) {
            // Cancel recording
            this.cancelRecording();
        } else if (this.isArmed) {
            // Disarm
            this.isArmed = false;
            this.updateUI('idle');
        } else {
            // Arm recording
            this.armRecording();
        }
    }
    
    /**
     * Arm recording - wait for next lap start
     */
    armRecording() {
        if (!this.trackId || !this.carName) {
            alert('⚠️ Session info not loaded yet. Please wait for connection.');
            return;
        }
        
        this.isArmed = true;
        this.isRecording = false;
        this.samples = [];
        this.metadata = null;
        this.currentBucket = -1;
        
        this.updateUI('armed');
    }
    
    /**
     * Start recording (lap boundary crossed)
     */
    startRecording(values) {
        this.isArmed = false;
        this.isRecording = true;
        this.samples = [];
        this.currentBucket = -1;
        
        // Capture weather metadata at lap start
        this.metadata = {
            trackTemp: values.TrackTemp ?? null,
            airTemp: values.AirTemp ?? null,
            windVel: values.WindVel ?? null,
            windDir: values.WindDir ?? null,
            humidity: values.RelativeHumidity ?? null,
            skies: values.Skies ?? null,
            fuelKgPerLtr: this.sessionInfo?.DriverInfo?.DriverCarFuelKgPerLtr ?? null,
            tankCapacity: this.sessionInfo?.DriverInfo?.DriverCarFuelMaxLtr ?? null,
            lapStartTime: Date.now()
        };
        
        this.updateUI('recording');
    }
    
    /**
     * Record a sample at current lap position
     */
    recordSample(lapDistPct, values) {
        // Convert lapDistPct (0.0-1.0) to percentage bucket (0-100)
        const bucket = Math.floor(lapDistPct * 100);
        
        // Only record once per bucket
        if (bucket === this.currentBucket) return;
        if (bucket < 0 || bucket > 100) return;
        
        this.currentBucket = bucket;
        
        const sample = {
            pct: bucket,
            fuelLevel: values.FuelLevel ?? null,
            fuelUsePerHour: values.FuelUsePerHour ?? null,
            speed: values.Speed ?? null,
            throttle: values.ThrottleRaw ?? null
        };
        
        this.samples.push(sample);
        
        // Update UI with progress
        if (this.statusText) {
            this.statusText.textContent = `Recording: ${bucket}% (${this.samples.length}/101 samples)`;
        }
    }
    
    /**
     * Finish recording and upload data
     */
    async finishRecording() {
        this.isRecording = false;
        this.updateUI('complete');
        
        // Calculate lap time
        const lapTime = this.metadata.lapStartTime ? (Date.now() - this.metadata.lapStartTime) / 1000 : null;
        
        // Prepare payload
        const payload = {
            trackId: this.trackId,
            carName: this.carName,
            samples: this.samples,
            metadata: {
                ...this.metadata,
                lapTime: lapTime
            }
        };
        
        delete payload.metadata.lapStartTime; // Don't send internal timestamp
        
        // Upload to backend
        try {
            const response = await fetch('/api/ideal-fuel-lap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Verify by fetching back
                await this.verifyStoredData(this.trackId, this.carName);
                
                if (this.statusText) {
                    this.statusText.textContent = `✅ Ideal lap saved (${this.samples.length} samples)`;
                }
            } else {
                const error = await response.text();
                if (this.statusText) {
                    this.statusText.textContent = `❌ Failed to save: ${error}`;
                }
            }
        } catch (err) {
            if (this.statusText) {
                this.statusText.textContent = `❌ Network error: ${err.message}`;
            }
        }
        
        // Reset after 5 seconds
        setTimeout(() => {
            this.updateUI('idle');
        }, 5000);
    }
    
    /**
     * Verify stored data by fetching it back
     */
    async verifyStoredData(trackId, carName) {
        try {
            const response = await fetch(`/api/ideal-fuel-lap/${trackId}/${encodeURIComponent(carName)}`);
            
            if (response.ok) {
                const data = await response.json();
            }
        } catch (err) {
            // Silently handle
        }
    }
    
    /**
     * Cancel recording
     */
    cancelRecording() {
        this.isArmed = false;
        this.isRecording = false;
        this.samples = [];
        this.updateUI('idle');
    }
    
    /**
     * Update UI state
     */
    updateUI(state) {
        if (!this.statusIndicator || !this.statusText || !this.recordButton) return;
        
        switch (state) {
            case 'idle':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-neutral-500';
                this.statusText.textContent = 'Ready...';
                this.recordButton.textContent = '⏺ Record Lap';
                this.recordButton.className = 'ov-dark hover:bg-purple-600 text-white px-4 py-1.5 rounded text-sm transition';
                break;
                
            case 'armed':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-red-500 animate-pulse';
                this.statusText.textContent = 'Waiting for lap start...';
                this.recordButton.textContent = '⏹ Cancel';
                this.recordButton.className = 'bg-neutral-600 hover:bg-neutral-700 text-white px-4 py-1.5 rounded text-sm transition';
                break;
                
            case 'recording':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
                this.statusText.textContent = 'Recording lap...';
                this.recordButton.textContent = '⏹ Cancel';
                this.recordButton.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm transition';
                break;
                
            case 'complete':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500';
                this.statusText.textContent = 'Upload complete';
                this.recordButton.textContent = '✓ Saved';
                this.recordButton.className = 'bg-green-600 text-white px-4 py-1.5 rounded text-sm cursor-default';
                this.recordButton.disabled = true;
                setTimeout(() => {
                    this.recordButton.disabled = false;
                }, 5000);
                break;
        }
    }
}
