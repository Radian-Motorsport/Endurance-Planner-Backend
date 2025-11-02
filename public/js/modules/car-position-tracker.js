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
        this.startFinishOffset = 0;  // Distance along path where start/finish line is located
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
            
            // Find start/finish line offset
            this.calculateStartFinishOffset();
            
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
     * Calculate the offset distance along the track path where the start/finish line is located
     */
    calculateStartFinishOffset() {
        try {
            // Find the start-finish layer
            const startFinishLayer = this.svg.querySelector('#layer-start-finish');
            
            if (!startFinishLayer) {
                console.warn('⚠️ Start/finish layer not found, using 0 offset');
                this.startFinishOffset = 0;
                return;
            }
            
            // Look for red line element (path or line)
            let startFinishElement = startFinishLayer.querySelector('path[style*="ff0000"], path[stroke*="ff0000"], path[stroke*="#ff0000"]');
            if (!startFinishElement) {
                startFinishElement = startFinishLayer.querySelector('line[style*="ff0000"], line[stroke*="ff0000"], line[stroke*="#ff0000"]');
            }
            if (!startFinishElement) {
                startFinishElement = startFinishLayer.querySelector('path[style*="red"], line[style*="red"]');
            }
            
            if (!startFinishElement) {
                console.warn('⚠️ Start/finish line element not found, using 0 offset');
                this.startFinishOffset = 0;
                return;
            }
            
            // Get midpoint of the start/finish line
            let midpointX, midpointY;
            
            if (startFinishElement.tagName === 'line') {
                const x1 = parseFloat(startFinishElement.getAttribute('x1')) || 0;
                const y1 = parseFloat(startFinishElement.getAttribute('y1')) || 0;
                const x2 = parseFloat(startFinishElement.getAttribute('x2')) || 0;
                const y2 = parseFloat(startFinishElement.getAttribute('y2')) || 0;
                midpointX = (x1 + x2) / 2;
                midpointY = (y1 + y2) / 2;
            } else if (startFinishElement.tagName === 'path') {
                // For path, get the point at 50% of its length
                const lineLength = startFinishElement.getTotalLength();
                const midpoint = startFinishElement.getPointAtLength(lineLength / 2);
                midpointX = midpoint.x;
                midpointY = midpoint.y;
            } else {
                console.warn('⚠️ Unknown start/finish element type, using 0 offset');
                this.startFinishOffset = 0;
                return;
            }
            
            console.log(`🎯 Start/finish line midpoint: (${midpointX.toFixed(2)}, ${midpointY.toFixed(2)})`);
            
            // Find the closest point on the track path to this midpoint
            let closestDistance = Infinity;
            let closestPathDistance = 0;
            const sampleRate = 10; // Check every 10 units along the path
            
            for (let dist = 0; dist <= this.totalLength; dist += sampleRate) {
                const point = this.trackPath.getPointAtLength(dist);
                const dx = point.x - midpointX;
                const dy = point.y - midpointY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPathDistance = dist;
                }
            }
            
            // Refine the search around the closest point (fine-tune with 0.5 unit precision)
            const searchRange = sampleRate;
            for (let dist = Math.max(0, closestPathDistance - searchRange); 
                 dist <= Math.min(this.totalLength, closestPathDistance + searchRange); 
                 dist += 0.5) {
                const point = this.trackPath.getPointAtLength(dist);
                const dx = point.x - midpointX;
                const dy = point.y - midpointY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPathDistance = dist;
                }
            }
            
            this.startFinishOffset = closestPathDistance;
            console.log(`✅ Start/finish offset calculated: ${this.startFinishOffset.toFixed(2)} units (${((this.startFinishOffset / this.totalLength) * 100).toFixed(1)}% of track)`);
            
        } catch (error) {
            console.error('❌ Error calculating start/finish offset:', error);
            this.startFinishOffset = 0;
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
        
        // Initialize at start/finish line (applying offset)
        const startPoint = this.trackPath.getPointAtLength(this.startFinishOffset);
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
            // Calculate distance along the path (applying start/finish offset)
            // LapDistPct from telemetry: 0% = start/finish, 100% = back at start/finish
            const adjustedDistance = (lapDistancePercentage / 100) * this.totalLength + this.startFinishOffset;
            
            // Wrap around if we exceed total length
            const wrappedDistance = adjustedDistance % this.totalLength;
            
            // Get the point at that distance
            const point = this.trackPath.getPointAtLength(wrappedDistance);
            
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
