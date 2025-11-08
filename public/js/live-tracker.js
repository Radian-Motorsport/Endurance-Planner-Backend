// Live Strategy Tracker - Connects to RadianApp telemetry and displays race progress vs plan
// Loads strategies the exact same way the planner does and calculates stint tables

// Debug flag - set to false to disable all debug logging
const DEBUG = false;
const debug = (...args) => { if (DEBUG) console.log(...args); };

/**
 * PedalTrace - A visualization component for racing pedal inputs
 */
class PedalTrace {
    constructor(socket, canvasId, options = {}) {
        this.socket = socket;
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn('PedalTrace: Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Configuration with defaults
        this.options = {
            maxPoints: options.maxPoints || 300,
            throttleColor: options.throttleColor || '#10b981',  // Green
            brakeColor: options.brakeColor || '#ef4444',        // Red
            gearColor: options.gearColor || '#3b82f6',          // Blue
            maxGear: options.maxGear || 8,
            ...options
        };
        
        // Data buffer
        this.buffer = [];
        
        // Set up telemetry listener
        this.setupListeners();
        
        // Start animation
        this.startAnimation();
    }
    
    setupListeners() {
        this.socket.on('telemetry', (data) => {
            const values = data?.values;
            if (!values) return;
            
            const throttleVal = values.Throttle ?? values.ThrottleRaw ?? 0;
            
            this.buffer.push({
                throttle: (values.ThrottleRaw ?? 0) * 100,
                brake: (values.Brake ?? 0) * 100,
                gear: ((values.Gear ?? 0) / this.options.maxGear) * 100,
                coasting: (values.Brake ?? 0) < 0.02 && throttleVal < 0.02,
                overlap: throttleVal > 0.20 && (values.Brake ?? 0) > 0.05
            });
            
            if (this.buffer.length > this.options.maxPoints) {
                this.buffer.shift();
            }
        });
    }
    
    startAnimation() {
        requestAnimationFrame(this.draw.bind(this));
    }
    
    draw() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Throttle line
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.throttleColor;
        this.ctx.lineWidth = 2;
        this.buffer.forEach((point, i) => {
            const x = i * (this.canvas.width / this.options.maxPoints);
            const y = this.canvas.height - point.throttle * (this.canvas.height / 100);
            i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();
        
        // Brake line
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.brakeColor;
        this.ctx.lineWidth = 2;
        this.buffer.forEach((point, i) => {
            const x = i * (this.canvas.width / this.options.maxPoints);
            const y = this.canvas.height - point.brake * (this.canvas.height / 100);
            i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();
        
        // Gear line
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.options.gearColor;
        this.ctx.lineWidth = 1;
        this.buffer.forEach((point, i) => {
            const x = i * (this.canvas.width / this.options.maxPoints);
            const y = this.canvas.height - point.gear * (this.canvas.height / 100);
            i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        });
        this.ctx.stroke();
        
        // Status indicators
        const latestData = this.buffer[this.buffer.length - 1];
        if (latestData) {
            this.ctx.font = '12px Inter, sans-serif';
            this.ctx.fillStyle = latestData.coasting ? '#fb923c' : '#6b7280';
            this.ctx.fillText('COASTING', 10, 15);
            this.ctx.fillStyle = latestData.overlap ? '#14b8a6' : '#6b7280';
            this.ctx.fillText('OVERLAP', 10, 30);
        }
        
        requestAnimationFrame(this.draw.bind(this));
    }
}

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
        this.lastSessionTimeRemain = null;  // Track last valid time to detect out-of-order packets
        this.fuelLevel = 0;
        this.lastLapTime = 0;
        this.isConnected = false;
        this.sessionInfo = null;
        this.fuelPerLap = 0;
        this.pitStopDuration = 0;  // Pit stop time in seconds
        this.pitStopStartTime = null;  // When pit road was entered
        this.actualPitStopTime = 0;  // Actual measured pit stop duration
        this.pitTimerInterval = null;  // Interval for live pit timer display
        
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
        
        // Stint calculation flag
        this.hasCalculatedStints = false; // Track if stints have been calculated with live session time
        
        // Time mode (Auto = live telemetry, Manual = user countdown)
        this.timeMode = 'auto';  // 'auto' or 'manual'
        this.manualTimerInterval = null;
        this.manualTimeRemaining = 0;
        
        // Telemetry activity tracking
        this.lastTelemetryTime = null;
        this.telemetryTimeoutCheck = null;
        
        // Track map and car position tracking
        this.trackMapComponent = null;
        this.carPositionTracker = null;
        
        // Car Analysis
        this.driversList = [];
        this.playerCarIdx = null;
        this.playerCarClass = null;
        this.selectedCarIdx = null;
        this.selectedClassFilter = 'player'; // 'player', 'GTP', 'GT3', 'GT4', 'LMP'
        this.carAnalysisData = {};
        this.lastCarAnalysisUpdate = 0; // Throttle position updates
        this.carAnalysisInitialized = false; // Flag to prevent re-initialization
        
        // Class ID mapping
        this.classMapping = {
            'GTP': [4029, 4074],
            'GT3': [4046, 4091, 4090, 4083, 4072, 4011],
            'GT4': [4088, 4084],
            'LMP': [2523]
        };
        
        // Sector tracking
        this.sectors = [];
        this.currentSector = null;
        this.trackLength = null;
        this.sectorsInitialized = false;
        
        // Sector incident tracking
        this.sectorIncidents = new Map(); // carIdx -> { sectorNum, startTime, active, triggered }
        this.activeSectorIncidents = new Set(); // Set of sector numbers with active incidents
        this.sectorIncidentTimeouts = new Map(); // sectorNum -> timeoutId for clearing
        this.incidentTimeout = 10000; // Clear incident markers after 10 seconds
        this.incidentMinDuration = 1000; // Off-track must last 1+ seconds to trigger incident
        
        // Sector time tracking for class comparison
        this.carSectorTimes = new Map(); // carIdx -> Map(sectorNum -> lastSectorTime)
        this.carSectorStartTimes = new Map(); // carIdx -> Map(sectorNum -> estTime when sector started)
        this.previousCarSectors = new Map(); // carIdx -> last completed sector number
        this.lastSectorComparisonUpdate = 0; // Throttle sector comparison updates
        
        // Lap progress multi-car display
        this.showAllCarsOnProgress = false;
        
        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
        this.connectToTelemetry();
        
        // Check for strategy in URL on load
        this.checkURLForStrategy();
        
        // Start telemetry timeout checker
        this.startTelemetryTimeoutCheck();
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
        this.elements.lapsRemaining = document.getElementById('laps-remaining');
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
        
        // Running averages (Strategy Status box)
        this.elements.runningAvgLapTime = document.getElementById('running-avg-lap-time');
        this.elements.runningAvgFuel = document.getElementById('running-avg-fuel');
        this.elements.runningAvgPitTime = document.getElementById('running-avg-pit-time');
        
        // Table
        this.elements.stintTableBody = document.getElementById('stint-table-body');
        
        // Modal
        this.elements.loadModal = document.getElementById('load-modal');
        this.elements.strategyInput = document.getElementById('strategy-input');
        
        // Time mode controls
        this.elements.timeAutoBtn = document.getElementById('time-mode-auto');
        this.elements.timeManualBtn = document.getElementById('time-mode-manual');
        this.elements.recalcStintsBtn = document.getElementById('recalc-stints-btn');
        this.elements.manualControls = document.getElementById('manual-mode-controls');
        this.elements.manualHours = document.getElementById('manual-hours');
        this.elements.manualMinutes = document.getElementById('manual-minutes');
        this.elements.manualSeconds = document.getElementById('manual-seconds');
        this.elements.manualStartBtn = document.getElementById('manual-start-btn');
        this.elements.manualStopBtn = document.getElementById('manual-stop-btn');
        this.elements.manualResetBtn = document.getElementById('manual-reset-btn');
        this.elements.manualRecalcBtn = document.getElementById('manual-recalc-btn');
        
        // Driver inputs elements
        this.elements.inputThrottle = document.getElementById('input-throttle');
        this.elements.inputBrake = document.getElementById('input-brake');
        this.elements.inputClutch = document.getElementById('input-clutch');
        this.elements.inputGear = document.getElementById('input-gear');
        this.elements.inputRPM = document.getElementById('input-rpm');
        this.elements.inputSpeed = document.getElementById('input-speed');
        this.elements.inputSteering = document.getElementById('input-steering');
        this.elements.inputCoasting = document.getElementById('input-coasting');
        this.elements.inputOverlap = document.getElementById('input-overlap');
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
        
        // Pedal trace toggle
        const togglePedalBtn = document.getElementById('toggle-pedal-inputs');
        const pedalInputsDetails = document.getElementById('driver-inputs-details');
        if (togglePedalBtn && pedalInputsDetails) {
            togglePedalBtn.addEventListener('click', () => {
                if (pedalInputsDetails.classList.contains('hidden')) {
                    pedalInputsDetails.classList.remove('hidden');
                    togglePedalBtn.textContent = 'Hide Inputs ▲';
                } else {
                    pedalInputsDetails.classList.add('hidden');
                    togglePedalBtn.textContent = 'Show Inputs ▼';
                }
            });
        }
        
        // Lap progress all cars toggle
        const toggleProgressCarsBtn = document.getElementById('toggle-progress-cars');
        if (toggleProgressCarsBtn) {
            toggleProgressCarsBtn.addEventListener('click', () => {
                this.showAllCarsOnProgress = !this.showAllCarsOnProgress;
                toggleProgressCarsBtn.textContent = this.showAllCarsOnProgress ? 'Show Player Only' : 'Show All Cars';
                const progressCarsContainer = document.getElementById('progress-car-dots-container');
                if (progressCarsContainer) {
                    if (this.showAllCarsOnProgress) {
                        progressCarsContainer.classList.remove('hidden');
                        this.renderProgressCars();
                    } else {
                        progressCarsContainer.classList.add('hidden');
                    }
                }
            });
        }
        
        // Track map toggle
        const toggleTrackMapBtn = document.getElementById('toggle-track-map');
        const trackMapDetails = document.getElementById('track-map-details');
        if (toggleTrackMapBtn && trackMapDetails) {
            toggleTrackMapBtn.addEventListener('click', () => {
                if (trackMapDetails.classList.contains('hidden')) {
                    trackMapDetails.classList.remove('hidden');
                    toggleTrackMapBtn.textContent = 'Hide Map ▲';
                } else {
                    trackMapDetails.classList.add('hidden');
                    toggleTrackMapBtn.textContent = 'Show Map ▼';
                }
            });
        }
        
        // Car Analysis toggle
        const toggleCarAnalysisBtn = document.getElementById('toggle-car-analysis');
        const carAnalysisDetails = document.getElementById('car-analysis-details');
        if (toggleCarAnalysisBtn && carAnalysisDetails) {
            toggleCarAnalysisBtn.addEventListener('click', () => {
                if (carAnalysisDetails.classList.contains('hidden')) {
                    carAnalysisDetails.classList.remove('hidden');
                    toggleCarAnalysisBtn.textContent = 'Hide Analysis ▲';
                } else {
                    carAnalysisDetails.classList.add('hidden');
                    toggleCarAnalysisBtn.textContent = 'Show Analysis ▼';
                }
            });
        }
        
        // Class filter tabs
        document.querySelectorAll('.class-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const selectedClass = e.target.dataset.class;
                this.setClassFilter(selectedClass);
            });
        });
        
        // Time mode toggle
        this.elements.timeAutoBtn?.addEventListener('click', () => this.setTimeMode('auto'));
        this.elements.timeManualBtn?.addEventListener('click', () => this.setTimeMode('manual'));
        
        // Recalculate button
        this.elements.recalcStintsBtn?.addEventListener('click', () => {
            console.log('🔄 Manual recalculation triggered');
            this.calculateStintsForRemainingTime();
        });
        
