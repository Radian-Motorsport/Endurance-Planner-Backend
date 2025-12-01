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
        this.baselineRPM = new Map();     // Map of "carIdx-zoneIndex" -> baseline RPM at brake zone entry
        this.selectedCarIdx = null;       // Currently selected car for analysis
        this.liftMarkers = [];            // Array of lift marker positions for selected car
        
        // Create lift markers container if it doesn't exist
        if (!document.getElementById('brake-zone-lift-markers')) {
            const liftMarkersContainer = document.createElement('div');
            liftMarkersContainer.id = 'brake-zone-lift-markers';
            liftMarkersContainer.className = 'absolute inset-0';
            this.markersContainer?.parentElement?.appendChild(liftMarkersContainer);
        }
        this.liftMarkersContainer = document.getElementById('brake-zone-lift-markers');
        
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
            marker.style.height = '32px';
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
        
        // Hide player dot
        if (this.progressDot) {
            this.progressDot.style.display = 'none';
        }
        
        // Hide position label
        if (this.playerLabel) {
            this.playerLabel.style.display = 'none';
        }
    }
    
    /**
     * Update all car positions
     */
    updateCarPositions(carIdxLapDistPct, carIdxPosition, carIdxCarNumber, carIdxClass) {
        if (!this.allCarsVisible || !this.carDotsContainer || this.selectedCarIdx === null) return;
        
        /*console.log('🚗 Brake zone updateCarPositions:', {
            playerCarClass: this.playerCarClass,
            hasCarIdxClass: !!carIdxClass,
            totalCars: carIdxLapDistPct?.length
        });*/
        
        const activeCars = new Set();
        let carsFiltered = 0;
        
        // Update or create dot for selected car only
        carIdxLapDistPct.forEach((lapDist, carIdx) => {
            // Only show selected car
            if (carIdx !== this.selectedCarIdx || lapDist < 0) return;
            
            activeCars.add(carIdx);
            const position = carIdxPosition?.[carIdx];
            const carNumber = carIdxCarNumber?.[carIdx];
            
            // Get or create dot
            let dot = this.carDotsContainer.querySelector(`[data-car-idx="${carIdx}"]`);
            
            if (!dot) {
                // Create new dot
                dot = document.createElement('div');
                dot.className = 'absolute bg-white rounded-full shadow-lg transition-all duration-100';
                dot.style.width = '24px';
                dot.style.height = '24px';
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
        });
        
        /*console.log('🚗 Brake zone cars:', {
            active: activeCars.size,
            filtered: carsFiltered
        });*/
        
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
        if (!this.brakeZones || !carIdxRPM || !carIdxLapDistPct || !carIdxClass || this.selectedCarIdx === null) {
            return;
        }
        
        this.liftingCars.clear();
        
        // Group brake zones for easier lookup
        const zones = this.groupBrakeZones(this.brakeZones);
        
        carIdxRPM.forEach((rpm, carIdx) => {
            // Only check selected car
            if (carIdx !== this.selectedCarIdx || rpm == null || rpm < 100) return;
            
            const lapDist = carIdxLapDistPct[carIdx];
            if (lapDist == null || lapDist < 0) return;
            
            const lapDistPct = lapDist * 100; // Convert to 0-100
            
            // Check each brake zone
            zones.forEach((zone, zoneIndex) => {
                const key = `${carIdx}-${zoneIndex}`;
                
                // Check if car is at the START of brake zone (record/update baseline RPM)
                if (lapDistPct >= zone.start && lapDistPct < zone.start + 0.5) {
                    // Always update baseline RPM when entering brake zone (keeps highest RPM across laps)
                    const currentBaseline = this.baselineRPM.get(key);
                    if (currentBaseline == null || rpm > currentBaseline) {
                        this.baselineRPM.set(key, rpm);
                    }
                }
                
                // Check if car is in the lift detection zone (before brake zone)
                const liftZoneStart = Math.max(0, zone.start - this.liftThreshold);
                const liftZoneEnd = zone.start;
                
                if (lapDistPct >= liftZoneStart && lapDistPct < liftZoneEnd) {
                    const baselineRPM = this.baselineRPM.get(key);
                    
                    // If we have baseline RPM from previous lap, compare current RPM
                    if (baselineRPM != null) {
                        const rpmDrop = (baselineRPM - rpm) / baselineRPM;
                        
                        // Check if RPM drop exceeds threshold (15% default, controlled by slider)
                        if (rpmDrop > 0.15) {
                            this.liftingCars.add(carIdx);
                            // Place vertical marker at current position
                            this.addLiftMarker(lapDistPct);
                        }
                    }
                }
                
                // Remove lift marker when car passes over it
                this.removeLiftMarkerAtPosition(lapDistPct);
                }
            });
        });
    }
    
    /**
     * Add vertical lift marker at position
     */
    addLiftMarker(lapDistPct) {
        // Check if marker already exists at this position (within 0.5%)
        const exists = this.liftMarkers.some(pos => Math.abs(pos - lapDistPct) < 0.5);
        if (exists) return;
        
        this.liftMarkers.push(lapDistPct);
        this.renderLiftMarkers();
    }
    
    /**
     * Remove lift marker when car passes over it
     */
    removeLiftMarkerAtPosition(currentLapDistPct) {
        // Remove markers within 0.5% of current position
        const before = this.liftMarkers.length;
        this.liftMarkers = this.liftMarkers.filter(pos => Math.abs(pos - currentLapDistPct) > 0.5);
        
        if (this.liftMarkers.length !== before) {
            this.renderLiftMarkers();
        }
    }
    
    /**
     * Render all lift markers
     */
    renderLiftMarkers() {
        if (!this.liftMarkersContainer) return;
        
        this.liftMarkersContainer.innerHTML = '';
        
        this.liftMarkers.forEach(lapDistPct => {
            const marker = document.createElement('div');
            marker.className = 'absolute bg-green-400';
            marker.style.left = `${lapDistPct}%`;
            marker.style.width = '2px';
            marker.style.height = '100%';
            marker.style.top = '0';
            marker.title = `Lift detected at ${lapDistPct.toFixed(1)}%`;
            
            this.liftMarkersContainer.appendChild(marker);
        });
    }
    
    /**
     * Set selected car and clear previous markers
     */
    setSelectedCar(carIdx) {
        // Clear markers when changing car
        if (this.selectedCarIdx !== carIdx) {
            this.liftMarkers = [];
            this.renderLiftMarkers();
        }
        this.selectedCarIdx = carIdx;
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
