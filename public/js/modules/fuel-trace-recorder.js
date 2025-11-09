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
        
        this.updateUI('idle');
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
        
        console.log('🎯 Fuel recorder context:', {
            trackId: this.trackId,
            carName: this.carName,
            playerCarIdx: this.playerCarIdx
        });
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
        console.log('🔴 Armed - waiting for lap start...');
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
        console.log('🟢 Recording started', this.metadata);
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
        
        console.log(`🟡 Recording complete: ${this.samples.length} samples`);
        
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
        
        console.log('📤 Uploading ideal fuel lap:', payload);
        
        // Upload to backend
        try {
            const response = await fetch('/api/ideal-fuel-lap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Ideal lap saved:', result);
                if (this.statusText) {
                    this.statusText.textContent = `✅ Ideal lap saved (${this.samples.length} samples)`;
                }
            } else {
                const error = await response.text();
                console.error('❌ Failed to save ideal lap:', error);
                if (this.statusText) {
                    this.statusText.textContent = `❌ Failed to save: ${error}`;
                }
            }
        } catch (err) {
            console.error('❌ Network error:', err);
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
     * Cancel recording
     */
    cancelRecording() {
        this.isArmed = false;
        this.isRecording = false;
        this.samples = [];
        this.updateUI('idle');
        console.log('⚪ Recording cancelled');
    }
    
    /**
     * Update UI state
     */
    updateUI(state) {
        if (!this.statusIndicator || !this.statusText || !this.recordButton) return;
        
        switch (state) {
            case 'idle':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-neutral-500';
                this.statusText.textContent = 'Ready to record';
                this.recordButton.textContent = '⏺ Record Ideal Lap';
                this.recordButton.className = 'bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded text-sm transition';
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