        // Manual timer controls
        this.elements.manualStartBtn?.addEventListener('click', () => this.startManualTimer());
        this.elements.manualStopBtn?.addEventListener('click', () => this.stopManualTimer());
        this.elements.manualResetBtn?.addEventListener('click', () => this.resetManualTimer());
        this.elements.manualRecalcBtn?.addEventListener('click', () => this.recalculateRemainingStints());
    }
    
    connectToTelemetry() {
        console.log('🔌 Connecting to RadianApp telemetry...');
        
        // Connect to RadianApp production server
        this.socket = io('https://radianapp.onrender.com');
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to telemetry server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            
            // Initialize pedal trace visualization
            this.initializePedalTrace();
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
            this.lastTelemetryTime = Date.now();  // Track last telemetry received
            this.handleTelemetryUpdate(data);
            this.updateDriverInputs(data);  // Update driver inputs display
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
    
    initializePedalTrace() {
        if (!this.pedalTrace && this.socket) {
            try {
                this.pedalTrace = new PedalTrace(this.socket, 'pedal-canvas', {
                    maxPoints: 300,
                    maxGear: 8
                });
                console.log('✅ Pedal trace initialized');
            } catch (error) {
                console.error('❌ Failed to initialize pedal trace:', error);
            }
        }
    }
    
    updateDriverInputs(data) {
        const values = data?.values;
        if (!values) return;
        
        // Update inputs with formatting
        if (this.elements.inputThrottle) {
            this.elements.inputThrottle.textContent = `${((values.ThrottleRaw ?? 0) * 100).toFixed(0)}%`;
        }
        if (this.elements.inputBrake) {
            this.elements.inputBrake.textContent = `${((values.Brake ?? 0) * 100).toFixed(0)}%`;
        }
        if (this.elements.inputClutch) {
            this.elements.inputClutch.textContent = `${((values.Clutch ?? 0) * 100).toFixed(0)}%`;
        }
        if (this.elements.inputGear) {
            this.elements.inputGear.textContent = values.Gear ?? '--';
        }
        if (this.elements.inputRPM) {
            this.elements.inputRPM.textContent = values.RPM ? `${Math.round(values.RPM)}` : '--';
        }
        if (this.elements.inputSpeed) {
            this.elements.inputSpeed.textContent = values.Speed ? `${Math.round(values.Speed * 3.6)} km/h` : '--';
        }
        if (this.elements.inputSteering) {
            const steering = (values.SteeringWheelAngle ?? 0) * (180 / Math.PI);
            this.elements.inputSteering.textContent = `${steering.toFixed(0)}°`;
        }
        
        // Calculate and display coasting/overlap status
        const throttleVal = values.Throttle ?? values.ThrottleRaw ?? 0;
        const isCoasting = (values.Brake ?? 0) < 0.02 && throttleVal < 0.02;
        const isOverlap = throttleVal > 0.20 && (values.Brake ?? 0) > 0.05;
        
        if (this.elements.inputCoasting) {
            this.elements.inputCoasting.textContent = isCoasting ? 'YES' : 'NO';
        }
        if (this.elements.inputOverlap) {
            this.elements.inputOverlap.textContent = isOverlap ? 'YES' : 'NO';
        }
        
        // Update car position on track map
        this.updateCarPosition(values);
    }
    
    async loadTrackMap(sessionDetails) {
        if (!window.TrackMapComponent || !window.CarPositionTracker) {
            console.warn('⚠️ Track map components not loaded');
            return;
        }
        
        try {
            console.log('🗺️ Loading track map for:', sessionDetails.track_name);
            
            // Initialize track map component if not already done
            if (!this.trackMapComponent) {
                this.trackMapComponent = new window.TrackMapComponent('track-map-container-live', {
                    showControls: true,
                    defaultLayers: ['background', 'active'],
                    maxHeight: '400px'
                });
            }
            
            // Show track map section (unhide the container)
            const trackMapDetails = document.getElementById('track-map-details');
            if (trackMapDetails && trackMapDetails.classList.contains('hidden')) {
                trackMapDetails.classList.remove('hidden');
                const toggleBtn = document.getElementById('toggle-track-map');
                if (toggleBtn) toggleBtn.textContent = 'Hide Map ▲';
            }
            
            // Load track map from API (same as planner)
            const trackAssets = await this.loadTrackAssetsWithRacingLine(sessionDetails.track_id);
            
            // Load SVG layers
            if (trackAssets) {
                await this.trackMapComponent.loadTrackMap(trackAssets);
            }
            
            // Destroy old car position tracker if it exists
            if (this.carPositionTracker) {
                this.carPositionTracker.destroy();
                this.carPositionTracker = null;
            }
            
            // Initialize car position tracker after map loads
            this.carPositionTracker = new window.CarPositionTracker('track-map-container-live', {
                carRadius: 22, // was 12
                carColor: '#06b6d4',  // Cyan
                carStroke: 'transparent',  // Start transparent - will change dynamically based on track surface
                carStrokeWidth: 6,
                trackLayerName: 'active',
                useRacingLine: false,  // Will be set to true if racing line data available
                showOnlyPlayerClass: false,  // Don't filter by class
                showAllCars: true,  // Show all cars from all classes
                onCarClick: (carIdx) => {
                    console.log(`🖱️ Car marker clicked: ${carIdx}`);
                    this.selectCar(carIdx);
                }
            });
            
            // If racing line data is available, use it
            if (trackAssets && trackAssets.racing_line) {
                console.log('🏁 Racing line data available, using racing line mode');
                this.carPositionTracker.setRacingLineData(trackAssets.racing_line);
            } else {
                console.log('⚠️ No racing line data, using SVG path fallback');
            }
            
            // Wait a bit for SVG to be fully rendered
            setTimeout(() => {
                if (this.carPositionTracker.initialize()) {
                    console.log('✅ Car position tracker ready');
                } else {
                    console.warn('⚠️ Car position tracker failed to initialize');
                }
            }, 500);
            
            console.log('✅ Track map loaded successfully');
            
        } catch (error) {
            console.warn('❌ Failed to load track map:', error);
        }
    }
    
    /**
     * Load track assets including racing line data from API
     */
    async loadTrackAssetsWithRacingLine(trackId) {
        try {
            const response = await fetch(`/api/track-assets/${trackId}`);
            
            if (response.status === 404) {
                throw new Error('Track assets not available for this track');
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch track assets: ${response.status}`);
            }
            
            const trackAssets = await response.json();
            
            if (!trackAssets || !trackAssets.track_map || !trackAssets.track_map_layers) {
                throw new Error('Track map data not available');
            }
            
            console.log('✅ Track assets loaded:', {
                track_map: trackAssets.track_map ? 'yes' : 'no',
                racing_line: trackAssets.racing_line ? `yes (${trackAssets.racing_line.points?.length || 0} points)` : 'no'
            });
            
            return trackAssets;
            
        } catch (error) {
            console.warn('❌ Failed to load track assets:', error.message);
            return null;
        }
    }
    
    updateCarPosition(values) {
        // Track sector times for class comparison
        this.trackSectorTimes(values);
        
        // Update simple lap progress bar
        const lapProgressDot = document.getElementById('lap-progress-dot');
        
        if (lapProgressDot) {
            const playerCarIdx = values.PlayerCarIdx;
            const carIdxLapDistPct = values.CarIdxLapDistPct;
            
            if (playerCarIdx != null && carIdxLapDistPct && carIdxLapDistPct[playerCarIdx] != null) {
                const lapDistPct = carIdxLapDistPct[playerCarIdx];
                if (!isNaN(lapDistPct)) {
                    // Convert 0-1 to 0-100 percentage
                    const percentage = lapDistPct * 100;
                    lapProgressDot.style.left = `${percentage}%`;
                    
                    // Update current sector
                    this.updateCurrentSector(lapDistPct);
                    
                    // Change color when in pits
                    if (values.OnPitRoad) {
                        lapProgressDot.classList.remove('bg-cyan-400', 'ring-cyan-300');
                        lapProgressDot.classList.add('bg-orange-400', 'ring-orange-300');
                    } else {
                        lapProgressDot.classList.remove('bg-orange-400', 'ring-orange-300');
                        lapProgressDot.classList.add('bg-cyan-400', 'ring-cyan-300');
                    }
                }
            }
        }
        
        // Update all cars on progress bar if enabled
        if (this.showAllCarsOnProgress && values.CarIdxLapDistPct) {
            this.renderProgressCars(values);
        }
        
        // Update car positions on track map (now supports multiple cars filtered by class)
        if (!this.carPositionTracker || !this.carPositionTracker.isInitialized) {
            return;
        }
        
        // Pass full telemetry data to update all cars
        this.carPositionTracker.updateAllPositions(values);
        
        // Update car analysis data
        this.updateCarAnalysisData(values);
    }
    
    renderProgressCars(values) {
        const container = document.getElementById('progress-car-dots-container');
        console.log('🔍 renderProgressCars called:', {
            hasContainer: !!container,
            driversListLength: this.driversList.length,
            containerClassList: container?.classList.toString()
        });
        
        if (!container || !this.driversList.length) return;
        
        const playerCarIdx = values.PlayerCarIdx;
        const carIdxLapDistPct = values.CarIdxLapDistPct;
        
        console.log('🔍 Progress cars data:', {
            playerCarIdx,
            totalDrivers: this.driversList.length,
            hasLapDistData: !!carIdxLapDistPct
        });
        
        let dotsCreated = 0;
        let dotsSkipped = 0;
        
        this.driversList.forEach(driver => {
            const carIdx = driver.CarIdx;
            if (carIdx === undefined || carIdx === playerCarIdx) {
                dotsSkipped++;
                return; // Skip player (shown separately)
            }
            
            const lapDistPct = carIdxLapDistPct[carIdx];
            if (lapDistPct == null || isNaN(lapDistPct)) {
                dotsSkipped++;
                return;
            }
            
            dotsCreated++;
            
            // Create or get existing dot
            let dot = container.querySelector(`[data-car-idx="${carIdx}"]`);
            if (!dot) {
                dot = document.createElement('div');
                dot.dataset.carIdx = carIdx;
                dot.className = 'absolute w-3 h-3 rounded-full transition-all duration-100';
                dot.style.top = '50%';
                dot.style.transform = 'translate(-50%, -50%)';
                dot.title = driver.UserName || `Car ${carIdx}`;
                container.appendChild(dot);
            }
            
            // Position the dot horizontally
            const percentage = lapDistPct * 100;
            dot.style.left = `${percentage}%`;
            
            // Color by class using CarClassID (exact same logic as car-position-tracker.js)
            const classId = driver.CarClassID;
            
            // Fixed class color mapping (same as track map)
            const classColorMap = {
                // GTP
                4029: '#fff265ff',
                4074: '#fff265ff',
                // LMP
                2523: '#598afcea',
                // GT3
                4046: '#fa59e7ff',
                4091: '#fa59e7ff',
                4090: '#fa59e7ff',
                4083: '#fa59e7ff',
                4072: '#fa59e7ff',
                4011: '#fa59e7ff',
                // GT4
                4088: '#35ff12ff',
                4084: '#35ff12ff'
            };
            
            const color = classColorMap[classId] || '#9ca3af'; // Default gray for unknown
            
            // Apply styles
            dot.className = 'absolute w-3 h-3 rounded-full transition-all duration-100';
            dot.style.backgroundColor = color;
            dot.style.top = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
        });
        
        console.log('✅ Progress cars rendered:', { dotsCreated, dotsSkipped });
    }
    
    updateCarAnalysisData(values) {
        if (!this.playerCarClass || !this.driversList.length) return;
        
        // Update car data for ALL drivers (not just player's class)
        this.driversList.forEach((driver, idx) => {
            const carIdx = driver.CarIdx;
            if (carIdx === undefined) return;
            
            // Get current values
            const currentOnPitRoad = values.CarIdxOnPitRoad?.[carIdx] || false;
            const currentLapCompleted = values.CarIdxLapCompleted?.[carIdx] || 0;
            const currentTrackSurface = values.CarIdxTrackSurface?.[carIdx];
            
            // Initialize tracking data if first time seeing this car
            if (!this.carAnalysisData[carIdx]) {
                this.carAnalysisData[carIdx] = {
                    stintLaps: 0,
                    lastPitDuration: 0,
                    pitEntryTime: null,
                    previousOnPitRoad: false,
                    previousLapCompleted: currentLapCompleted
                };
            }
            
            const carData = this.carAnalysisData[carIdx];
            
            // Track stint laps: increment when lap completes and not on pit road
            if (currentLapCompleted > carData.previousLapCompleted && !currentOnPitRoad) {
                carData.stintLaps++;
            }
            
            // Detect pit road exit: reset stint lap counter
            if (carData.previousOnPitRoad === true && currentOnPitRoad === false) {
                carData.stintLaps = 0;
            }
            
            // Track pit stop duration: start timer when entering pit stall
            const isInPitStall = currentTrackSurface === 1 || currentTrackSurface === 'InPitStall';
            const wasInPitStall = carData.pitEntryTime !== null;
            
            if (isInPitStall && !wasInPitStall) {
                // Entering pit stall - start timer
                carData.pitEntryTime = Date.now();
            } else if (!isInPitStall && wasInPitStall) {
                // Exiting pit stall - calculate duration and save it
                const pitDuration = (Date.now() - carData.pitEntryTime) / 1000; // Convert to seconds
                carData.lastPitDuration = pitDuration;
                carData.pitEntryTime = null;
            }
            
            // Update telemetry data
            carData.bestLapTime = values.CarIdxBestLapTime?.[carIdx] || 0;
            carData.classPosition = values.CarIdxClassPosition?.[carIdx] || 0;
            carData.estTime = values.CarIdxEstTime?.[carIdx] || 0;
            carData.lap = values.CarIdxLap?.[carIdx] || 0;
            carData.lapCompleted = currentLapCompleted;
            carData.lastLapTime = values.CarIdxLastLapTime?.[carIdx] || 0;
            carData.onPitRoad = currentOnPitRoad;
            carData.trackSurface = this.getTrackSurfaceName(currentTrackSurface);
            carData.surfaceMaterial = this.getSurfaceMaterialName(values.CarIdxTrackSurfaceMaterial?.[carIdx]);
            
            // Track off-track incidents per sector
            this.trackSectorIncident(carIdx, currentTrackSurface, values.CarIdxLapDistPct?.[carIdx]);
            
            // Store previous states for next comparison
            carData.previousOnPitRoad = currentOnPitRoad;
            carData.previousLapCompleted = currentLapCompleted;
        });
        
        // Throttle position updates to every 500ms to prevent flashing
        const now = Date.now();
        if (now - this.lastCarAnalysisUpdate > 500) {
            this.updateCarListPositions();
            this.lastCarAnalysisUpdate = now;
        }
        
        // Update selected car details if one is selected (always update this)
        if (this.selectedCarIdx !== null) {
            this.updateCarDetails();
        }
    }
    
    updateCarListPositions() {
        // Update all card header data without re-rendering entire list (prevents flashing)
        document.querySelectorAll('.car-card').forEach(card => {
            const carIdx = parseInt(card.dataset.carIdx);
            const carData = this.carAnalysisData[carIdx] || {};
            
            // Update position
            const position = carData.classPosition || '--';
            const positionEl = card.querySelector('.car-position');
            if (positionEl) {
                positionEl.textContent = position;
            }
            
            // Update off-track incidents count
            const offTrackCount = this.carPositionTracker?.getOffTrackCount(carIdx) || 0;
            const incElement = card.querySelector('[data-stat="inc"]');
            if (incElement) {
                incElement.textContent = offTrackCount;
            }
            
            // Update last lap time
            const lastLapTime = carData.lastLapTime || 0;
            const formatLapTime = (seconds) => {
                if (!seconds || seconds <= 0) return '--';
                const mins = Math.floor(seconds / 60);
                const secs = (seconds % 60).toFixed(3);
                return `${mins}:${secs.padStart(6, '0')}`;
            };
            const lastElement = card.querySelector('[data-stat="last"]');
            if (lastElement) {
                lastElement.textContent = formatLapTime(lastLapTime);
            }
            
            // Update stint laps
            const stintLaps = carData.stintLaps || 0;
            const stintElement = card.querySelector('[data-stat="stint"]');
            if (stintElement) {
                stintElement.textContent = `${stintLaps}L`;
            }
        });
    }
    
    getTrackSurfaceName(value) {
        // Telemetry sends string values directly (e.g., "InPitStall", "OnTrack", "OffTrack")
        return value || '--';
    }
    
    getSurfaceMaterialName(value) {
        // Telemetry sends string values directly (e.g., "Asphalt", "Concrete", "Grass")
        return value || '--';
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
    
    startTelemetryTimeoutCheck() {
        // Check every 2 seconds if telemetry data is still being received
        this.telemetryTimeoutCheck = setInterval(() => {
            if (this.lastTelemetryTime) {
                const timeSinceLastTelemetry = Date.now() - this.lastTelemetryTime;
                
                // If no telemetry received in last 5 seconds, mark as disconnected
                if (timeSinceLastTelemetry > 5000) {
                    this.updateConnectionStatus(false);
                } else {
                    this.updateConnectionStatus(true);
                }
            } else {
                // No telemetry ever received
                this.updateConnectionStatus(false);
            }
        }, 2000);
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
                // Stop manual timer when switching to auto
                this.stopManualTimer();
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
                // Only update the session time display, telemetry continues streaming normally
                this.updateSessionTimeDisplay();
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
        // Only update the session time display
        this.updateSessionTimeDisplay();
        console.log(`⏱️ Manual timer reset to: ${this.formatTime(this.manualTimeRemaining)}`);
    }
    
    startPitTimer() {
        // Clear any existing timer
        if (this.pitTimerInterval) {
            clearInterval(this.pitTimerInterval);
        }
        
        const pitStopEl = document.getElementById('pit-stop-time');
        if (!pitStopEl) return;
        
        // Update display every 100ms for smooth counting
        this.pitTimerInterval = setInterval(() => {
            if (this.pitStopStartTime) {
                const elapsed = (Date.now() - this.pitStopStartTime) / 1000;
                pitStopEl.textContent = `${elapsed.toFixed(1)}s`;
                pitStopEl.classList.add('text-yellow-400'); // Highlight during pit
            }
        }, 100);
    }
    
    stopPitTimer() {
        if (this.pitTimerInterval) {
            clearInterval(this.pitTimerInterval);
            this.pitTimerInterval = null;
        }
        
        const pitStopEl = document.getElementById('pit-stop-time');
        if (pitStopEl) {
            pitStopEl.classList.remove('text-yellow-400');
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
        
        // Get player's car info (not just first driver)
        let carName = '--';
        const playerCarIdx = sessionData.DriverInfo?.DriverCarIdx;
        if (sessionData?.DriverInfo?.Drivers && playerCarIdx != null) {
            const playerCar = sessionData.DriverInfo.Drivers[playerCarIdx];
            if (playerCar) {
                carName = playerCar.CarScreenName || playerCar.CarPath || '--';
            }
        }
        
        // Fallback to first driver if no player car found
        if (carName === '--' && sessionData?.DriverInfo?.Drivers && sessionData.DriverInfo.Drivers.length > 0) {
            const fallbackCar = sessionData.DriverInfo.Drivers[0];
            carName = fallbackCar.CarScreenName || fallbackCar.CarPath || '--';
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
        
        // Initialize sectors from session data
        this.initializeSectors(sessionData);
        
        // Initialize car analysis with driver data
        this.initializeCarAnalysis(sessionData);
    }
    
    /**
     * Initialize sector markers from session data
     */
    initializeSectors(sessionData) {
        // Only initialize once - prevent repeated calls from destroying sector cards
        if (this.sectorsInitialized) {
            console.log('⏭️ Sectors already initialized, skipping to prevent yellow flash');
            return;
        }
        
        // Get track length
        this.trackLength = sessionData?.WeekendInfo?.TrackLength;
        
        // Get sector data
        const splitTimeInfo = sessionData?.SplitTimeInfo;
        if (!splitTimeInfo || !splitTimeInfo.Sectors) {
            console.warn('⚠️ No sector data available');
            return;
        }
        
        this.sectors = splitTimeInfo.Sectors.map(sector => ({
            number: sector.SectorNum,
            startPct: sector.SectorStartPct
        }));
        
        console.log('🏁 Sectors initialized:', {
            trackLength: this.trackLength,
            sectors: this.sectors
        });
        
        // Draw sector markers on the lap progress bar
        this.drawSectorMarkers();
        
        // Mark as initialized to prevent repeated destruction of sector cards
        this.sectorsInitialized = true;
    }
    
    /**
     * Draw visual sector markers on the lap progress bar
     */
    drawSectorMarkers() {
        console.log('🔨🔨🔨 drawSectorMarkers() CALLED - THIS DESTROYS AND RECREATES SECTOR CARDS');
        const container = document.getElementById('sector-markers-container');
        const sectorInfoDisplay = document.getElementById('sector-info-display');
        
        if (!container || !this.sectors.length) return;
        
        // PRESERVE incident state before clearing
        const incidentStates = new Map();
        this.sectors.forEach(sector => {
            const existingCard = document.getElementById(`sector-card-${sector.number}`);
            if (existingCard && existingCard.classList.contains('incident-active')) {
                incidentStates.set(sector.number, true);
            }
        });
        
        container.innerHTML = '';
        sectorInfoDisplay.innerHTML = '';
        
        this.sectors.forEach((sector, index) => {
            // Create vertical marker line
            const marker = document.createElement('div');
            marker.className = 'absolute h-full border-l-2 border-dashed border-neutral-500';
            marker.style.left = `${sector.startPct * 100}%`;
            marker.style.transform = 'translateX(-50%)';
            
            // Create sector label
            const label = document.createElement('div');
            label.className = 'absolute text-[10px] text-neutral-400 font-mono';
            label.style.left = `${sector.startPct * 100}%`;
            label.style.top = '-18px';
            label.style.transform = 'translateX(-50%)';
            label.textContent = `S${sector.number}`;
            
            container.appendChild(marker);
            container.appendChild(label);
            
            // Create narrow sector indicator bar with width matching sector length
            const nextSector = this.sectors[index + 1];
            const sectorEndPct = nextSector ? nextSector.startPct : 1.0;
            const sectorLength = (sectorEndPct - sector.startPct) * 100;
            
            const sectorCard = document.createElement('div');
            sectorCard.id = `sector-card-${sector.number}`;
            // RESTORE incident state if it existed
            const hadIncident = incidentStates.get(sector.number);
            sectorCard.className = hadIncident 
                ? 'absolute h-full bg-yellow-500 incident-active rounded transition-colors'
                : 'absolute h-full bg-neutral-600 rounded transition-colors';
            sectorCard.style.left = `${sector.startPct * 100}%`;
            sectorCard.style.width = `${sectorLength}%`;
            
            sectorInfoDisplay.appendChild(sectorCard);
        });
        
        console.log('✅ Sector markers drawn (preserved incident states:', Array.from(incidentStates.keys()), ')');
    }
    
    /**
     * Update current sector based on lap distance
     */
    updateCurrentSector(lapDistPct) {
        if (!this.sectors.length) return;
        
        // Find which sector we're in
        let currentSectorNum = this.sectors[this.sectors.length - 1].number; // Default to last sector
        
        for (let i = 0; i < this.sectors.length; i++) {
            const sector = this.sectors[i];
            const nextSector = this.sectors[i + 1];
            
            if (nextSector) {
                // Check if we're between this sector and the next
                if (lapDistPct >= sector.startPct && lapDistPct < nextSector.startPct) {
                    currentSectorNum = sector.number;
                    break;
                }
            } else {
                // Last sector wraps around to 0
                if (lapDistPct >= sector.startPct || lapDistPct < this.sectors[0].startPct) {
                    currentSectorNum = sector.number;
                    break;
                }
            }
        }
        
        // Update display if sector changed
        if (this.currentSector !== currentSectorNum) {
            this.currentSector = currentSectorNum;
            
            // Update sector display
            const sectorDisplay = document.getElementById('current-sector-display');
            if (sectorDisplay) {
                sectorDisplay.textContent = `Sector ${currentSectorNum}`;
            }
            
            // No visual highlighting - position is already clear from lap progress bar
        }
    }
    
    /**
     * Track sector completion times for cars in player's class
     * Records the time taken to complete each sector for comparison
     */
    trackSectorTimes(values) {
        if (!this.sectors.length || !this.playerCarClass || !this.driversList.length) return;
        
        const CarIdxLapDistPct = values.CarIdxLapDistPct || [];
        const CarIdxEstTime = values.CarIdxEstTime || [];
        
        // Track sector times for cars in player's class (including player)
        this.driversList.forEach(driver => {
            const carIdx = driver.CarIdx;
            if (carIdx === undefined) return;
            
            // Only track cars in player's class
            if (driver.CarClassID !== this.playerCarClass) return;
            
            const lapDistPct = CarIdxLapDistPct[carIdx];
            const estTime = CarIdxEstTime[carIdx];
            
            if (lapDistPct === undefined || estTime === undefined) return;
            
            // Determine current sector for this car
            let currentSectorNum = null;
            for (let i = 0; i < this.sectors.length; i++) {
                const sector = this.sectors[i];
                const nextSector = this.sectors[i + 1];
                
                if (nextSector) {
                    if (lapDistPct >= sector.startPct && lapDistPct < nextSector.startPct) {
                        currentSectorNum = sector.number;
                        break;
                    }
                } else {
                    if (lapDistPct >= sector.startPct || lapDistPct < this.sectors[0].startPct) {
                        currentSectorNum = sector.number;
                        break;
                    }
                }
            }
            
            if (currentSectorNum === null) return;
            
            // Initialize maps for this car if needed
            if (!this.carSectorTimes.has(carIdx)) {
                this.carSectorTimes.set(carIdx, new Map());
            }
            if (!this.carSectorStartTimes) {
                this.carSectorStartTimes = new Map();
            }
            if (!this.carSectorStartTimes.has(carIdx)) {
                this.carSectorStartTimes.set(carIdx, new Map());
            }
            
            const previousSector = this.previousCarSectors.get(carIdx);
            const sectorStartTimes = this.carSectorStartTimes.get(carIdx);
            
            // Detect sector boundary crossing (sector changed)
            if (previousSector !== undefined && previousSector !== currentSectorNum) {
                // Car just completed previousSector, now in currentSectorNum
                const startTime = sectorStartTimes.get(previousSector);
                
                if (startTime !== undefined) {
                    // Calculate sector time as delta
                    const sectorTime = estTime - startTime;
                    
                    // Store the sector time (not cumulative time)
                    const sectorTimes = this.carSectorTimes.get(carIdx);
                    sectorTimes.set(previousSector, sectorTime);
                    
                    debug(`🏁 Car ${carIdx} completed sector ${previousSector}: ${sectorTime.toFixed(3)}s`);
                }
                
                // Record start time for the new sector
                sectorStartTimes.set(currentSectorNum, estTime);
            } else if (previousSector === undefined) {
                // First time tracking this car - record start time for current sector
                sectorStartTimes.set(currentSectorNum, estTime);
            }
            
            // Update previous sector
            this.previousCarSectors.set(carIdx, currentSectorNum);
        });
    }
    
    /**
     * Get sector time for a specific car and sector
     * Returns the last recorded time for that sector, or null if not yet recorded
     */
    getCarSectorTime(carIdx, sectorNum) {
        const sectorTimes = this.carSectorTimes.get(carIdx);
        if (!sectorTimes) return null;
        return sectorTimes.get(sectorNum) || null;
    }
    
    /**
     * Get best sector time in player's class for a specific sector
     * Returns { carIdx, time, driver } or null
     */
    getBestSectorTime(sectorNum) {
        if (!this.playerCarClass || !this.driversList.length) return null;
        
        let bestTime = null;
        let bestCarIdx = null;
        
        this.driversList.forEach(driver => {
            const carIdx = driver.CarIdx;
            if (carIdx === undefined) return;
            if (driver.CarClassID !== this.playerCarClass) return;
            
            const time = this.getCarSectorTime(carIdx, sectorNum);
            if (time !== null && (bestTime === null || time < bestTime)) {
                bestTime = time;
                bestCarIdx = carIdx;
            }
        });
        
        if (bestTime === null) return null;
        
        return {
            carIdx: bestCarIdx,
            time: bestTime,
            driver: this.driversList.find(d => d.CarIdx === bestCarIdx)
        };
    }
    
    /**
     * Update sector comparison display
     * Shows sector times for car ahead, player, and car behind in class
     */
    updateSectorComparison(values) {
        const container = document.getElementById('sector-comparison-container');
        if (!container || !this.sectors.length || !this.driversList.length) return;
        
        const playerCarIdx = values.PlayerCarIdx;
        if (playerCarIdx === undefined) return;
        
        // Find player in drivers list
        const playerDriver = this.driversList.find(d => d.CarIdx === playerCarIdx);
        if (!playerDriver) return;
        
        const playerClassPos = values.CarIdxClassPosition?.[playerCarIdx];
        if (playerClassPos === undefined) return;
        
        // Find car ahead and behind in class
        let carAhead = null;
        let carBehind = null;
        
        this.driversList.forEach(driver => {
            const carIdx = driver.CarIdx;
            if (carIdx === playerCarIdx) return; // Skip player
            if (driver.CarClassID !== playerDriver.CarClassID) return; // Same class only
            
            const classPos = values.CarIdxClassPosition?.[carIdx];
            if (classPos === undefined) return;
            
            if (classPos === playerClassPos - 1) {
                carAhead = { driver, carIdx };
            } else if (classPos === playerClassPos + 1) {
                carBehind = { driver, carIdx };
            }
        });
        
        // Build comparison grid
        let html = '<div class="grid grid-cols-1 gap-1">';
        
        // Header row
        html += '<div class="grid gap-1" style="grid-template-columns: 150px repeat(' + this.sectors.length + ', 1fr);">';
        html += '<div class="bg-neutral-900 px-3 py-2 text-xs font-bold text-neutral-400 rounded">Driver</div>';
        this.sectors.forEach(sector => {
            html += `<div class="bg-neutral-900 px-2 py-2 text-xs font-bold text-center text-neutral-400 rounded">S${sector.number}</div>`;
        });
        html += '</div>';
        
        // Car ahead row
        if (carAhead) {
            html += this.renderSectorComparisonRow(carAhead.driver, carAhead.carIdx, playerCarIdx, values, 'ahead');
        }
        
        // Player row
        html += this.renderSectorComparisonRow(playerDriver, playerCarIdx, playerCarIdx, values, 'player');
        
        // Car behind row
        if (carBehind) {
            html += this.renderSectorComparisonRow(carBehind.driver, carBehind.carIdx, playerCarIdx, values, 'behind');
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    /**
     * Render a single row for sector comparison
     */
    renderSectorComparisonRow(driver, carIdx, playerCarIdx, values, position) {
        const isPlayer = carIdx === playerCarIdx;
        const bgClass = isPlayer ? 'bg-blue-900/30' : 'bg-neutral-900/50';
        
        let html = '<div class="grid gap-1" style="grid-template-columns: 150px repeat(' + this.sectors.length + ', 1fr);">';
        
        // Driver name cell
        const positionLabel = position === 'ahead' ? '↑ ' : position === 'behind' ? '↓ ' : '';
        html += `<div class="${bgClass} px-3 py-2 text-sm rounded truncate ${isPlayer ? 'font-bold text-cyan-400' : 'text-neutral-300'}">`;
        html += `${positionLabel}${driver.UserName || 'Unknown'}`;
        html += '</div>';
        
        // Sector time cells
        this.sectors.forEach(sector => {
            const sectorTime = this.getCarSectorTime(carIdx, sector.number);
            const playerSectorTime = this.getCarSectorTime(playerCarIdx, sector.number);
            
            let cellBg = bgClass;
            let textColor = 'text-neutral-400';
            
            // Color coding for non-player cars
            if (!isPlayer && sectorTime !== null && playerSectorTime !== null) {
                if (sectorTime < playerSectorTime) {
                    // Competitor is faster - BAD for player (red)
                    cellBg = 'bg-red-900/40';
                    textColor = 'text-red-300';
                } else if (sectorTime > playerSectorTime) {
                    // Competitor is slower - GOOD for player (green)
                    cellBg = 'bg-green-900/40';
                    textColor = 'text-green-300';
                } else {
                    // Same time (yellow)
                    cellBg = 'bg-yellow-900/40';
                    textColor = 'text-yellow-300';
                }
            } else if (isPlayer && sectorTime !== null) {
                textColor = 'text-cyan-400';
            }
            
            const timeDisplay = sectorTime !== null ? sectorTime.toFixed(3) : '--';
            html += `<div class="${cellBg} px-2 py-2 text-xs font-mono text-center ${textColor} rounded">${timeDisplay}</div>`;
        });
        
        html += '</div>';
        return html;
    }
    
    /**
     * Track off-track incidents per sector
     * If a car is off-track for >1 second, mark that sector with incident warning
     */
    trackSectorIncident(carIdx, trackSurface, lapDistPct) {
        if (!this.sectors.length || lapDistPct === undefined) return;
        
        const isOffTrack = trackSurface === 'OffTrack';
        const now = Date.now();
        
        // Determine which sector the car is in
        let carSectorNum = null;
        for (let i = 0; i < this.sectors.length; i++) {
            const sector = this.sectors[i];
            const nextSector = this.sectors[i + 1];
            
            if (nextSector) {
                if (lapDistPct >= sector.startPct && lapDistPct < nextSector.startPct) {
                    carSectorNum = sector.number;
                    break;
                }
            } else {
                // Last sector wraps to start
                if (lapDistPct >= sector.startPct || lapDistPct < this.sectors[0].startPct) {
                    carSectorNum = sector.number;
                    break;
                }
            }
        }
        
        if (carSectorNum === null) return;
        
        // Get or create incident tracking for this car
        let incident = this.sectorIncidents.get(carIdx);
        
        if (isOffTrack) {
            if (!incident || !incident.active) {
                // Start new off-track tracking
                this.sectorIncidents.set(carIdx, {
                    sectorNum: carSectorNum,
                    startTime: now,
                    active: true,
                    triggered: false
                });
                debug(`🚨 Car ${carIdx} went off-track in sector ${carSectorNum}`);
            } else {
                // Car is still off-track - update sector if changed
                if (incident.sectorNum !== carSectorNum) {
                    // Car moved to different sector while off-track - update tracking
                    incident.sectorNum = carSectorNum;
                    this.sectorIncidents.set(carIdx, incident);
                    debug(`🚨 Car ${carIdx} still off-track, now in sector ${carSectorNum}`);
                }
                
                // Continue tracking - check if duration threshold met
                const duration = now - incident.startTime;
                
                if (duration >= this.incidentMinDuration && !incident.triggered) {
                    // Incident confirmed - mark sector (only once)
                    incident.triggered = true;
                    this.sectorIncidents.set(carIdx, incident);
                    
                    debug(`⚠️⚠️⚠️ TRIGGERING YELLOW: sector ${carSectorNum}, car ${carIdx}, duration ${duration}ms`);
                    debug(`   activeSectorIncidents before:`, Array.from(this.activeSectorIncidents));
                    
                    // Always mark sector - don't check if already there
                    this.activeSectorIncidents.add(carSectorNum);
                    this.updateSectorIncidentDisplay(carSectorNum, true);
                    
                    debug(`   activeSectorIncidents after:`, Array.from(this.activeSectorIncidents));
                    
                    // Only set timeout if one doesn't already exist for this sector
                    // This prevents resetting the timer on every telemetry frame
                    if (!this.sectorIncidentTimeouts.has(carSectorNum)) {
                        // Auto-clear after timeout
                        const timeoutId = setTimeout(() => {
                            debug(`⏰ TIMEOUT EXECUTING: Clearing yellow for sector ${carSectorNum} after ${this.incidentTimeout}ms`);
                            this.activeSectorIncidents.delete(carSectorNum);
                            this.sectorIncidentTimeouts.delete(carSectorNum);
                            this.updateSectorIncidentDisplay(carSectorNum, false);
                        }, this.incidentTimeout);
                        
                        this.sectorIncidentTimeouts.set(carSectorNum, timeoutId);
                        debug(`   NEW timeout set with ID: ${timeoutId}, will fire in ${this.incidentTimeout}ms`);
                    } else {
                        debug(`   ⏱️ Timeout already running for sector ${carSectorNum}, NOT resetting`);
                    }
                }
            }
        } else {
            // Car back on track - clear incident tracking for this car
            if (incident && incident.active) {
                const offTrackDuration = now - incident.startTime;
                this.sectorIncidents.delete(carIdx);
                debug(`🏁 BACK ON TRACK: Car ${carIdx}, sector ${incident.sectorNum}, off-track ${offTrackDuration}ms, triggered: ${incident.triggered}`);
                debug(`   Yellow ${incident.triggered ? 'STAYS (timeout will clear)' : 'not shown (< 1s)'}`);
            }
        }
    }
    
    /**
     * Update visual indicator for sector incident
     */
    updateSectorIncidentDisplay(sectorNum, hasIncident) {
        const card = document.getElementById(`sector-card-${sectorNum}`);
        if (!card) {
            debug(`❌ updateSectorIncidentDisplay: sector-card-${sectorNum} NOT FOUND`);
            return;
        }
        
        debug(`🎨 updateSectorIncidentDisplay: sector ${sectorNum}, hasIncident=${hasIncident}`);
        debug(`   Card classes before:`, card.className);
        
        if (hasIncident) {
            // Yellow warning for incident
            card.classList.remove('bg-neutral-700');
            card.classList.add('bg-yellow-500', 'incident-active');
            card.title = 'Incident detected in this sector';
            debug(`   ✅ YELLOW APPLIED`);
        } else {
            // Clear incident - restore neutral color
            card.classList.remove('bg-yellow-500', 'incident-active');
            card.classList.add('bg-neutral-700');
            card.title = '';
            debug(`   ❌ YELLOW REMOVED`);
        }
        
        debug(`   Card classes after:`, card.className);
    }
    
    initializeCarAnalysis(sessionData) {
        // Only initialize once per session
        if (this.carAnalysisInitialized) {
            console.log('🔄 Car analysis already initialized, skipping...');
            return;
        }
        
        if (!sessionData?.DriverInfo?.Drivers) return;
        
        this.driversList = sessionData.DriverInfo.Drivers;
        this.playerCarIdx = sessionData.DriverInfo.DriverCarIdx;
        
        // Find player's car class
        const playerDriver = this.driversList[this.playerCarIdx];
        if (playerDriver) {
            this.playerCarClass = playerDriver.CarClassID;
        }
        
        console.log('🏁 Car Analysis initialized:', {
            totalDrivers: this.driversList.length,
            playerCarIdx: this.playerCarIdx,
            playerCarClass: this.playerCarClass
        });
        
        // Determine which class tab to select based on player's class
        let initialClassTab = 'GTP'; // Default
        
        for (const [className, classIds] of Object.entries(this.classMapping)) {
            if (classIds.includes(this.playerCarClass)) {
                initialClassTab = className;
                break;
            }
        }
        
        console.log(`🎯 Setting initial class tab to: ${initialClassTab} (player class: ${this.playerCarClass})`);
        
        // Set initial filter to player's class tab (only called once at initialization)
        this.setClassFilter(initialClassTab);
        
        // Mark as initialized
        this.carAnalysisInitialized = true;
    }
    
    setClassFilter(classFilter) {
        this.selectedClassFilter = classFilter;
        
        // Update tab styling
        document.querySelectorAll('.class-tab').forEach(tab => {
            if (tab.dataset.class === classFilter) {
                tab.classList.add('border-cyan-400', 'text-white');
                tab.classList.remove('border-transparent', 'text-neutral-400');
            } else {
                tab.classList.remove('border-cyan-400', 'text-white');
                tab.classList.add('border-transparent', 'text-neutral-400');
            }
        });
        
        // Re-render car list with new filter
        this.renderCarList();
    }
    
    getClassIds(className) {
        // Return class IDs for a given class name
        return this.classMapping[className] || [];
    }
    
    renderCarList() {
        const carListContainer = document.getElementById('car-list');
        if (!carListContainer || !this.driversList.length) return;
        
        // Get class IDs to filter by
        const targetClassIds = this.getClassIds(this.selectedClassFilter);
        
        // Filter drivers by selected class
        const classDrivers = this.driversList.filter(driver => 
            targetClassIds.includes(driver.CarClassID) && driver.CarIdx !== undefined
        );
        
        if (classDrivers.length === 0) {
            carListContainer.innerHTML = `
                <div class="text-neutral-500 text-sm text-center py-4">
                    No cars in this class
                </div>
            `;
            return;
        }
        
        // Sort by class position (will be updated via telemetry)
        classDrivers.sort((a, b) => {
            const posA = this.carAnalysisData[a.CarIdx]?.classPosition ?? 999;
            const posB = this.carAnalysisData[b.CarIdx]?.classPosition ?? 999;
            return posA - posB;
        });
        
        // Render car cards
        carListContainer.innerHTML = classDrivers.map(driver => {
            const isPlayer = driver.CarIdx === this.playerCarIdx;
            const isSelected = driver.CarIdx === this.selectedCarIdx;
            const carData = this.carAnalysisData[driver.CarIdx] || {};
            
            const position = carData.classPosition || '--';
            const offTrackCount = this.carPositionTracker?.getOffTrackCount(driver.CarIdx) || 0;
            const stintLaps = carData.stintLaps || 0;
            const lastLapTime = carData.lastLapTime || 0;
            
            // Format last lap time
            const formatLapTime = (seconds) => {
                if (!seconds || seconds <= 0) return '--';
                const mins = Math.floor(seconds / 60);
                const secs = (seconds % 60).toFixed(3);
                return `${mins}:${secs.padStart(6, '0')}`;
            };
            
            return `
                <div class="car-card bg-neutral-700 hover:bg-neutral-600 rounded-lg px-3 py-1 cursor-pointer transition ${isPlayer ? 'border-2 border-cyan-400' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}"
                     data-car-idx="${driver.CarIdx}">
                    <div class="grid grid-cols-[auto,1fr,1fr,auto] gap-3 items-center mb-2">
                        <span class="car-position text-xl font-bold text-white">${position}</span>
                        <div class="min-w-0">
                            <div class="text-sm font-semibold text-neutral-200 truncate">${driver.TeamName || 'No Team'} ${isPlayer ? '<span class="text-xs bg-cyan-500 text-black px-2 py-0.5 rounded ml-1">YOU</span>' : ''}</div>
                            <div class="text-xs text-neutral-400 truncate">${driver.UserName || 'Unknown'}</div>
                        </div>
                        <div class="min-w-0">
                            <div class="text-xs text-neutral-400 truncate">${driver.CarScreenNameShort || driver.CarPath || 'Unknown Car'}</div>
                        </div>
                        <div class="text-right text-xs space-y-1">
                            <div class="text-neutral-500">Div ${driver.DivisionID || '--'}</div>
                            <div class="text-yellow-400">iR: ${driver.IRating || '--'}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-xs border-t border-neutral-600 pt-2">
                        <div>
                            <span class="text-neutral-500">Inc:</span>
                            <span data-stat="inc" class="text-red-400 font-mono ml-1">${offTrackCount}</span>
                        </div>
                        <div>
                            <span class="text-neutral-500">Last:</span>
                            <span data-stat="last" class="text-cyan-400 font-mono ml-1">${formatLapTime(lastLapTime)}</span>
                        </div>
                        <div>
                            <span class="text-neutral-500">Stint:</span>
                            <span data-stat="stint" class="text-green-400 font-mono ml-1">${stintLaps}L</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers to car cards
        document.querySelectorAll('.car-card').forEach(card => {
            card.addEventListener('click', () => {
                const carIdx = parseInt(card.dataset.carIdx);
                this.selectCar(carIdx);
            });
        });
    }
    
    selectCar(carIdx) {
        this.selectedCarIdx = carIdx;
        
        // Find the driver and their class to potentially switch tabs
        const driver = this.driversList.find(d => d.CarIdx === carIdx);
        if (driver) {
            // Find which class tab this car belongs to
            for (const [className, classIds] of Object.entries(this.classMapping)) {
                if (classIds.includes(driver.CarClassID)) {
                    // Switch to this class tab if not already selected
                    if (this.selectedClassFilter !== className) {
                        console.log(`🔄 Switching to ${className} tab for selected car`);
                        this.setClassFilter(className);
                    }
                    break;
                }
            }
        }
        
        // Update selected car details
        this.updateCarDetails();
        
        // Show details container
        const detailsContainer = document.getElementById('car-details-container');
        if (detailsContainer) {
            detailsContainer.classList.remove('hidden');
        }
        
        // Update selected car name
        const selectedCarName = document.getElementById('selected-car-name');
        if (selectedCarName && driver) {
            selectedCarName.textContent = `${driver.TeamName || 'No Team'} - ${driver.UserName || 'Unknown'}`;
        }
        
        // Highlight selected card
        document.querySelectorAll('.car-card').forEach(card => {
            if (parseInt(card.dataset.carIdx) === carIdx) {
                card.classList.add('ring-2', 'ring-blue-500');
            } else {
                card.classList.remove('ring-2', 'ring-blue-500');
            }
        });
        
        // Highlight selected car on track map
        if (this.carPositionTracker) {
            this.carPositionTracker.setSelectedCar(carIdx);
        }
    }
    
    updateCarDetails() {
        if (this.selectedCarIdx === null) return;
        
        const data = this.carAnalysisData[this.selectedCarIdx] || {};
        
        // Helper to format lap time
        const formatLapTime = (seconds) => {
            if (!seconds || seconds <= 0) return '--';
            const mins = Math.floor(seconds / 60);
            const secs = (seconds % 60).toFixed(3);
            return `${mins}:${secs.padStart(6, '0')}`;
        };
        
        // Helper to format est time
        const formatEstTime = (seconds) => {
            if (!seconds || seconds <= 0) return '--';
            return seconds.toFixed(1) + 's';
        };
        
        // Helper to format pit duration
        const formatPitDuration = (seconds) => {
            if (!seconds || seconds <= 0) return '--';
            return seconds.toFixed(1) + 's';
        };
        
        // Get off-track count from car position tracker
        const offTrackCount = this.carPositionTracker?.getOffTrackCount(this.selectedCarIdx) || 0;
        
        // Update detail fields
        document.getElementById('detail-best-lap').textContent = formatLapTime(data.bestLapTime);
        document.getElementById('detail-class-pos').textContent = data.classPosition || '--';
        document.getElementById('detail-est-time').textContent = formatEstTime(data.estTime);
        document.getElementById('detail-lap').textContent = data.lap || '--';
        document.getElementById('detail-lap-completed').textContent = data.lapCompleted || '--';
        document.getElementById('detail-last-lap').textContent = formatLapTime(data.lastLapTime);
        document.getElementById('detail-pit-road').textContent = data.onPitRoad ? 'YES' : 'NO';
        document.getElementById('detail-track-surface').textContent = data.trackSurface || '--';
        document.getElementById('detail-surface-material').textContent = data.surfaceMaterial || '--';
        document.getElementById('detail-off-track').textContent = offTrackCount;
        document.getElementById('detail-stint-laps').textContent = data.stintLaps || 0;
        document.getElementById('detail-pit-duration').textContent = formatPitDuration(data.lastPitDuration);
    }
    
    handleTelemetryUpdate(data) {
        if (!data || !data.values) return;
        
        const values = data.values;
        
        // Reject out-of-order packets - time should only decrease (counting down)
        if (this.lastSessionTimeRemain !== null && values.SessionTimeRemain != null) {
            const timeDiff = values.SessionTimeRemain - this.lastSessionTimeRemain;
            // If time goes UP by more than 0.5 seconds, it's an old packet
            if (timeDiff > 0.5) {
                debug(`⏭️ REJECTED old packet: time jumped from ${this.lastSessionTimeRemain}s to ${values.SessionTimeRemain}s (+${timeDiff}s)`);
                return; // Discard this packet
            }
        }
        
        // Update live stats - use manual timer if in manual mode, otherwise use telemetry
        if (this.timeMode === 'manual') {
            this.sessionTimeRemain = this.manualTimeRemaining;
        } else {
            this.sessionTimeRemain = values.SessionTimeRemain || 0;
            this.lastSessionTimeRemain = values.SessionTimeRemain; // Track for next comparison
        }
        
        // Calculate stints on first telemetry update with actual session time
        if (!this.hasCalculatedStints && this.strategy && this.sessionTimeRemain > 0) {
            console.log(`🔄 First telemetry update - recalculating stints for ${this.formatTime(this.sessionTimeRemain)} remaining`);
            this.calculateStintsForRemainingTime();
            this.hasCalculatedStints = true;
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
            
            // Start live pit timer
            this.startPitTimer();
        }
        
        // When exiting pit road (driver just exited pits - NEW STINT STARTED)
        if (this.wasOnPitRoad === true && isOnPitRoad === false) {
            // Calculate actual pit stop duration
            if (this.pitStopStartTime) {
                this.actualPitStopTime = Math.round((Date.now() - this.pitStopStartTime) / 1000);
                this.pitStopDuration = this.actualPitStopTime;
                console.log(`🛠️  Pit stop ended - Duration: ${this.actualPitStopTime}s`);
                
                // Stop live pit timer
                this.stopPitTimer();
                
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
            // Sync currentStintLap with calculated value
            this.currentStintLap = Math.max(0, this.currentLap - this.stintStartLap);
            
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
        
        // Update strategy comparison (works for both auto and manual modes)
        if (this.strategy) {
            this.updateStrategyComparison();
        }
        
        // Update sector comparison display (throttled to 100ms = 10 times per second)
        const now = Date.now();
        if (now - this.lastSectorComparisonUpdate > 100) {
            this.updateSectorComparison(values);
            this.lastSectorComparisonUpdate = now;
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
        // Only save stint if we completed at least one lap AND have valid lap times
        if (this.currentStintLap > 0 && this.currentStintLapTimes.length > 0) {
            // Calculate total stint time (lap times + pit stop time if applicable)
            const totalLapTime = this.currentStintLapTimes.reduce((a, b) => a + b, 0);
            const totalStintTime = totalLapTime + this.actualPitStopTime;
            
            // Only save if we actually have valid lap time data
            if (totalLapTime === 0) {
                console.log(`⏭️ Skipping stint #${this.currentStintNumber} - no valid lap times recorded`);
                return;
            }
            
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
    
    updateSessionTimeDisplay() {
        // Only update the session time display (used by manual timer)
        this.elements.sessionTime.textContent = this.formatTime(this.sessionTimeRemain);
    }
    
    updateLiveStats() {
        // Session time - just display remaining time directly
        this.elements.sessionTime.textContent = this.formatTime(this.sessionTimeRemain);
        
        // Total laps in session
        this.elements.totalLaps.textContent = this.currentLap || '--';
        
        // Current stint number - match the active stint in the table
        const currentStintFromTable = this.findCurrentStint(this.currentLap);
        if (currentStintFromTable) {
            this.elements.stintNumber.textContent = currentStintFromTable.stintNumber;
        } else {
            this.elements.stintNumber.textContent = this.currentStintNumber || '--';
        }
        
        // Stint laps completed
        // Calculate from the difference between current lap and stint start lap
        // This updates immediately without waiting for fuel calculation logic
        const calculatedStintLap = this.stintStartLap !== undefined ? Math.max(0, this.currentLap - this.stintStartLap) : this.currentStintLap;
        this.elements.stintLap.textContent = calculatedStintLap > 0 ? calculatedStintLap : '--';
        
        // Fuel - 2 decimals
        this.elements.fuelRemaining.textContent = this.fuelLevel ? `${this.fuelLevel.toFixed(2)} L` : '-- L';
        
        // Laps remaining (calculated from fuel remaining / running avg fuel per lap) - 1 decimal
        if (this.elements.lapsRemaining) {
            const runningAvgFuel = this.getRunningAvgFuelPerLap();
            if (this.fuelLevel && runningAvgFuel > 0) {
                const lapsRemaining = this.fuelLevel / runningAvgFuel;
                this.elements.lapsRemaining.textContent = lapsRemaining.toFixed(1);
            } else {
                this.elements.lapsRemaining.textContent = '--';
            }
        }
        
        // Last lap time
        this.elements.lastLapTime.textContent = this.lastLapTime ? this.formatLapTime(this.lastLapTime) : '--:--';
        
        // Pit stop time - only update if NOT currently in pit (let live timer show)
        const pitStopEl = document.getElementById('pit-stop-time');
        if (pitStopEl && !this.pitTimerInterval) {
            // Not in pits - show average or default
            if (this.stintHistory.length > 0) {
                const avgPitTime = this.getAveragePitStopTime();
                pitStopEl.textContent = `${avgPitTime.toFixed(1)}s`;
            } else {
                pitStopEl.textContent = '--';
            }
        }
        
        // Latest lap fuel per lap
        this.elements.fuelPerLap.textContent = this.fuelPerLap > 0 ? `${this.fuelPerLap.toFixed(2)} L` : '-- L';
        
        // Average lap time for current stint
        const avgLapTime = this.getAverageLapTime(this.currentStintLapTimes);
        this.elements.avgLapTime.textContent = avgLapTime > 0 ? this.formatLapTime(avgLapTime) : '--:--';
        
        // Average fuel for current stint
        const avgFuel = this.getAverageFuelPerLap(this.currentStintFuelUse);
        this.elements.avgFuelPerLap.textContent = avgFuel > 0 ? `${avgFuel.toFixed(2)} L` : '-- L';
        
        // Update strategy status running averages live
        this.updateStrategyStatusAverages();
        
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
        
        // Always update stint number from table lookup (or fallback to counter)
        if (this.elements.currentStintNumber) {
            if (currentStint) {
                this.elements.currentStintNumber.textContent = currentStint.stintNumber;
                this.elements.totalStints.textContent = this.strategy.stints.length;
            } else {
                this.elements.currentStintNumber.textContent = this.currentStintNumber || '--';
                this.elements.totalStints.textContent = this.strategy.stints.length;
            }
        }
        
        // Always calculate lap time delta if we have data
        if (this.elements.lapDelta && this.strategy.formData) {
            const avgLapTimeMinutes = parseInt(this.strategy.formData.avgLapTimeMinutes || 0);
            const avgLapTimeSeconds = parseInt(this.strategy.formData.avgLapTimeSeconds || 0);
            const plannedAvgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
            
            const runningAvgLapTime = this.getRunningAvgLapTime();
            
            if (plannedAvgLapTime > 0 && runningAvgLapTime > 0) {
                const lapTimeDelta = runningAvgLapTime - plannedAvgLapTime;
                this.elements.lapDelta.textContent = lapTimeDelta > 0 ? `+${lapTimeDelta.toFixed(1)}s` : `${lapTimeDelta.toFixed(1)}s`;
                this.elements.lapDelta.classList.remove('delta-positive', 'delta-negative', 'delta-neutral');
                if (lapTimeDelta > 0.5) {
                    this.elements.lapDelta.classList.add('delta-negative');
                } else if (lapTimeDelta < -0.5) {
                    this.elements.lapDelta.classList.add('delta-positive');
                } else {
                    this.elements.lapDelta.classList.add('delta-neutral');
                }
            } else {
                this.elements.lapDelta.textContent = '--';
                this.elements.lapDelta.classList.remove('delta-positive', 'delta-negative', 'delta-neutral');
                this.elements.lapDelta.classList.add('delta-neutral');
            }
        }
        
        // Always calculate next pit stop based on fuel (use running average, not stint average)
        if (this.elements.nextPitLap) {
            const runningAvgFuel = this.getRunningAvgFuelPerLap();
            
            if (this.fuelLevel > 0 && runningAvgFuel > 0) {
                const lapsRemaining = this.fuelLevel / runningAvgFuel;
                this.elements.nextPitLap.textContent = lapsRemaining.toFixed(1);
            } else {
                this.elements.nextPitLap.textContent = '--';
            }
        }
        
        if (currentStint) {
            this.currentStint = currentStint;
        }
        
        // Update stint table rows
        this.updateStintTableStatus();
    }
    
    /**
     * Update strategy status running averages (called live with telemetry)
     */
    updateStrategyStatusAverages() {
        if (!this.strategy || !this.strategy.formData) return;
        
        const avgLapTimeMinutes = parseInt(this.strategy.formData.avgLapTimeMinutes || 0);
        const avgLapTimeSeconds = parseInt(this.strategy.formData.avgLapTimeSeconds || 0);
        const plannedAvgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
        const plannedFuelPerLap = parseFloat(this.strategy.formData.fuelPerLap) || 1.0;
        
        // Get running averages (falls back to planned if no history)
        const actualAvgLapTime = this.getRunningAvgLapTime();
        const actualAvgFuelPerLap = this.getRunningAvgFuelPerLap();
        const avgPitStopTime = this.getAveragePitStopTime();
        
        // Update displays
        if (this.elements.runningAvgLapTime && actualAvgLapTime > 0) {
            const minutes = Math.floor(actualAvgLapTime / 60);
            const seconds = (actualAvgLapTime % 60).toFixed(3);
            this.elements.runningAvgLapTime.textContent = `${minutes}:${seconds.padStart(6, '0')}`;
        }
        if (this.elements.runningAvgFuel) {
            this.elements.runningAvgFuel.textContent = `${actualAvgFuelPerLap.toFixed(2)} L`;
        }
        if (this.elements.runningAvgPitTime) {
            this.elements.runningAvgPitTime.textContent = `${avgPitStopTime.toFixed(1)} s`;
        }
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
        // Calculate what lap we SHOULD be on based on the original planned lap time
        if (!this.strategy || !this.strategy.formData || !this.strategy.strategyState) {
            return this.currentLap; // Fallback if no strategy loaded
        }
        
        // Get the original planned average lap time from the strategy
        const avgLapTimeMinutes = parseInt(this.strategy.formData.avgLapTimeMinutes || 0);
        const avgLapTimeSeconds = parseInt(this.strategy.formData.avgLapTimeSeconds || 0);
        const plannedAvgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
        
        if (plannedAvgLapTime === 0) {
            console.warn('⚠️ Planned lap time is 0, cannot calculate delta');
            return this.currentLap; // Fallback if invalid lap time
        }
        
        // Calculate elapsed time (total race duration - time remaining)
        const totalRaceDuration = this.strategy.strategyState.raceDurationSeconds || 0;
        const elapsedTime = totalRaceDuration - sessionTimeRemain;
        
        console.log(`⏱️ Planned Lap Calc: totalRaceDuration=${totalRaceDuration}s, sessionTimeRemain=${sessionTimeRemain}s, elapsedTime=${elapsedTime}s, avgLapTime=${plannedAvgLapTime}s`);
        
        // Calculate what lap we should be on based on elapsed time and planned lap time
        const plannedLap = Math.floor(elapsedTime / plannedAvgLapTime);
        
        return plannedLap;
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
                console.log('📊 FULL STRATEGY OBJECT:', strategy);
                console.log('📊 Has stints?', 'stints' in strategy);
                console.log('📊 stints value:', strategy.stints);
                
                // Store strategy ID BEFORE calling loadStrategy so URL update works
                this.currentStrategyId = strategyId;
                sessionStorage.setItem('currentStrategyId', strategyId);
                
                // Now load the strategy (this will update the URL)
                this.loadStrategy(strategy);
                
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
        console.log('STINTS:', strategy.stints);
        console.log('📥 Strategy stints present?', strategy.stints ? 'YES' : 'NO');
        this.strategy = strategy;
        
        // Update URL to reflect currently loaded strategy
        if (this.currentStrategyId) {
            const newUrl = `${window.location.pathname}?strategy=${this.currentStrategyId}`;
            window.history.replaceState({ strategyId: this.currentStrategyId }, '', newUrl);
            console.log('🔗 URL updated:', newUrl);
        }
        
        // Initialize sessionTimeRemain with full race duration from strategy
        // This will be overwritten by telemetry data when it arrives
        if (strategy.strategyState && strategy.strategyState.raceDurationSeconds) {
            this.sessionTimeRemain = strategy.strategyState.raceDurationSeconds;
            console.log(`⏱️ Race duration initialized: ${this.formatTime(this.sessionTimeRemain)}`);
        }
        
        // Display setup data from strategy
        this.displaySetupData();
        
        // Load track map if track info is available (pass entire selectedEvent like planner does)
        if (strategy.selectedEvent) {
            console.log('🗺️ Loading track map for:', strategy.selectedEvent.track_name);
            this.loadTrackMap(strategy.selectedEvent);
        } else {
            console.warn('⚠️ No selectedEvent found in strategy:', strategy);
        }
        
        // Don't populate stint table yet - wait for telemetry to get actual session time
        // The table will be populated when handleTelemetryUpdate receives SessionTimeRemain
        console.log('⏳ Waiting for telemetry data to calculate stints based on actual session time...');
    }
    
    calculateStintsForRemainingTime() {
        if (!this.strategy || !this.strategy.strategyState || !this.strategy.formData) {
            console.warn('⚠️ Cannot calculate stints - missing strategy data');
            return;
        }
        
        const state = this.strategy.strategyState;
        const formData = this.strategy.formData;
        
        // Get average lap time
        const avgLapTimeMinutes = parseInt(formData.avgLapTimeMinutes) || 0;
        const avgLapTimeSeconds = parseInt(formData.avgLapTimeSeconds) || 0;
        let avgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
        
        if (avgLapTime === 0) {
            avgLapTime = 120; // 2 minute default
            console.warn(`⚠️ No lap time, using default: ${avgLapTime}s`);
        }
        
        // Get fuel parameters from formData (where planner stores them)
        const tankSize = parseFloat(formData.tankCapacity) || 100;
        const fuelPerLap = parseFloat(formData.fuelPerLap) || 2.0;
        const pitStopTime = state.pitStopTime || 90;
        
        // Calculate laps per stint based on fuel
        const lapsPerStint = Math.floor(tankSize / fuelPerLap);
        
        // Calculate total laps remaining in session
        const totalLapsRemaining = Math.floor(this.sessionTimeRemain / avgLapTime);
        
        // Calculate number of stints needed
        const totalStints = Math.ceil(totalLapsRemaining / lapsPerStint);
        
        console.log(`🔧 Calculating stints for remaining time:
  Session time remaining: ${this.formatTime(this.sessionTimeRemain)}
  Avg lap time: ${avgLapTime}s
  Total laps remaining: ${totalLapsRemaining}
  Laps per stint (fuel): ${lapsPerStint}
  Stints needed: ${totalStints}`);
        
        const stints = [];
        let currentLap = 1;
        
        for (let i = 1; i <= totalStints; i++) {
            const stintDriver = this.strategy.stintDriverAssignments?.[i-1] || 'Unassigned';
            const startLap = Math.floor(currentLap);
            const endLap = Math.min(Math.floor(currentLap + lapsPerStint - 1), totalLapsRemaining);
            const laps = endLap - startLap + 1;
            
            // Calculate times
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
            
            // Next stint starts after this one ends
            currentLap = endLap + 1;
            
            // Stop if we've reached the end of the session
            if (currentLap > totalLapsRemaining) break;
        }
        
        this.strategy.stints = stints;
        console.log(`✅ Calculated ${stints.length} stints for remaining session time`);
        this.populateStintTable();
    }
    
    calculateStints() {
        if (!this.strategy.strategyState || !this.strategy.formData) return;
        
        const state = this.strategy.strategyState;
        const formData = this.strategy.formData;
        
        // Extract average lap time from separate minute/second fields
        const avgLapTimeMinutes = parseInt(formData.avgLapTimeMinutes) || 0;
        const avgLapTimeSeconds = parseInt(formData.avgLapTimeSeconds) || 0;
        let avgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
        
        console.log(`🔍 formData.avgLapTimeMinutes=${formData.avgLapTimeMinutes}, avgLapTimeSeconds=${formData.avgLapTimeSeconds}, calculated=${avgLapTime}`);
        
        // If both are zero, check if formData has race duration to estimate
        if (avgLapTime === 0 && state.raceDurationSeconds && state.totalStints) {
            avgLapTime = Math.floor(state.raceDurationSeconds / (state.totalStints * state.lapsPerStint));
            console.log(`⚠️ No lap time in formData, estimated from race duration: ${avgLapTime}s`);
        }
        
        // Last resort default
        if (avgLapTime === 0) {
            avgLapTime = 300;
            console.log(`⚠️ Using default lap time: 300s`);
        }
        
        // Calculate basic stint parameters
        const totalStints = state.totalStints;
        const lapsPerStint = state.lapsPerStint;
        const pitStopTime = state.pitStopTime || 90;
        
        console.log(`🔧 Calculating stints: totalStints=${totalStints}, lapsPerStint=${lapsPerStint}, avgLapTime=${avgLapTime}s`);
        
        const stints = [];
        let currentLap = 1;
        
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
        console.log('🔧 populateStintTable() called');
        console.log('  this.strategy:', this.strategy);
        console.log('  this.strategy.stints:', this.strategy?.stints);
        console.log('  this.elements.stintTableBody:', this.elements.stintTableBody);
        
        if (!this.strategy) {
            console.warn('⚠️ No strategy object');
            return;
        }
        
        const stints = this.strategy.stints;
        
        if (!stints || !Array.isArray(stints) || stints.length === 0) {
            console.warn('⚠️ No stints array or empty:', stints);
            const tbody = this.elements.stintTableBody;
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center text-neutral-500 py-4">No stints loaded</td></tr>';
            } else {
                console.error('❌ stint-table-body element not found!');
            }
            return;
        }
        
        const tbody = this.elements.stintTableBody;
        if (!tbody) {
            console.error('❌ stint-table-body element not found!');
            return;
        }
        
        tbody.innerHTML = '';
        console.log(`✅ Populating ${stints.length} stints`);
        
        // Get pit stop time from strategy
        const pitStopTime = this.strategy.strategyState?.pitStopTime || 90;
        this.pitStopDuration = pitStopTime;
        
        stints.forEach((stint, index) => {
            console.log(`  Creating row for stint ${stint.stintNumber}:`, stint);
            
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
                <td class="px-3 py-2 text-right font-mono text-blue-400 text-sm">${Math.floor(stint.laps)}</td>
                <td class="px-3 py-2 text-sm">${stint.driver || 'Unassigned'}</td>
                <td class="px-3 py-2 text-sm status-cell text-neutral-500">--</td>
            `;
            
            tbody.appendChild(stintRow);
            console.log(`  ✅ Stint row appended to tbody`);
            
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
        
        console.log(`✅ Stint table populated with ${stints.length} stints`);
        console.log(`  Total rows in tbody:`, tbody.children.length);
    }
    
    /**
     * Get average pit stop time with outlier filter
     * Ignores extreme outliers (accidents/repairs) that are > 3x the minimum
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
        
        const pitTimes = this.stintHistory.map(s => s.pitStopTime).filter(t => t > 0);
        
        if (pitTimes.length === 0) {
            return baseline;
        }
        
        // Find minimum pit time as reference
        const minPitTime = Math.min(...pitTimes);
        
        // Filter out extreme outliers (3x minimum = likely accident/repair)
        const validPitTimes = pitTimes.filter(time => time <= minPitTime * 3);
        
        if (validPitTimes.length === 0) {
            console.log(`⚠️ No valid pit stops, using baseline: ${baseline}s`);
            return baseline;
        }
        
        const avg = validPitTimes.reduce((a, b) => a + b, 0) / validPitTimes.length;
        console.log(`📊 Pit stop average: ${avg.toFixed(1)}s (min: ${minPitTime}s, valid samples: ${validPitTimes.length}/${pitTimes.length})`);
        return avg;
    }
    
    /**
     * Get running average fuel per lap from stint history
     * Includes current stint data for live updates
     * Returns planned value if no history, otherwise actual average
     */
    getRunningAvgFuelPerLap() {
        // Start with planned baseline from strategy
        const plannedFuelPerLap = this.strategy?.formData?.fuelPerLap ? parseFloat(this.strategy.formData.fuelPerLap) : 1.0;
        
        let totalFuel = 0;
        let totalLaps = 0;
        
        // Include completed stints from history
        if (this.stintHistory && this.stintHistory.length > 0) {
            totalFuel = this.stintHistory.reduce((sum, s) => sum + (s.avgFuelPerLap * s.lapCount), 0);
            totalLaps = this.stintHistory.reduce((sum, s) => sum + s.lapCount, 0);
        }
        
        // Include current stint fuel use for live updates
        if (this.currentStintFuelUse && this.currentStintFuelUse.length > 0) {
            const currentStintAvgFuel = this.getAverageFuelPerLap(this.currentStintFuelUse);
            if (currentStintAvgFuel > 0) {
                totalFuel += currentStintAvgFuel * this.currentStintFuelUse.length;
                totalLaps += this.currentStintFuelUse.length;
            }
        }
        
        return totalLaps > 0 ? totalFuel / totalLaps : plannedFuelPerLap;
    }
    
    /**
     * Get running average lap time from stint history
     * Uses avgLapTime from each stint, weighted by lap count
     * Includes current stint data for live updates
     * Falls back to planned value if no history
     */
    getRunningAvgLapTime() {
        // Start with planned baseline from strategy
        if (!this.strategy || !this.strategy.formData) {
            return 0;
        }
        
        const avgLapTimeMinutes = parseInt(this.strategy.formData.avgLapTimeMinutes || 0);
        const avgLapTimeSeconds = parseInt(this.strategy.formData.avgLapTimeSeconds || 0);
        const plannedAvgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
        
        try {
            let totalWeightedTime = 0;
            let totalLaps = 0;
            
            // Include completed stints from history
            if (this.stintHistory && this.stintHistory.length > 0) {
                totalWeightedTime = this.stintHistory.reduce((sum, s) => sum + (s.avgLapTime * s.lapCount), 0);
                totalLaps = this.stintHistory.reduce((sum, s) => sum + s.lapCount, 0);
            }
            
            // Include current stint lap times for live updates
            if (this.currentStintLapTimes && this.currentStintLapTimes.length > 0) {
                const currentStintAvg = this.getAverageLapTime(this.currentStintLapTimes);
                if (currentStintAvg > 0) {
                    totalWeightedTime += currentStintAvg * this.currentStintLapTimes.length;
                    totalLaps += this.currentStintLapTimes.length;
                }
            }
            
            // If we have data, return weighted average, otherwise return planned
            const runningAvg = totalLaps > 0 ? totalWeightedTime / totalLaps : plannedAvgLapTime;
            
            return runningAvg;
        } catch (error) {
            console.error('❌ Error in getRunningAvgLapTime:', error, this.stintHistory);
            return plannedAvgLapTime;
        }
    }
    
    /**
     * Recalculate remaining stints based on actual performance
     * Uses running averages from completed stints
     */
    recalculateRemainingStints() {
        if (!this.strategy || !this.strategy.stints) {
            console.warn('⚠️ No strategy loaded');
            return;
        }
        
        // Don't reset manual timer - it should only be controlled by user buttons
        // Manual mode uses this.manualTimeRemaining which is managed separately
        
        // Start with planned values as baseline
        const formData = this.strategy.formData || {};
        const avgLapTimeMinutes = parseInt(formData.avgLapTimeMinutes || 0);
        const avgLapTimeSeconds = parseInt(formData.avgLapTimeSeconds || 0);
        let actualAvgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds || 300;
        let actualAvgFuelPerLap = parseFloat(formData.fuelPerLap) || 1.0;
        let avgPitStopTime = this.strategy.strategyState?.pitStopTime || 90;
        let dataSource = 'PLANNED';
        
        // Override with actual data if stint history exists
        // Use the running average functions which properly weight by stint averages
        if (this.stintHistory.length > 0) {
            actualAvgLapTime = this.getRunningAvgLapTime();
            actualAvgFuelPerLap = this.getRunningAvgFuelPerLap();
            avgPitStopTime = this.getAveragePitStopTime();
            dataSource = 'ACTUAL';
        }
        
        console.log(`🔄 Recalculating stints with ${dataSource} data:`, {
            avgLapTime: actualAvgLapTime.toFixed(2),
            avgFuelPerLap: actualAvgFuelPerLap.toFixed(2),
            avgPitStopTime: avgPitStopTime.toFixed(1)
        });
        
        // Update running averages display in Strategy Status box
        if (this.elements.runningAvgLapTime) {
            const minutes = Math.floor(actualAvgLapTime / 60);
            const seconds = (actualAvgLapTime % 60).toFixed(3);
            this.elements.runningAvgLapTime.textContent = `${minutes}:${seconds.padStart(6, '0')}`;
        }
        if (this.elements.runningAvgFuel) {
            this.elements.runningAvgFuel.textContent = `${actualAvgFuelPerLap.toFixed(2)} L`;
        }
        if (this.elements.runningAvgPitTime) {
            this.elements.runningAvgPitTime.textContent = `${avgPitStopTime.toFixed(1)} s`;
        }
        
        // Get tank capacity and remaining session time
        const tankCapacity = this.strategy.formData?.tankCapacity || 100;
        const remainingSessionTime = this.sessionTimeRemain;
        
        console.log(`🔍 Tank and time data:`, {
            tankCapacity: tankCapacity,
            remainingSessionTime: remainingSessionTime,
            sessionTimeRemainFormatted: this.formatTime(remainingSessionTime)
        });
        
        // Calculate laps per stint based on fuel and tank
        const lapsPerTank = Math.floor(tankCapacity / actualAvgFuelPerLap);
        
        // Estimate number of pit stops needed
        const estimatedLapsNeeded = Math.ceil(remainingSessionTime / actualAvgLapTime);
        const estimatedStints = Math.ceil(estimatedLapsNeeded / lapsPerTank);
        const estimatedPitStops = Math.max(0, estimatedStints - 1); // One less than stints
        
        // Subtract pit stop time from available racing time
        const timeForPitStops = estimatedPitStops * avgPitStopTime;
        const actualRacingTime = Math.max(0, remainingSessionTime - timeForPitStops);
        
        console.log(`⏱️ Pit stop adjustment:`, {
            estimatedStints: estimatedStints,
            estimatedPitStops: estimatedPitStops,
            timeForPitStops: `${timeForPitStops}s`,
            actualRacingTime: `${(actualRacingTime / 60).toFixed(1)} min`
        });
        
        // Calculate actual laps needed with adjusted time
        const remainingLapsNeeded = Math.ceil(actualRacingTime / actualAvgLapTime);
        const newStintCount = Math.ceil(remainingLapsNeeded / lapsPerTank);
        
        const timePerStint = (lapsPerTank * actualAvgLapTime) + avgPitStopTime; // time per stint including pit
        
        // Calculate how many stints fit in remaining time
        const completedStints = this.stintHistory.length;
        const totalNewStints = completedStints + newStintCount;
        
        console.log(`📊 Time analysis:`, {
            remainingTime: `${(remainingSessionTime / 60).toFixed(1)} min`,
            lapsPerTank: lapsPerTank,
            tankCapacity: tankCapacity,
            actualAvgFuelPerLap: actualAvgFuelPerLap,
            timePerStint: `${(timePerStint / 60).toFixed(1)} min`,
            remainingLaps: remainingLapsNeeded,
            newStintCount: newStintCount,
            totalNewStints: totalNewStints
        });
        
        if (newStintCount <= 0) {
            console.log('✅ All time remaining stints completed');
            return;
        }
        
        // Rebuild remaining stints array (trim or add stints as needed)
        const lastEndLap = completedStints > 0 ? this.strategy.stints[completedStints - 1].endLap : 0;
        let newCurrentLap = lastEndLap + 1;
        
        console.log(`📍 Recalculating from lap ${newCurrentLap}, need ${newStintCount} stints`);
        
        // Remove old remaining stints
        this.strategy.stints = this.strategy.stints.slice(0, completedStints);
        
        // Create new remaining stints
        for (let i = 0; i < newStintCount; i++) {
            const stintIndex = completedStints + i;
            const originalStint = this.strategy.stints[stintIndex - 1] || {}; // Get previous stint as template
            
            const startLap = Math.floor(newCurrentLap);
            const endLap = Math.floor(startLap + lapsPerTank - 1);
            
            const startTime = this.formatTimeSeconds((startLap - 1) * actualAvgLapTime);
            const endTime = this.formatTimeSeconds(endLap * actualAvgLapTime);
            
            const newStint = {
                stintNumber: stintIndex + 1,
                driver: originalStint.driver || 'Unassigned',
                backup: originalStint.backup || null,
                startLap: startLap,
                endLap: endLap,
                laps: endLap - startLap + 1,
                startTime: startTime,
                endTime: endTime
            };
            
            this.strategy.stints.push(newStint);
            
            console.log(`✏️  Stint #${stintIndex + 1} created: laps ${startLap}-${endLap} (${endLap - startLap + 1} laps)`);
            
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
        // Handle invalid values
        if (!seconds || seconds < 0 || isNaN(seconds)) {
            return '--:--';
        }
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
     * Display setup data from strategy in the session container
     */
    displaySetupData() {
        if (!this.strategy) return;
        
        const state = this.strategy.strategyState;
        const formData = this.strategy.formData;
        
        // Display session metadata (track, car, event type, series)
        const trackEl = document.getElementById('session-track');
        if (trackEl && this.strategy.selectedTrack) {
            trackEl.textContent = this.strategy.selectedTrack.trackName || '--';
        }
        
        const carEl = document.getElementById('session-car');
        if (carEl && this.strategy.selectedCar) {
            carEl.textContent = this.strategy.selectedCar.carName || '--';
        }
        
        const typeEl = document.getElementById('session-type');
        if (typeEl && this.strategy.selectedEvent) {
            typeEl.textContent = this.strategy.selectedEvent.sessionType || '--';
        }
        
        const seriesEl = document.getElementById('session-series');
        if (seriesEl && this.strategy.selectedSeries) {
            seriesEl.textContent = this.strategy.selectedSeries.seriesName || '--';
        }
        
        if (!state || !formData) return;
        
        // Session Time
        const sessionTimeEl = document.getElementById('setup-session-time');
        if (sessionTimeEl && state.raceDurationSeconds) {
            sessionTimeEl.textContent = this.formatTime(state.raceDurationSeconds);
        }
        
        // Avg Lap Time
        const avgLapTimeEl = document.getElementById('setup-avg-lap-time');
        if (avgLapTimeEl) {
            const avgLapTimeMinutes = parseInt(formData.avgLapTimeMinutes) || 0;
            const avgLapTimeSeconds = parseInt(formData.avgLapTimeSeconds) || 0;
            const avgLapTime = (avgLapTimeMinutes * 60) + avgLapTimeSeconds;
            avgLapTimeEl.textContent = avgLapTime > 0 ? this.formatLapTime(avgLapTime) : '--';
        }
        
        // Avg Fuel Use
        const avgFuelEl = document.getElementById('setup-avg-fuel-use');
        if (avgFuelEl && formData.fuelPerLap) {
            avgFuelEl.textContent = `${parseFloat(formData.fuelPerLap).toFixed(2)} L`;
        }
        
        // Tank Size
        const tankSizeEl = document.getElementById('setup-tank-size');
        if (tankSizeEl && formData.tankCapacity) {
            tankSizeEl.textContent = `${parseFloat(formData.tankCapacity).toFixed(1)} L`;
        }
        
        // Pit Stop Time (baseline from planner)
        const pitTimeEl = document.getElementById('setup-pit-time');
        if (pitTimeEl && state.pitStopTime) {
            pitTimeEl.textContent = `${parseFloat(state.pitStopTime).toFixed(1)}s`;
        }
        
        console.log('📊 Setup data displayed from strategy');
    }
    
    /**
     * Get average lap time from array
     * @param {Array<number>} lapTimes - Array of lap times in seconds
     * @returns {number} Average lap time
     */
    getAverageLapTime(lapTimes) {
        if (!lapTimes || lapTimes.length === 0) return 0;
        
        // Filter out invalid lap times (0, null, undefined, NaN, negative)
        const validLapTimes = lapTimes.filter(time => 
            time != null && 
            !isNaN(time) && 
            time > 0 && 
            isFinite(time)
        );
        
        if (validLapTimes.length === 0) return 0;
        
        const sum = validLapTimes.reduce((a, b) => a + b, 0);
        return sum / validLapTimes.length;
    }
    
    /**
     * Get average fuel per lap from array
     * @param {Array<number>} fuelUse - Array of fuel usage in liters
     * @returns {number} Average fuel per lap
     */
    getAverageFuelPerLap(fuelUse) {
        if (!fuelUse || fuelUse.length === 0) return 0;
        
        // Filter out invalid fuel values (0, null, undefined, NaN, negative)
        const validFuelUse = fuelUse.filter(fuel => 
            fuel != null && 
            !isNaN(fuel) && 
            fuel > 0 && 
            isFinite(fuel)
        );
        
        if (validFuelUse.length === 0) return 0;
        
        const sum = validFuelUse.reduce((a, b) => a + b, 0);
        return sum / validFuelUse.length;
    }
}

// Initialize tracker when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.liveTracker = new LiveStrategyTracker();
    
    // Add console helper functions for testing
    window.toggleRacingLine = function(visible) {
        if (window.liveTracker && window.liveTracker.carPositionTracker) {
            window.liveTracker.carPositionTracker.toggleRacingLineVisibility(visible);
            console.log(`🎨 Racing line ${visible ? 'shown' : 'hidden'} for alignment testing`);
        } else {
            console.warn('⚠️ Car position tracker not initialized');
        }
    };
    
    console.log('💡 Test alignment: toggleRacingLine(true) to show, toggleRacingLine(false) to hide');
});

