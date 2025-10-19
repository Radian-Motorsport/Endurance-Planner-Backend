// RadianPlanner - Main Application File
// This file orchestrates all modules and handles application initialization

import { APIClient } from './modules/api-client.js';
import { UIManager } from './modules/ui-manager.js';
import { StrategyCalculator } from './modules/strategy-calculator.js';
import { Garage61Client } from './modules/garage61-client.js';
import { WeatherComponent } from './modules/weather-component.js';
import { TrackMapComponent } from './modules/track-map.js';

class RadianPlannerApp {
    constructor() {
        this.apiClient = new APIClient();
        this.uiManager = new UIManager(this);
        this.strategyCalculator = new StrategyCalculator();
        this.garage61Client = new Garage61Client();
        this.weatherComponent = null; // Will be initialized when needed
        this.trackMapComponent = null; // Will be initialized when needed
        
        this.currentStrategies = [];
        this.allData = {};
        this.isLoading = false;
        this.selectedDrivers = [];
        this.selectedTrack = null;
        this.selectedCar = null;
        
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

        console.log('� POPULATE EVENTS CALLED with seriesId:', seriesId);
        console.trace('🔵 Call stack for populateEventsDropdown');
        eventsSelect.innerHTML = '<option value="">Loading events...</option>';
        

        
        try {
            const response = await fetch(`/api/events/${seriesId}`);
            const events = await response.json();
            
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
                
                // Use only event_name
                option.textContent = event.event_name;
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
                sessionLengthElement.textContent = `${sessionDetails.session_length} minutes`;
            }
            
            // Fetch and populate practice/qualifying lengths
            await this.populateAllSessionLengths(sessionDetails.event_id);
            
            // Store session details for later use
            this.selectedSessionDetails = sessionDetails;
            
            // Populate track details
            await this.populateTrackDetails(sessionDetails);
            
            // Populate car selection
            await this.populateCarSelection(sessionDetails);
            
        } catch (error) {
            console.error('❌ Error fetching session details:', error);
            this.clearRaceInformation();
        }
    }
    
    async populateAllSessionLengths(eventId) {
        try {
            const response = await fetch(`/api/event-sessions/${eventId}`);
            if (!response.ok) return;
            
            const sessions = await response.json();
            
            // Find practice and qualifying sessions
            const practiceSession = sessions.find(s => s.session_type === 'practice');
            const qualifyingSession = sessions.find(s => s.session_type === 'qualifying');
            
            // Update practice length
            const practiceElement = document.getElementById('practice-length');
            if (practiceElement && practiceSession?.session_length) {
                practiceElement.textContent = `${practiceSession.session_length} minutes`;
            } else if (practiceElement) {
                practiceElement.textContent = '-';
            }
            
            // Update qualifying length
            const qualifyingElement = document.getElementById('qualifying-length');
            if (qualifyingElement && qualifyingSession?.session_length) {
                qualifyingElement.textContent = `${qualifyingSession.session_length} minutes`;
            } else if (qualifyingElement) {
                qualifyingElement.textContent = '-';
            }
        } catch (error) {
            console.error('Error fetching session lengths:', error);
        }
    }

    clearRaceInformation() {
        // Hide race info content and show placeholder
        const raceInfoContent = document.getElementById('race-info-content');
        const raceInfoPlaceholder = document.getElementById('race-info-placeholder');
        
        if (raceInfoContent) raceInfoContent.classList.add('hidden');
        if (raceInfoPlaceholder) raceInfoPlaceholder.classList.remove('hidden');
        
        // Clear all the content
        const elements = ['race-datetime', 'event-datetime', 'session-length', 'practice-length', 'qualifying-length'];
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
        
        // Populate track logo overlay
        const trackLogoOverlay = document.getElementById('track-logo-overlay');
        if (trackLogoOverlay && sessionDetails.logo) {
            const logoUrl = `https://images-static.iracing.com${sessionDetails.logo}`;
            trackLogoOverlay.src = logoUrl;
            trackLogoOverlay.alt = `${sessionDetails.track_name} Logo` || 'Track Logo';
            trackLogoOverlay.classList.remove('hidden');
            
            console.log('🏷️ Loading track logo overlay:', logoUrl);
            
            // Handle logo load errors
            trackLogoOverlay.onerror = function() {
                console.warn('❌ Failed to load track logo:', logoUrl);
                this.classList.add('hidden');
            };
        } else if (trackLogoOverlay) {
            trackLogoOverlay.classList.add('hidden');
        }
        
        // Load track map if available
        await this.loadTrackMap(sessionDetails);
        
        // Load weather forecast if available
        await this.loadWeatherForecast(sessionDetails);
    }

    async loadTrackMap(sessionDetails) {
        console.log('🗺️ Loading track map for:', sessionDetails.track_name);
        
        try {
            // Initialize track map component if not already done
            if (!this.trackMapComponent) {
                this.trackMapComponent = new TrackMapComponent('track-map-container');
            }
            
            // Show track map section
            const trackMapSection = document.getElementById('track-map-section');
            if (trackMapSection) {
                trackMapSection.classList.remove('hidden');
            }
            
            // Load track map from API
            await this.trackMapComponent.loadTrackFromAPI(sessionDetails.track_id);
            
            console.log('✅ Track map loaded successfully');
            
        } catch (error) {
            console.warn('❌ Failed to load track map:', error.message);
            // Track map component handles its own error display
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
        
        try {
            // Initialize weather component if not already done
            if (!this.weatherComponent) {
                this.weatherComponent = new WeatherComponent('weather-display');
            }
            
            // Show weather display section
            const weatherDisplay = document.getElementById('weather-display');
            if (weatherDisplay) {
                weatherDisplay.classList.remove('hidden');
            }
            
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
                
                // Load weather data using the weather component
                await this.weatherComponent.loadWeatherData(eventWeather.weather_url);
            } else {
                console.log('ℹ️ Event does not have weather URL');
                // Show a message that no weather data is available
                this.weatherComponent.render({ message: 'No weather data available for this event' });
            }
            
        } catch (error) {
            console.error('❌ Failed to load weather forecast:', error);
            if (this.weatherComponent) {
                this.weatherComponent.render({ error: error.message });
            }
        }
    }
    
    clearWeatherDisplay() {
        // Hide weather display section
        const weatherDisplay = document.getElementById('weather-display');
        if (weatherDisplay) {
            weatherDisplay.classList.add('hidden');
            weatherDisplay.innerHTML = ''; // Clear content
        }
        
        // Dispose weather component if it exists
        if (this.weatherComponent) {
            this.weatherComponent.dispose();
            this.weatherComponent = null;
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
        
        // Hide track logo overlay
        const trackLogoOverlay = document.getElementById('track-logo-overlay');
        if (trackLogoOverlay) {
            trackLogoOverlay.classList.add('hidden');
            trackLogoOverlay.src = '';
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

        const refreshDriversBtn = document.getElementById('refresh-drivers-btn');
        if (refreshDriversBtn) {
            refreshDriversBtn.addEventListener('click', () => this.refreshAllDrivers());
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
            // TEMPORARILY DISABLED VALIDATION
            console.log('🔧 VALIDATION BYPASSED - formData:', formData);
            // if (!this.validateFormData(formData)) {
            //     this.uiManager.showNotification('Please fill in all required fields', 'error');
            //     return;
            // }

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
                <div class="flex items-center space-x-3">
                    <span class="text-neutral-200">${driver.name}</span>
                    <div class="text-xs text-neutral-400">
                        iR: ${driver.sports_car_irating || 'N/A'} | 
                        SR: ${driver.sports_car_safety_rating || 'N/A'}
                    </div>
                </div>
                <button onclick="window.radianPlanner.removeSelectedDriver('${driver.name}')" 
                        class="text-red-400 hover:text-red-300">
                    <i class="fas fa-times"></i>
                </button>
            `;
            driversList.appendChild(li);
        });
    }

    async refreshAllDrivers() {
        const refreshBtn = document.getElementById('refresh-drivers-btn');
        const originalHtml = refreshBtn.innerHTML;
        
        try {
            // Update button to show loading state
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;
            
            this.uiManager.showNotification('Refreshing all driver data...', 'info');
            
            const response = await fetch('/api/drivers/refresh-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Refresh failed');
            }
            
            // Reload driver data
            this.allData = await this.apiClient.fetchAllData();
            this.populateDriversDropdown();
            
            this.uiManager.showNotification(
                `Successfully refreshed ${result.updatedCount}/${result.totalDrivers} drivers`, 
                'success'
            );
            
            console.log(`✅ Driver refresh completed: ${result.updatedCount}/${result.totalDrivers} updated`);
            
        } catch (error) {
            console.error('❌ Driver refresh failed:', error);
            this.uiManager.showNotification(
                `Driver refresh failed: ${error.message}`, 
                'error'
            );
        } finally {
            // Restore button
            refreshBtn.innerHTML = originalHtml;
            refreshBtn.disabled = false;
        }
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

    /**
     * Collect all page 1 data for transition to page 2
     * @returns {Object} Complete event data from page 1 selections
     */
    collectPage1Data() {
        console.log('📋 Collecting page 1 data for transition...');
        console.log('🔍 DEBUG: Selected data before collection:');
        console.log('   selectedTrack:', this.selectedTrack);
        console.log('   selectedCar:', this.selectedCar);
        console.log('   selectedDrivers:', this.selectedDrivers);
        
        // Collect selected track data (prioritize session details over selectedTrack)
        const trackDetails = this.selectedSessionDetails || this.selectedTrack;
        const trackData = {
            name: trackDetails?.track_name || this.selectedTrack?.name || 'Unknown Track',
            id: trackDetails?.track_id || this.selectedTrack?.id || null,
            garage61_id: trackDetails?.track_garage61_id || this.selectedTrack?.garage61_id || null,
            iracing_track_id: trackDetails?.iracing_track_id || this.selectedTrack?.iracing_track_id || null
        };

        // Collect selected car data (handle both nested and direct structures)
        const carDetails = this.selectedCar?.details || this.selectedCar;
        const carData = {
            name: this.selectedCar?.name || carDetails?.car_name || carDetails?.name || 'Unknown Car',
            id: this.selectedCar?.id || carDetails?.id || carDetails?.car_id || null,
            garage61_id: carDetails?.garage61_id || null,
            iracing_car_id: carDetails?.iracing_car_id || null,
            weight: carDetails?.car_weight || carDetails?.weight || null,
            horsepower: carDetails?.hp || carDetails?.horsepower || null
        };

        // Collect selected drivers data
        const driversData = (this.selectedDrivers || []).map(driver => ({
            name: driver.name,
            firstName: driver.firstName,
            lastName: driver.lastName,
            garage61_slug: driver.garage61_slug,
            timezone: driver.timezone
        }));
        
        console.log('🔍 DEBUG: Collected data structures:');
        console.log('   trackData:', trackData);
        console.log('   carData:', carData);
        console.log('   driversData:', driversData);
        console.log('🔍 DEBUG: Detailed data inspection:');
        console.log('   trackData.garage61_id:', trackData.garage61_id);
        console.log('   carData.garage61_id:', carData.garage61_id);
        console.log('   sessionDetails exists:', !!this.selectedSessionDetails);

        // Collect session details
        const sessionData = this.selectedSessionDetails ? {
            session_name: this.selectedSessionDetails.session_name || 'Unknown Session',
            session_date: this.selectedSessionDetails.session_date || null,
            session_start_time: this.selectedSessionDetails.session_start_time || 'Not selected',
            session_length: this.selectedSessionDetails.session_length || null,
            time_of_day: this.selectedSessionDetails.time_of_day || null,
            weather_type: this.selectedSessionDetails.weather_type || null,
            track_temp: this.selectedSessionDetails.track_temp || null,
            air_temp: this.selectedSessionDetails.air_temp || null
        } : {
            session_name: 'Unknown Session',
            session_date: null,
            session_start_time: 'Not selected',
            session_length: null,
            time_of_day: null,
            weather_type: null,
            track_temp: null,
            air_temp: null
        };

        // Collect weather data if available
        const weatherData = this.currentWeatherData || null;

        const eventData = {
            track: trackData,
            car: carData,
            drivers: driversData,
            session: sessionData,
            weather: weatherData,
            timestamp: new Date().toISOString()
        };

        console.log('📋 Collected event data:', eventData);
        return eventData;
    }

    /**
     * Populate page 2 with event summary data
     * @param {Object} eventData - Event data from page 1
     */
    async populatePage2(eventData) {
        console.log('📄 Populating page 2 with event data...');

        // Guard clause - ensure eventData exists
        if (!eventData) {
            console.error('❌ No event data provided to populatePage2');
            return;
        }

        // Populate track information
        const trackNameEl = document.getElementById('page2-track');
        if (trackNameEl) trackNameEl.textContent = eventData.track?.name || 'Unknown Track';

        // Populate car information
        const carNameEl = document.getElementById('page2-car');
        if (carNameEl) carNameEl.textContent = eventData.car?.name || 'Unknown Car';

        // Populate session information using correct element IDs
        if (eventData.session) {
            const sessionDateEl = document.getElementById('page2-race-date');
            const sessionTimeEl = document.getElementById('page2-race-time');

            if (sessionDateEl) {
                const formattedDate = eventData.session.session_date 
                    ? new Date(eventData.session.session_date).toLocaleDateString()
                    : 'Not selected';
                sessionDateEl.textContent = formattedDate;
            }
            
            if (sessionTimeEl) {
                sessionTimeEl.textContent = eventData.session.session_start_time || 'Not selected';
            }
        }

        // Populate drivers list
        const driversListEl = document.getElementById('page2-drivers');
        if (driversListEl) {
            if (eventData.drivers && eventData.drivers.length > 0) {
                // Create a nice formatted drivers display
                driversListEl.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-users text-purple-400 text-2xl mb-2"></i>
                        <div class="text-sm text-neutral-500 mb-1">Team Drivers</div>
                        <div class="text-neutral-300 font-medium">
                            ${eventData.drivers.map(d => d.name || 'Unknown Driver').join('<br>')}
                        </div>
                    </div>
                `;
            } else {
                // Show placeholder when no drivers selected
                driversListEl.innerHTML = `
                    <div class="text-center">
                        <i class="fas fa-users text-neutral-600 text-2xl mb-2"></i>
                        <div class="text-sm text-neutral-500 mb-1">Team Drivers</div>
                        <div class="text-neutral-500 font-medium">
                            No drivers selected
                        </div>
                    </div>
                `;
            }
        }

        // Make Garage61 API call if we have the required IDs
        console.log('🔍 DEBUG: Checking Garage61 data requirements:');
        console.log('   Car garage61_id:', eventData.car?.garage61_id);
        console.log('   Track garage61_id:', eventData.track?.garage61_id);
        console.log('   Drivers count:', eventData.drivers?.length || 0);
        console.log('   Drivers data:', eventData.drivers);
        
        if (eventData.car?.garage61_id && eventData.track?.garage61_id && eventData.drivers?.length > 0) {
            console.log('✅ All required data present - making Garage61 API call');
            await this.fetchAndDisplayGarage61Data(eventData);
        } else {
            console.warn('⚠️ Missing required data for Garage61 API call');
            console.warn('   Missing car garage61_id:', !eventData.car?.garage61_id);
            console.warn('   Missing track garage61_id:', !eventData.track?.garage61_id);
            console.warn('   Missing drivers:', (eventData.drivers?.length || 0) === 0);
            if (this.garage61Client) {
                this.garage61Client.updateUI('error', 'Missing car/track/driver data for lap times');
            }
        }
    }

    /**
     * Fetch and display Garage61 lap times data
     * @param {Object} eventData - Event data with car, track, and drivers
     */
    async fetchAndDisplayGarage61Data(eventData) {
        console.log('🏁 Fetching Garage61 lap times...');
        
        try {
            // Show loading state
            this.garage61Client.updateUI('loading');

            // Make API call
            const result = await this.garage61Client.fetchLapTimes(
                eventData.car.garage61_id,
                eventData.track.garage61_id
            );

            if (result.success && result.data.length > 0) {
                // Filter laps by selected drivers
                const filteredLaps = this.garage61Client.filterLapsByDrivers(result.data, eventData.drivers);
                
                // Get best laps per driver
                const bestLaps = this.garage61Client.getDriverBestLaps(filteredLaps);

                // Display results
                const tbody = document.querySelector('#garage61-lap-times table tbody');
                if (tbody) {
                    this.garage61Client.displayLapTimes(bestLaps, tbody);
                    this.garage61Client.updateUI('content');
                }

                console.log(`✅ Displayed ${bestLaps.length} best lap times`);
            } else {
                console.warn('⚠️ No lap data found');
                this.garage61Client.updateUI('error', 'No lap data found for this car/track combination');
            }

        } catch (error) {
            console.error('❌ Garage61 fetch error:', error);
            this.garage61Client.updateUI('error', error.message);
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌐 DOM loaded, initializing RadianPlanner...');
    window.radianPlanner = new RadianPlannerApp();
    await window.radianPlanner.init();
});

// Export for use in other modules if needed
export { RadianPlannerApp };