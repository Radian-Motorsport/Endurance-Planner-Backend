/**
 * Car Position Tracker Module
 * Displays real-time car position on SVG track map based on lap distance percentage
 */

export class CarPositionTracker {
    constructor(svgContainerId, options = {}) {
        this.svgContainerId = svgContainerId;
        this.options = {
            carRadius: options.carRadius || 14,
            carColor: options.carColor || '#06b6d4',  // Cyan
            carStroke: options.carStroke || '#0e7490',
            carStrokeWidth: options.carStrokeWidth || 3,
            showDebugInfo: options.showDebugInfo || false,
            ...options
        };
        
        this.svg = null;
        this.carMarker = null;
        this.isInitialized = false;
        this.lastLapPct = null;
        
        // Racing line mode properties
        this.racingLinePoints = null;  // Array of {x, y} points from database
        this.racingLineLayer = null;   // SVG polyline element for racing line visualization
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
     * Create the SVG car marker element
     */
    createCarMarker() {
        // Create car marker as a circle
        this.carMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.carMarker.setAttribute('id', 'car-position-marker');
        this.carMarker.setAttribute('r', this.options.carRadius);
        this.carMarker.setAttribute('fill', this.options.carColor);
        this.carMarker.setAttribute('stroke', this.options.carStroke);
        this.carMarker.setAttribute('stroke-width', this.options.carStrokeWidth);
        this.carMarker.setAttribute('opacity', '0.9');
        this.carMarker.style.transition = 'cx 0.1s linear, cy 0.1s linear';
        
        // Initialize at start/finish (first point in racing line)
        const startPoint = this.racingLinePoints[0];
        this.carMarker.setAttribute('cx', startPoint.x);
        this.carMarker.setAttribute('cy', startPoint.y);
        
        // Add pulsing animation
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'opacity');
        animate.setAttribute('values', '0.9;1;0.9');
        animate.setAttribute('dur', '2s');
        animate.setAttribute('repeatCount', 'indefinite');
        this.carMarker.appendChild(animate);
        
        // Append to SVG (on top of everything)
        this.svg.appendChild(this.carMarker);
        
        console.log('✅ Car marker created at start line');
    }
    
    /**
     * Update car position based on lap distance percentage
     * @param {number} lapDistancePercentage - 0-100% around the lap
     */
    updatePosition(lapDistancePercentage) {
        if (!this.isInitialized) {
            console.warn('⚠️ Car position tracker not initialized');
            return;
        }
        
        if (lapDistancePercentage == null || isNaN(lapDistancePercentage)) {
            return;
        }
        
        try {
            // Convert 0-100% to exact position in array (with decimals for interpolation)
            const normalizedPct = lapDistancePercentage / 100; // 0 to 1
            const exactPosition = normalizedPct * this.racingLinePoints.length;
            
            // Get the two surrounding points for interpolation
            const index1 = Math.floor(exactPosition) % this.racingLinePoints.length;
            const index2 = (index1 + 1) % this.racingLinePoints.length;
            
            // Calculate interpolation factor (0 to 1 between the two points)
            const t = exactPosition - Math.floor(exactPosition);
            
            // Get the two points
            const point1 = this.racingLinePoints[index1];
            const point2 = this.racingLinePoints[index2];
            
            // Linear interpolation between the two points
            const interpolatedX = point1.x + (point2.x - point1.x) * t;
            const interpolatedY = point1.y + (point2.y - point1.y) * t;
            
            if (this.options.showDebugInfo && Math.random() < 0.01) {
                console.log(`🚗 Car position: ${lapDistancePercentage.toFixed(1)}% → interpolating between ${index1}-${index2} (t=${t.toFixed(3)}) → (${interpolatedX.toFixed(1)}, ${interpolatedY.toFixed(1)})`);
            }
            
            // Update car marker position with interpolated coordinates
            this.carMarker.setAttribute('cx', interpolatedX);
            this.carMarker.setAttribute('cy', interpolatedY);
            
            // Store last position for debugging
            this.lastLapPct = lapDistancePercentage;
            
        } catch (error) {
            console.error('❌ Failed to update car position:', error);
        }
    }
    
    /**
     * Change car stroke color based on status (e.g., pit lane, track surface)
     * @param {string} color - CSS color string for the outer ring
     */
    setCarStrokeColor(color) {
        if (this.carMarker) {
            this.carMarker.setAttribute('stroke', color);
        }
    }
    
    /**
     * Set car appearance based on track surface location
     * Uses iRacing CarIdxTrackSurface enum (irsdk_TrkLoc)
     * @param {number} trackSurface - Track surface type
     * 
     * irsdk_TrkLoc enum values:
     * -1 = NotInWorld
     *  0 = OffTrack
     *  1 = InPitStall
     *  2 = AproachingPits
     *  3 = OnTrack
     */
    setTrackSurface(trackSurface) {
        if (!this.carMarker) return;
        
        switch(trackSurface) {
            case -1: // NotInWorld
                this.setCarStrokeColor('#6b7280'); // Gray
                break;
            case 0: // OffTrack
                this.setCarStrokeColor('#dc2626'); // Red
                break;
            case 1: // InPitStall
                this.setCarStrokeColor('#f97316'); // Orange
                break;
            case 2: // AproachingPits
                this.setCarStrokeColor('#facc15'); // Yellow
                break;
            case 3: // OnTrack
                this.setCarStrokeColor('#0e7490'); // Default cyan stroke
                break;
            default:
                this.setCarStrokeColor('#0e7490'); // Default cyan stroke
        }
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
            // Asphalt - default cyan (on track)
            this.setCarStrokeColor('#0e7490');
        } else if (surfaceMaterial >= 6 && surfaceMaterial <= 7) {
            // Concrete - light blue
            this.setCarStrokeColor('#06b6d4');
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
        if (this.carMarker && this.carMarker.parentNode) {
            this.carMarker.parentNode.removeChild(this.carMarker);
        }
        
        if (this.racingLineLayer && this.racingLineLayer.parentNode) {
            this.racingLineLayer.parentNode.removeChild(this.racingLineLayer);
        }
        
        this.svg = null;
        this.trackPath = null;
        this.carMarker = null;
        this.racingLineLayer = null;
        this.racingLinePoints = null;
        this.isInitialized = false;
        
        console.log('🗑️ Car position tracker destroyed');
    }
}
