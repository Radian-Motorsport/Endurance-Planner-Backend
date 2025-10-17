/**
 * Track Map Module
 * Standalone component for displaying interactive SVG track maps with selectable layers
 * Can be imported and used in other projects
 */

export class TrackMapComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            showControls: true,
            defaultLayers: ['background', 'active'],
            maxHeight: '400px',
            ...options
        };
        
        this.layers = {};
        this.svgContainer = null;
        this.controlsContainer = null;
        
        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Container with id '${this.containerId}' not found`);
        }
        
        this.createHTML(container);
        this.setupEventListeners();
    }
    
    createHTML(container) {
        container.innerHTML = `
            <div class="track-map-wrapper bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                <div class="flex justify-between items-start mb-4">
                    <!-- Track Map SVG Container -->
                    <div class="flex-1 ${this.options.showControls ? 'mr-4' : ''}">
                        <div id="${this.containerId}-map" class="relative bg-white rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                            <div id="${this.containerId}-loading" class="text-neutral-600">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <p>Loading track map...</p>
                            </div>
                            <div id="${this.containerId}-svg" class="hidden w-full h-full">
                                <!-- SVG track map will be loaded here -->
                            </div>
                            <div id="${this.containerId}-error" class="hidden text-neutral-600 text-center">
                                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                                <p>Track map not available</p>
                            </div>
                        </div>
                    </div>
                    
                    ${this.options.showControls ? this.createControlsHTML() : ''}
                </div>
            </div>
        `;
        
        this.svgContainer = document.getElementById(`${this.containerId}-svg`);
        this.loadingElement = document.getElementById(`${this.containerId}-loading`);
        this.errorElement = document.getElementById(`${this.containerId}-error`);
        
        if (this.options.showControls) {
            this.controlsContainer = document.getElementById(`${this.containerId}-controls`);
        }
    }
    
    createControlsHTML() {
        return `
            <!-- Layer Controls -->
            <div id="${this.containerId}-controls" class="w-48 bg-neutral-900 border border-neutral-600 rounded-lg p-4">
                <h4 class="text-sm font-medium text-neutral-300 mb-3">Map Layers</h4>
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-400">Background</span>
                        <div class="track-layer-toggle relative inline-block w-10 h-6">
                            <input type="checkbox" id="${this.containerId}-layer-background" class="absolute w-0 h-0 opacity-0" checked>
                            <label for="${this.containerId}-layer-background" class="block w-10 h-6 bg-green-500 rounded-full cursor-pointer transition-all duration-200">
                                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 transform translate-x-full"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-400">Active Config</span>
                        <div class="track-layer-toggle relative inline-block w-10 h-6">
                            <input type="checkbox" id="${this.containerId}-layer-active" class="absolute w-0 h-0 opacity-0" checked>
                            <label for="${this.containerId}-layer-active" class="block w-10 h-6 bg-green-500 rounded-full cursor-pointer transition-all duration-200">
                                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 transform translate-x-full"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-400">Pit Road</span>
                        <div class="track-layer-toggle relative inline-block w-10 h-6">
                            <input type="checkbox" id="${this.containerId}-layer-pitroad" class="absolute w-0 h-0 opacity-0">
                            <label for="${this.containerId}-layer-pitroad" class="block w-10 h-6 bg-neutral-600 rounded-full cursor-pointer transition-all duration-200">
                                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-400">Start/Finish</span>
                        <div class="track-layer-toggle relative inline-block w-10 h-6">
                            <input type="checkbox" id="${this.containerId}-layer-start-finish" class="absolute w-0 h-0 opacity-0">
                            <label for="${this.containerId}-layer-start-finish" class="block w-10 h-6 bg-neutral-600 rounded-full cursor-pointer transition-all duration-200">
                                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-400">Turn Numbers</span>
                        <div class="track-layer-toggle relative inline-block w-10 h-6">
                            <input type="checkbox" id="${this.containerId}-layer-turns" class="absolute w-0 h-0 opacity-0">
                            <label for="${this.containerId}-layer-turns" class="block w-10 h-6 bg-neutral-600 rounded-full cursor-pointer transition-all duration-200">
                                <span class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-200"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="mt-4 pt-3 border-t border-neutral-700">
                    <button id="${this.containerId}-fullscreen" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition-all duration-200">
                        <i class="fas fa-expand mr-2"></i>Fullscreen
                    </button>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        if (!this.options.showControls) return;
        
        const layerNames = ['background', 'active', 'pitroad', 'start-finish', 'turns'];
        
        layerNames.forEach(layerName => {
            const checkbox = document.getElementById(`${this.containerId}-layer-${layerName}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.toggleLayer(layerName, e.target.checked);
                });
            }
        });
        
        // Fullscreen button
        const fullscreenBtn = document.getElementById(`${this.containerId}-fullscreen`);
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
    }
    
    async loadTrackMap(trackMapData) {
        console.log('🗺️ Loading track map:', trackMapData);
        
        // Show loading state
        this.svgContainer.classList.add('hidden');
        this.errorElement.classList.add('hidden');
        this.loadingElement.classList.remove('hidden');
        
        try {
            if (!trackMapData.track_map || !trackMapData.track_map_layers) {
                throw new Error('Track map data not available');
            }
            
            // Load SVG layers
            await this.loadLayers(trackMapData);
            
            // Show the map
            this.loadingElement.classList.add('hidden');
            this.svgContainer.classList.remove('hidden');
            
            console.log('✅ Track map loaded successfully');
            
        } catch (error) {
            console.warn('❌ Failed to load track map:', error);
            
            // Show error state
            this.loadingElement.classList.add('hidden');
            this.errorElement.classList.remove('hidden');
        }
    }
    
    async loadLayers(trackMapData) {
        const baseUrl = trackMapData.track_map;
        const layers = typeof trackMapData.track_map_layers === 'string' 
            ? JSON.parse(trackMapData.track_map_layers) 
            : trackMapData.track_map_layers;
        
        console.log('📋 Available track map layers:', Object.keys(layers));
        
        // Clear existing map content
        this.svgContainer.innerHTML = '';
        
        // Create SVG container
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.setAttribute('viewBox', '0 0 1000 1000'); // Default viewBox
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgElement.style.maxHeight = this.options.maxHeight;
        
        this.svgContainer.appendChild(svgElement);
        
        // Load each layer in order
        const layerOrder = ['background', 'inactive', 'active', 'pitroad', 'start-finish', 'turns'];
        
        for (const layerName of layerOrder) {
            if (layers[layerName]) {
                try {
                    await this.loadLayer(svgElement, baseUrl, layerName, layers[layerName]);
                } catch (error) {
                    console.warn(`⚠️ Failed to load layer ${layerName}:`, error);
                }
            }
        }
    }
    
    async loadLayer(svgContainer, baseUrl, layerName, layerFile) {
        const layerUrl = `${baseUrl}${layerFile}`;
        
        try {
            const response = await fetch(layerUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const svgText = await response.text();
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const sourceSvg = svgDoc.querySelector('svg');
            
            if (!sourceSvg) throw new Error('No SVG element found');
            
            // Create layer group
            const layerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            layerGroup.setAttribute('id', `${this.containerId}-layer-${layerName}`);
            layerGroup.setAttribute('class', 'track-svg-layer');
            
            // Copy all child elements from source SVG to layer group
            while (sourceSvg.firstChild) {
                layerGroup.appendChild(sourceSvg.firstChild);
            }
            
            // Set initial visibility
            const isDefaultLayer = this.options.defaultLayers.includes(layerName);
            if (!isDefaultLayer) {
                layerGroup.style.display = 'none';
            }
            
            // Update container viewBox from first loaded layer (usually background)
            if (layerName === 'background' && sourceSvg.getAttribute('viewBox')) {
                svgContainer.setAttribute('viewBox', sourceSvg.getAttribute('viewBox'));
            }
            
            svgContainer.appendChild(layerGroup);
            
            // Store layer reference
            this.layers[layerName] = layerGroup;
            
            console.log(`✅ Loaded track map layer: ${layerName}`);
            
        } catch (error) {
            console.warn(`❌ Failed to load track map layer ${layerName}:`, error);
        }
    }
    
    toggleLayer(layerName, visible) {
        const layerGroup = this.layers[layerName];
        if (layerGroup) {
            layerGroup.style.display = visible ? 'block' : 'none';
            console.log(`🎚️ Layer ${layerName}: ${visible ? 'visible' : 'hidden'}`);
        }
    }
    
    toggleFullscreen() {
        const mapContainer = document.getElementById(`${this.containerId}-map`);
        if (mapContainer) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                mapContainer.requestFullscreen().catch(console.warn);
            }
        }
    }
    
    // Public API methods
    showLayer(layerName) {
        this.toggleLayer(layerName, true);
        if (this.options.showControls) {
            const checkbox = document.getElementById(`${this.containerId}-layer-${layerName}`);
            if (checkbox) checkbox.checked = true;
        }
    }
    
    hideLayer(layerName) {
        this.toggleLayer(layerName, false);
        if (this.options.showControls) {
            const checkbox = document.getElementById(`${this.containerId}-layer-${layerName}`);
            if (checkbox) checkbox.checked = false;
        }
    }
    
    setLayers(visibleLayers) {
        const allLayers = ['background', 'active', 'pitroad', 'start-finish', 'turns'];
        allLayers.forEach(layer => {
            const visible = visibleLayers.includes(layer);
            this.toggleLayer(layer, visible);
            if (this.options.showControls) {
                const checkbox = document.getElementById(`${this.containerId}-layer-${layer}`);
                if (checkbox) checkbox.checked = visible;
            }
        });
    }
    
    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
        this.layers = {};
        this.svgContainer = null;
        this.controlsContainer = null;
    }
}

// CSS styles (inject if not already present)
if (!document.querySelector('#track-map-styles')) {
    const style = document.createElement('style');
    style.id = 'track-map-styles';
    style.textContent = `
        /* Track Map Component Styles */
        .track-layer-toggle input:checked + label {
            background-color: #22c55e !important; /* green-500 */
        }
        
        .track-layer-toggle input:checked + label span {
            transform: translateX(100%) !important;
        }
        
        .track-layer-toggle input:not(:checked) + label {
            background-color: #525252 !important; /* neutral-600 */
        }
        
        .track-svg-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .track-map-wrapper svg {
            max-width: 100%;
            max-height: 100%;
            height: auto;
            width: auto;
        }
    `;
    document.head.appendChild(style);
}