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
            <div class="border-t border-neutral-700 pt-6">
                <h3 class="text-lg font-medium text-neutral-300 mb-4">Track Map</h3>
                
                <div class="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-4">
                        <!-- Track Map SVG Container -->
                        <div class="flex-1 ${this.options.showControls ? 'mr-4' : ''}">
                            <div id="${this.containerId}-map" class="relative bg-neutral-800 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                            <div id="${this.containerId}-loading" class="text-neutral-400">
                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                <p>Loading track map...</p>
                            </div>
                            <div id="${this.containerId}-svg" class="hidden w-full h-full">
                                <!-- SVG track map will be loaded here -->
                            </div>
                            <div id="${this.containerId}-error" class="hidden text-neutral-400 text-center">
                                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                                <p>Track map not available</p>
                            </div>
                        </div>
                    </div>
                    
                    ${this.options.showControls ? this.createControlsHTML() : ''}
                    </div>
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
            <div id="${this.containerId}-controls" class="w-48 bg-neutral-900 border border-neutral-600 rounded-lg p-3">
                <h4 class="text-xs font-medium text-neutral-300 mb-2">Map Layers</h4>
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-neutral-400">Background</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="layer-background" class="sr-only peer" checked>
                            <div class="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-neutral-400">Active Config</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="layer-active" class="sr-only peer" checked>
                            <div class="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-neutral-400">Pit Road</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="layer-pitroad" class="sr-only peer">
                            <div class="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-neutral-400">Start/Finish</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="layer-start-finish" class="sr-only peer">
                            <div class="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-neutral-400">Turn Numbers</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="layer-turns" class="sr-only peer">
                            <div class="relative w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        if (!this.options.showControls) return;
        
        const layerNames = ['background', 'active', 'pitroad', 'start-finish', 'turns'];
        
        layerNames.forEach(layerName => {
            const checkbox = document.getElementById(`layer-${layerName}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.toggleLayer(layerName, e.target.checked);
                });
            }
        });
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
            layerGroup.setAttribute('id', `layer-${layerName}`);
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

            // Apply your exact color styles after a short delay to ensure DOM is ready
            setTimeout(() => {
                this.applyLayerStyles(layerGroup, layerName);
            }, 100);            // Update container viewBox from first loaded layer (usually background)
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
    
    applyLayerStyles(layerGroup, layerName) {
        // Apply your exact color styles based on layer name
        const styles = {
            'background': { fill: '#5a5a5a', stroke: '#5a5a5a', strokeWidth: '2px' },
            'active': { fill: '#d1d1d1', stroke: '#d1d1d1', strokeWidth: '1px' },
            'inactive': { fill: '#111827', stroke: '#1f2937', strokeWidth: '1px' },
            'pitroad': { fill: '#059669', stroke: '#047857', strokeWidth: '2px' },
            'start-finish': { fill: '#dc2626', stroke: '#991b1b', strokeWidth: '3px' },
            'turns': { fill: '#ffbf00', stroke: '#ffea00', strokeWidth: '1px', fontFamily: 'Arial, sans-serif', fontSize: '18px', fontWeight: 'bold' }
        };

        if (styles[layerName]) {
            const style = styles[layerName];
            const elements = layerGroup.querySelectorAll('*');
            
            elements.forEach((element) => {
                if (style.fill) {
                    element.setAttribute('fill', style.fill);
                    element.style.setProperty('fill', style.fill, 'important');
                }
                if (style.stroke) {
                    element.setAttribute('stroke', style.stroke);
                    element.style.setProperty('stroke', style.stroke, 'important');
                }
                if (style.strokeWidth) {
                    element.setAttribute('stroke-width', style.strokeWidth);
                    element.style.setProperty('stroke-width', style.strokeWidth, 'important');
                }
                if (style.fontFamily) element.setAttribute('font-family', style.fontFamily);
                if (style.fontSize) element.setAttribute('font-size', style.fontSize);
                if (style.fontWeight) element.setAttribute('font-weight', style.fontWeight);
            });

            // For text elements in turns layer, make them white and apply proper font
            if (layerName === 'turns') {
                const textElements = layerGroup.querySelectorAll('text');
                console.log(`🔤 TURNS: Found ${textElements.length} text elements`);
                textElements.forEach(text => {
                    text.setAttribute('fill', '#ffffff');
                    text.style.setProperty('fill', '#ffffff', 'important');
                    text.setAttribute('font-weight', 'bold');
                    text.setAttribute('font-family', 'Arial, sans-serif');
                    text.setAttribute('font-size', '18px');
                    text.style.setProperty('font-family', 'Arial, sans-serif', 'important');
                    text.style.setProperty('font-size', '18px', 'important');
                    text.style.setProperty('font-weight', 'bold', 'important');
                    console.log('🔤 Applied font styles to turn number:', text.textContent, 'fill:', text.getAttribute('fill'));
                });
                

            }
        }
    }
    
    toggleLayer(layerName, visible) {
        const layerGroup = this.layers[layerName];
        if (layerGroup) {
            layerGroup.style.display = visible ? 'block' : 'none';
            console.log(`🎚️ Layer ${layerName}: ${visible ? 'visible' : 'hidden'}`);
        }
    }
    

    
    // Public API methods
    showLayer(layerName) {
        this.toggleLayer(layerName, true);
        if (this.options.showControls) {
            const checkbox = document.getElementById(`layer-${layerName}`);
            if (checkbox) checkbox.checked = true;
        }
    }
    
    hideLayer(layerName) {
        this.toggleLayer(layerName, false);
        if (this.options.showControls) {
            const checkbox = document.getElementById(`layer-${layerName}`);
            if (checkbox) checkbox.checked = false;
        }
    }
    
    setLayers(visibleLayers) {
        const allLayers = ['background', 'active', 'pitroad', 'start-finish', 'turns'];
        allLayers.forEach(layer => {
            const visible = visibleLayers.includes(layer);
            this.toggleLayer(layer, visible);
            if (this.options.showControls) {
                const checkbox = document.getElementById(`layer-${layer}`);
                if (checkbox) checkbox.checked = visible;
            }
        });
    }

    async loadTrackFromAPI(trackId) {
        console.log('🗺️ Loading track map from API for track:', trackId);
        
        try {
            // Fetch track assets data via API endpoint
            const response = await fetch(`/api/track-assets/${trackId}`);
            
            if (response.status === 404) {
                throw new Error('Track map data not available for this track');
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch track assets: ${response.status}`);
            }
            
            const trackAssets = await response.json();
            
            if (!trackAssets || !trackAssets.track_map || !trackAssets.track_map_layers) {
                throw new Error('Track map data not available');
            }

            // Load the track map
            await this.loadTrackMap(trackAssets);
            
            console.log('✅ Track map loaded successfully from API');
            
        } catch (error) {
            console.warn('❌ Failed to load track map from API:', error.message);
            throw error;
        }
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
        /* Track Layer Toggle Styles */
        .track-layer-toggle input:checked + label {
            background-color: #22c55e !important; /* green-500 */
        }
        
        .track-layer-toggle input:checked + label span {
            transform: translateX(100%) !important;
        }
        
        .track-layer-toggle input:not(:checked) + label {
            background-color: #525252 !important; /* neutral-600 */
        }
        
        .track-layer-toggle input:not(:checked) + label span {
            transform: translateX(0%) !important;
        }

        /* SVG Track Map Layer Styling - Dark Mode */
        .track-svg-layer {
            transition: opacity 0.3s ease;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        
        .track-svg-layer.hidden {
            display: none;
        }
        
        /* Dark mode track styling with progressive shading */
        #layer-background, [id*="background"], .background-layer {
            fill: #5a5a5a !important; /* Gray for track outline/boundaries */
            stroke: #5a5a5a !important; /* Light gray for track borders */
            stroke-width: 2px !important;
        }
        
        #layer-active, [id*="active"], .active-layer {
            fill: #d1d1d1 !important; /* Light gray for racing surface */
            stroke: #d1d1d1 !important; /* Medium gray for track edges */
            stroke-width: 1px !important;
        }
        
        #layer-inactive, [id*="inactive"], .inactive-layer {
            fill: #111827 !important; /* Very dark gray for unused sections */
            stroke: #1f2937 !important; /* Dark gray borders */
            stroke-width: 1px !important;
        }
        
        #layer-pitroad, [id*="pitroad"], [id*="pit"], .pitroad-layer {
            fill: #059669 !important; /* Green for pit road */
            stroke: #047857 !important; /* Darker green borders */
            stroke-width: 2px !important;
        }
        
        #layer-start-finish, [id*="start"], [id*="finish"], .start-finish-layer {
            fill: #dc2626 !important; /* Red for start/finish line */
            stroke: #991b1b !important; /* Darker red borders */
            stroke-width: 3px !important;
        }
        
        #layer-turns, [id*="turn"], [id*="number"], .turns-layer {
            fill: #ffbf00 !important; /* Yellow for turn numbers */
            stroke: #ffea00 !important; /* Darker yellow borders */
            stroke-width: 1px !important;
            font-family: Arial, sans-serif !important;
            font-size: 12px !important;
            font-weight: bold !important;
        }
        
        /* Broad SVG element targeting - Override all black/white SVG elements */
        svg path[fill="#000000"], svg path[fill="black"], svg path[fill="#000"] {
            fill: #5a5a5a !important;
            stroke: #5a5a5a !important;
            stroke-width: 2px !important;
        }
        
        svg path[fill="#ffffff"], svg path[fill="white"], svg path[fill="#fff"] {
            fill: #d1d1d1 !important;
            stroke: #d1d1d1 !important;
            stroke-width: 1px !important;
        }
        
        /* Force all SVG elements to use our color scheme */
        svg * {
            fill: #5a5a5a !important;
            stroke: #5a5a5a !important;
        }
        
        /* Override any default SVG colors and ensure visibility on dark background */
        svg path:not([id*="pit"]):not([id*="start"]):not([id*="finish"]):not([id*="turn"]) {
            fill: #5a5a5a !important;
            stroke: #5a5a5a !important;
            stroke-width: 2px !important;
        }
        
        svg g[id*="pit"] path, svg path[id*="pit"] {
            fill: #059669 !important;
            stroke: #047857 !important;
            stroke-width: 2px !important;
        }
        
        svg g[id*="start"] path, svg path[id*="start"], svg g[id*="finish"] path, svg path[id*="finish"] {
            fill: #dc2626 !important;
            stroke: #991b1b !important;
            stroke-width: 3px !important;
        }
        
        svg text {
            fill: #ffbf00 !important;
            font-weight: bold !important;
            stroke: none !important;
        }
        
        /* Ensure text elements are visible */
        .track-svg-layer text {
            fill: #ffbf00 !important;
            font-weight: bold !important;
        }
        
        /* Track map container styling */
        #track-map-svg svg {
            background: transparent !important;
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
        }
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
        }
    `;
    document.head.appendChild(style);
}