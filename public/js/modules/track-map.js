// ============================================================================
// DEBUG SYSTEM - Set to false to disable all debug console output
// ============================================================================
const DEBUG = false;

// Debug helper functions
const debug = (...args) => { if (DEBUG) console.log(...args); };
const debugWarn = (...args) => { if (DEBUG) console.warn(...args); };
const debugError = (...args) => { if (DEBUG) console.error(...args); };

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
            <div>
                <div class="bg-neutral-800 rounded-lg p-4">
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
        
        // Use event delegation on the controls container for better reliability
        const controlsContainer = document.getElementById(`${this.containerId}-controls`);
        if (controlsContainer) {
            controlsContainer.addEventListener('change', (e) => {
                if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
                    const layerName = e.target.id.replace('layer-', '');
                    this.toggleLayer(layerName, e.target.checked);
                }
            });
        }
        
        // Also set up direct listeners for each checkbox as fallback
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
        debug('🗺️ Loading track map:', trackMapData);
        
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
            
            // Re-attach event listeners after map loads
            this.setupEventListeners();
            
            debug('✅ Track map loaded successfully');
            
        } catch (error) {
            debugWarn('❌ Failed to load track map:', error);
            
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
        
        debug('📋 Available track map layers:', Object.keys(layers));
        
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
                    debugWarn(`⚠️ Failed to load layer ${layerName}:`, error);
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
            }, 100);
            
            // Update container viewBox from first loaded layer (usually background)
            if (layerName === 'background' && sourceSvg.getAttribute('viewBox')) {
                svgContainer.setAttribute('viewBox', sourceSvg.getAttribute('viewBox'));
            }
            
            svgContainer.appendChild(layerGroup);
            
            // Store layer reference
            this.layers[layerName] = layerGroup;
            
            debug(`✅ Loaded track map layer: ${layerName}`);
            
        } catch (error) {
            debugWarn(`❌ Failed to load track map layer ${layerName}:`, error);
        }
    }
    
    applyLayerStyles(layerGroup, layerName) {
        // Apply your exact color styles based on layer name
        const styles = {
            'background': { fill: '#5a5a5a', stroke: '#5a5a5a', strokeWidth: '1px' },
            'active': { fill: '#d1d1d1', stroke: '#d1d1d1', strokeWidth: '1px' },
            'inactive': { fill: '#111827', stroke: '#1f2937', strokeWidth: '1px' },
            'pitroad': { fill: '#059669', stroke: '#047857', strokeWidth: '1px' },
            'start-finish': { fill: '#dc2626', stroke: '#991b1b', strokeWidth: '1px' },
            'turns': { fill: '#ffbf00', stroke: 'rgba(255, 234, 0, 0)', strokeWidth: '1px', fontFamily: 'Arial, sans-serif', fontSize: '24px', fontWeight: 'bold' }
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
                if (style.fontFamily) {
                    // Remove existing font attributes that might override
                    element.removeAttribute('font-family');
                    element.setAttribute('font-family', style.fontFamily);
                    element.style.setProperty('font-family', style.fontFamily, 'important');
                }
                if (style.fontSize) {
                    element.setAttribute('font-size', style.fontSize);
                    element.style.setProperty('font-size', style.fontSize, 'important');
                }
                if (style.fontWeight) {
                    element.setAttribute('font-weight', style.fontWeight);
                    element.style.setProperty('font-weight', style.fontWeight, 'important');
                }
                
                // Add crisp text rendering for turn numbers
                if (layerName === 'turns' && element.tagName === 'text') {
                    element.style.textRendering = 'optimizeLegibility';
                    element.style.shapeRendering = 'crispEdges';
                }
            });

        }

        // ========== MAP COLOURS: Selective element styling for background layer ==========
        // Colours for individual background elements (Pavement, Buildings, Water, Bridge)
        if (layerName === 'background') {
            const elementColours = {
                'Pavement': '#8c8c8cff',       // Dark gray (keep default)
                'Buildings': '#494949ff',      // Darker gray for buildings
                'Water': '#8990fcff',          // Blue for water bodies
                'Bridge': '#636466',         // Dark gray (keep default, same as Pavement)
                'Bridge_1_': '#636466',      // Dark gray for numbered bridges
                'Bridge_2_': '#636466',
                'Bridge_3_': '#636466'
            };

            // Apply colours to specific element groups
            for (const [groupName, colour] of Object.entries(elementColours)) {
                const groupElements = layerGroup.querySelectorAll(`g[id="${groupName}"] *`);
                groupElements.forEach(el => {
                    el.setAttribute('fill', colour);
                    el.style.setProperty('fill', colour, 'important');
                    el.setAttribute('stroke', colour);
                    el.style.setProperty('stroke', colour, 'important');
                });
            }
        }
        // ============================= END MAP COLOURS ====================================

        // ========== START-FINISH STYLING: Line and arrow customization ==========
        // Separate styling for start-finish line and arrow elements
        if (layerName === 'start-finish') {
            const startFinishGroup = layerGroup.querySelector('g[id="Start_Finish_Link"]');
            if (startFinishGroup) {
                const paths = startFinishGroup.querySelectorAll('path');
                
                // Configuration for line and arrow
                const lineConfig = {
                    colour: '#dc2626',      // Line colour (red)
                    strokeWidth: '1px',
                    scale: 0.5
                };
                
                const arrowConfig = {
                    colour: '#dc2626',      // Arrow colour (lighter red for distinction)
                    strokeWidth: '1px',
                    scale: 0.5              // Scale factor for arrow (0.7 = 70% of original size)
                };

                paths.forEach((path, index) => {
                    if (index === 0) {
                        // First path = LINE
                        path.setAttribute('fill', lineConfig.colour);
                        path.style.setProperty('fill', lineConfig.colour, 'important');
                        path.setAttribute('stroke-width', lineConfig.strokeWidth);
                        path.style.setProperty('stroke-width', lineConfig.strokeWidth, 'important');
                    } else if (index === 1) {
                        // Second path = ARROW
                        path.setAttribute('fill', arrowConfig.colour);
                        path.style.setProperty('fill', arrowConfig.colour, 'important');
                        path.setAttribute('stroke-width', arrowConfig.strokeWidth);
                        path.style.setProperty('stroke-width', arrowConfig.strokeWidth, 'important');
                        
                        // Apply scale to arrow
                        if (arrowConfig.scale && arrowConfig.scale !== 1) {
                            const bbox = path.getBBox();
                            const centerX = bbox.x + bbox.width / 2;
                            const centerY = bbox.y + bbox.height / 2;
                            const scaleTransform = `translate(${centerX}, ${centerY}) scale(${arrowConfig.scale}) translate(${-centerX}, ${-centerY})`;
                            path.setAttribute('transform', scaleTransform);
                        }
                    }
                });
            }
        }
        // ========================= END START-FINISH STYLING ===========================
    }
    
    toggleLayer(layerName, visible) {
        const layerGroup = this.layers[layerName];
        if (layerGroup) {
            layerGroup.style.display = visible ? 'block' : 'none';
            debug(`🎚️ Layer ${layerName}: ${visible ? 'visible' : 'hidden'}`);
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
        debug('🗺️ Loading track map from API for track:', trackId);
        
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
            
            debug('✅ Track map loaded successfully from API');
            
        } catch (error) {
            debugWarn('❌ Failed to load track map from API:', error.message);
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
        .track-svg-layer {
            transition: opacity 0.3s ease;
        }
        
        .track-svg-layer.hidden {
            display: none;
        }
    `;
    document.head.appendChild(style);
}