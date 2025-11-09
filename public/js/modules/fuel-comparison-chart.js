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
            idealLineColor: options.idealLineColor || 'rgba(16, 185, 129, 0.5)',  // Green 50% opacity
            deviationPositiveColor: options.deviationPositiveColor || '#10b981',  // Green (using less)
            deviationNegativeColor: options.deviationNegativeColor || '#ef4444',  // Red (using more)
            gridColor: options.gridColor || '#374151',
            textColor: options.textColor || '#9ca3af',
            zeroLineColor: options.zeroLineColor || '#ffffff',
            paddingLeft: options.paddingLeft || 50,
            paddingRight: options.paddingRight || 20,
            paddingTop: options.paddingTop || 40,
            paddingBottom: options.paddingBottom || 40,
            deviationRange: options.deviationRange || 1.0,  // ±1.0L default range
            ...options
        };
        
        // Data
        this.idealData = null;          // Array of 101 samples from database
        this.originalIdealData = null;  // Backup of original data
        this.idealAdjustment = 0;       // Current adjustment in liters
        this.liveData = [];             // Current lap samples
        this.currentLapDistPct = 0;     // Current position (0-100)
        this.currentFuelLevel = 0;      // Current fuel level
        this.lapStartFuel = null;       // Fuel at lap start
        this.lastLapDistPct = 0;        // Track lap boundary
        
        // Chart bounds
        this.chartArea = {
            x: this.options.paddingLeft,
            y: this.options.paddingTop,
            width: this.canvas.width - this.options.paddingLeft - this.options.paddingRight,
            height: this.canvas.height - this.options.paddingTop - this.options.paddingBottom
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
                this.originalIdealData = JSON.parse(JSON.stringify(data.samples)); // Deep copy
                this.idealData = data.samples;
                this.idealAdjustment = 0;
                this.updateAdjustmentDisplay();
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
        
        // Draw zero line (ideal consumption)
        this.drawZeroLine();
        
        // Draw deviation trace if available
        if (this.idealData && this.idealData.length > 0) {
            if (this.liveData.length > 0) {
                this.drawDeviationTrace();
            }
        } else {
            this.drawNoDataMessage();
        }
        
        // Draw current position marker
        if (this.currentLapDistPct > 0 && this.lapStartFuel !== null) {
            this.drawPositionMarker();
        }
        
        // Update stats display
        this.updateStatsDisplay();
        
        // Continue rendering
        requestAnimationFrame(() => this.render());
    }
    
    /**
     * Draw grid and axes
     */
    drawGrid() {
        const { x, y, width, height } = this.chartArea;
        
        this.ctx.strokeStyle = '#6b7280';  // Grey for grid
        this.ctx.lineWidth = 0.5;  // Thinner
        
        // Vertical grid lines (every 10%) - solid
        for (let i = 0; i <= 10; i++) {
            const xPos = x + (width * i / 10);
            this.ctx.beginPath();
            this.ctx.moveTo(xPos, y);
            this.ctx.lineTo(xPos, y + height);
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
        
        // Y-axis tick labels (deviation range) - add L suffix
        const range = this.options.deviationRange;
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '10px Inter, sans-serif';
        this.ctx.textAlign = 'right';
        
        for (let i = -2; i <= 2; i++) {
            const value = (range / 2 * i).toFixed(2);
            const yPos = y + height / 2 - (height / 4) * i;
            
            // Color code the labels
            if (i > 0) {
                this.ctx.fillStyle = this.options.deviationPositiveColor;
            } else if (i < 0) {
                this.ctx.fillStyle = this.options.deviationNegativeColor;
            } else {
                this.ctx.fillStyle = this.options.textColor;
            }
            
            this.ctx.fillText(value + 'L', x - 5, yPos + 3);
        }
    }
    
    /**
     * Draw zero line (ideal consumption reference)
     */
    drawZeroLine() {
        const { x, y, width, height } = this.chartArea;
        const midY = y + height / 2;
        
        this.ctx.strokeStyle = '#6b7280';  // Grey
        this.ctx.lineWidth = 0.5;  // Thinner
        this.ctx.beginPath();
        this.ctx.moveTo(x, midY);
        this.ctx.lineTo(x + width, midY);
        this.ctx.stroke();
    }
    
    /**
     * Draw deviation trace (difference from ideal consumption)
     */
    drawDeviationTrace() {
        if (!this.idealData || this.liveData.length === 0 || this.lapStartFuel === null) return;
        
        const { x, y, width, height } = this.chartArea;
        const midY = y + height / 2;
        const range = this.options.deviationRange;
        const idealStartFuel = this.idealData[0]?.fuelLevel || 0;
        
        this.ctx.lineWidth = 1.5;  // Thinner
        this.ctx.beginPath();
        
        let started = false;
        for (const liveSample of this.liveData) {
            // Find corresponding ideal sample
            const idealSample = this.idealData.find(s => s.pct === liveSample.pct);
            if (!idealSample || idealSample.fuelLevel === null) continue;
            
            // Calculate consumed fuel for both
            const liveConsumed = this.lapStartFuel - liveSample.fuelLevel;
            const idealConsumed = idealStartFuel - idealSample.fuelLevel;
            
            // Deviation: positive = using less fuel (good), negative = using more (bad)
            const deviation = idealConsumed - liveConsumed;
            
            // Clamp to range for display
            const clampedDeviation = Math.max(-range/2, Math.min(range/2, deviation));
            
            const xPos = x + (width * liveSample.pct / 100);
            const yPos = midY - (clampedDeviation / (range/2)) * (height / 2);
            
            // Color based on deviation
            if (deviation > 0.05) {
                this.ctx.strokeStyle = this.options.deviationPositiveColor;
            } else if (deviation < -0.05) {
                this.ctx.strokeStyle = this.options.deviationNegativeColor;
            } else {
                this.ctx.strokeStyle = this.options.textColor;
            }
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
    }
    
    /**
     * DEPRECATED - kept for compatibility
     */
    drawIdealConsumedTrace() {
        if (!this.idealData || this.idealData.length === 0) return;
        
        const { x, y, width, height } = this.chartArea;
        const startFuel = this.idealData[0]?.fuelLevel || 0;
        const maxConsumed = this.getMaxFuelConsumed();
        
        this.ctx.strokeStyle = this.options.idealConsumedColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.idealData) {
            if (sample.fuelLevel === null) continue;
            
            const consumed = startFuel - sample.fuelLevel;
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + height - (consumed / maxConsumed) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.idealConsumedColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Ideal Consumed', x + 10, y + 20);
    }
    
    /**
     * Draw ideal fuel remaining trace (right Y-axis)
     */
    drawIdealRemainingTrace() {
        if (!this.idealData || this.idealData.length === 0) return;
        
        const { x, y, width, height } = this.chartArea;
        const startFuel = this.idealData[0]?.fuelLevel || 0;
        const endFuel = this.idealData[this.idealData.length - 1]?.fuelLevel || 0;
        const fuelRange = startFuel - endFuel;
        
        this.ctx.strokeStyle = this.options.idealRemainingColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.idealData) {
            if (sample.fuelLevel === null) continue;
            
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + ((startFuel - sample.fuelLevel) / fuelRange) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.idealRemainingColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Ideal Remaining', x + 150, y + 20);
    }
    
    /**
     * Draw live fuel consumed trace (left Y-axis)
     */
    drawLiveConsumedTrace() {
        if (this.liveData.length === 0 || this.lapStartFuel === null) return;
        
        const { x, y, width, height } = this.chartArea;
        const maxConsumed = this.getMaxFuelConsumed();
        
        this.ctx.strokeStyle = this.options.liveConsumedColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.liveData) {
            const consumed = this.lapStartFuel - sample.fuelLevel;
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + height - (consumed / maxConsumed) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.liveConsumedColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Live Consumed', x + 10, y + 40);
    }
    
    /**
     * Draw live fuel remaining trace (right Y-axis)
     */
    drawLiveRemainingTrace() {
        if (this.liveData.length === 0 || this.lapStartFuel === null || !this.idealData) return;
        
        const { x, y, width, height } = this.chartArea;
        const startFuel = this.idealData[0]?.fuelLevel || 0;
        const endFuel = this.idealData[this.idealData.length - 1]?.fuelLevel || 0;
        const fuelRange = startFuel - endFuel;
        
        this.ctx.strokeStyle = this.options.liveRemainingColor;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        let started = false;
        for (const sample of this.liveData) {
            const xPos = x + (width * sample.pct / 100);
            const yPos = y + ((this.lapStartFuel - sample.fuelLevel) / fuelRange) * height;
            
            if (!started) {
                this.ctx.moveTo(xPos, yPos);
                started = true;
            } else {
                this.ctx.lineTo(xPos, yPos);
            }
        }
        
        this.ctx.stroke();
        
        // Draw legend label
        this.ctx.fillStyle = this.options.liveRemainingColor;
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('● Live Remaining', x + 150, y + 40);
    }
    
    /**
     * Draw current position marker
     */
    drawPositionMarker() {
        if (!this.idealData || this.lapStartFuel === null) return;
        
        const { x, y, width, height } = this.chartArea;
        const midY = y + height / 2;
        const xPos = x + (width * this.currentLapDistPct / 100);
        
        // Calculate current deviation
        const bucket = Math.floor(this.currentLapDistPct);
        const idealSample = this.idealData.find(s => s.pct === bucket);
        
        if (idealSample && idealSample.fuelLevel !== null) {
            const idealStartFuel = this.idealData[0]?.fuelLevel || 0;
            const liveConsumed = this.lapStartFuel - this.currentFuelLevel;
            const idealConsumed = idealStartFuel - idealSample.fuelLevel;
            const deviation = idealConsumed - liveConsumed;
            
            const range = this.options.deviationRange;
            const clampedDeviation = Math.max(-range/2, Math.min(range/2, deviation));
            const yPos = midY - (clampedDeviation / (range/2)) * (height / 2);
            
            // Draw vertical line
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(xPos, y);
            this.ctx.lineTo(xPos, y + height);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw marker dot
            const color = deviation > 0.05 ? this.options.deviationPositiveColor : 
                         deviation < -0.05 ? this.options.deviationNegativeColor : 
                         '#ffffff';
            
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(xPos, yPos, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }
    
    /**
     * Update stats display below chart
     */
    updateStatsDisplay() {
        if (!this.idealData || this.lapStartFuel === null) return;
        
        const bucket = Math.floor(this.currentLapDistPct);
        const idealSample = this.idealData.find(s => s.pct === bucket);
        
        if (idealSample && idealSample.fuelLevel !== null) {
            const idealStartFuel = this.idealData[0]?.fuelLevel || 0;
            
            // Calculate how much fuel SHOULD have been consumed at this point (from ideal lap)
            const idealConsumedAtThisPoint = idealStartFuel - idealSample.fuelLevel;
            
            // Calculate how much fuel YOU'VE consumed so far
            const liveConsumed = this.lapStartFuel - this.currentFuelLevel;
            
            // Deviation: positive = using less fuel (good)
            const deviation = idealConsumedAtThisPoint - liveConsumed;
            
            // What you SHOULD have remaining (based on your lap start fuel and ideal consumption)
            const idealRemaining = this.lapStartFuel - idealConsumedAtThisPoint;
            
            // Calculate lap totals
            const idealLapTotal = this.idealData[0]?.fuelLevel - this.idealData[this.idealData.length - 1]?.fuelLevel;
            const currentLapConsumed = this.lapStartFuel - this.currentFuelLevel;
            
            // Project current lap total based on progress
            let projectedLapTotal = '--';
            let lapDelta = '--';
            if (this.currentLapDistPct > 5) { // Only project after 5% to avoid wild estimates
                const consumptionRate = currentLapConsumed / (this.currentLapDistPct / 100);
                projectedLapTotal = consumptionRate; // Full lap projection
                lapDelta = projectedLapTotal - idealLapTotal;
            }
            
            // Update DOM elements
            const el = (id) => document.getElementById(id);
            
            // Row 1: Lap consumption stats
            if (el('fuel-ideal-lap-total')) {
                el('fuel-ideal-lap-total').textContent = idealLapTotal.toFixed(2) + ' L';
            }
            if (el('fuel-current-lap-total')) {
                el('fuel-current-lap-total').textContent = 
                    typeof projectedLapTotal === 'number' ? projectedLapTotal.toFixed(2) + ' L' : projectedLapTotal;
            }
            if (el('fuel-lap-delta')) {
                const lapDeltaEl = el('fuel-lap-delta');
                if (typeof lapDelta === 'number') {
                    const sign = lapDelta >= 0 ? '+' : '';
                    lapDeltaEl.textContent = sign + lapDelta.toFixed(2) + ' L';
                    lapDeltaEl.style.color = lapDelta <= 0 ? '#10b981' : '#ef4444'; // Green if using less
                } else {
                    lapDeltaEl.textContent = lapDelta;
                    lapDeltaEl.style.color = '#ffffff';
                }
            }
            
            // Row 2: Current position stats
            if (el('fuel-ideal-remaining')) {
                el('fuel-ideal-remaining').textContent = idealRemaining.toFixed(2) + ' L';
            }
            if (el('fuel-actual-remaining')) {
                el('fuel-actual-remaining').textContent = this.currentFuelLevel.toFixed(2) + ' L';
            }
            if (el('fuel-delta')) {
                const deltaEl = el('fuel-delta');
                const sign = deviation > 0 ? '+' : '';
                deltaEl.textContent = sign + deviation.toFixed(2) + ' L';
                deltaEl.style.color = deviation > 0.05 ? '#10b981' : 
                                     deviation < -0.05 ? '#ef4444' : '#ffffff';
            }
            if (el('fuel-lap-progress')) {
                el('fuel-lap-progress').textContent = this.currentLapDistPct.toFixed(1) + '%';
            }
        }
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
    
    /**
     * Adjust ideal fuel consumption by a fixed amount (liters)
     * This scales the consumption proportionally across the lap
     */
    adjustIdeal(deltaLiters) {
        if (!this.originalIdealData || this.originalIdealData.length === 0) return;
        
        this.idealAdjustment += deltaLiters;
        
        // Get original lap total consumption
        const originalStartFuel = this.originalIdealData[0].fuelLevel;
        const originalEndFuel = this.originalIdealData[this.originalIdealData.length - 1].fuelLevel;
        const originalLapTotal = originalStartFuel - originalEndFuel;
        
        // Calculate new lap total
        const newLapTotal = originalLapTotal + this.idealAdjustment;
        
        // Scale factor for all consumption values
        const scaleFactor = newLapTotal / originalLapTotal;
        
        // Apply adjustment to all samples proportionally
        this.idealData = this.originalIdealData.map((sample, index) => {
            const originalConsumed = originalStartFuel - sample.fuelLevel;
            const adjustedConsumed = originalConsumed * scaleFactor;
            const adjustedFuelLevel = originalStartFuel - adjustedConsumed;
            
            return {
                ...sample,
                fuelLevel: adjustedFuelLevel
            };
        });
        
        this.updateAdjustmentDisplay();
        this.render();
        this.updateStatsDisplay();
        
        console.log(`📊 Ideal adjusted by ${deltaLiters >= 0 ? '+' : ''}${deltaLiters.toFixed(2)}L (Total: ${this.idealAdjustment >= 0 ? '+' : ''}${this.idealAdjustment.toFixed(2)}L)`);
    }
    
    /**
     * Reset ideal adjustment to original values
     */
    resetIdealAdjustment() {
        if (!this.originalIdealData) return;
        
        this.idealAdjustment = 0;
        this.idealData = JSON.parse(JSON.stringify(this.originalIdealData)); // Deep copy
        this.updateAdjustmentDisplay();
        this.render();
        this.updateStatsDisplay();
        
        console.log('🔄 Ideal adjustment reset to original');
    }
    
    /**
     * Update the adjustment display element
     */
    updateAdjustmentDisplay() {
        const displayEl = document.getElementById('ideal-adjustment-display');
        if (displayEl) {
            const sign = this.idealAdjustment >= 0 ? '+' : '';
            displayEl.textContent = `${sign}${this.idealAdjustment.toFixed(2)}L`;
            
            // Color code: green = less fuel, red = more fuel
            if (this.idealAdjustment > 0) {
                displayEl.style.color = '#ef4444'; // Red (ideal is higher = you need more)
            } else if (this.idealAdjustment < 0) {
                displayEl.style.color = '#10b981'; // Green (ideal is lower = you need less)
            } else {
                displayEl.style.color = '#ffffff'; // White (neutral)
            }
        }
    }
}
