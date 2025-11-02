/**
 * Car Position Tracker Module
 * Displays real-time car position on SVG track map based on lap distance percentage
 */

export class CarPositionTracker {
    constructor(svgContainerId, options = {}) {
        this.svgContainerId = svgContainerId;
        this.options = {
            carRadius: options.carRadius || 12,
            carColor: options.carColor || '#06b6d4',  // Cyan
            carStroke: options.carStroke || '#0e7490',
            carStrokeWidth: options.carStrokeWidth || 3,
            trackLayerName: options.trackLayerName || 'active',
            showDebugInfo: options.showDebugInfo || false,
            ...options
        };
        
        this.svg = null;
        this.trackPath = null;
        this.totalLength = 0;
        this.carMarker = null;
        this.isInitialized = false;
        this.lastLapPct = null;
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
            
            // Find the track path (try active layer first, then background as fallback)
            this.trackPath = this.svg.querySelector(`#layer-${this.options.trackLayerName} path`);
            
            if (!this.trackPath) {
                // Fallback to background layer
                this.trackPath = this.svg.querySelector('#layer-background path');
            }
            
            if (!this.trackPath) {
                throw new Error('Track path not found in SVG');
            }
            
            // Calculate total path length
            this.totalLength = this.trackPath.getTotalLength();
            console.log(`📏 Track path total length: ${this.totalLength.toFixed(2)} units`);
            
            // Create car marker
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
        
        // Initialize at start line (0% lap distance)
        const startPoint = this.trackPath.getPointAtLength(0);
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
            // Calculate distance along the path
            const distance = (lapDistancePercentage / 100) * this.totalLength;
            
            // Get the point at that distance
            const point = this.trackPath.getPointAtLength(distance);
            
            // Update car marker position
            this.carMarker.setAttribute('cx', point.x);
            this.carMarker.setAttribute('cy', point.y);
            
            // Store last position for debugging
            this.lastLapPct = lapDistancePercentage;
            
            if (this.options.showDebugInfo && Math.random() < 0.01) {
                console.log(`🚗 Car position: ${lapDistancePercentage.toFixed(1)}% → (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
            }
            
        } catch (error) {
            console.error('❌ Failed to update car position:', error);
        }
    }
    
    /**
     * Change car color (e.g., when in pits)
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
        
        this.svg = null;
        this.trackPath = null;
        this.carMarker = null;
        this.isInitialized = false;
        
        console.log('🗑️ Car position tracker destroyed');
    }
}
