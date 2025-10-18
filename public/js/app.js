// RadianPlanner - Main Application File
// This file orchestrates all modules and handles application initialization

import { APIClient } from './modules/api-client.js';
import { UIManager } from './modules/ui-manager.js';
import { StrategyCalculator } from './modules/strategy-calculator.js';
import { Garage61Client } from './modules/garage61-client.js';

class RadianPlannerApp {
    constructor() {
        this.apiClient = new APIClient();
        this.uiManager = new UIManager();
        this.strategyCalculator = new StrategyCalculator();
        this.garage61Client = new Garage61Client();
        
        this.currentStrategies = [];
        this.allData = {};
        this.isLoading = false;
        this.selectedDrivers = [];
        this.selectedTrack = null;
        this.selectedCar = null;
        
        // Weather chart instances
        this.temperatureChart = null;
        this.cloudsChart = null;
        this.disposables = [];
        
        this.init();
    }

    async init() {
        console.log('🏁 Initializing RadianPlanner...');
        
        try {
            // Initialize UI Manager (it handles its own initialization)
            // this.uiManager will initialize automatically in constructor
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('✅ RadianPlanner initialized successfully!');
        } catch (error) {
            console.error('❌ Failed to initialize RadianPlanner:', error);
        }
    }

    async loadInitialData() {
        console.log('📥 Loading initial data...');
        
        try {
            this.setLoading(true);
            
            // Load all data from server
            this.allData = await this.apiClient.fetchAllData();
            
            // Populate dropdowns with loaded data
            this.populateSeriesDropdown();
            this.populateDriversDropdown();
            this.populateTracksDropdown();
            this.populateCarsDropdown();
            
            console.log('✅ Initial data loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.uiManager.showNotification('Failed to load initial data', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    populateSeriesDropdown() {
        const seriesSelect = document.getElementById('series-select');
        if (!seriesSelect || !this.allData.series) return;

        seriesSelect.innerHTML = '<option value="">Select Series</option>';
        
        this.allData.series.forEach(series => {
            const option = document.createElement('option');
            option.value = series.series_id;
            option.textContent = series.series_name;
            seriesSelect.appendChild(option);
        });
    }

    populateDriversDropdown() {
        const driverSelect = document.getElementById('driver-select');
        if (!driverSelect || !this.allData.drivers) return;

        driverSelect.innerHTML = '<option value="">Select a Driver...</option>';
        
        // Filter out drivers without names and sort alphabetically
        const validDrivers = this.allData.drivers.filter(driver => driver && driver.name);
        const sortedDrivers = validDrivers.sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        sortedDrivers.forEach(driver => {
            const option = document.createElement('option');
            option.value = driver.name;
            option.textContent = driver.name;
            driverSelect.appendChild(option);
        });

        console.log(`✅ Populated drivers dropdown with ${sortedDrivers.length} drivers`);
    }

    populateTracksDropdown() {
        const trackSelect = document.getElementById('track-select');
        if (!trackSelect || !this.allData.tracks) return;

        trackSelect.innerHTML = '<option value="">Select a Track...</option>';
        
        // Filter out tracks without names and sort alphabetically
        const validTracks = this.allData.tracks.filter(track => track && track.name);
        const sortedTracks = validTracks.sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        sortedTracks.forEach(track => {
            const option = document.createElement('option');
            option.value = track.name;
            option.textContent = track.name;
            trackSelect.appendChild(option);
        });

        console.log(`✅ Populated tracks dropdown with ${sortedTracks.length} tracks`);
    }

    populateCarsDropdown() {
        // This method now just sets up the class dropdown listener
        // The actual car population happens when a class is selected
        console.log('✅ Car dropdown system initialized');
    }

    populateCarsByClass(selectedClass) {
        const carSelect = document.getElementById('car-select');
        if (!carSelect || !this.allData.cars) return;

        // Enable the car dropdown
        carSelect.disabled = false;
        carSelect.innerHTML = '<option value="">Select a Car...</option>';

        if (!selectedClass) {
            carSelect.disabled = true;
            carSelect.innerHTML = '<option value="">Select Class First...</option>';
            return;
        }

        // Define class ID mappings based on your reference
        const classIdMap = {
            'GT3': [4083, 2708, 4091],
            'GT4': [4048, 4084], 
            'GTP': [4029],
            'Porsche Cup': [3104]
        };

        const classIds = classIdMap[selectedClass];
        if (!classIds) return;

        // Filter cars by selected class
        const classCars = this.allData.cars.filter(car => 
            car && car.name && car.iracing_class_id && 
            classIds.includes(parseInt(car.iracing_class_id))
        );

        // Sort alphabetically
        const sortedCars = classCars.sort((a, b) => 
            a.name.localeCompare(b.name)
        );

        sortedCars.forEach(car => {
            const option = document.createElement('option');
            option.value = car.name;
            option.textContent = car.name;
            
            // Store class info for reference
            option.dataset.classId = car.iracing_class_id;
            option.dataset.className = car.class_name || '';
            
            carSelect.appendChild(option);
        });

        console.log(`✅ Populated ${sortedCars.length} ${selectedClass} cars`);
    }

    async populateEventsDropdown(seriesId) {
        const eventsSelect = document.getElementById('event-select');
        if (!eventsSelect) return;

        console.log('🔍 Loading events for series ID:', seriesId, 'Type:', typeof seriesId);
        eventsSelect.innerHTML = '<option value="">Loading events...</option>';
        
        try {
            const url = `/api/events/${seriesId}`;
            console.log('🌐 Fetching URL:', url);
            const response = await fetch(url);
            console.log('🔍 Response status:', response.status, response.statusText);
            console.log('🔍 Response headers:', response.headers.get('content-type'));
            
            const responseText = await response.text();
            console.log('🔍 Raw response:', responseText.substring(0, 200));
            
            const events = JSON.parse(responseText);
            
            eventsSelect.innerHTML = '<option value="">Select Event</option>';
            
            if (!Array.isArray(events)) {
                console.error('❌ Events response is not an array:', events);
                eventsSelect.innerHTML = '<option value="">Error: ' + (events.error || 'Invalid response') + '</option>';
                return;
            }
            
            events.forEach(event => {
                const option = document.createElement('option');
                option.value = event.event_id || event.id;
                
                // Format the date for display
                const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                
                option.textContent = `${event.event_name} - ${eventDate}`;
                eventsSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching events:', error);
            eventsSelect.innerHTML = '<option value="">Error loading events</option>';
        }

        // Reset sessions dropdown
        const sessionsSelect = document.getElementById('session-select');
        if (sessionsSelect) {
            sessionsSelect.innerHTML = '<option value="">Select Session</option>';
        }
    }

    async populateSessionsDropdown(eventId) {
        const sessionsSelect = document.getElementById('session-select');
        if (!sessionsSelect) return;

        console.log('🔍 Loading sessions for event ID:', eventId);
        sessionsSelect.innerHTML = '<option value="">Loading sessions...</option>';
        sessionsSelect.disabled = false;
        
        try {
            const response = await fetch(`/api/sessions/${eventId}`);
            if (!response.ok) throw new Error('Failed to fetch sessions');
            
            const sessions = await response.json();
            console.log('✅ Found sessions:', sessions);
            
            sessionsSelect.innerHTML = '<option value="">Select Session</option>';
            
            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.session_id;
                
                // Format session display with name and date
                const sessionDate = new Date(session.session_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                option.textContent = `${session.session_name} - ${sessionDate}`;
                sessionsSelect.appendChild(option);
            });
            
        } catch (error) {
            console.error('❌ Error fetching sessions:', error);
            sessionsSelect.innerHTML = '<option value="">Error loading sessions</option>';
        }
    }

    async populateRaceInformation(sessionId) {
        console.log('🔍 Loading race information for session ID:', sessionId);
        
        try {
            const response = await fetch(`/api/session-details/${sessionId}`);
            if (!response.ok) throw new Error('Failed to fetch session details');
            
            const sessionDetails = await response.json();
            console.log('✅ Session details:', sessionDetails);
            
            // Show the race info content and hide placeholder
            const raceInfoContent = document.getElementById('race-info-content');
            const raceInfoPlaceholder = document.getElementById('race-info-placeholder');
            
            if (raceInfoContent) raceInfoContent.classList.remove('hidden');
            if (raceInfoPlaceholder) raceInfoPlaceholder.classList.add('hidden');
            
            // Populate race datetime (simulated_start_time)
            const raceDatetimeElement = document.getElementById('race-datetime');
            if (raceDatetimeElement && sessionDetails.simulated_start_time) {
                const raceDateTime = new Date(sessionDetails.simulated_start_time);
                raceDatetimeElement.textContent = raceDateTime.toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
            }
            
            // Populate event datetime (session_date)
            const eventDatetimeElement = document.getElementById('event-datetime');
            if (eventDatetimeElement && sessionDetails.session_date) {
                const eventDateTime = new Date(sessionDetails.session_date);
                eventDatetimeElement.textContent = eventDateTime.toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                });
            }
            
            // Populate session length
            const sessionLengthElement = document.getElementById('session-length');
            if (sessionLengthElement && sessionDetails.session_length) {
                const hours = Math.floor(sessionDetails.session_length / 60);
                const minutes = sessionDetails.session_length % 60;
                sessionLengthElement.textContent = hours > 0 ? 
                    `${hours}h ${minutes}m` : `${minutes} minutes`;
            }
            
            // Populate track details
            await this.populateTrackDetails(sessionDetails);
            
            // Populate car selection
            await this.populateCarSelection(sessionDetails);
            
        } catch (error) {
            console.error('❌ Error fetching session details:', error);
            this.clearRaceInformation();
        }
    }

    clearRaceInformation() {
        // Hide race info content and show placeholder
        const raceInfoContent = document.getElementById('race-info-content');
        const raceInfoPlaceholder = document.getElementById('race-info-placeholder');
        
        if (raceInfoContent) raceInfoContent.classList.add('hidden');
        if (raceInfoPlaceholder) raceInfoPlaceholder.classList.remove('hidden');
        
        // Clear all the content
        const elements = ['race-datetime', 'event-datetime', 'session-length'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
        
        // Clear track details
        this.clearTrackDetails();
        
        // Clear weather display
        this.clearWeatherDisplay();
        
        // Clear car selection
        this.clearCarSelection();
    }

    async populateCarSelection(sessionDetails) {
        // Show car selection content and hide placeholder
        const carSelectionContent = document.getElementById('car-selection-content');
        const carSelectionPlaceholder = document.getElementById('car-selection-placeholder');
        
        if (carSelectionContent) carSelectionContent.classList.remove('hidden');
        if (carSelectionPlaceholder) carSelectionPlaceholder.classList.add('hidden');
        
        // Populate car class dropdown
        const carClassDropdown = document.getElementById('car-class-dropdown');
        if (carClassDropdown && sessionDetails.available_car_classes) {
            carClassDropdown.innerHTML = '<option value="">Select Car Class...</option>';
            carClassDropdown.disabled = false;
            
            sessionDetails.available_car_classes.forEach(carClass => {
                const option = document.createElement('option');
                option.value = carClass.car_class_id;
                option.textContent = carClass.name;
                carClassDropdown.appendChild(option);
            });
            
            console.log(`✅ Populated car classes: ${sessionDetails.available_car_classes.length} classes`);
        }
        
        // Reset car dropdown
        const carDropdown = document.getElementById('car-dropdown');
        if (carDropdown) {
            carDropdown.innerHTML = '<option value="">Select Car Class First...</option>';
            carDropdown.disabled = true;
        }
        
        // Store session details for later use
        this.currentSessionDetails = sessionDetails;
    }

    async populateCarsByClass(classId) {
        const carDropdown = document.getElementById('car-dropdown');
        if (!carDropdown || !classId) return;
        
        console.log('🔍 Loading cars for class ID:', classId);
        carDropdown.innerHTML = '<option value="">Loading cars...</option>';
        carDropdown.disabled = false;
        
        try {
            // Fetch cars filtered by the selected class
            const response = await fetch(`/api/cars`);
            if (!response.ok) throw new Error('Failed to fetch cars');
            
            const allCars = await response.json();
            const filteredCars = allCars.filter(car => 
                car.iracing_class_id && car.iracing_class_id.toString() === classId.toString()
            );
            
            carDropdown.innerHTML = '<option value="">Select Car...</option>';
            
            filteredCars.forEach(car => {
                const option = document.createElement('option');
                option.value = car.car_id || car.id;
                option.textContent = car.car_name || car.name;
                carDropdown.appendChild(option);
            });
            
            console.log(`✅ Found ${filteredCars.length} cars for class ${classId}`);
            
        } catch (error) {
            console.error('❌ Error fetching cars:', error);
            carDropdown.innerHTML = '<option value="">Error loading cars</option>';
        }
    }

    clearCarSelection() {
        // Hide car selection content and show placeholder
        const carSelectionContent = document.getElementById('car-selection-content');
        const carSelectionPlaceholder = document.getElementById('car-selection-placeholder');
        
        if (carSelectionContent) carSelectionContent.classList.add('hidden');
        if (carSelectionPlaceholder) carSelectionPlaceholder.classList.remove('hidden');
        
        // Reset dropdowns
        const carClassDropdown = document.getElementById('car-class-dropdown');
        const carDropdown = document.getElementById('car-dropdown');
        
        if (carClassDropdown) {
            carClassDropdown.innerHTML = '<option value="">Select Session First...</option>';
            carClassDropdown.disabled = true;
        }
        
        if (carDropdown) {
            carDropdown.innerHTML = '<option value="">Select Car Class First...</option>';
            carDropdown.disabled = true;
        }
        
        // Clear stored session details
        this.currentSessionDetails = null;
        
        // Clear car details
        this.clearCarDetails();
    }

    async populateCarDetails(carId, carName) {
        console.log('🔍 Loading car details for car ID:', carId);
        
        try {
            // Fetch car details from the cars API
            const response = await fetch(`/api/cars`);
            if (!response.ok) throw new Error('Failed to fetch cars');
            
            const cars = await response.json();
            const selectedCar = cars.find(car => 
                (car.car_id && car.car_id.toString() === carId.toString()) || 
                (car.id && car.id.toString() === carId.toString())
            );
            
            if (!selectedCar) {
                console.error('❌ Car not found:', carId);
                return;
            }
            
            console.log('✅ Found car details:', selectedCar);
            
            // Show car details section
            const carDetailsSection = document.getElementById('car-details-section');
            if (carDetailsSection) carDetailsSection.classList.remove('hidden');
            
            // Populate car name
            const carNameElement = document.getElementById('car-name');
            if (carNameElement) {
                carNameElement.textContent = selectedCar.car_name || carName || '-';
            }
            
            // Populate Garage61 ID
            const garage61IdElement = document.getElementById('garage61-id');
            if (garage61IdElement) {
                garage61IdElement.textContent = selectedCar.garage61_id ? 
                    `Garage61 ID: ${selectedCar.garage61_id}` : 'Garage61 ID: -';
            }
            
            // Populate car weight
            const carWeightElement = document.getElementById('car-weight');
            if (carWeightElement) {
                carWeightElement.textContent = selectedCar.car_weight ? 
                    `${selectedCar.car_weight} kg` : '-';
            }
            
            // Populate car HP
            const carHpElement = document.getElementById('car-hp');
            if (carHpElement) {
                console.log('🏎️ Car HP data:', selectedCar.hp);
                carHpElement.textContent = selectedCar.hp ? 
                    `${selectedCar.hp} HP` : '-';
                console.log('🏎️ Set HP element to:', carHpElement.textContent);
            }
            
            // Populate car image
            const carImageElement = document.getElementById('car-image');
            if (carImageElement && selectedCar.small_image && selectedCar.folder) {
                const imageUrl = `https://images-static.iracing.com/${selectedCar.folder}/${selectedCar.small_image}`;
                carImageElement.src = imageUrl;
                carImageElement.alt = selectedCar.car_name || 'Car Image';
                carImageElement.classList.remove('hidden');
                
                console.log('🖼️ Loading car image:', imageUrl);
                console.log('🖼️ Folder field contains:', selectedCar.folder);
                
                // Handle image load errors
                carImageElement.onerror = function() {
                    console.warn('❌ Failed to load car image:', imageUrl);
                    this.classList.add('hidden');
                };
            } else if (carImageElement) {
                carImageElement.classList.add('hidden');
                if (selectedCar.small_image && !selectedCar.folder) {
                    console.warn('❌ Car has small_image but missing folder:', selectedCar);
                }
            }
            
            // Store selected car details for later use
            this.selectedCar = {
                id: carId,
                name: carName,
                details: selectedCar
            };
            
        } catch (error) {
            console.error('❌ Error fetching car details:', error);
            this.clearCarDetails();
        }
    }

    clearCarDetails() {
        // Hide car details section
        const carDetailsSection = document.getElementById('car-details-section');
        if (carDetailsSection) carDetailsSection.classList.add('hidden');
        
        // Clear car details content
        const elements = ['car-name', 'garage61-id', 'car-weight', 'car-hp'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
        
        // Hide car image
        const carImageElement = document.getElementById('car-image');
        if (carImageElement) {
            carImageElement.classList.add('hidden');
            carImageElement.src = '';
        }
        
        // Clear stored car details
        this.selectedCar = null;
    }

    async populateTrackDetails(sessionDetails) {
        console.log('🏁 Populating track details:', sessionDetails);
        
        // Show track details section
        const trackDetailsSection = document.getElementById('track-details-section');
        if (trackDetailsSection) trackDetailsSection.classList.remove('hidden');
        
        // Show track map section
        const trackMapSection = document.getElementById('track-map-section');
        if (trackMapSection) trackMapSection.classList.remove('hidden');
        
        // Populate track name
        const trackNameElement = document.getElementById('track-name');
        if (trackNameElement) {
            trackNameElement.textContent = sessionDetails.track_name || '-';
        }
        
        // Populate Garage61 ID
        const trackGarage61IdElement = document.getElementById('track-garage61-id');
        if (trackGarage61IdElement) {
            trackGarage61IdElement.textContent = sessionDetails.track_garage61_id ? 
                `Garage61 ID: ${sessionDetails.track_garage61_id}` : 'Garage61 ID: -';
        }
        
        // Populate track config
        const trackConfigElement = document.getElementById('track-config');
        if (trackConfigElement) {
            trackConfigElement.textContent = sessionDetails.config_name || '-';
        }
        
        // Populate track location
        const trackLocationElement = document.getElementById('track-location');
        if (trackLocationElement) {
            trackLocationElement.textContent = sessionDetails.location || '-';
        }
        
        // Populate coordinates
        const trackCoordinatesElement = document.getElementById('track-coordinates');
        if (trackCoordinatesElement && sessionDetails.latitude && sessionDetails.longitude) {
            trackCoordinatesElement.textContent = `${sessionDetails.latitude}, ${sessionDetails.longitude}`;
        } else if (trackCoordinatesElement) {
            trackCoordinatesElement.textContent = '-';
        }
        
        // Populate track length
        const trackLengthElement = document.getElementById('track-length');
        if (trackLengthElement) {
            trackLengthElement.textContent = sessionDetails.track_config_length ? 
                `${sessionDetails.track_config_length} km` : '-';
        }
        
        // Populate corners
        const trackCornersElement = document.getElementById('track-corners');
        if (trackCornersElement) {
            trackCornersElement.textContent = sessionDetails.corners_per_lap ? 
                `${sessionDetails.corners_per_lap} corners` : '-';
        }
        
        // Populate track image
        const trackImageElement = document.getElementById('track-image');
        if (trackImageElement && sessionDetails.track_small_image && sessionDetails.track_folder) {
            const imageUrl = `https://images-static.iracing.com/${sessionDetails.track_folder}/${sessionDetails.track_small_image}`;
            trackImageElement.src = imageUrl;
            trackImageElement.alt = sessionDetails.track_name || 'Track Image';
            trackImageElement.classList.remove('hidden');
            
            console.log('🖼️ Loading track image:', imageUrl);
            
            // Handle image load errors
            trackImageElement.onerror = function() {
                console.warn('❌ Failed to load track image:', imageUrl);
                this.classList.add('hidden');
            };
        } else if (trackImageElement) {
            trackImageElement.classList.add('hidden');
        }
        
        // Load track map if available
        await this.loadTrackMap(sessionDetails);
        
        // Load weather forecast if available
        await this.loadWeatherForecast(sessionDetails);
    }

    async loadTrackMap(sessionDetails) {
        console.log('🗺️ Loading track map for:', sessionDetails.track_name);
        
        const mapContainer = document.getElementById('track-map-svg');
        const loadingElement = document.getElementById('track-map-loading');
        const errorElement = document.getElementById('track-map-error');
        
        // Show loading state
        mapContainer.classList.add('hidden');
        errorElement.classList.add('hidden');
        loadingElement.classList.remove('hidden');
        
        try {
            // Fetch track assets data via API endpoint
            const response = await fetch(`/api/track-assets/${sessionDetails.track_id}`);
            
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
            
            // Setup layer toggle event listeners
            this.setupTrackMapLayerToggles();
            
            // Load SVG layers
            await this.loadTrackMapLayers(trackAssets);
            
            // Show the map
            loadingElement.classList.add('hidden');
            mapContainer.classList.remove('hidden');
            
            console.log('✅ Track map loaded successfully');
            
        } catch (error) {
            console.warn('❌ Failed to load track map:', error.message);
            
            // Update error message to be more helpful
            const errorTextElement = errorElement.querySelector('p');
            if (errorTextElement) {
                if (error.message.includes('not available')) {
                    errorTextElement.textContent = 'Track map not available for this track';
                } else {
                    errorTextElement.textContent = 'Track map temporarily unavailable';
                }
            }
            
            // Show error state
            loadingElement.classList.add('hidden');
            errorElement.classList.remove('hidden');
        }
    }
    
    async loadTrackMapLayers(trackAssets) {
        const mapContainer = document.getElementById('track-map-svg');
        const baseUrl = trackAssets.track_map;
        const layers = JSON.parse(trackAssets.track_map_layers || '{}');
        
        console.log('📋 Available track map layers:', Object.keys(layers));
        
        // Clear existing map content
        mapContainer.innerHTML = '';
        
        // Create SVG container
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.setAttribute('viewBox', '0 0 1000 1000'); // Default viewBox, will be updated from actual SVG
        svgElement.setAttribute('width', '100%');
        svgElement.setAttribute('height', '100%');
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgElement.style.maxHeight = '400px';
        
        mapContainer.appendChild(svgElement);
        
        // Load each layer
        const layerOrder = ['background', 'inactive', 'active', 'pitroad', 'start-finish', 'turns'];
        
        for (const layerName of layerOrder) {
            if (layers[layerName]) {
                try {
                    await this.loadTrackMapLayer(svgElement, baseUrl, layerName, layers[layerName]);
                } catch (error) {
                    console.warn(`⚠️ Failed to load layer ${layerName}:`, error);
                }
            }
        }
    }
    
    async loadTrackMapLayer(svgContainer, baseUrl, layerName, layerFile) {
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
            
            // Set initial visibility based on checkbox state
            const checkbox = document.getElementById(`layer-${layerName}`);
            if (checkbox && !checkbox.checked) {
                layerGroup.style.display = 'none';
            }
            
            // Update container viewBox from first loaded layer (usually background)
            if (layerName === 'background' && sourceSvg.getAttribute('viewBox')) {
                svgContainer.setAttribute('viewBox', sourceSvg.getAttribute('viewBox'));
            }
            
            svgContainer.appendChild(layerGroup);
            
            console.log(`✅ Loaded track map layer: ${layerName}`);
            
        } catch (error) {
            console.warn(`❌ Failed to load track map layer ${layerName}:`, error);
        }
    }
    
    setupTrackMapLayerToggles() {
        console.log('🎚️ Setting up track map layer toggles...');
        const layerNames = ['background', 'active', 'pitroad', 'start-finish', 'turns'];
        
        layerNames.forEach(layerName => {
            const checkbox = document.getElementById(`layer-${layerName}`);
            if (checkbox) {
                console.log(`✅ Found checkbox for layer: ${layerName}`);
                
                // Remove existing event listeners to avoid duplicates
                checkbox.removeEventListener('change', this.handleLayerToggle);
                
                // Add new event listener with proper binding
                const handleToggle = (e) => {
                    console.log(`🎚️ Toggle ${layerName}: ${e.target.checked}`);
                    this.toggleTrackMapLayer(layerName, e.target.checked);
                };
                
                checkbox.addEventListener('change', handleToggle);
                
                // Set initial state for default layers
                const isDefaultLayer = ['background', 'active'].includes(layerName);
                checkbox.checked = isDefaultLayer;
                
            } else {
                console.warn(`❌ Checkbox not found for layer: ${layerName}`);
            }
        });
    }
    
    toggleTrackMapLayer(layerName, visible) {
        const layerGroup = document.getElementById(`layer-${layerName}`);
        console.log(`🎚️ Toggling layer ${layerName} to ${visible ? 'visible' : 'hidden'}`);
        console.log(`🔍 Layer group found:`, layerGroup);
        
        if (layerGroup) {
            layerGroup.style.display = visible ? 'block' : 'none';
            console.log(`✅ Layer ${layerName}: ${visible ? 'visible' : 'hidden'}`);
        } else {
            console.error(`❌ Layer group not found: layer-${layerName}`);
            
            // Debug: List all available layer elements
            const allLayers = document.querySelectorAll('[id*="layer-"]');
            console.log('🔍 Available layer elements:', Array.from(allLayers).map(el => el.id));
        }
    }
    
    async loadWeatherForecast(sessionDetails) {
        console.log('🌦️ Loading weather forecast for event:', sessionDetails.event_id);
        console.log('🌦️ Session details:', sessionDetails);
        
        // Show weather display section regardless - for testing
        const weatherDisplay = document.getElementById('weather-display');
        console.log('🌦️ Weather display element:', weatherDisplay);
        
        if (weatherDisplay) {
            console.log('🌦️ Showing weather display section');
            weatherDisplay.classList.remove('hidden');
            weatherDisplay.innerHTML = `
                <h1 class="text-xl mb-4 road-rage-font">🌦️ WEATHER FORECAST</h1>
                <div class="text-sm text-neutral-400">
                    <p>Testing weather display for event ${sessionDetails.event_id}</p>
                    <p>Weather box is working!</p>
                </div>
            `;
        } else {
            console.error('❌ Weather display element not found');
        }
        
        try {
            // Check if event has weather_url
            const weatherUrl = `/api/events/${sessionDetails.event_id}/weather`;
            console.log('🌦️ Fetching weather from:', weatherUrl);
            
            const response = await fetch(weatherUrl);
            console.log('🌦️ Weather API response status:', response.status);
            
            if (!response.ok) {
                console.log('ℹ️ No weather data available for this event, status:', response.status);
                return;
            }
            
            const eventWeather = await response.json();
            console.log('🌦️ Event weather data:', eventWeather);
            
            if (eventWeather && eventWeather.weather_url) {
                console.log('✅ Event has weather URL:', eventWeather.weather_url);
                
                // Load actual weather data and display it
                await this.displayWeatherData(eventWeather.weather_url);
            } else {
                console.log('ℹ️ Event does not have weather URL');
                console.log('ℹ️ Event weather response:', eventWeather);
            }
            
        } catch (error) {
            console.error('❌ Failed to load weather forecast:', error);
        }
    }
    
    async displayWeatherData(weatherUrl) {
        try {
            console.log('🌦️ Loading weather data via proxy from:', weatherUrl);
            
            // Use the weather proxy to avoid CORS issues
            const response = await fetch(`/api/weather-proxy?url=${encodeURIComponent(weatherUrl)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const weatherData = await response.json();
            console.log('🌦️ Weather data received:', weatherData);
            
            // Handle different weather data formats
            let processedWeatherData;
            if (Array.isArray(weatherData)) {
                // If it's an array, wrap it in the expected format
                processedWeatherData = { weather_forecast: weatherData };
                console.log('🌦️ Converted array to object format');
            } else if (weatherData.weather_forecast) {
                // If it's already in the correct format
                processedWeatherData = weatherData;
            } else {
                console.error('❌ Unexpected weather data format:', weatherData);
                return;
            }
            
            console.log('🌦️ Processed weather data:', processedWeatherData);
            
            // Create the COMPLETE weather interface exactly like weather-forecast.html
            const weatherDisplay = document.getElementById('weather-display');
            if (weatherDisplay && processedWeatherData) {
                // Show the weather display
                weatherDisplay.classList.remove('hidden');
                
                // First add the complete CSS styles
                this.addWeatherStyles();
                
                // Then add the complete HTML structure
                weatherDisplay.innerHTML = `
                    <div style="background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <div style="display: flex; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; background: #f8f9fa; border-radius: 8px 8px 0 0;">
                            <svg style="width: 20px; height: 20px; color: #666;" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                            </svg>
                            <h6 style="margin: 0 0 0 8px; font-size: 18px; font-weight: 600; color: #333;">Weather Forecast</h6>
                        </div>

                        <div style="padding: 24px;">
                            <div class="chakra-tabs" style="width: 100%;">
                                <div class="chakra-tabs__tablist" role="tablist" style="display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;">
                                    <button class="chakra-tabs__tab" role="tab" aria-selected="false" data-tab="temperature" style="padding: 12px 24px; background: none; border: none; font-size: 16px; font-weight: 500; color: #718096; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s;">
                                        Temperature
                                    </button>
                                    <button class="chakra-tabs__tab" role="tab" aria-selected="true" data-tab="clouds" style="padding: 12px 24px; background: none; border: none; font-size: 16px; font-weight: 500; color: #2b6cb0; cursor: pointer; border-bottom: 3px solid #2b6cb0; transition: all 0.2s;">
                                        Clouds & Precipitation
                                    </button>
                                </div>

                                <!-- Temperature Tab Panel -->
                                <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="true" id="temperature-panel" style="display: none;">
                                    <div style="display: flex; gap: 32px; margin-bottom: 16px; align-items: center;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 24px; height: 3px; border-radius: 2px; background: #ff6b6b;"></div>
                                            <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Temperature</span>
                                        </div>
                                    </div>
                                    <div style="width: 100%; height: 350px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fff; position: relative;">
                                        <div id="temperature-chart" style="width: 100%; height: 300px;"></div>
                                    </div>
                                </div>

                                <!-- Clouds & Precipitation Tab Panel -->
                                <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="false" id="clouds-panel" style="display: block;">
                                    <div style="display: flex; gap: 32px; margin-bottom: 16px; align-items: center;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 24px; height: 3px; border-radius: 2px; background: rgb(5,5,15);"></div>
                                            <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Clouds</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 24px; height: 3px; border-radius: 2px; background: #0B5559;"></div>
                                            <span style="font-size: 14px; color: #4a5568; font-weight: 500;">Chance of Precipitation</span>
                                        </div>
                                    </div>
                                    <div style="width: 100%; height: 350px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fff; position: relative;">
                                        <div id="clouds-chart" style="width: 100%; height: 300px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Import ECharts if not loaded
                await this.loadECharts();
                
                // Initialize tabs functionality
                this.initializeWeatherTabs();
                
                // Wait a moment for DOM to be ready, then render charts
                setTimeout(() => {
                    console.log('🌦️ Rendering weather charts...');
                    this.renderWeatherCharts(processedWeatherData);
                }, 100);
            }
        } catch (error) {
            console.error('❌ Failed to display weather data:', error);
            
            const weatherDisplay = document.getElementById('weather-display');
            if (weatherDisplay) {
                weatherDisplay.innerHTML = `
                    <h1 class="text-xl mb-4 road-rage-font">🌦️ WEATHER FORECAST</h1>
                    <div class="text-sm text-red-400">
                        <p>Error loading weather data: ${error.message}</p>
                    </div>
                `;
            }
        }
    }
    
    addWeatherStyles() {
        // Add CSS styles for weather tabs if not already added
        if (!document.getElementById('weather-styles')) {
            const style = document.createElement('style');
            style.id = 'weather-styles';
            style.textContent = `
                .chakra-tabs__tab:hover {
                    color: #4a5568 !important;
                }
                .chakra-tabs__tab[aria-selected="true"] {
                    color: #2b6cb0 !important;
                    border-bottom-color: #2b6cb0 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    initializeWeatherTabs() {
        const tabs = document.querySelectorAll('.chakra-tabs__tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchWeatherTab(tab.dataset.tab));
        });
    }
    
    switchWeatherTab(tabName) {
        // Update tab states
        document.querySelectorAll('.chakra-tabs__tab').forEach(tab => {
            const isSelected = tab.dataset.tab === tabName;
            tab.setAttribute('aria-selected', isSelected);
            tab.style.color = isSelected ? '#2b6cb0' : '#718096';
            tab.style.borderBottomColor = isSelected ? '#2b6cb0' : 'transparent';
        });

        // Update panel visibility
        document.querySelectorAll('.chakra-tabs__tab-panel').forEach(panel => {
            const isVisible = panel.id === `${tabName}-panel`;
            panel.setAttribute('aria-hidden', !isVisible);
            panel.style.display = isVisible ? 'block' : 'none';
        });

        // Resize charts when switching tabs
        setTimeout(() => {
            if (tabName === 'temperature' && this.temperatureChart) {
                this.temperatureChart.resize();
            } else if (tabName === 'clouds' && this.cloudsChart) {
                this.cloudsChart.resize();
            }
        }, 100);
    }
    
    async loadECharts() {
        if (typeof echarts !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    renderWeatherCharts(weatherData) {
        console.log('🌦️ renderWeatherCharts called with data:', weatherData);
        
        if (!weatherData || !weatherData.weather_forecast) {
            console.error('Invalid weather data format');
            return;
        }

        // Check if ECharts is available
        if (typeof echarts === 'undefined') {
            console.error('ECharts is not loaded');
            return;
        }

        // Check if chart containers exist
        const tempContainer = document.getElementById('temperature-chart');
        const cloudsContainer = document.getElementById('clouds-chart');
        
        console.log('🌦️ Temperature chart container:', tempContainer);
        console.log('🌦️ Clouds chart container:', cloudsContainer);

        if (!tempContainer || !cloudsContainer) {
            console.error('Chart containers not found');
            return;
        }

        this.renderTemperatureChart(weatherData);
        this.renderCloudsChart(weatherData);
    }

    renderTemperatureChart(weatherData) {
        console.log('🌡️ Rendering temperature chart...');
        
        // Dispose existing chart if it exists
        if (this.temperatureChart) {
            this.temperatureChart.dispose();
        }
        
        const container = document.getElementById('temperature-chart');
        if (!container) {
            console.error('Temperature chart container not found');
            return;
        }
        
        // Ensure container has dimensions and is visible
        container.style.width = '100%';
        container.style.height = '300px';
        container.style.display = 'block';
        
        console.log('🌡️ Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
        
        // Wait a moment for container to be properly sized
        setTimeout(() => {
            console.log('🌡️ Initializing temperature chart...');
            this.temperatureChart = echarts.init(container);
            
            if (!this.temperatureChart) {
                console.error('Failed to initialize temperature chart');
                return;
            }

        const forecast = weatherData.weather_forecast;
        const timeLabels = this.generateTimeLabels(forecast);
        const temperatures = forecast.map(item => this.convertTemperature(item.raw_air_temp));
        
        // Find race start index (where time_offset >= 0 and affects_session becomes true)
        const raceStartIndex = forecast.findIndex(item => item.time_offset >= 0 && item.affects_session);
        
        // Create day/night background markings
        const dayNightMarkings = this.createDayNightMarkings(forecast, timeLabels);

        const option = {
            title: {
                text: '24-Hour Temperature Forecast',
                left: 'center',
                textStyle: { color: '#333', fontSize: 16 }
            },
            grid: { left: '60px', right: '40px', top: '60px', bottom: '80px' },
            toolbox: {
                feature: {
                    dataZoom: { yAxisIndex: 'none' },
                    restore: {},
                    saveAsImage: {}
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    start: 0,
                    end: 100,
                    height: 30,
                    bottom: 40
                }
            ],

        const option = {
            xAxis: {
                type: 'category',
                data: timeLabels,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { 
                    color: '#6E7079', 
                    fontSize: 10,
                    rotate: 45,
                    interval: Math.floor(timeLabels.length / 12) // Show ~12 labels max
                }
            },
            yAxis: {
                type: 'value',
                name: 'Temperature (°F)',
                nameLocation: 'middle',
                nameGap: 40,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { color: '#6E7079', fontSize: 12, formatter: '{value}°F' },
                splitLine: { lineStyle: { color: '#6E7079', opacity: 0.3 } }
            },
            series: [
                {
                    name: 'Temperature',
                    type: 'line',
                    data: temperatures,
                    lineStyle: { color: '#ff6b6b', width: 2 },
                    itemStyle: { color: '#ff6b6b' },
                    areaStyle: { 
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(255, 107, 107, 0.3)' },
                                { offset: 1, color: 'rgba(255, 107, 107, 0.05)' }
                            ]
                        }
                    },
                    smooth: true, 
                    symbol: 'none',
                    markLine: raceStartIndex >= 0 ? {
                        data: [{
                            name: 'Race Start',
                            xAxis: raceStartIndex,
                            lineStyle: { color: '#00ff00', width: 3, type: 'solid' },
                            label: { 
                                position: 'end',
                                formatter: 'Race Start',
                                color: '#00ff00',
                                fontWeight: 'bold'
                            }
                        }]
                    } : undefined
                }
            ].concat(dayNightMarkings),
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const point = params[0];
                    const forecastItem = forecast[point.dataIndex];
                    const isRace = forecastItem.affects_session;
                    const sunStatus = forecastItem.is_sun_up ? '☀️ Day' : '🌙 Night';
                    
                    return `<div style="color: black;">
                        <strong>Time:</strong> ${timeLabels[point.dataIndex]}<br>
                        <strong>Temperature:</strong> ${point.value}°F<br>
                        <strong>Period:</strong> ${isRace ? 'Race' : 'Practice/Quali'}<br>
                        <strong>Sun:</strong> ${sunStatus}<br>
                        <strong>Weather:</strong> ${this.getWeatherDescription(forecastItem)}
                    </div>`;
                }
            }
        };

            console.log('🌡️ Setting temperature chart options:', option);
            this.temperatureChart.setOption(option);
            console.log('🌡️ Temperature chart rendered successfully');
        }, 50);
    }

    renderCloudsChart(weatherData) {
        console.log('☁️ Rendering clouds chart...');
        
        // Dispose existing chart if it exists
        if (this.cloudsChart) {
            this.cloudsChart.dispose();
        }
        
        const cloudsContainer = document.getElementById('clouds-chart');
        if (!cloudsContainer) {
            console.error('Clouds chart container not found');
            return;
        }
        
        // Ensure container has dimensions and is visible
        cloudsContainer.style.width = '100%';
        cloudsContainer.style.height = '300px';
        cloudsContainer.style.display = 'block';
        
        console.log('☁️ Container dimensions:', cloudsContainer.offsetWidth, 'x', cloudsContainer.offsetHeight);
        
        // Wait a moment for container to be properly sized
        setTimeout(() => {
            console.log('☁️ Initializing clouds chart...');
            this.cloudsChart = echarts.init(cloudsContainer);
            
            if (!this.cloudsChart) {
                console.error('Failed to initialize clouds chart');
                return;
            }

        const forecast = weatherData.weather_forecast;
        const timeLabels = this.generateTimeLabels(forecast);
        const cloudCover = forecast.map(item => this.convertCloudCover(item.cloud_cover));
        const precipitation = forecast.map(item => this.convertPrecipitation(item.rel_humidity));
        
        // Find race start index
        const raceStartIndex = forecast.findIndex(item => item.time_offset >= 0 && item.affects_session);
        
        // Create day/night background markings
        const dayNightMarkings = this.createDayNightMarkings(forecast, timeLabels);

        const option = {
            title: {
                text: '24-Hour Clouds & Precipitation Forecast',
                left: 'center',
                textStyle: { color: '#333', fontSize: 16 }
            },
            grid: { left: '60px', right: '40px', top: '60px', bottom: '80px' },
            toolbox: {
                feature: {
                    dataZoom: { yAxisIndex: 'none' },
                    restore: {},
                    saveAsImage: {}
                }
            },
            dataZoom: [
                {
                    type: 'inside',
                    start: 0,
                    end: 100
                },
                {
                    start: 0,
                    end: 100,
                    height: 30,
                    bottom: 40
                }
            ],

        const option = {
            xAxis: {
                type: 'category', 
                data: timeLabels,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { 
                    color: '#6E7079', 
                    fontSize: 10,
                    rotate: 45,
                    interval: Math.floor(timeLabels.length / 12)
                }
            },
            yAxis: {
                type: 'value', 
                min: 0, 
                max: 100,
                name: 'Percentage (%)',
                nameLocation: 'middle',
                nameGap: 40,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { color: '#6E7079', fontSize: 12, formatter: '{value}%' },
                splitLine: { lineStyle: { color: '#6E7079', opacity: 0.3 } }
            },
            series: [
                {
                    name: 'Cloud Cover', 
                    type: 'line', 
                    data: cloudCover,
                    lineStyle: { color: 'rgb(5,5,15)', width: 2 },
                    itemStyle: { color: 'rgb(5,5,15)' },
                    areaStyle: { color: 'rgba(5,5,15,0.04)' },
                    smooth: true, 
                    symbol: 'none',
                    markLine: raceStartIndex >= 0 ? {
                        data: [{
                            name: 'Race Start',
                            xAxis: raceStartIndex,
                            lineStyle: { color: '#00ff00', width: 3, type: 'solid' },
                            label: { 
                                position: 'end',
                                formatter: 'Race Start',
                                color: '#00ff00',
                                fontWeight: 'bold'
                            }
                        }]
                    } : undefined
                },
                {
                    name: 'Precipitation Chance', 
                    type: 'line', 
                    data: precipitation,
                    lineStyle: { color: '#0B5559', width: 2 },
                    itemStyle: { color: '#0B5559' },
                    areaStyle: { color: 'rgba(15,138,138,0.04)' },
                    smooth: true, 
                    symbol: 'none'
                }
            ].concat(dayNightMarkings),
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const dataIndex = params[0].dataIndex;
                    const forecastItem = forecast[dataIndex];
                    const isRace = forecastItem.affects_session;
                    const sunStatus = forecastItem.is_sun_up ? '☀️ Day' : '🌙 Night';
                    
                    return `<div style="color: black;">
                        <strong>Time:</strong> ${timeLabels[dataIndex]}<br>
                        <strong>Temperature:</strong> ${this.convertTemperature(forecastItem.raw_air_temp)}°F<br>
                        <strong>Cloud Cover:</strong> ${cloudCover[dataIndex]}%<br>
                        <strong>Precipitation Chance:</strong> ${precipitation[dataIndex]}%<br>
                        <strong>Period:</strong> ${isRace ? 'Race' : 'Practice/Quali'}<br>
                        <strong>Sun:</strong> ${sunStatus}<br>
                        <strong>Wind:</strong> ${this.convertWindSpeed(forecastItem.wind_speed)} mph
                    </div>`;
                }
            }
        };

        console.log('☁️ Setting clouds chart options:', option);
        this.cloudsChart.setOption(option);
        console.log('☁️ Clouds chart rendered successfully');
        }, 50);
    }

    dispose() {
        if (this.temperatureChart) {
            this.temperatureChart.dispose();
            this.temperatureChart = null;
        }
        if (this.cloudsChart) {
            this.cloudsChart.dispose();
            this.cloudsChart = null;
        }
        this.disposables.forEach(disposable => {
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
        });
        this.disposables = [];
    }

    createDayNightMarkings(forecast, timeLabels) {
        // Create background shading for day/night periods
        const markAreas = [];
        let currentPeriod = null;
        let periodStart = 0;
        
        forecast.forEach((item, index) => {
            const isDay = item.is_sun_up;
            
            if (currentPeriod === null) {
                currentPeriod = isDay;
                periodStart = index;
            } else if (currentPeriod !== isDay) {
                // Period changed, add the previous period
                markAreas.push([
                    { name: currentPeriod ? 'Day' : 'Night', xAxis: periodStart },
                    { xAxis: index - 1 }
                ]);
                currentPeriod = isDay;
                periodStart = index;
            }
        });
        
        // Add the final period
        if (currentPeriod !== null) {
            markAreas.push([
                { name: currentPeriod ? 'Day' : 'Night', xAxis: periodStart },
                { xAxis: forecast.length - 1 }
            ]);
        }
        
        return [{
            name: 'Day/Night',
            type: 'line',
            data: [], // No actual data
            markArea: {
                silent: true,
                itemStyle: {
                    color: function(params) {
                        return params.name === 'Day' ? 
                            'rgba(255, 255, 0, 0.1)' :  // Light yellow for day
                            'rgba(0, 0, 100, 0.1)';     // Light blue for night
                    }
                },
                data: markAreas
            }
        }];
    }

    generateTimeLabels(forecast) {
        return forecast.map((item, index) => {
            // Use the actual timestamp from the data for accurate time display
            const timestamp = new Date(item.timestamp);
            
            // Format to show date and time for 24+ hour period
            const timeStr = timestamp.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
            
            // Add date if it spans multiple days
            const dateStr = timestamp.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            // Show date every 24 hours or when day changes
            if (index === 0 || index % 96 === 0) { // Every ~24 hours (assuming 15min intervals)
                return `${dateStr}\n${timeStr}`;
            }
            
            return timeStr;
        });
    }

    convertTemperature(temp) {
        // Based on actual data: raw_air_temp ranges from ~1200-1850
        // Convert to realistic Fahrenheit range (60-85°F)
        const minTemp = 1200, maxTemp = 1850, minF = 60, maxF = 85;
        return Math.round(((temp - minTemp) / (maxTemp - minTemp)) * (maxF - minF) + minF);
    }

    convertCloudCover(cloudCover) {
        // Based on actual data: cloud_cover ranges from ~400-1000
        // Convert to 0-100% with proper clamping
        const minCloud = 400, maxCloud = 1000;
        const percentage = Math.round(((cloudCover - minCloud) / (maxCloud - minCloud)) * 100);
        return Math.max(0, Math.min(100, percentage));
    }

    convertPrecipitation(humidity) {
        // Based on actual data: rel_humidity ranges from ~4000-7000
        // Convert to precipitation chance 0-100%
        const minHumidity = 4000, maxHumidity = 7000;
        const percentage = Math.round(((humidity - minHumidity) / (maxHumidity - minHumidity)) * 100);
        return Math.max(0, Math.min(100, percentage));
    }

    convertWindSpeed(windSpeed) {
        const minWind = 147, maxWind = 306;
        return Math.round(((windSpeed - minWind) / (maxWind - minWind)) * 20 + 5);
    }

    getWeatherDescription(forecastItem) {
        const cloudCover = this.convertCloudCover(forecastItem.cloud_cover);
        if (cloudCover < 25) return 'Clear';
        if (cloudCover < 50) return 'Partly Cloudy';
        if (cloudCover < 75) return 'Mostly Cloudy';
        return 'Overcast';
    }
    
    clearWeatherDisplay() {
        // Hide weather display section
        const weatherDisplay = document.getElementById('weather-display');
        if (weatherDisplay) {
            weatherDisplay.classList.add('hidden');
            weatherDisplay.innerHTML = ''; // Clear content
        }
        
        console.log('✅ Weather display cleared');
    }
    
    clearTrackDetails() {
        // Hide track details section
        const trackDetailsSection = document.getElementById('track-details-section');
        if (trackDetailsSection) trackDetailsSection.classList.add('hidden');
        
        // Hide track map section
        const trackMapSection = document.getElementById('track-map-section');
        if (trackMapSection) trackMapSection.classList.add('hidden');
        
        // Clear track details content
        const elements = ['track-name', 'track-garage61-id', 'track-config', 'track-location', 
                         'track-coordinates', 'track-length', 'track-corners'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
        
        // Hide track image
        const trackImageElement = document.getElementById('track-image');
        if (trackImageElement) {
            trackImageElement.classList.add('hidden');
            trackImageElement.src = '';
        }
    }

    setupEventListeners() {
        // Navigation buttons
        const showPlannerBtn = document.getElementById('showPlannerBtn');
        const showPage2Btn = document.getElementById('showPage2Btn');
        const showAdminBtn = document.getElementById('showAdminBtn');

        if (showPlannerBtn) {
            showPlannerBtn.addEventListener('click', () => this.uiManager.showPlannerPage());
        }
        if (showPage2Btn) {
            showPage2Btn.addEventListener('click', () => this.uiManager.showPage2());
        }
        if (showAdminBtn) {
            showAdminBtn.addEventListener('click', () => this.uiManager.showAdminPage());
        }

        // iRacing series dropdowns
        const seriesSelect = document.getElementById('series-select');
        const eventsSelect = document.getElementById('event-select');
        const sessionsSelect = document.getElementById('sessionsSelect');

        if (seriesSelect) {
            seriesSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    console.log('🔍 Series selected:', e.target.value, 'Type:', typeof e.target.value);
                    console.log('🔍 Selected option text:', e.target.selectedOptions[0]?.textContent);
                    this.populateEventsDropdown(e.target.value);
                }
            });
        }

        if (eventsSelect) {
            eventsSelect.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.populateSessionsDropdown(e.target.value);
                } else {
                    // Reset sessions dropdown when no event selected
                    const sessionsSelect = document.getElementById('session-select');
                    if (sessionsSelect) {
                        sessionsSelect.innerHTML = '<option value="">Select Event First...</option>';
                        sessionsSelect.disabled = true;
                    }
                }
                // Clear race information when event changes
                this.clearRaceInformation();
            });
        }

        // Session selection
        const sessionSelectElement = document.getElementById('session-select');
        if (sessionSelectElement) {
            sessionSelectElement.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.populateRaceInformation(e.target.value);
                } else {
                    this.clearRaceInformation();
                }
            });
        }

        // Car class selection
        const carClassDropdown = document.getElementById('car-class-dropdown');
        if (carClassDropdown) {
            carClassDropdown.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.populateCarsByClass(e.target.value);
                } else {
                    // Reset car dropdown when no class selected
                    const carDropdown = document.getElementById('car-dropdown');
                    if (carDropdown) {
                        carDropdown.innerHTML = '<option value="">Select Car Class First...</option>';
                        carDropdown.disabled = true;
                    }
                }
                // Clear car details when class changes
                this.clearCarDetails();
            });
        }

        // Car selection
        const carDropdown = document.getElementById('car-dropdown');
        if (carDropdown) {
            carDropdown.addEventListener('change', async (e) => {
                if (e.target.value) {
                    console.log('🚗 Car selected:', e.target.value);
                    await this.populateCarDetails(e.target.value, e.target.selectedOptions[0]?.textContent);
                } else {
                    this.clearCarDetails();
                }
            });
        }

        // Driver selection and management
        const addDriverBtn = document.getElementById('add-driver-btn');
        if (addDriverBtn) {
            addDriverBtn.addEventListener('click', () => this.addSelectedDriver());
        }

        // Track selection
        const trackSelect = document.getElementById('track-select');
        if (trackSelect) {
            trackSelect.addEventListener('change', (e) => this.handleTrackSelection(e.target.value));
        }

        // Car class selection
        const carClassSelect = document.getElementById('car-class-select');
        if (carClassSelect) {
            carClassSelect.addEventListener('change', (e) => this.populateCarsByClass(e.target.value));
        }

        // Car selection
        const carSelect = document.getElementById('car-select');
        if (carSelect) {
            carSelect.addEventListener('change', (e) => this.handleCarSelection(e.target.value));
        }

        // Strategy form submission
        const strategyForm = document.getElementById('strategyForm');
        if (strategyForm) {
            strategyForm.addEventListener('submit', (e) => this.handleStrategySubmission(e));
        }

        // Calculate button
        const calculateBtn = document.getElementById('calculateBtn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', () => this.calculateStrategy());
        }

        // Desktop mode toggle
        const desktopModeBtn = document.getElementById('desktopModeBtn');
        if (desktopModeBtn) {
            desktopModeBtn.addEventListener('click', () => this.toggleDesktopMode());
        }

        // Setup additional UI event listeners
        this.uiManager.setupEventListeners();
    }

    async calculateStrategy() {
        try {
            this.setLoading(true);
            
            const formData = this.collectFormData();
            if (!this.validateFormData(formData)) {
                this.uiManager.showNotification('Please fill in all required fields', 'error');
                return;
            }

            const strategy = await this.strategyCalculator.calculateStrategy(formData);
            this.displayStrategy(strategy);
            
            this.uiManager.showNotification('Strategy calculated successfully!', 'success');
        } catch (error) {
            console.error('❌ Strategy calculation failed:', error);
            this.uiManager.showNotification('Strategy calculation failed', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    collectFormData() {
        return {
            trackName: document.getElementById('trackName')?.value || '',
            raceLength: parseFloat(document.getElementById('raceLength')?.value) || 0,
            lapTime: this.parseTimeToSeconds(document.getElementById('lapTime')?.value || '0:00'),
            fuelPerLap: parseFloat(document.getElementById('fuelPerLap')?.value) || 0,
            tankCapacity: parseFloat(document.getElementById('tankCapacity')?.value) || 0,
            pitStopTime: this.parseTimeToSeconds(document.getElementById('pitStopTime')?.value || '0:00'),
            drivers: this.collectDriverData(),
            startTime: document.getElementById('startTime')?.value || '',
            startDate: document.getElementById('startDate')?.value || ''
        };
    }

    collectDriverData() {
        const drivers = [];
        for (let i = 1; i <= 8; i++) {
            const nameEl = document.getElementById(`driver${i}Name`);
            const timeEl = document.getElementById(`driver${i}Time`);
            
            if (nameEl?.value && timeEl?.value) {
                drivers.push({
                    name: nameEl.value,
                    lapTime: this.parseTimeToSeconds(timeEl.value),
                    id: i
                });
            }
        }
        return drivers;
    }

    validateFormData(formData) {
        return formData.trackName && 
               formData.raceLength > 0 && 
               formData.lapTime > 0 && 
               formData.fuelPerLap > 0 && 
               formData.tankCapacity > 0 && 
               formData.drivers.length > 0;
    }

    displayStrategy(strategy) {
        // Update UI with calculated strategy
        this.strategyCalculator.displayStrategy(strategy);
        this.currentStrategies = [strategy];
    }

    async handleStrategySubmission(e) {
        e.preventDefault();
        
        try {
            const strategyData = this.collectFormData();
            const savedStrategy = await this.apiClient.saveStrategy(strategyData);
            
            this.uiManager.showNotification('Strategy saved successfully!', 'success');
        } catch (error) {
            console.error('❌ Failed to save strategy:', error);
            this.uiManager.showNotification('Failed to save strategy', 'error');
        }
    }

    toggleDesktopMode() {
        const container = document.querySelector('.container');
        if (container) {
            container.classList.toggle('desktop-mode');
            
            // Update button text
            const btn = document.getElementById('desktopModeBtn');
            if (btn) {
                const isDesktop = container.classList.contains('desktop-mode');
                btn.textContent = isDesktop ? 'Mobile Mode' : 'Desktop Mode';
            }
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        // Update UI loading state
        const loadingElements = document.querySelectorAll('.loading-spinner');
        loadingElements.forEach(el => {
            el.style.display = loading ? 'block' : 'none';
        });
        
        // Disable form elements during loading
        const formElements = document.querySelectorAll('input, select, button');
        formElements.forEach(el => {
            el.disabled = loading;
        });
    }

    addSelectedDriver() {
        const driverSelect = document.getElementById('driver-select');
        const driverName = driverSelect.value;
        
        if (!driverName) {
            this.uiManager.showNotification('Please select a driver first', 'error');
            return;
        }

        // Find the driver object
        const driver = this.allData.drivers.find(d => d.name === driverName);
        if (!driver) {
            this.uiManager.showNotification('Driver not found', 'error');
            return;
        }

        // Check if driver is already selected
        if (this.selectedDrivers.some(d => d.name === driverName)) {
            this.uiManager.showNotification('Driver already selected', 'warning');
            return;
        }

        // Check max drivers limit (6 for endurance racing)
        if (this.selectedDrivers.length >= 6) {
            this.uiManager.showNotification('Maximum 6 drivers allowed', 'warning');
            return;
        }

        // Add driver to selected list
        this.selectedDrivers.push(driver);
        this.updateDriversList();
        
        // Reset dropdown
        driverSelect.value = '';
        
        console.log(`✅ Added driver: ${driverName}`);
    }

    removeSelectedDriver(driverName) {
        this.selectedDrivers = this.selectedDrivers.filter(d => d.name !== driverName);
        this.updateDriversList();
        console.log(`❌ Removed driver: ${driverName}`);
    }

    updateDriversList() {
        const driversList = document.getElementById('driver-list');
        if (!driversList) return;

        driversList.innerHTML = '';

        this.selectedDrivers.forEach(driver => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between bg-neutral-700 p-3 rounded';
            li.innerHTML = `
                <span class="text-neutral-200">${driver.name}</span>
                <button onclick="window.radianPlanner.removeSelectedDriver('${driver.name}')" 
                        class="text-red-400 hover:text-red-300">
                    <i class="fas fa-times"></i>
                </button>
            `;
            driversList.appendChild(li);
        });
    }

    handleTrackSelection(trackName) {
        if (!trackName) {
            this.selectedTrack = null;
            console.log('❌ Track selection cleared');
            return;
        }

        // Find the track object
        const track = this.allData.tracks.find(t => t.name === trackName);
        if (!track) {
            console.error(`❌ Track "${trackName}" not found in tracks data`);
            this.uiManager.showNotification('Track not found', 'error');
            return;
        }

        this.selectedTrack = track;
        console.log(`✅ Selected track: ${trackName}`, track);
        
        // Show track info if it has Garage61 integration
        if (track.garage61_id) {
            console.log(`🏁 Track has Garage61 ID: ${track.garage61_id}`);
        }

        // Check if we can fetch Garage61 lap data
        this.checkGarage61Data();
    }

    handleCarSelection(carName) {
        if (!carName) {
            this.selectedCar = null;
            console.log('❌ Car selection cleared');
            return;
        }

        // Find the car object
        const car = this.allData.cars.find(c => c.name === carName);
        if (!car) {
            console.error(`❌ Car "${carName}" not found in cars data`);
            this.uiManager.showNotification('Car not found', 'error');
            return;
        }

        this.selectedCar = car;
        console.log(`✅ Selected car: ${carName}`, car);
        
        // Show car info if it has Garage61 integration
        if (car.garage61_id) {
            console.log(`🏎️ Car has Garage61 ID: ${car.garage61_id}`);
        }

        // Check if we can fetch Garage61 lap data
        this.checkGarage61Data();
    }

    checkGarage61Data() {
        if (this.selectedCar?.garage61_id && this.selectedTrack?.garage61_id) {
            console.log(`🔗 Ready for Garage61 lap data: Car ${this.selectedCar.garage61_id}, Track ${this.selectedTrack.garage61_id}`);
            // TODO: Automatically fetch lap data when both car and track are selected
        }
    }

    parseTimeToSeconds(timeString) {
        if (!timeString) return 0;
        
        const parts = timeString.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseFloat(parts[1]) || 0;
            return minutes * 60 + seconds;
        }
        return parseFloat(timeString) || 0;
    }

    formatSecondsToTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${minutes}:${secs.padStart(6, '0')}`;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.radianPlanner = new RadianPlannerApp();
});

// Export for use in other modules if needed
export { RadianPlannerApp };