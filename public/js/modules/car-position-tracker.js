// ============================================================================
// DEBUG SYSTEM - Set to false to disable debug/info logging (errors/warnings always show)
// ============================================================================
const DEBUG = false;

// Debug helper functions
const debug = (...args) => { if (DEBUG) console.log(...args); };
const debugWarn = (...args) => { console.warn(...args); }; // Always show warnings
const debugError = (...args) => { console.error(...args); }; // Always show errors

/**
 * Car Position Tracker Module
 * Displays real-time car positions on SVG track map based on lap distance percentage
 * Supports multiple cars with dynamic class color assignment
 */

export class CarPositionTracker {
    constructor(svgContainerId, options = {}) {
        this.svgContainerId = svgContainerId;
        this.options = {
            carRadius: options.carRadius || 14,
            playerCarRadius: options.playerCarRadius || 20,  // Larger radius for player car
            playerCarColor: options.playerCarColor || '#00d9ffff',  // Cyan for player
            carStroke: options.carStroke || 'transparent',  // Transparent by default (on track)
            carStrokeWidth: options.carStrokeWidth || 3,
            showDebugInfo: options.showDebugInfo || false,
            showOnlyPlayerClass: options.showOnlyPlayerClass !== false,  // Default true
            showAllCars: options.showAllCars || false,  // Default false
            onCarClick: options.onCarClick || null,  // Callback when car marker is clicked
            ...options
        };
        
        // Fixed class color mapping for multiclass racing
        // GTP classes: 4029, 4074 → Yellow
        // LMP class: 2523 → Blue
        // GT3 classes: 4046, 4091, 4090, 4083, 4072, 4011 → Pink/Magenta
        // GT4 classes: 4088, 4084 → Green
        this.classColorMap = {
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
        
        this.defaultClassColor = '#9ca3af'; // Gray for unknown classes
        
        this.svg = null;
        this.carMarkers = new Map();  // Map of carIdx -> SVG circle element
        this.carCenterDots = new Map();  // Map of carIdx -> center dot element for selected cars
        this.classColors = new Map();  // Map of classId -> assigned color (now just for tracking)
        this.discoveredClasses = new Set();  // Set of all discovered class IDs
        this.isInitialized = false;
        this.playerCarIdx = null;
        this.playerCarClass = null;
        
        // Off-track incident tracking
        this.offTrackCounts = new Map();  // Map of carIdx -> count
        this.previousTrackSurface = new Map();  // Map of carIdx -> last track surface state
        
        // Stint and pit tracking
        this.stintLapCounts = new Map();  // Map of carIdx -> laps completed this stint
        this.previousOnPitRoad = new Map();  // Map of carIdx -> previous OnPitRoad state
        this.previousLapCompleted = new Map();  // Map of carIdx -> previous LapCompleted value
        this.lastPitDuration = new Map();  // Map of carIdx -> last pit stop duration in seconds
        this.pitEntryTime = new Map();  // Map of carIdx -> timestamp when entered pit stall
        
        // Selected car tracking (for car analysis UI)
        this.selectedCarIdx = null;
        
        // Racing line mode properties
        this.racingLinePoints = null;  // Array of {x, y} points from database
        this.racingLineLayer = null;   // SVG polyline element for racing line visualization
    }
    
    /**
     * Get color for a specific class using fixed class mapping
     * @param {number} classId - The class ID
     * @param {boolean} isPlayerClass - Whether this is the player's class
     * @returns {string} The color for this class
     */
    getClassColor(classId, isPlayerClass) {
        // Player's car always uses cyan (not the whole class, just player's specific car)
        // This is handled in getOrCreateCarMarker, not here
        
        // Check fixed class color map
        if (this.classColorMap.hasOwnProperty(classId)) {
            const color = this.classColorMap[classId];
            
            // Track this class (for info/debugging)
            if (!this.classColors.has(classId)) {
                this.classColors.set(classId, color);
                this.discoveredClasses.add(classId);
                
                if (this.options.showDebugInfo) {
                    debug(`🎨 Class ${classId} assigned color ${color} (fixed mapping)`);
                }
            }
            
            return color;
        }
        
        // Unknown class - use default gray
        if (!this.classColors.has(classId)) {
            this.classColors.set(classId, this.defaultClassColor);
            this.discoveredClasses.add(classId);
            debugWarn(`⚠️ Unknown class ${classId} - using default color ${this.defaultClassColor}`);
        }
        
        return this.defaultClassColor;
    }
    
    /**
     * Set racing line data from database
     * @param {Object} racingLineData - Racing line data with points array
     */
    setRacingLineData(racingLineData) {
        if (!racingLineData || !racingLineData.points || racingLineData.points.length === 0) {
            debugWarn('⚠️ Invalid racing line data provided');
            return false;
        }
        
        this.racingLinePoints = racingLineData.points;
        
        debug(`✅ Racing line data loaded: ${this.racingLinePoints.length} points`);
        
        return true;
    }
    
    /**
     * Initialize the car marker on the track
     * Must be called after track map is loaded
     */
    initialize() {
        try {
            // Find the SVG container
            const container = document.getElementById(this.svgContainerId);
            if (!container) {
                throw new Error(`SVG container '${this.svgContainerId}' not found`);
            }
            
            // Find the SVG element
            this.svg = container.querySelector('svg');
            if (!this.svg) {
                throw new Error('SVG element not found in container');
            }
            
            // Verify racing line data is loaded
            if (!this.racingLinePoints || this.racingLinePoints.length === 0) {
                throw new Error('Racing line data not loaded. Call setRacingLineData() first.');
            }
            
            debug('🏁 Initializing car tracker with racing line data');
            debug('  SVG container:', this.svgContainerId);
            debug('  Racing line points:', this.racingLinePoints.length);
            debug('  Show only player class:', this.options.showOnlyPlayerClass);
            debug('  Show all cars:', this.options.showAllCars);
            
            // Create racing line visualization layer (invisible initially)
            this.createRacingLineLayer();
            
            // No longer create markers upfront - they are created dynamically
            
            this.isInitialized = true;
            this.hasLoggedFirstUpdate = false;  // Reset logging flag
            debug('✅ Car position tracker initialized (multi-car mode)');
            debug('  Waiting for telemetry data to create car markers...');
            return true;
            
        } catch (error) {
            debugError('❌ Failed to initialize car position tracker:', error);
            this.isInitialized = false;
            return false;
        }
    }
    
    /**
     * Create racing line visualization layer (SVG polyline)
     */
    createRacingLineLayer() {
        if (!this.racingLinePoints || this.racingLinePoints.length === 0) {
            return;
        }
        
        // Convert points array to SVG polyline points string
        const pointsString = this.racingLinePoints
            .map(p => `${p.x},${p.y}`)
            .join(' ');
        
        // Create polyline element
        this.racingLineLayer = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        this.racingLineLayer.setAttribute('id', 'racing-line-overlay');
        this.racingLineLayer.setAttribute('points', pointsString);
        this.racingLineLayer.setAttribute('fill', 'none');
        this.racingLineLayer.setAttribute('stroke', '#10b981');  // Green
        this.racingLineLayer.setAttribute('stroke-width', '2');
        this.racingLineLayer.setAttribute('opacity', '0');  // Invisible initially
        this.racingLineLayer.style.pointerEvents = 'none';
        
        // Add to SVG (below car marker layer)
        this.svg.appendChild(this.racingLineLayer);
        
        debug('✅ Racing line layer created (invisible)');
    }
    
    /**
     * Toggle racing line visibility for alignment testing
     * @param {boolean} visible - Show or hide racing line
     */
    toggleRacingLineVisibility(visible) {
        if (this.racingLineLayer) {
            this.racingLineLayer.setAttribute('opacity', visible ? '0.8' : '0');
            debug(`🎨 Racing line ${visible ? 'visible' : 'hidden'}`);
        }
    }
    
    /**
     * Create or get a car marker for a specific car index
     * @param {number} carIdx - Car index
     * @param {boolean} isPlayer - Whether this is the player's car
     * @param {number} classId - The car's class ID
     * @returns {SVGCircleElement} The car marker element
     */
    getOrCreateCarMarker(carIdx, isPlayer, classId) {
        // Check if marker already exists
        if (this.carMarkers.has(carIdx)) {
            return this.carMarkers.get(carIdx);
        }
        
        // Create new car marker as a circle
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        marker.setAttribute('id', `car-marker-${carIdx}`);
        // Use larger radius for player car
        const radius = isPlayer ? this.options.playerCarRadius : this.options.carRadius;
        marker.setAttribute('r', radius);
        marker.setAttribute('stroke-width', this.options.carStrokeWidth);
        marker.setAttribute('opacity', '0.9');
        marker.style.transition = 'cx 0.1s linear, cy 0.1s linear';
        marker.style.cursor = 'pointer';  // Show pointer cursor on hover
        marker.setAttribute('data-car-idx', carIdx);
        marker.setAttribute('data-class-id', classId);
        
        // Add click handler if callback provided
        if (this.options.onCarClick) {
            marker.addEventListener('click', (e) => {
                e.stopPropagation();  // Prevent event bubbling
                this.options.onCarClick(carIdx);
            });
        }
        
        // Get color for this car's class
        // Only the PLAYER car gets the playerCarColor, not the whole class
        const fillColor = isPlayer ? this.options.playerCarColor : this.getClassColor(classId, false);
        marker.setAttribute('fill', fillColor);
        marker.setAttribute('stroke', this.options.carStroke);
        
        // Add pulsing animation for player car only
        if (isPlayer) {
            const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
            animate.setAttribute('attributeName', 'opacity');
            animate.setAttribute('values', '0.9;1;0.9');
            animate.setAttribute('dur', '2s');
            animate.setAttribute('repeatCount', 'indefinite');
            marker.appendChild(animate);
        }
        
        // Initialize at start/finish (first point in racing line)
        const startPoint = this.racingLinePoints[0];
        marker.setAttribute('cx', startPoint.x);
        marker.setAttribute('cy', startPoint.y);
        
        // Append to SVG
        this.svg.appendChild(marker);
        
        // Store in map
        this.carMarkers.set(carIdx, marker);
        
        // Create center dot for selection indicator (initially hidden)
        const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerDot.setAttribute('id', `car-center-dot-${carIdx}`);
        centerDot.setAttribute('r', this.options.carRadius / 3); // 1/3 of main marker size
        centerDot.setAttribute('fill', '#000000'); // Black dot
        centerDot.setAttribute('opacity', '0'); // Hidden by default
        centerDot.setAttribute('cx', startPoint.x);
        centerDot.setAttribute('cy', startPoint.y);
        centerDot.style.transition = 'cx 0.1s linear, cy 0.1s linear, opacity 0.2s';
        centerDot.style.pointerEvents = 'none'; // Don't block clicks
        
        this.svg.appendChild(centerDot);
        this.carCenterDots.set(carIdx, centerDot);
        
        debug(`✅ Created car marker: idx=${carIdx}, class=${classId}, color=${fillColor}, isPlayer=${isPlayer}, position=(${startPoint.x.toFixed(1)}, ${startPoint.y.toFixed(1)})`);
        
        return marker;
    }
    
    /**
     * Remove a car marker
     * @param {number} carIdx - Car index to remove
     */
    removeCarMarker(carIdx) {
        const marker = this.carMarkers.get(carIdx);
        if (marker && marker.parentNode) {
            marker.parentNode.removeChild(marker);
            this.carMarkers.delete(carIdx);
        }
        
        const centerDot = this.carCenterDots.get(carIdx);
        if (centerDot && centerDot.parentNode) {
            centerDot.parentNode.removeChild(centerDot);
            this.carCenterDots.delete(carIdx);
        }
    }
    
    /**
     * Update all car positions based on telemetry data
     * @param {Object} telemetryData - Full telemetry data object with CarIdx arrays
     */
    updateAllPositions(telemetryData) {
        if (!this.isInitialized) {
            debugWarn('⚠️ Car position tracker not initialized');
            return;
        }
        
        const {
            PlayerCarIdx,
            PlayerCarClass,
            CarIdxLapDistPct,
            CarIdxClass,
            CarIdxTrackSurface
        } = telemetryData;
        
        // Debug logging for first call
        if (!this.hasLoggedFirstUpdate) {
            debug('🔍 First car position update:');
            debug('  PlayerCarIdx:', PlayerCarIdx);
            debug('  PlayerCarClass:', PlayerCarClass);
            debug('  CarIdxLapDistPct length:', CarIdxLapDistPct?.length);
            debug('  CarIdxClass length:', CarIdxClass?.length);
            debug('  CarIdxTrackSurface:', CarIdxTrackSurface);
            debug('  CarIdxTrackSurface length:', CarIdxTrackSurface?.length);
            if (CarIdxTrackSurface && PlayerCarIdx != null) {
                debug('  Player track surface value:', CarIdxTrackSurface[PlayerCarIdx]);
            }
            debug('  showOnlyPlayerClass:', this.options.showOnlyPlayerClass);
            debug('  showAllCars:', this.options.showAllCars);
            this.hasLoggedFirstUpdate = true;
        }
        
        if (PlayerCarIdx == null || !CarIdxLapDistPct || !CarIdxClass) {
            debugWarn('⚠️ Missing required telemetry data:', {
                hasPlayerCarIdx: PlayerCarIdx != null,
                hasCarIdxLapDistPct: !!CarIdxLapDistPct,
                hasCarIdxClass: !!CarIdxClass
            });
            return;
        }
        
        // Store player info
        this.playerCarIdx = PlayerCarIdx;
        this.playerCarClass = PlayerCarClass;
        
        // Track which cars we've updated
        const activeCars = new Set();
        let carsProcessed = 0;
        let carsSkippedNoPosition = 0;
        let carsSkippedWrongClass = 0;
        
        try {
            // Loop through all cars
            for (let carIdx = 0; carIdx < CarIdxLapDistPct.length; carIdx++) {
                const lapDistPct = CarIdxLapDistPct[carIdx];
                const carClass = CarIdxClass[carIdx];
                
                // Skip if no valid position data or invalid class
                if (lapDistPct == null || isNaN(lapDistPct) || lapDistPct < 0) {
                    carsSkippedNoPosition++;
                    continue;
                }
                
                // Determine if we should show this car
                const isPlayer = carIdx === PlayerCarIdx;
                const isSameClass = carClass === PlayerCarClass;
                
                // Filter logic
                if (!isPlayer && this.options.showOnlyPlayerClass && !isSameClass) {
                    // Skip cars not in player's class
                    carsSkippedWrongClass++;
                    continue;
                }
                
                if (!isPlayer && !this.options.showAllCars && !this.options.showOnlyPlayerClass) {
                    // Skip non-player cars if not showing all
                    continue;
                }
                
                // Get or create marker for this car
                const marker = this.getOrCreateCarMarker(carIdx, isPlayer, carClass);
                activeCars.add(carIdx);
                carsProcessed++;
                
                // Calculate interpolated position
                const normalizedPct = lapDistPct; // Already 0-1 from telemetry
                const exactPosition = normalizedPct * this.racingLinePoints.length;
                
                const index1 = Math.floor(exactPosition) % this.racingLinePoints.length;
                const index2 = (index1 + 1) % this.racingLinePoints.length;
                const t = exactPosition - Math.floor(exactPosition);
                
                const point1 = this.racingLinePoints[index1];
                const point2 = this.racingLinePoints[index2];
                
                const interpolatedX = point1.x + (point2.x - point1.x) * t;
                const interpolatedY = point1.y + (point2.y - point1.y) * t;
                
                // Update marker position
                marker.setAttribute('cx', interpolatedX);
                marker.setAttribute('cy', interpolatedY);
                
                // Update center dot position if it exists
                const centerDot = this.carCenterDots.get(carIdx);
                if (centerDot) {
                    centerDot.setAttribute('cx', interpolatedX);
                    centerDot.setAttribute('cy', interpolatedY);
                }
                
                // Update stroke color based on track surface (all cars)
                if (CarIdxTrackSurface && CarIdxTrackSurface[carIdx] != null) {
                    const surfaceValue = CarIdxTrackSurface[carIdx];
                    this.setCarStrokeColor(marker, surfaceValue);
                    
                    // Track off-track incidents (detect transition to OffTrack)
                    this.trackOffTrackIncident(carIdx, surfaceValue);
                    
                    // Debug log occasionally for player car
                    if (isPlayer && Math.random() < 0.05) {
                        debug(`🎨 Player car (${carIdx}) track surface: ${surfaceValue}`);
                    }
                }
            }
            
            // Remove markers for cars that are no longer active
            for (const [carIdx, marker] of this.carMarkers.entries()) {
                if (!activeCars.has(carIdx)) {
                    this.removeCarMarker(carIdx);
                }
            }
            
            if (this.options.showDebugInfo || (carsProcessed === 0 && Math.random() < 0.1)) {
                debug(`🚗 Car tracking: ${carsProcessed} visible, ${carsSkippedWrongClass} wrong class, ${carsSkippedNoPosition} no position (Player class: ${PlayerCarClass})`);
            }
            
            // Remove markers for cars that are no longer active
            for (const [carIdx, marker] of this.carMarkers.entries()) {
                if (!activeCars.has(carIdx)) {
                    this.removeCarMarker(carIdx);
                }
            }
            
            if (this.options.showDebugInfo || (carsProcessed === 0 && Math.random() < 0.1)) {
                debug(`🚗 Car tracking: ${carsProcessed} visible, ${carsSkippedWrongClass} wrong class, ${carsSkippedNoPosition} no position (Player class: ${PlayerCarClass})`);
            }
            
        } catch (error) {
            debugError('❌ Failed to update car positions:', error);
        }
    }
    
    /**
     * Change car stroke color based on track surface status
     * @param {SVGCircleElement} marker - The car marker element
     * @param {number} trackSurface - Track surface enum value (irsdk_TrkLoc)
     * 
     * irsdk_TrkLoc enum values:
     * -1 = NotInWorld
     *  0 = OffTrack
     *  1 = InPitStall
     *  2 = AproachingPits
     *  3 = OnTrack
     */
    setCarStrokeColor(marker, trackSurface) {
        if (!marker) return;
        
        let strokeColor;
        
        // Handle both numeric and string values from telemetry
        switch(trackSurface) {
            case -1:
            case 'NotInWorld':
                strokeColor = '#6b7280'; // Gray
                break;
            case 0:
            case 'OffTrack':
                strokeColor = '#dc2626'; // Red
                break;
            case 1:
            case 'InPitStall':
                strokeColor = '#f97316'; // Orange
                break;
            case 2:
            case 'AproachingPits':
                strokeColor = '#facc15'; // Yellow
                break;
            case 3:
            case 'OnTrack':
                strokeColor = 'transparent'; // Transparent - normal racing
                break;
            default:
                strokeColor = 'transparent'; // Transparent - default
        }
        
        marker.setAttribute('stroke', strokeColor);
    }
    
    /**
     * Track off-track incidents by detecting transitions to OffTrack state
     * @param {number} carIdx - Car index
     * @param {number|string} currentSurface - Current track surface value
     */
    trackOffTrackIncident(carIdx, currentSurface) {
        // Initialize counter if this is first time seeing this car
        if (!this.offTrackCounts.has(carIdx)) {
            this.offTrackCounts.set(carIdx, 0);
        }
        
        // Get previous state
        const previousSurface = this.previousTrackSurface.get(carIdx);
        
        // Detect transition TO OffTrack (0 or 'OffTrack')
        const isNowOffTrack = currentSurface === 0 || currentSurface === 'OffTrack';
        const wasOffTrack = previousSurface === 0 || previousSurface === 'OffTrack';
        
        // Increment counter if transitioning from any other state to OffTrack
        if (isNowOffTrack && !wasOffTrack && previousSurface !== undefined) {
            const newCount = this.offTrackCounts.get(carIdx) + 1;
            this.offTrackCounts.set(carIdx, newCount);
            
            if (this.options.showDebugInfo) {
                debug(`🚨 Car ${carIdx} went off-track (incident #${newCount})`);
            }
        }
        
        // Store current state for next comparison
        this.previousTrackSurface.set(carIdx, currentSurface);
    }
    
    /**
     * Get off-track incident count for a specific car
     * @param {number} carIdx - Car index
     * @returns {number} Number of off-track incidents
     */
    getOffTrackCount(carIdx) {
        return this.offTrackCounts.get(carIdx) || 0;
    }
    
    /**
     * Set car appearance based on track surface material
     * Uses iRacing CarIdxTrackSurfaceMaterial enum (irsdk_TrkSurf)
     * @param {number} surfaceMaterial - Surface material type
     * 
     * irsdk_TrkSurf enum values:
     * 0 = SurfaceNotInWorld
     * 1 = UndefinedMaterial
     * 2 = Asphalt1Material
     * 3 = Asphalt2Material
     * 4 = Asphalt3Material
     * 5 = Asphalt4Material
     * 6 = Concrete1Material
     * 7 = Concrete2Material
     * 8 = RacingDirt1Material
     * 9 = RacingDirt2Material
     * 10 = Paint1Material
     * 11 = Paint2Material
     * 12 = Rumble1Material
     * 13 = Rumble2Material
     * 14 = Rumble3Material
     * 15 = Rumble4Material
     * 16 = Grass1Material
     * 17 = Grass2Material
     * 18 = Grass3Material
     * 19 = Grass4Material
     * 20 = Dirt1Material
     * 21 = Dirt2Material
     * 22 = Dirt3Material
     * 23 = Dirt4Material
     * 24 = SandMaterial
     * 25 = Gravel1Material
     * 26 = Gravel2Material
     * 27 = GrasscreteMaterial
     * 28 = AstroturfMaterial
     */
    setTrackSurfaceMaterial(surfaceMaterial) {
        if (!this.carMarker) return;
        
        // Categorize materials into groups with distinct colors
        if (surfaceMaterial >= 2 && surfaceMaterial <= 5) {
            // Asphalt - transparent (normal racing surface)
            this.setCarStrokeColor('transparent');
        } else if (surfaceMaterial >= 6 && surfaceMaterial <= 7) {
            // Concrete - transparent (normal racing surface)
            this.setCarStrokeColor('transparent');
        } else if (surfaceMaterial >= 8 && surfaceMaterial <= 9) {
            // Racing dirt - brown
            this.setCarStrokeColor('#92400e');
        } else if (surfaceMaterial >= 10 && surfaceMaterial <= 11) {
            // Paint (pit lane markings) - orange
            this.setCarStrokeColor('#f97316');
        } else if (surfaceMaterial >= 12 && surfaceMaterial <= 15) {
            // Rumble strips - yellow
            this.setCarStrokeColor('#eab308');
        } else if (surfaceMaterial >= 16 && surfaceMaterial <= 19) {
            // Grass - green
            this.setCarStrokeColor('#16a34a');
        } else if (surfaceMaterial >= 20 && surfaceMaterial <= 26) {
            // Dirt/Sand/Gravel - red (off track)
            this.setCarStrokeColor('#dc2626');
        } else if (surfaceMaterial === 27 || surfaceMaterial === 28) {
            // Grasscrete/Astroturf - light green
            this.setCarStrokeColor('#22c55e');
        } else {
            // Not in world / undefined - gray
            this.setCarStrokeColor('#6b7280');
        }
    }
    
    /**
     * Change car fill color (DEPRECATED - use setTrackSurface/Material instead)
     * Kept for backward compatibility
     * @param {string} color - CSS color string
     */
    setCarColor(color) {
        if (this.carMarker) {
            this.carMarker.setAttribute('fill', color);
        }
    }
    
    /**
     * Show/hide the car marker
     * @param {boolean} visible
     */
    setVisible(visible) {
        if (this.carMarker) {
            this.carMarker.style.display = visible ? 'block' : 'none';
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Remove all car markers
        for (const [carIdx, marker] of this.carMarkers.entries()) {
            if (marker && marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
        }
        this.carMarkers.clear();
        
        if (this.racingLineLayer && this.racingLineLayer.parentNode) {
            this.racingLineLayer.parentNode.removeChild(this.racingLineLayer);
        }
        
        this.svg = null;
        this.racingLineLayer = null;
        this.racingLinePoints = null;
        this.classColors.clear();
        this.discoveredClasses.clear();
        this.isInitialized = false;
        
        debug('🗑️ Car position tracker destroyed');
    }
    
    /**
     * Get information about discovered classes
     * @returns {Array} Array of {classId, color, carCount} objects
     */
    getClassInfo() {
        const classInfo = [];
        const classCounts = new Map();
        
        // Count cars per class
        for (const marker of this.carMarkers.values()) {
            const classId = parseInt(marker.getAttribute('data-class-id'));
            classCounts.set(classId, (classCounts.get(classId) || 0) + 1);
        }
        
        // Build info array
        for (const [classId, color] of this.classColors.entries()) {
            classInfo.push({
                classId,
                color,
                carCount: classCounts.get(classId) || 0,
                isPlayerClass: classId === this.playerCarClass
            });
        }
        
        return classInfo.sort((a, b) => a.classId - b.classId);
    }
    
    /**
     * Set the selected car for analysis UI highlighting
     * Shows a black center dot on the selected car's marker
     * @param {number|null} carIdx - Car index to select, or null to clear selection
     */
    setSelectedCar(carIdx) {
        // Hide previous selection's center dot
        if (this.selectedCarIdx !== null) {
            const prevDot = this.carCenterDots.get(this.selectedCarIdx);
            if (prevDot) {
                prevDot.setAttribute('opacity', '0');
            }
        }
        
        // Update selected car
        this.selectedCarIdx = carIdx;
        
        // Show new selection's center dot
        if (carIdx !== null) {
            const newDot = this.carCenterDots.get(carIdx);
            if (newDot) {
                newDot.setAttribute('opacity', '1');
                
                if (this.options.showDebugInfo) {
                    debug(`🎯 Selected car ${carIdx} on track map`);
                }
            }
        }
    }
}

