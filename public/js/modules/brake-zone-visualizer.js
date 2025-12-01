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
        this.playerCarClass = null;       // Player's car class ID
        this.playerLapDistPct = 0;        // Player's current position (0-1)
        this.playerPosition = null;       // Player's position in class
        this.allCarsVisible = false;      // Show all car positions
        this.carPositions = new Map();    // CarIdx -> {lapDistPct, position, carNumber}
        
        // Lift-and-coast detection
        this.liftThreshold = 5;           // % before brake zone to check for lift (default 5%)
        this.liftingCars = new Set();     // Set of carIdx currently lifting before brake zones
        this.previousRPM = new Map();     // Track previous RPM per car
        
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
    updateCarPositions(carIdxLapDistPct, carIdxPosition, carIdxCarNumber, carIdxClass) {
        if (!this.allCarsVisible || !this.carDotsContainer) return;
        
        console.log('🚗 Brake zone updateCarPositions:', {
            playerCarClass: this.playerCarClass,
            hasCarIdxClass: !!carIdxClass,
            totalCars: carIdxLapDistPct?.length
        });
        
        const activeCars = new Set();
        let carsFiltered = 0;
        
        // Update or create dot for each car (skip player)
        carIdxLapDistPct.forEach((lapDist, carIdx) => {
            if (carIdx === this.playerCarIdx || lapDist < 0) return;
            
            // Only show player's class
            if (this.playerCarClass != null && carIdxClass && carIdxClass[carIdx] !== this.playerCarClass) {
                carsFiltered++;
                return;
            }
            
            activeCars.add(carIdx);
            const position = carIdxPosition?.[carIdx];
            const carNumber = carIdxCarNumber?.[carIdx];
            
            // Get or create dot
            let dot = this.carDotsContainer.querySelector(`[data-car-idx="${carIdx}"]`);
            
            if (!dot) {
                // Create new dot
                dot = document.createElement('div');
                dot.className = 'absolute bg-white rounded-full shadow-lg transition-all duration-100';
                dot.style.width = '20px';
                dot.style.height = '20px';
                dot.style.top = '50%';
                dot.style.transform = 'translate(-50%, -50%)';
                dot.style.display = 'flex';
                dot.style.alignItems = 'center';
                dot.style.justifyContent = 'center';
                dot.dataset.carIdx = carIdx;
                dot.dataset.lastPct = lapDist;
                
                const label = document.createElement('span');
                label.style.fontSize = '12px';
                label.style.fontWeight = 'bold';
                label.style.color = '#000000';
                dot.appendChild(label);
                
                this.carDotsContainer.appendChild(dot);
            }
            
            // Detect lap wrap (crossing from >0.9 to <0.1)
            const lastPct = parseFloat(dot.dataset.lastPct || 0);
            const isLapWrap = lastPct > 0.9 && lapDist < 0.1;
            
            if (isLapWrap) {
                // Disable transition for instant snap
                dot.classList.remove('transition-all', 'duration-100');
                dot.style.left = `${lapDist * 100}%`;
                dot.dataset.lastPct = lapDist;
                
                // Re-enable transition on next frame
                requestAnimationFrame(() => {
                    dot.classList.add('transition-all', 'duration-100');
                });
            } else {
                // Normal position update with transition
                dot.style.left = `${lapDist * 100}%`;
                dot.dataset.lastPct = lapDist;
            }
            
            // Update position label
            const label = dot.querySelector('span');
            if (label && position != null) {
                label.textContent = position.toString();
            }
            
            // Apply green ring if car is lifting before brake zones
            if (this.liftingCars.has(carIdx)) {
                dot.style.boxShadow = '0 0 0 3px #10b981';
            } else {
                dot.style.boxShadow = '';
            }
        });
        
        console.log('🚗 Brake zone cars:', {
            active: activeCars.size,
            filtered: carsFiltered
        });
        
        // Remove dots for inactive cars
        const existingDots = this.carDotsContainer.querySelectorAll('[data-car-idx]');
        existingDots.forEach(dot => {
            const carIdx = parseInt(dot.dataset.carIdx);
            if (!activeCars.has(carIdx)) {
                dot.remove();
            }
        });
    }
    
    /**
     * Detect lift-and-coast behavior (RPM drops before brake zones)
     * @param {Array} carIdxRPM - RPM values for all cars
     * @param {Array} carIdxLapDistPct - Lap distance percentages
     * @param {Array} carIdxClass - Car class IDs
     */
    detectLiftAndCoast(carIdxRPM, carIdxLapDistPct, carIdxClass) {
        if (!this.brakeZones || !carIdxRPM || !carIdxLapDistPct || !carIdxClass) {
            console.log('🔍 Lift detection skipped:', {
                hasBrakeZones: !!this.brakeZones,
                hasCarIdxRPM: !!carIdxRPM,
                hasLapDistPct: !!carIdxLapDistPct,
                hasCarIdxClass: !!carIdxClass
            });
            return;
        }
        
        this.liftingCars.clear();
        
        // Group brake zones for easier lookup
        const zones = this.groupBrakeZones(this.brakeZones);
        console.log('🔍 Detecting lift in', zones.length, 'brake zones, threshold:', this.liftThreshold + '%');
        
        carIdxRPM.forEach((rpm, carIdx) => {
            // Skip player and invalid data
            if (carIdx === this.playerCarIdx || rpm == null || rpm < 100) return;
            
            // Only check player's class
            if (this.playerCarClass != null && carIdxClass[carIdx] !== this.playerCarClass) return;
            
            const lapDist = carIdxLapDistPct[carIdx];
            if (lapDist == null || lapDist < 0) return;
            
            const lapDistPct = lapDist * 100; // Convert to 0-100
            
            // Check if approaching any brake zone
            for (const zone of zones) {
                // Calculate the "lift zone" - threshold% before brake zone
                const liftZoneStart = Math.max(0, zone.start - this.liftThreshold);
                const liftZoneEnd = zone.start;
                
                // Check if car is in the lift detection zone
                if (lapDistPct >= liftZoneStart && lapDistPct < liftZoneEnd) {
                    // Get previous RPM
                    const prevRPM = this.previousRPM.get(carIdx) || rpm;
                    
                    // Detect significant RPM drop (>15% drop indicates lift)
                    const rpmDrop = (prevRPM - rpm) / prevRPM;
                    if (rpmDrop > 0.15) {
                        this.liftingCars.add(carIdx);
                        break;
                    }
                }
            }
            
            // Store current RPM for next comparison
            this.previousRPM.set(carIdx, rpm);
        });
    }
    
    /**
     * Set lift detection threshold
     * @param {number} threshold - Percentage before brake zone (0-20)
     */
    setLiftThreshold(threshold) {
        this.liftThreshold = Math.max(0, Math.min(20, threshold));
    }
    
    /**
     * Set player car index
     */
    setPlayerCarIdx(carIdx) {
        this.playerCarIdx = carIdx;
    }
    
    /**
     * Set player car class
     */
    setPlayerCarClass(classId) {
        this.playerCarClass = classId;
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
