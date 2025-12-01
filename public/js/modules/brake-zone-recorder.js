/**
 * BrakeZoneRecorder - Records ideal braking zones with full telemetry
 * 
 * Records at 0.1% lap distance intervals (1000 samples per lap):
 * - Brake input (BrakeRaw), longitudinal G-force, lap distance %
 * Only stores samples where braking is active (BrakeRaw > 0)
 * Plus weather/session metadata
 */

export class BrakeZoneRecorder {
    constructor(socket, sessionInfo) {
        this.socket = socket;
        this.sessionInfo = sessionInfo;
        
        // Recording state
        this.isArmed = false;           // Button pressed, waiting for lap start
        this.isRecording = false;       // Currently recording lap
        this.allSamples = [];           // All samples during lap (for filtering)
        this.brakeSamples = [];         // Filtered samples (brake zones only)
        this.metadata = null;           // Weather/session metadata
        this.lastLapDistPct = 0;        // Track lap boundary
        this.currentBucket = -1;        // Current 0.1% bucket (0-1000)
        
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
        const viewButton = document.getElementById('brake-recorder-view-button');
        if (viewButton) {
            viewButton.addEventListener('click', () => this.toggleDataDisplay());
        }
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+B to toggle recording (arm/disarm)
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggleRecording();
            }
            // Ctrl+Shift+B to cancel recording
            if (e.ctrlKey && e.shiftKey && e.key === 'B') {
                e.preventDefault();
                if (this.isRecording || this.isArmed) {
                    this.cancelRecording();
                }
            }
        });
        
        this.updateUI('idle');
    }
    
    /**
     * Toggle stored data display
     */
    async toggleDataDisplay() {
        const dataDisplay = document.getElementById('brake-recorder-data-display');
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
            const response = await fetch(`/api/brake-zone-trace/${this.trackId}/${encodeURIComponent(this.carName)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.displayStoredData(data);
            } else if (response.status === 404) {
                this.showDataMessage('📭 No brake zones recorded for this track/car combination');
            } else {
                this.showDataMessage('❌ Error loading data');
            }
        } catch (err) {
            this.showDataMessage('No brake zone data available');
        }
    }
    
    /**
     * Display stored data in UI
     */
    displayStoredData(data) {
        const el = (id) => document.getElementById(id);
        
        // Calculate statistics
        const brakeZoneCount = this.countBrakeZones(data.samples);
        const maxBrakeForce = Math.max(...data.samples.map(s => Math.abs(s.brakeInput || 0)));
        const maxLongG = Math.max(...data.samples.map(s => Math.abs(s.longG || 0)));
        
        // Format lap time
        const lapTime = data.metadata.lapTime ? this.formatTime(data.metadata.lapTime) : '--';
        
        // Format recorded date
        const recordedDate = data.metadata.recordedAt ? 
            new Date(data.metadata.recordedAt).toLocaleString() : '--';
        
        // Primary stats
        if (el('brake-stored-track-name')) el('brake-stored-track-name').textContent = `Track ${data.trackId}`;
        if (el('brake-stored-car-name')) el('brake-stored-car-name').textContent = data.carName;
        if (el('brake-stored-lap-time')) el('brake-stored-lap-time').textContent = lapTime;
        if (el('brake-stored-zone-count')) el('brake-stored-zone-count').textContent = brakeZoneCount;
        if (el('brake-stored-max-force')) el('brake-stored-max-force').textContent = 
            `${(maxBrakeForce * 100).toFixed(0)}%`;
        if (el('brake-stored-sample-count')) el('brake-stored-sample-count').textContent = data.samples.length;
        
        // Secondary stats
        if (el('brake-stored-max-long-g')) el('brake-stored-max-long-g').textContent = 
            `${maxLongG.toFixed(2)} G`;
        if (el('brake-stored-track-temp')) el('brake-stored-track-temp').textContent = 
            data.metadata.trackTemp ? `${data.metadata.trackTemp.toFixed(1)}°C` : '--';
        if (el('brake-stored-recorded-at')) el('brake-stored-recorded-at').textContent = recordedDate;
    }
    
    /**
     * Count distinct brake zones (clusters of consecutive brake samples)
     */
    countBrakeZones(samples) {
        if (!samples || samples.length === 0) return 0;
        
        let zones = 0;
        let inZone = false;
        let lastPct = -1;
        
        // Sort samples by lap distance
        const sorted = [...samples].sort((a, b) => a.lapDistPct - b.lapDistPct);
        
        for (const sample of sorted) {
            // If gap > 1% from last sample, it's a new zone
            if (!inZone || (sample.lapDistPct - lastPct) > 1.0) {
                zones++;
                inZone = true;
            }
            lastPct = sample.lapDistPct;
        }
        
        return zones;
    }
    
    /**
     * Show message in data display area
     */
    showDataMessage(message) {
        const el = (id) => document.getElementById(id);
        
        if (el('brake-stored-track-name')) el('brake-stored-track-name').textContent = message;
        if (el('brake-stored-car-name')) el('brake-stored-car-name').textContent = '--';
        if (el('brake-stored-lap-time')) el('brake-stored-lap-time').textContent = '--';
        if (el('brake-stored-zone-count')) el('brake-stored-zone-count').textContent = '--';
        if (el('brake-stored-max-force')) el('brake-stored-max-force').textContent = '--';
        if (el('brake-stored-sample-count')) el('brake-stored-sample-count').textContent = '--';
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
                if (crossedStart && this.allSamples.length > 500) {
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
        this.allSamples = [];
        this.brakeSamples = [];
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
        this.allSamples = [];
        this.brakeSamples = [];
        this.currentBucket = -1;
        
        // Capture weather metadata at lap start
        this.metadata = {
            trackTemp: values.TrackTemp ?? null,
            airTemp: values.AirTemp ?? null,
            windVel: values.WindVel ?? null,
            windDir: values.WindDir ?? null,
            humidity: values.RelativeHumidity ?? null,
            skies: values.Skies ?? null,
            lapStartTime: Date.now()
        };
        
        this.updateUI('recording');
    }
    
    /**
     * Record a sample at current lap position
     * Samples at 0.1% intervals (1000 samples per lap)
     */
    recordSample(lapDistPct, values) {
        // Convert lapDistPct (0.0-1.0) to 0.1% bucket (0-1000)
        const bucket = Math.floor(lapDistPct * 1000);
        
        // Only record once per bucket
        if (bucket === this.currentBucket) return;
        if (bucket < 0 || bucket > 1000) return;
        
        this.currentBucket = bucket;
        
        // Always capture sample (we'll filter to brake zones later)
        const sample = {
            lapDistPct: lapDistPct * 100, // Store as 0-100 for consistency
            brakeInput: values.Brake ?? null,
            longG: values.LongAccel ?? null // Longitudinal G-force
        };
        
        this.allSamples.push(sample);
        
        // Update UI with progress
        if (this.statusText) {
            this.statusText.textContent = `Recording: ${(lapDistPct * 100).toFixed(1)}% (${this.allSamples.length} samples)`;
        }
    }
    
    /**
     * Finish recording and upload data
     */
    async finishRecording() {
        this.isRecording = false;
        this.updateUI('processing');
        
        // Calculate lap time
        const lapTime = this.metadata.lapStartTime ? (Date.now() - this.metadata.lapStartTime) / 1000 : null;
        
        // Filter to brake zones only (BrakeRaw > 0)
        this.brakeSamples = this.allSamples.filter(s => s.brakeInput != null && s.brakeInput > 0);
        
        console.log(`🔍 Filtered ${this.allSamples.length} samples → ${this.brakeSamples.length} brake zone samples`);
        
        if (this.brakeSamples.length === 0) {
            if (this.statusText) {
                this.statusText.textContent = '❌ No brake zones detected in lap';
            }
            setTimeout(() => this.updateUI('idle'), 3000);
            return;
        }
        
        // Prepare payload
        const payload = {
            trackId: this.trackId,
            carName: this.carName,
            samples: this.brakeSamples,
            metadata: {
                ...this.metadata,
                lapTime: lapTime
            }
        };
        
        delete payload.metadata.lapStartTime; // Don't send internal timestamp
        
        // Upload to backend
        try {
            const response = await fetch('/api/brake-zone-trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (this.statusText) {
                    this.statusText.textContent = `✅ Brake zones saved (${this.brakeSamples.length} samples)`;
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
     * Cancel recording
     */
    cancelRecording() {
        this.isArmed = false;
        this.isRecording = false;
        this.allSamples = [];
        this.brakeSamples = [];
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
                this.recordButton.textContent = '⏺ Record Brake Zones';
                this.recordButton.className = 'ov-dark hover:bg-blue-600 text-white px-4 py-1.5 rounded text-sm transition';
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
                
            case 'processing':
                this.statusIndicator.className = 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse';
                this.statusText.textContent = 'Processing brake zones...';
                this.recordButton.textContent = '⏳ Processing';
                this.recordButton.className = 'bg-yellow-600 text-white px-4 py-1.5 rounded text-sm cursor-wait';
                this.recordButton.disabled = true;
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
