/**
 * FuelComparisonChart - Real-time fuel consumption comparison vs ideal lap
 * 
 * Displays:
 * - Ideal fuel trace (green line) - loaded from database
 * - Live fuel trace (cyan line) - current lap overlay
 * - Delta indicator - fuel difference vs ideal at current position
 */

export class FuelComparisonChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn('FuelComparisonChart: Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Configuration
        this.options = {
            idealColor: options.idealColor || '#10b981',      // Green
            liveColor: options.liveColor || '#06b6d4',        // Cyan
            gridColor: options.gridColor || '#374151',        // Gray
            textColor: options.textColor || '#9ca3af',        // Light gray
            deltaPositiveColor: options.deltaPositiveColor || '#10b981',  // Green (using less fuel)
            deltaNegativeColor: options.deltaNegativeColor || '#ef4444',  // Red (using more fuel)
            padding: options.padding || 40,
            ...options
        };
        
        // Data
        this.idealData = null;          // Array of 101 samples from database
        this.liveData = [];             // Current lap samples
        this.currentLapDistPct = 0;     // Current position (0-100)
        this.currentFuelLevel = 0;      // Current fuel level
        this.lapStartFuel = null;       // Fuel at lap start
        this.lastLapDistPct = 0;        // Track lap boundary
        
        // Chart bounds
        this.chartArea = {
            x: this.options.padding,
            y: this.options.padding,
            width: this.canvas.width - (this.options.padding * 2),
            height: this.canvas.height - (this.options.padding * 2)
        };
        
        // Start rendering
        this.render();
    }
    
    /**
     * Load ideal lap data from database
     */
    async loadIdealLap(trackId, carName) {
        try {
            console.log(`🔍 Loading ideal lap: Track ${trackId}, Car ${carName}`);
            
            const response = await fetch(`/api/ideal-fuel-lap/${trackId}/${encodeURIComponent(carName)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.idealData = data.samples;
                console.log(`✅ Ideal lap loaded: ${this.idealData.length} samples`);
                this.render();
                return true;
            } else if (response.status === 404) {
                console.log('📭 No ideal lap found for this track/car');
                this.idealData = null;
                this.render();
                return false;
            } else {
                console.warn('⚠️ Failed to load ideal lap:', response.status);
                return false;
            }
        } catch (err) {
            console.error('❌ Error loading ideal lap:', err);
            return false;
        }
    }
    
    /**
     * Update live telemetry
     */
    updateLive(lapDistPct, fuelLevel) {
        // Convert to percentage (0-100)
        const pct = lapDistPct * 100;
        
        // Detect lap start (crossing from high to low)
        const crossedStart = this.lastLapDistPct > 90 && pct < 10;
        if (crossedStart) {
            // New lap started - reset live data
            this.liveData = [];
            this.lapStartFuel = fuelLevel;
            console.log('🔄 New lap started, fuel:', fuelLevel.toFixed(2));
        }
        
        this.currentLapDistPct = pct;
        this.currentFuelLevel = fuelLevel;
        this.lastLapDistPct = pct;
        
        // Record sample for live trace
        if (this.lapStartFuel !== null) {
            const bucket = Math.floor(pct);
            // Only add if this bucket doesn't exist yet
            if (!this.liveData.find(d => d.pct === bucket)) {
                this.liveData.push({
                    pct: bucket,
                    fuelLevel: fuelLevel
                });
            }
        }
    }
    
    /**
     * Calculate delta vs ideal at current position
     */
    getDelta() {
        if (!this.idealData || this.lapStartFuel === null) return null;
        
        const bucket = Math.floor(this.currentLapDistPct);
        const idealSample = this.idealData.find(s => s.pct === bucket);
        
        if (!idealSample) return null;
        
        // Calculate fuel used so far
        const liveUsed = this.lapStartFuel - this.currentFuelLevel;
        const idealUsed = this.idealData[0].fuelLevel - idealSample.fuelLevel;
        
        // Positive delta = using less fuel than ideal (good)
        // Negative delta = using more fuel than ideal (bad)
        return idealUsed - liveUsed;
    }
    
    /**
     * Render chart
     */
    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid and axes
        this.drawGrid();
        
        // Draw ideal trace if available
        if (this.idealData && this.idealData.length > 0) {
            this.drawIdealTrace();
        } else {
            this.drawNoDataMessage();
        }
        
        // Draw live trace if recording
        if (this.liveData.length > 0) {
            this.drawLiveTrace();
        }
        
        // Draw current position marker
        if (this.currentLapDistPct > 0 && this.lapStartFuel !== null) {
            this.drawPositionMarker();
        }
        
        // Draw delta indicator
        const delta = this.getDelta();
        if (delta !== null) {
            this.drawDeltaIndicator(delta);
        }
        
        // Continue rendering
        requestAnimationFrame(() => this.render());
    }
    
    /**
     * Draw grid and axes
     */
    drawGrid() {
        const { x, y, width, height } = this.chartArea;
        
        this.ctx.strokeStyle = this.options.gridColor;
        this.ctx.lineWidth = 1;
        
        // Vertical grid lines (every 10%)
        for (let i = 0; i <= 10; i++) {
            const xPos = x + (width * i / 10);
            this.ctx.beginPath();
            this.ctx.moveTo(xPos, y);
            this.ctx.lineTo(xPos, y + height);
            this.ctx.stroke();
        }
        
        // Horizontal grid lines (5 lines)
        for (let i = 0; i <= 5; i++) {
            const yPos = y + (height * i / 5);
            this.ctx.beginPath();
            this.ctx.moveTo(x, yPos);
            this.ctx.lineTo(x + width, yPos);
            this.ctx.stroke();
        }
        
        // Axes labels
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        
        // X-axis labels (lap distance %)
        for (let i = 0; i <= 10; i++) {
            const xPos = x + (width * i / 10);
            const label = `${i * 10}%`;
            this.ctx.fillText(label, xPos, this.canvas.height - 10);
        }
        
        // Y-axis label
        this.ctx.save();
        this.ctx.translate(15, this.canvas.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Fuel Level (L)', 0, 0);
        this.ctx.restore();
    }
    
    /**
     * Draw ideal fuel trace
     */
    drawIdealTrace() {
        if (!this.idealData || this.idealData.length === 0) return;
        
        const { x, y, width, height } = this.chartArea;
        
        // Find fuel range for scaling
        const fuelLevels = this.idealData.map(s => s.fuelLevel).filter(f => f !== null);
        const minFuel = Math.min(...fuelLevels);
        const maxFuel = Math.max(...fuelLevels);
        const fuelRange = maxFuel - minFuel;
        
        this.ctx.strokeStyle = this.options.idealColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.idealData) {
            if (sample.fuelLevel === null) continue;
            
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + height - ((sample.fuelLevel - minFuel) / fuelRange) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.idealColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Ideal', x + 10, y + 20);
    }
    
    /**
     * Draw live fuel trace
     */
    drawLiveTrace() {
        if (this.liveData.length === 0 || !this.idealData) return;
        
        const { x, y, width, height } = this.chartArea;
        
        // Use same fuel range as ideal for proper comparison
        const fuelLevels = this.idealData.map(s => s.fuelLevel).filter(f => f !== null);
        const minFuel = Math.min(...fuelLevels);
        const maxFuel = Math.max(...fuelLevels);
        const fuelRange = maxFuel - minFuel;
        
        this.ctx.strokeStyle = this.options.liveColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.liveData) {
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + height - ((sample.fuelLevel - minFuel) / fuelRange) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.liveColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Live', x + 80, y + 20);
    }
    
    /**
     * Draw current position marker
     */
    drawPositionMarker() {
        if (!this.idealData) return;
        
        const { x, y, width, height } = this.chartArea;
        
        // Use same fuel range as ideal
        const fuelLevels = this.idealData.map(s => s.fuelLevel).filter(f => f !== null);
        const minFuel = Math.min(...fuelLevels);
        const maxFuel = Math.max(...fuelLevels);
        const fuelRange = maxFuel - minFuel;
        
        const xPos = x + (width * this.currentLapDistPct / 100);
        const yPos = y + height - ((this.currentFuelLevel - minFuel) / fuelRange) * height;
        
        // Draw marker dot
        this.ctx.fillStyle = this.options.liveColor;
        this.ctx.beginPath();
        this.ctx.arc(xPos, yPos, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw vertical line
        this.ctx.strokeStyle = this.options.liveColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(xPos, y);
        this.ctx.lineTo(xPos, y + height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    /**
     * Draw delta indicator
     */
    drawDeltaIndicator(delta) {
        const color = delta > 0 ? this.options.deltaPositiveColor : this.options.deltaNegativeColor;
        const sign = delta > 0 ? '-' : '+';  // Inverted: positive delta = using less = good
        const text = `${sign}${Math.abs(delta).toFixed(2)} L vs Ideal`;
        
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 14px Inter, sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(text, this.canvas.width - this.options.padding - 10, this.options.padding + 20);
    }
    
    /**
     * Draw no data message
     */
    drawNoDataMessage() {
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            'No ideal lap recorded for this track/car',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.fillText(
            'Record an ideal lap to enable comparison',
            this.canvas.width / 2,
            this.canvas.height / 2 + 20
        );
    }
    
    /**
     * Clear live data (e.g., on session change)
     */
    reset() {
        this.liveData = [];
        this.lapStartFuel = null;
        this.currentLapDistPct = 0;
        this.currentFuelLevel = 0;
        this.lastLapDistPct = 0;
        console.log('🔄 Fuel comparison chart reset');
    }
}
