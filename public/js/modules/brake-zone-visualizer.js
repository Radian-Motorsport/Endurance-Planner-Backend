/**
 * BrakeZoneVisualizer - Displays brake zones and car positions on lap progress bar
 * 
 * Shows:
 * - Red zones where braking occurs (from ideal lap data)
 * - Player car position (cyan dot)
 * - All car positions (when enabled)
 */

export class BrakeZoneVisualizer {
    constructor() {
        // DOM elements
        this.progressDot = document.getElementById('brake-zone-progress-dot');
        this.playerLabel = document.getElementById('brake-zone-player-label');
        this.markersContainer = document.getElementById('brake-zone-markers-container');
        this.carDotsContainer = document.getElementById('brake-zone-car-dots-container');
        this.infoDisplay = document.getElementById('brake-zone-info-display');
        this.statusText = document.getElementById('brake-zone-status');
        this.toggleButton = document.getElementById('toggle-brake-zones-cars');
        
        // State
        this.brakeZones = null;           // Loaded brake zone data
        this.playerCarIdx = null;         // Player's car index
        this.playerLapDistPct = 0;        // Player's current position (0-1)
        this.playerPosition = null;       // Player's position in class
        this.allCarsVisible = false;      // Show all car positions
        this.carPositions = new Map();    // CarIdx -> {lapDistPct, position, carNumber}
        
        this.setupEventListeners();
    }
    
    /**
     * Setup UI event listeners
     */
    setupEventListeners() {
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => {
                this.allCarsVisible = !this.allCarsVisible;
                this.toggleButton.textContent = this.allCarsVisible ? 'Hide Other Cars' : 'Show All Cars';
                
                if (this.carDotsContainer) {
                    if (this.allCarsVisible) {
                        this.carDotsContainer.classList.remove('hidden');
                    } else {
                        this.carDotsContainer.classList.add('hidden');
                    }
                }
            });
        }
    }
    
    /**
     * Load brake zones from database
     */
    async loadBrakeZones(trackId, carName) {
        try {
            const response = await fetch(`/api/brake-zone-trace/${trackId}/${encodeURIComponent(carName)}`);
            
            if (response.ok) {
                const data = await response.json();
                this.brakeZones = data.samples;
                this.renderBrakeZones();
                this.updateInfoDisplay();
                console.log(`✅ Loaded ${this.brakeZones.length} brake zone samples`);
                return true;
            } else {
                // No brake zones available - clear display
                this.brakeZones = null;
                this.clearBrakeZones();
                if (this.infoDisplay) {
                    this.infoDisplay.textContent = 'No brake zones recorded for this track/car';
                }
                return false;
            }
        } catch (err) {
            this.brakeZones = null;
            this.clearBrakeZones();
            console.log('No brake zone data available');
            return false;
        }
    }
    
    /**
     * Render brake zones as red markers on progress bar
     */
    renderBrakeZones() {
        if (!this.markersContainer || !this.brakeZones) return;
        
        // Clear existing markers
        this.markersContainer.innerHTML = '';
        
        // Group consecutive samples into zones
        const zones = this.groupBrakeZones(this.brakeZones);
        
        // Render each zone as a red bar
        zones.forEach(zone => {
            const marker = document.createElement('div');
            marker.className = 'absolute bg-red-500 opacity-30 rounded';
            marker.style.left = `${zone.start}%`;
            marker.style.width = `${zone.end - zone.start}%`;
            marker.style.height = '4px';
            marker.style.top = '50%';
            marker.style.transform = 'translateY(-50%)';
            marker.title = `Brake Zone ${zone.start.toFixed(1)}% - ${zone.end.toFixed(1)}%`;
            
            this.markersContainer.appendChild(marker);
        });
        
        if (this.statusText) {
            this.statusText.textContent = `${zones.length} brake zones`;
        }
    }
    
    /**
     * Group consecutive brake samples into zones
     * Returns array of {start, end} percentages
     */
    groupBrakeZones(samples) {
        if (!samples || samples.length === 0) return [];
        
        // Sort samples by lap distance
        const sorted = [...samples].sort((a, b) => a.lapDistPct - b.lapDistPct);
        
        const zones = [];
        let currentZone = null;
        
        sorted.forEach(sample => {
            const pct = sample.lapDistPct;
            
            if (!currentZone) {
                // Start new zone
                currentZone = { start: pct, end: pct };
            } else if (pct - currentZone.end < 1.0) {
                // Extend current zone (gap < 1%)
                currentZone.end = pct;
            } else {
                // Save current zone and start new one
                zones.push(currentZone);
                currentZone = { start: pct, end: pct };
            }
        });
        
        // Save last zone
        if (currentZone) {
            zones.push(currentZone);
        }
        
        return zones;
    }
    
    /**
     * Clear brake zone markers
     */
    clearBrakeZones() {
        if (this.markersContainer) {
            this.markersContainer.innerHTML = '';
        }
        if (this.statusText) {
            this.statusText.textContent = '--';
        }
    }
    
    /**
     * Update info display
     */
    updateInfoDisplay() {
        if (!this.infoDisplay || !this.brakeZones) return;
        
        const zones = this.groupBrakeZones(this.brakeZones);
        this.infoDisplay.textContent = `${zones.length} brake zones recorded`;
    }
    
    /**
     * Update player position
     */
    updatePlayerPosition(lapDistPct, position = null) {
        this.playerLapDistPct = lapDistPct;
        this.playerPosition = position;
        
        // Update player dot position
        if (this.progressDot) {
            const pct = (lapDistPct * 100);
            this.progressDot.style.left = `${pct}%`;
        }
        
        // Update position label
        if (this.playerLabel && position != null) {
            this.playerLabel.textContent = position.toString();
        }
    }
    
    /**
     * Update all car positions
     */
    updateCarPositions(carIdxLapDistPct, carIdxPosition, carIdxCarNumber) {
        if (!this.allCarsVisible || !this.carDotsContainer) return;
        
        // Clear existing car dots
        this.carDotsContainer.innerHTML = '';
        
        // Create dot for each car (skip player)
        carIdxLapDistPct.forEach((lapDist, carIdx) => {
            if (carIdx === this.playerCarIdx || lapDist < 0) return;
            
            const position = carIdxPosition?.[carIdx];
            const carNumber = carIdxCarNumber?.[carIdx];
            
            const dot = document.createElement('div');
            dot.className = 'absolute bg-white rounded-full shadow-lg transition-all duration-100';
            dot.style.left = `${lapDist * 100}%`;
            dot.style.width = '20px';
            dot.style.height = '20px';
            dot.style.top = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            
            if (position != null) {
                const label = document.createElement('span');
                label.textContent = position.toString();
                label.style.fontSize = '12px';
                label.style.fontWeight = 'bold';
                label.style.color = '#000000';
                dot.appendChild(label);
            }
            
            this.carDotsContainer.appendChild(dot);
        });
    }
    
    /**
     * Set player car index
     */
    setPlayerCarIdx(carIdx) {
        this.playerCarIdx = carIdx;
    }
    
    /**
     * Reset visualization
     */
    reset() {
        this.brakeZones = null;
        this.playerLapDistPct = 0;
        this.playerPosition = null;
        this.carPositions.clear();
        this.clearBrakeZones();
        
        if (this.progressDot) {
            this.progressDot.style.left = '0%';
        }
        if (this.playerLabel) {
            this.playerLabel.textContent = '';
        }
        if (this.infoDisplay) {
            this.infoDisplay.textContent = 'No brake zones loaded';
        }
    }
}
