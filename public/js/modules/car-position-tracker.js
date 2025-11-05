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
            playerCarColor: options.playerCarColor || '#06b6d4',  // Cyan for player
            carStroke: options.carStroke || 'transparent',  // Transparent by default (on track)
            carStrokeWidth: options.carStrokeWidth || 3,
            showDebugInfo: options.showDebugInfo || false,
            showOnlyPlayerClass: options.showOnlyPlayerClass !== false,  // Default true
            showAllCars: options.showAllCars || false,  // Default false
            ...options
        };
        
        // Dynamic class color palette - vibrant, distinct colors for multiclass racing
        this.classColorPalette = [
            '#10b981', // Green
            '#f59e0b', // Amber
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#3b82f6', // Blue
            '#ef4444', // Red
            '#14b8a6', // Teal
            '#f97316', // Orange
            '#06b6d4', // Cyan (alternate)
            '#a855f7', // Violet
            '#84cc16', // Lime
            '#f43f5e', // Rose
        ];
        
        this.svg = null;
        this.carMarkers = new Map();  // Map of carIdx -> SVG circle element
        this.classColors = new Map();  // Map of classId -> assigned color
        this.discoveredClasses = new Set();  // Set of all discovered class IDs
        this.isInitialized = false;
        this.playerCarIdx = null;
        this.playerCarClass = null;
        
        // Racing line mode properties
        this.racingLinePoints = null;  // Array of {x, y} points from database
        this.racingLineLayer = null;   // SVG polyline element for racing line visualization
    }
    
    /**
     * Get color for a specific class, assigning one if not yet discovered
     * @param {number} classId - The class ID
     * @param {boolean} isPlayerClass - Whether this is the player's class
     * @returns {string} The color for this class
     */
    getClassColor(classId, isPlayerClass) {
        // Player's class always uses player color
        if (isPlayerClass) {
            return this.options.playerCarColor;
        }
        
        // Check if we've already assigned a color to this class
        if (this.classColors.has(classId)) {
            return this.classColors.get(classId);
        }
        
        // Assign next available color from palette
        const colorIndex = this.discoveredClasses.size % this.classColorPalette.length;
        const assignedColor = this.classColorPalette[colorIndex];
        
        this.classColors.set(classId, assignedColor);
        this.discoveredClasses.add(classId);
        
        if (this.options.showDebugInfo) {
            console.log(`🎨 Assigned color ${assignedColor} to class ${classId} (${this.discoveredClasses.size} classes total)`);
        }
        
        return assignedColor;
    }
    
    /**
     * Set racing line data from database
     * @param {Object} racingLineData - Racing line data with points array
     */
    setRacingLineData(racingLineData) {
        if (!racingLineData || !racingLineData.points || racingLineData.points.length === 0) {
            console.warn('⚠️ Invalid racing line data provided');
            return false;
        }
        
        this.racingLinePoints = racingLineData.points;
        
        console.log(`✅ Racing line data loaded: ${this.racingLinePoints.length} points`);
        
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
            
            console.log('🏁 Initializing car tracker with racing line data');
            
            // Create racing line visualization layer (invisible initially)
            this.createRacingLineLayer();
            
            // Create car marker at start position
            this.createCarMarker();
            
            this.isInitialized = true;
            console.log('✅ Car position tracker initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize car position tracker:', error);
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
        
        console.log('✅ Racing line layer created (invisible)');
    }
    
    /**
     * Toggle racing line visibility for alignment testing
     * @param {boolean} visible - Show or hide racing line
     */
    toggleRacingLineVisibility(visible) {
        if (this.racingLineLayer) {
            this.racingLineLayer.setAttribute('opacity', visible ? '0.8' : '0');
            console.log(`🎨 Racing line ${visible ? 'visible' : 'hidden'}`);
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
        marker.setAttribute('r', this.options.carRadius);
        marker.setAttribute('stroke-width', this.options.carStrokeWidth);
        marker.setAttribute('opacity', '0.9');
        marker.style.transition = 'cx 0.1s linear, cy 0.1s linear';
        marker.setAttribute('data-car-idx', carIdx);
        marker.setAttribute('data-class-id', classId);
        
        // Get color for this car's class
        const isSameClass = classId === this.playerCarClass;
        const fillColor = this.getClassColor(classId, isSameClass);
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
    }
    
    /**
     * Update all car positions based on telemetry data
     * @param {Object} telemetryData - Full telemetry data object with CarIdx arrays
     */
    updateAllPositions(telemetryData) {
        if (!this.isInitialized) {
            console.warn('⚠️ Car position tracker not initialized');
            return;
        }
        
        const {
            PlayerCarIdx,
            PlayerCarClass,
            CarIdxLapDistPct,
            CarIdxClass,
            CarIdxTrackSurface
        } = telemetryData;
        
        if (!PlayerCarIdx == null || !CarIdxLapDistPct || !CarIdxClass) {
            return;
        }
        
        // Store player info
        this.playerCarIdx = PlayerCarIdx;
        this.playerCarClass = PlayerCarClass;
        
        // Track which cars we've updated
        const activeCars = new Set();
        
        try {
            // Loop through all cars
            for (let carIdx = 0; carIdx < CarIdxLapDistPct.length; carIdx++) {
                const lapDistPct = CarIdxLapDistPct[carIdx];
                const carClass = CarIdxClass[carIdx];
                
                // Skip if no valid position data or invalid class
                if (lapDistPct == null || isNaN(lapDistPct) || lapDistPct < 0) {
                    continue;
                }
                
                // Determine if we should show this car
                const isPlayer = carIdx === PlayerCarIdx;
                const isSameClass = carClass === PlayerCarClass;
                
                // Filter logic
                if (!isPlayer && this.options.showOnlyPlayerClass && !isSameClass) {
                    // Skip cars not in player's class
                    continue;
                }
                
                if (!isPlayer && !this.options.showAllCars && !this.options.showOnlyPlayerClass) {
                    // Skip non-player cars if not showing all
                    continue;
                }
                
                // Get or create marker for this car
                const marker = this.getOrCreateCarMarker(carIdx, isPlayer, carClass);
                activeCars.add(carIdx);
                
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
                
                // Update stroke color based on track surface (player car only)
                if (isPlayer && CarIdxTrackSurface && CarIdxTrackSurface[carIdx] != null) {
                    this.setCarStrokeColor(marker, CarIdxTrackSurface[carIdx]);
                }
            }
            
            // Remove markers for cars that are no longer active
            for (const [carIdx, marker] of this.carMarkers.entries()) {
                if (!activeCars.has(carIdx)) {
                    this.removeCarMarker(carIdx);
                }
            }
            
            if (this.options.showDebugInfo && Math.random() < 0.01) {
                console.log(`🚗 Tracking ${activeCars.size} cars (Player class: ${PlayerCarClass})`);
            }
            
        } catch (error) {
            console.error('❌ Failed to update car positions:', error);
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
        
        switch(trackSurface) {
            case -1: // NotInWorld
                strokeColor = '#6b7280'; // Gray
                break;
            case 0: // OffTrack
                strokeColor = '#dc2626'; // Red
                break;
            case 1: // InPitStall
                strokeColor = '#f97316'; // Orange
                break;
            case 2: // AproachingPits
                strokeColor = '#facc15'; // Yellow
                break;
            case 3: // OnTrack
                strokeColor = 'transparent'; // Transparent - normal racing
                break;
            default:
                strokeColor = 'transparent'; // Transparent - default
        }
        
        marker.setAttribute('stroke', strokeColor);
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
        
        console.log('🗑️ Car position tracker destroyed');
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
}

