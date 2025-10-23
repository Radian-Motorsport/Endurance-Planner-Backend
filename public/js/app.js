// RadianPlanner - Main Application File
// This file orchestrates all modules and handles application initialization

import { APIClient } from './modules/api-client.js';
import { UIManager } from './modules/ui-manager.js';
import { StrategyCalculator } from './modules/strategy-calculator.js';
import { Garage61Client } from './modules/garage61-client.js';
import { WeatherComponent } from './modules/weather-component.js';
import { TrackMapComponent } from './modules/track-map.js';
import { getCountryFlag, getCountryFlagOrCode } from './modules/country-flags.js';

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
        this.selectedSeries = null;
        
        this.isLoadingFromSharedLink = false; // Flag to track shared strategy loading
        
        // Expose app instance globally for strategy calculator access
        window.radianPlanner = this;
        
        this.disposables = [];
        
        // Note: init() will be called manually after DOM is loaded
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
            
            // Check for shared strategy in URL
            await this.checkForSharedStrategy();
            
            console.log('✅ RadianPlanner initialized successfully!');
        } catch (error) {
            console.error('❌ Failed to initialize RadianPlanner:', error);
        }
    }

    async loadInitialData() {
        console.log('📥 Loading initial data...');
        
        try {
            this.setLoading(true, true); // Show overlay for initial load
            
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
            this.setLoading(false, true); // Hide overlay after initial load
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
            
            // Display series logo and name when race info is shown
            this.displaySeriesLogo();
            
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
                
                // Store date and time as data attributes for Page 2 StrategyCalculator
                const dateStr = raceDateTime.getFullYear() + '-' + 
                    String(raceDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(raceDateTime.getDate()).padStart(2, '0');
                const timeStr = String(raceDateTime.getHours()).padStart(2, '0') + ':' + 
                    String(raceDateTime.getMinutes()).padStart(2, '0');
                
                raceDatetimeElement.dataset.raceDate = dateStr;
                raceDatetimeElement.dataset.raceTime = timeStr;
                console.log(`📅 Stored race start time data: ${dateStr} ${timeStr}`);
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
                
                // Store date and time as data attributes for Page 2 Local Time calculations
                // Event time is the base time in Europe/London that gets converted to driver timezones
                const eventDate = eventDateTime.getFullYear() + '-' + 
                    String(eventDateTime.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(eventDateTime.getDate()).padStart(2, '0');
                const eventTime = String(eventDateTime.getHours()).padStart(2, '0') + ':' + 
                    String(eventDateTime.getMinutes()).padStart(2, '0');
                
                eventDatetimeElement.dataset.eventDate = eventDate;
                eventDatetimeElement.dataset.eventTime = eventTime;
                eventDatetimeElement.dataset.eventTimezone = 'Europe/London'; // Event time is always in London time
                console.log(`📅 Stored event start time data (London): ${eventDate} ${eventTime}`);
            }
            
            // Populate session length
            const sessionLengthElement = document.getElementById('session-length');
            if (sessionLengthElement && sessionDetails.session_length) {
                // Display the human-readable text
                sessionLengthElement.textContent = `${sessionDetails.session_length} minutes`;
                // Also export numeric values to dataset so other pages/modules can consume them
                try {
                    const totalMinutes = parseInt(sessionDetails.session_length, 10) || 0;
                    sessionLengthElement.dataset.sessionLength = totalMinutes.toString();
                    sessionLengthElement.dataset.sessionMinutes = (totalMinutes % 60).toString();
                    sessionLengthElement.dataset.sessionHours = Math.floor(totalMinutes / 60).toString();
                } catch (e) {
                    // ignore dataset write failures
                }
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
                const practiceMinutes = parseInt(practiceSession.session_length) || 0;
                const practiceHours = Math.floor(practiceMinutes / 60);
                const practiceMinsRemainder = practiceMinutes % 60;
                
                practiceElement.dataset.practiceMinutes = practiceMinutes;
                practiceElement.dataset.practiceHours = practiceHours;
                practiceElement.textContent = `${practiceHours}h ${practiceMinsRemainder}m`;
                console.log(`🏁 Practice session: ${practiceMinutes} minutes total (${practiceHours}h ${practiceMinsRemainder}m)`);
            } else if (practiceElement) {
                practiceElement.dataset.practiceMinutes = '';
                practiceElement.dataset.practiceHours = '';
                practiceElement.textContent = '-';
            }
            
            // Update qualifying length
            const qualifyingElement = document.getElementById('qualifying-length');
            if (qualifyingElement && qualifyingSession?.session_length) {
                const qualifyingMinutes = parseInt(qualifyingSession.session_length) || 0;
                const qualifyingHours = Math.floor(qualifyingMinutes / 60);
                const qualifyingMinsRemainder = qualifyingMinutes % 60;
                
                qualifyingElement.dataset.qualifyingMinutes = qualifyingMinutes;
                qualifyingElement.dataset.qualifyingHours = qualifyingHours;
                qualifyingElement.textContent = `${qualifyingHours}h ${qualifyingMinsRemainder}m`;
                console.log(`🏁 Qualifying session: ${qualifyingMinutes} minutes total (${qualifyingHours}h ${qualifyingMinsRemainder}m)`);
            } else if (qualifyingElement) {
                qualifyingElement.dataset.qualifyingMinutes = '';
                qualifyingElement.dataset.qualifyingHours = '';
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
                    
                    // Find and store the selected series object
                    const seriesId = parseInt(e.target.value);
                    this.selectedSeries = this.allData.series.find(s => s.series_id === seriesId);
                    console.log('🏁 Selected series object:', this.selectedSeries);
                    console.log('🔍 Series logo field:', this.selectedSeries?.logo);
                    console.log('🔍 All series fields:', Object.keys(this.selectedSeries || {}));
                    
                    // Display series logo
                    this.displaySeriesLogo();
                    
                    this.populateEventsDropdown(e.target.value);
                } else {
                    // Clear series selection
                    this.selectedSeries = null;
                    this.hideSeriesLogo();
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

        const refreshDriversFullBtn = document.getElementById('refresh-drivers-full-btn');
        if (refreshDriversFullBtn) {
            refreshDriversFullBtn.addEventListener('click', () => this.refreshAllDriversFullDetails());
        }

        const refreshWeatherBtn = document.getElementById('refresh-weather-btn');
        if (refreshWeatherBtn) {
            refreshWeatherBtn.addEventListener('click', () => this.refreshWeatherData());
        }

        const addDriverByIdBtn = document.getElementById('add-driver-by-id-btn');
        if (addDriverByIdBtn) {
            addDriverByIdBtn.addEventListener('click', () => this.addDriverByCustomerId());
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

        // Time toggle switch for Race Time / Local Time mode
        const timeToggleSwitch = document.querySelector('.toggle-switch');
        if (timeToggleSwitch && this.strategyCalculator) {
            timeToggleSwitch.addEventListener('click', () => {
                this.strategyCalculator.toggleTimeMode();
            });
        }

        // Desktop mode toggle
        const desktopModeBtn = document.getElementById('desktopModeBtn');
        if (desktopModeBtn) {
            desktopModeBtn.addEventListener('click', () => this.toggleDesktopMode());
        }

        // Share link functionality
        const generateShareBtn = document.getElementById('generate-share-btn');
        const copyShareBtn = document.getElementById('copy-share-btn');
        const saveUpdateBtn = document.getElementById('save-update-btn');

        if (generateShareBtn) {
            generateShareBtn.addEventListener('click', () => this.generateShareLink());
        }
        if (copyShareBtn) {
            copyShareBtn.addEventListener('click', () => this.copyShareLink());
        }
        if (saveUpdateBtn) {
            saveUpdateBtn.addEventListener('click', () => this.updateShareLink());
        }

        // Setup Adjustment Sliders (Page 2)
        this.setupAdjustmentSliders();

        // Setup additional UI event listeners (but not driver events which are already set up above)
        // this.uiManager.setupEventListeners(); // REMOVED - causing duplicate event listeners
    }

    async calculateStrategy() {
        try {
            this.setLoading(true, false); // Don't show overlay for quick calculations

                // SAVE CURRENT DRIVER ASSIGNMENTS BEFORE TABLE REBUILD
                const savedStintDrivers = {};
                const savedBackupDrivers = {};
                const tbody = document.getElementById('stint-table-body');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr[data-role="stint"]');
                    rows.forEach((row, index) => {
                        const driverSelect = row.querySelector('.driver-select-stint');
                        if (driverSelect && driverSelect.value) {
                            savedStintDrivers[index] = driverSelect.value;
                        }
                        const backupSelect = row.querySelector('.backup-select-stint');
                        if (backupSelect && backupSelect.value) {
                            savedBackupDrivers[index] = backupSelect.value;
                        }
                    });
                }
                console.log('💾 Saved driver assignments before recalculation:', {
                    stintDrivers: savedStintDrivers,
                    backupDrivers: savedBackupDrivers
                });

                // Validate key Page 2 inputs to avoid crashes when fields are empty.
                // Required: race duration, avg lap time > 0, fuel per lap > 0, tank capacity > 0, at least one driver
                const raceDurHours = parseInt(document.getElementById('race-duration-hours')?.value) || 0;
                const raceDurMins = parseInt(document.getElementById('race-duration-minutes')?.value) || 0;
                const totalRaceMinutes = (raceDurHours * 60) + raceDurMins;

                const avgLapM = parseInt(document.getElementById('avg-lap-time-minutes')?.value);
                const avgLapS = parseInt(document.getElementById('avg-lap-time-seconds')?.value);
                const avgLapSecs = (isNaN(avgLapM) ? 0 : avgLapM * 60) + (isNaN(avgLapS) ? 0 : avgLapS);

                const fuelPerLap = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value);
                const tankCapacity = parseFloat(document.getElementById('tank-capacity-display-input')?.value);
                const driversCount = Array.isArray(this.selectedDrivers) ? this.selectedDrivers.length : 0;

                const missing = [];
                if (!totalRaceMinutes || totalRaceMinutes <= 0) missing.push('Race duration');
                if (!avgLapSecs || avgLapSecs <= 0) missing.push('Avg. lap time');
                if (isNaN(fuelPerLap) || fuelPerLap <= 0) missing.push('Fuel per lap');
                if (isNaN(tankCapacity) || tankCapacity <= 0) missing.push('Tank capacity');
                if (driversCount === 0) missing.push('At least one driver');

                if (missing.length > 0) {
                    const message = 'Please fill in required race inputs: ' + missing.join(', ');
                    // Popup for immediate UX
                    alert(message);
                    // In-app non-blocking notification as well
                    if (this.uiManager && typeof this.uiManager.showNotification === 'function') {
                        this.uiManager.showNotification(message, 'error');
                    }
                    throw new Error(message);
                }

                // Pass selected drivers to strategy calculator
                console.log('🔍 BEFORE setSelectedDrivers - app.selectedDrivers:', {
                    count: this.selectedDrivers.length,
                    drivers: this.selectedDrivers.map(d => ({name: d.name, timezone: d.timezone}))
                });
                
                if (this.strategyCalculator && this.selectedDrivers) {
                    this.strategyCalculator.setSelectedDrivers(this.selectedDrivers);
                    console.log('🚗 Passed drivers to strategy calculator:', this.selectedDrivers);
                } else {
                    console.error('❌ Cannot pass drivers - strategyCalculator:', !!this.strategyCalculator, 'selectedDrivers:', !!this.selectedDrivers);
                }

                // Pass session metadata (track and event IDs) for weather and track map
                if (this.strategyCalculator && this.selectedSessionDetails) {
                    console.log('🔍 selectedSessionDetails exists:', !!this.selectedSessionDetails);
                    console.log('🔍 selectedSessionDetails keys:', Object.keys(this.selectedSessionDetails));
                    console.log('🔍 selectedSessionDetails.event_id:', this.selectedSessionDetails.event_id);
                    console.log('🔍 selectedSessionDetails.track_garage61_id:', this.selectedSessionDetails.track_garage61_id);
                    console.log('🔍 selectedSessionDetails.track_id:', this.selectedSessionDetails.track_id);
                    
                    this.strategyCalculator.setSessionMetadata(
                        this.selectedSessionDetails.track_id,
                        this.selectedSessionDetails.event_id
                    );
                    console.log('📍 Passed session metadata to strategy calculator:', {
                        trackId: this.selectedSessionDetails.track_id,
                        eventId: this.selectedSessionDetails.event_id
                    });
                } else {
                    console.log('❌ selectedSessionDetails is null or strategyCalculator is null:', {
                        selectedSessionDetails: this.selectedSessionDetails,
                        strategyCalculator: !!this.strategyCalculator
                    });
                }

                const formData = this.collectFormData();

                const strategy = await this.strategyCalculator.calculateStrategy(formData);
                
                // RESTORE DRIVER ASSIGNMENTS AFTER TABLE IS REBUILT
                this.restoreDriverAssignmentsAfterRecalculation(savedStintDrivers, savedBackupDrivers);
                
            this.uiManager.showNotification('Strategy calculated successfully!', 'success');
        } catch (error) {
            console.error('❌ Strategy calculation failed:', error);
            this.uiManager.showNotification('Strategy calculation failed', 'error');
        } finally {
            this.setLoading(false, false); // Don't show overlay when finishing
        }
    }

    /**
     * Restore driver assignments after strategy recalculation
     * This preserves driver selections when the table is rebuilt
     */
    restoreDriverAssignmentsAfterRecalculation(stintDrivers, backupDrivers) {
        try {
            const tbody = document.getElementById('stint-table-body');
            if (!tbody) {
                console.warn('⚠️ Stint table body not found');
                return;
            }

            const rows = tbody.querySelectorAll('tr[data-role="stint"]');
            
            // Restore primary driver assignments
            Object.entries(stintDrivers).forEach(([stintIndex, driverName]) => {
                const index = parseInt(stintIndex);
                const row = rows[index];
                if (row) {
                    const driverSelect = row.querySelector('.driver-select-stint');
                    if (driverSelect) {
                        driverSelect.value = driverName;
                        // Apply color to row
                        if (this.strategyCalculator) {
                            this.strategyCalculator.applyDriverColorToRow(row, driverName);
                        }
                        console.log(`✅ Restored primary driver "${driverName}" to stint ${index + 1}`);
                    }
                }
            });

            // Restore backup driver assignments
            Object.entries(backupDrivers).forEach(([stintIndex, backupDriverName]) => {
                const index = parseInt(stintIndex);
                const row = rows[index];
                if (row) {
                    const backupSelect = row.querySelector('.backup-select-stint');
                    if (backupSelect) {
                        backupSelect.value = backupDriverName;
                        console.log(`✅ Restored backup driver "${backupDriverName}" to stint ${index + 1}`);
                    }
                }
            });

            console.log('✅ All driver assignments restored after recalculation');

        } catch (error) {
            console.error('❌ Failed to restore driver assignments:', error);
        }
    }

    /**
     * Setup adjustment sliders for Page 2 strategy adjustments
     * Displays original and adjusted values, updates when sliders move
     */
    /**
     * Update adjustment display values (called when form data changes)
     * Separate from setupAdjustmentSliders to avoid duplicate listeners
     */
    updateAdjustmentDisplayOnly() {
        const fuelSlider = document.getElementById('fuel-slider');
        const lapTimeSlider = document.getElementById('lap-time-slider');
        const fuelPerLap = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value) || 0;
        const lapTimeMinutes = parseInt(document.getElementById('avg-lap-time-minutes')?.value) || 0;
        const lapTimeSeconds = parseInt(document.getElementById('avg-lap-time-seconds')?.value) || 0;
        
        const fuelAdjustment = parseFloat(fuelSlider?.value) || 0;
        const lapTimeAdjustment = parseFloat(lapTimeSlider?.value) || 0;
        
        const effectiveFuel = fuelPerLap + fuelAdjustment;
        const effectiveLapTime = (lapTimeMinutes * 60) + lapTimeSeconds + lapTimeAdjustment;
        
        const fuelOriginal = document.getElementById('fuel-original-value');
        const lapTimeOriginal = document.getElementById('lap-time-original-value');
        
        if (fuelOriginal) {
            fuelOriginal.textContent = fuelPerLap.toFixed(2) + ' L';
        }
        if (lapTimeOriginal) {
            const origMinutes = Math.floor((lapTimeMinutes * 60 + lapTimeSeconds) / 60);
            const origSeconds = (lapTimeMinutes * 60 + lapTimeSeconds) % 60;
            lapTimeOriginal.textContent = `${origMinutes}:${String(Math.floor(origSeconds)).padStart(2, '0')}.000`;
        }
        
        const fuelAdjusted = document.getElementById('fuel-adjusted-value');
        const lapTimeAdjusted = document.getElementById('lap-time-adjusted-value');
        
        if (fuelAdjusted) {
            fuelAdjusted.textContent = effectiveFuel.toFixed(2) + ' L';
            if (fuelAdjustment !== 0) {
                fuelAdjusted.classList.add('text-purple-400');
                fuelAdjusted.classList.remove('text-neutral-200');
            } else {
                fuelAdjusted.classList.remove('text-purple-400');
                fuelAdjusted.classList.add('text-neutral-200');
            }
        }
        if (lapTimeAdjusted) {
            const minutes = Math.floor(effectiveLapTime / 60);
            const seconds = effectiveLapTime % 60;
            const wholeSeconds = Math.floor(seconds);
            const milliseconds = Math.round((seconds - wholeSeconds) * 1000);
            lapTimeAdjusted.textContent = `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
            if (lapTimeAdjustment !== 0) {
                lapTimeAdjusted.classList.add('text-purple-400');
                lapTimeAdjusted.classList.remove('text-neutral-200');
            } else {
                lapTimeAdjusted.classList.remove('text-purple-400');
                lapTimeAdjusted.classList.add('text-neutral-200');
            }
        }
    }

    setupAdjustmentSliders() {
        const fuelSlider = document.getElementById('fuel-slider');
        const lapTimeSlider = document.getElementById('lap-time-slider');

        // Function to update both original and adjusted displays
        const updateAdjustmentDisplay = () => {
            // Get base values from form (original Garage61 data)
            const fuelPerLap = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value) || 0;
            const lapTimeMinutes = parseInt(document.getElementById('avg-lap-time-minutes')?.value) || 0;
            const lapTimeSeconds = parseInt(document.getElementById('avg-lap-time-seconds')?.value) || 0;
            
            // Get slider adjustments
            const fuelAdjustment = parseFloat(fuelSlider?.value) || 0;
            const lapTimeAdjustment = parseFloat(lapTimeSlider?.value) || 0;
            
            // Calculate effective values
            const effectiveFuel = fuelPerLap + fuelAdjustment;
            const effectiveLapTime = (lapTimeMinutes * 60) + lapTimeSeconds + lapTimeAdjustment;
            
            // Update original value displays
            const fuelOriginal = document.getElementById('fuel-original-value');
            const lapTimeOriginal = document.getElementById('lap-time-original-value');
            
            if (fuelOriginal) {
                fuelOriginal.textContent = fuelPerLap.toFixed(2) + ' L';
            }
            if (lapTimeOriginal) {
                const origMinutes = Math.floor((lapTimeMinutes * 60 + lapTimeSeconds) / 60);
                const origSeconds = (lapTimeMinutes * 60 + lapTimeSeconds) % 60;
                lapTimeOriginal.textContent = `${origMinutes}:${String(Math.floor(origSeconds)).padStart(2, '0')}.000`;
            }
            
            // Update adjusted value displays with color change (purple when adjusted)
            const fuelAdjusted = document.getElementById('fuel-adjusted-value');
            const lapTimeAdjusted = document.getElementById('lap-time-adjusted-value');
            
            if (fuelAdjusted) {
                fuelAdjusted.textContent = effectiveFuel.toFixed(2) + ' L';
                // Change to purple if adjustment is not 0
                if (fuelAdjustment !== 0) {
                    fuelAdjusted.classList.add('text-purple-400');
                    fuelAdjusted.classList.remove('text-neutral-200');
                } else {
                    fuelAdjusted.classList.remove('text-purple-400');
                    fuelAdjusted.classList.add('text-neutral-200');
                }
            }
            if (lapTimeAdjusted) {
                const minutes = Math.floor(effectiveLapTime / 60);
                const seconds = effectiveLapTime % 60;
                const wholeSeconds = Math.floor(seconds);
                const milliseconds = Math.round((seconds - wholeSeconds) * 1000);
                lapTimeAdjusted.textContent = `${minutes}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
                // Change to purple if adjustment is not 0
                if (lapTimeAdjustment !== 0) {
                    lapTimeAdjusted.classList.add('text-purple-400');
                    lapTimeAdjusted.classList.remove('text-neutral-200');
                } else {
                    lapTimeAdjusted.classList.remove('text-purple-400');
                    lapTimeAdjusted.classList.add('text-neutral-200');
                }
            }
        };

        // Initial display update
        updateAdjustmentDisplay();

        // Fuel slider listeners
        if (fuelSlider) {
            fuelSlider.addEventListener('input', () => {
                document.getElementById('fuel-slider-value').textContent = parseFloat(fuelSlider.value).toFixed(2);
                updateAdjustmentDisplay();
                // Trigger strategy recalculation
                if (this.strategyCalculator) {
                    this.strategyCalculator.recalculateWithAdjustments();
                }
            });
        }

        // Lap time slider listeners
        if (lapTimeSlider) {
            lapTimeSlider.addEventListener('input', () => {
                document.getElementById('lap-time-slider-value').textContent = parseFloat(lapTimeSlider.value).toFixed(2);
                updateAdjustmentDisplay();
                // Trigger strategy recalculation
                if (this.strategyCalculator) {
                    this.strategyCalculator.recalculateWithAdjustments();
                }
            });
        }

        // Handle +/- buttons for adjustment sliders
        // Adjustment buttons are now handled in strategy-calculator.js setupSliderAdjustmentButtons()
        // Removing duplicate listener code here to prevent double-firing
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
            startDate: document.getElementById('startDate')?.value || '',
            stintDriverAssignments: this.collectStintDriverAssignments()
        };
    }
    
    collectStintDriverAssignments() {
        const assignments = {};
        const tbody = document.getElementById('stint-table-body');
        
        if (!tbody) {
            console.warn('⚠️ Stint table not found, cannot collect assignments');
            return assignments;
        }
        
        const rows = tbody.querySelectorAll('tr[data-role="stint"]');
        rows.forEach((row, index) => {
            const driverSelect = row.querySelector('.driver-select-stint');
            const backupSelect = row.querySelector('.backup-select-stint');
            
            if (driverSelect?.value) {
                assignments[`stint_${index}_driver`] = driverSelect.value;
            }
            if (backupSelect?.value) {
                assignments[`stint_${index}_backup`] = backupSelect.value;
            }
        });
        
        console.log('💾 Collected stint driver assignments:', assignments);
        return assignments;
    }

    /**
     * Restore stint driver assignments from saved data
     * @param {Object} assignments - Map of stint assignments (e.g., {stint_0_driver: 'John Sowerby', stint_0_backup: 'Jane Doe'})
     */
    restoreStintDriverAssignments(assignments) {
        if (!assignments || Object.keys(assignments).length === 0) {
            console.log('ℹ️ No stint assignments to restore');
            return;
        }
        
        const tbody = document.getElementById('stint-table-body');
        if (!tbody) {
            console.warn('⚠️ Stint table not found, cannot restore assignments');
            return;
        }
        
        const rows = tbody.querySelectorAll('tr[data-role="stint"]');
        
        Object.entries(assignments).forEach(([key, value]) => {
            const match = key.match(/stint_(\d+)_(driver|backup)/);
            if (!match) return;
            
            const [, stintIndex, driverType] = match;
            const index = parseInt(stintIndex);
            const row = rows[index];
            
            if (!row) {
                console.warn(`⚠️ Stint row ${index} not found`);
                return;
            }
            
            if (driverType === 'driver') {
                const driverSelect = row.querySelector('.driver-select-stint');
                if (driverSelect) {
                    driverSelect.value = value;
                    // Apply color to row
                    if (this.strategyCalculator) {
                        this.strategyCalculator.applyDriverColorToRow(row, value);
                    }
                    console.log(`✅ Restored driver "${value}" to stint ${index + 1}`);
                }
            } else if (driverType === 'backup') {
                const backupSelect = row.querySelector('.backup-select-stint');
                if (backupSelect) {
                    backupSelect.value = value;
                    console.log(`✅ Restored backup driver "${value}" to stint ${index + 1}`);
                }
            }
        });
        
        console.log('✅ Stint driver assignments restored');
        
        // Update weather component with restored data
        if (this.strategyCalculator && this.strategyCalculator.weatherComponent) {
            this.strategyCalculator.updateWeatherComponentDriversChart();
        }
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

    collectPage2FormData() {
        return {
            raceDurationHours: document.getElementById('race-duration-hours')?.value || '',
            raceDurationMinutes: document.getElementById('race-duration-minutes')?.value || '',
            avgLapTimeMinutes: document.getElementById('avg-lap-time-minutes')?.value || '',
            avgLapTimeSeconds: document.getElementById('avg-lap-time-seconds')?.value || '',
            fuelPerLap: document.getElementById('fuel-per-lap-display-input')?.value || '',
            tankCapacity: document.getElementById('tank-capacity-display-input')?.value || '',
            pitStopTime: document.getElementById('pit-stop-time')?.value || '',
            fuelSlider: document.getElementById('fuel-slider')?.value || '0',
            lapTimeSlider: document.getElementById('lap-time-slider')?.value || '0'
        };
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
        
        // Restore stint driver assignments if they were saved
        if (window.stintDriverAssignments) {
            this.restoreStintDriverAssignments(window.stintDriverAssignments);
            delete window.stintDriverAssignments;
        }
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

    setLoading(loading, showOverlay = false) {
        this.isLoading = loading;
        
        // Only show/hide the page2 loading overlay if explicitly requested (for saved data loading)
        if (showOverlay) {
            const loadingOverlay = document.getElementById('page2-loading-overlay');
            if (loadingOverlay) {
                if (loading) {
                    loadingOverlay.classList.remove('hidden');
                } else {
                    // Add 3-second delay before hiding overlay
                    setTimeout(() => {
                        loadingOverlay.classList.add('hidden');
                    }, 3000);
                }
            }
        }
        
        // Skip showing loading spinners and disabling forms for quick calculations
        // These cause flickering during strategy calculations
        // Only enable them for initial data load or explicit requests
        if (showOverlay) {
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
    }

    addSelectedDriver() {
        // Prevent multiple rapid calls
        if (this._addingDriver) {
            console.log('🔒 Already adding driver, ignoring duplicate call');
            return;
        }
        
        this._addingDriver = true;
        
        const driverSelect = document.getElementById('driver-select');
        
        console.log('🔍 DETAILED DEBUG - Button clicked:');
        console.log('   - Time:', new Date().toISOString());
        console.log('   - driverSelect element exists:', !!driverSelect);
        console.log('   - driverSelect.options.length:', driverSelect?.options?.length);
        console.log('   - driverSelect.selectedIndex:', driverSelect?.selectedIndex);
        console.log('   - driverSelect.value BEFORE anything:', `"${driverSelect?.value}"`);
        console.log('   - driverSelect.value.length:', driverSelect?.value?.length);
        
        // Let's see all the options
        if (driverSelect && driverSelect.options) {
            console.log('   - Available options:');
            for (let i = 0; i < driverSelect.options.length; i++) {
                console.log(`     [${i}] value: "${driverSelect.options[i].value}", text: "${driverSelect.options[i].text}", selected: ${driverSelect.options[i].selected}`);
            }
        }
        
        const driverName = driverSelect.value;
        
        console.log('   - Final driverName after assignment:', `"${driverName}"`);
        console.log('   - driverName === "":', driverName === "");
        console.log('   - !driverName:', !driverName);
        console.log('   - driverName.trim() === "":', driverName?.trim() === "");
        
        if (!driverName || driverName.trim() === '') {
            console.log('❌ VALIDATION FAILED - No driver name selected');
            console.log('   - This is why the error message appears!');
            this.uiManager.showNotification('Please select a driver first', 'error');
            this._addingDriver = false;
            return;
        }

        // Find the driver object
        const driver = this.allData.drivers.find(d => d.name === driverName);
        console.log('   - Found driver object:', driver);
        
        if (!driver) {
            console.log('❌ Driver not found in allData.drivers');
            this.uiManager.showNotification('Driver not found', 'error');
            this._addingDriver = false;
            return;
        }

        // Check if driver is already selected
        if (this.selectedDrivers.some(d => d.name === driverName)) {
            console.log('⚠️ Driver already selected');
            this.uiManager.showNotification('Driver already selected', 'warning');
            this._addingDriver = false;
            return;
        }

        // Check max drivers limit (6 for endurance racing)
        if (this.selectedDrivers.length >= 6) {
            console.log('⚠️ Max drivers limit reached');
            this.uiManager.showNotification('Maximum 6 drivers allowed', 'warning');
            this._addingDriver = false;
            return;
        }

        // Add driver to selected list
        this.selectedDrivers.push(driver);
        this.updateDriversList();
        
        // Reset dropdown
        driverSelect.value = '';
        
        console.log(`✅ Added driver: ${driverName}`);
        
        // Reset the lock
        this._addingDriver = false;
    }

    removeSelectedDriver(driverName) {
        this.selectedDrivers = this.selectedDrivers.filter(d => d.name !== driverName);
        this.updateDriversList();
        console.log(`❌ Removed driver: ${driverName}`);
    }

    /**
     * Display the selected series logo and name
     */
    displaySeriesLogo() {
        const seriesLogoEl = document.getElementById('series-logo');
        const seriesNameEl = document.getElementById('series-name');

        if (this.selectedSeries) {
            // Display series name
            if (seriesNameEl) {
                seriesNameEl.textContent = this.selectedSeries.series_name || 'Unknown Series';
                seriesNameEl.classList.remove('hidden');
            }

            // Display series logo if available
            if (seriesLogoEl && this.selectedSeries.logo) {
                const logoUrl = `https://images-static.iracing.com${this.selectedSeries.logo}`;
                seriesLogoEl.src = logoUrl;
                seriesLogoEl.classList.remove('hidden');
                console.log('🏁 Displaying series logo:', logoUrl);
                
                // Handle logo load errors
                seriesLogoEl.onerror = function() {
                    console.warn('❌ Failed to load series logo:', logoUrl);
                    seriesLogoEl.classList.add('hidden');
                };
            } else if (seriesLogoEl) {
                seriesLogoEl.classList.add('hidden');
            }
        } else {
            this.hideSeriesLogo();
        }
    }

    /**
     * Hide the series logo and name
     */
    hideSeriesLogo() {
        const seriesLogoEl = document.getElementById('series-logo');
        const seriesNameEl = document.getElementById('series-name');
        
        if (seriesLogoEl) {
            seriesLogoEl.classList.add('hidden');
            seriesLogoEl.src = '';
        }
        
        if (seriesNameEl) {
            seriesNameEl.classList.add('hidden');
            seriesNameEl.textContent = '';
        }
    }

    updateDriversList() {
        const driversList = document.getElementById('driver-list');
        if (!driversList) return;

        driversList.innerHTML = '';

        this.selectedDrivers.forEach(driver => {
            const li = document.createElement('li');
            li.className = 'bg-neutral-700 rounded-lg p-3 mb-3';
            
            // Get country flag
            console.log(`🏁 Getting flag for driver ${driver.name} from ${driver.country}`);
            const countryFlag = getCountryFlagOrCode(driver.country);
            console.log(`🏁 Flag result: ${countryFlag}`);
            
            // Get safety rating class from database field
            const groupName = driver.sports_car_group_name || 'D';
            const safetyRating = driver.sports_car_safety_rating || 'D';
            const iRating = driver.sports_car_irating || 'N/A';
            
            // Get color for group name and clean display name
            let groupColorClass = '';
            const groupLetter = groupName.replace(/^Class\s*/i, '').trim().toUpperCase();
            const displayGroupName = groupLetter; // Remove "Class" from display
            
            // Determine color based on safety rating class
            switch(groupLetter) {
                case 'A':
                    groupColorClass = 'bg-blue-500 text-blue-800';
                    break;
                case 'B':
                    groupColorClass = 'bg-green-500 text-green-800';
                    break;
                case 'C':
                    groupColorClass = 'bg-yellow-500 text-yellow-800';
                    break;
                case 'D':
                    groupColorClass = 'bg-red-500 text-red-800';
                    break;
                default:
                    groupColorClass = 'bg-neutral-400 text-neutral-800';
            }
            
            li.innerHTML = `
                <div class="flex items-center">
                    <div class="flex items-center justify-between w-32 px-3 py-2 rounded-full ${groupColorClass}">
                        <span class="font-bold text-xs">${displayGroupName}</span>
                        <span class="mx-1">${safetyRating}</span>
                        <span class="font-bold">${iRating}</span>
                    </div>
                    <div class="ml-4 w-8 flex justify-center">
                        ${countryFlag}
                    </div>
                    <div class="flex-1 px-2">
                        <span class="text-neutral-200 font-medium">${driver.name}</span>
                    </div>
                    <div class="text-neutral-400 text-sm min-w-max">
                        ${driver.country}
                    </div>
                    <button onclick="window.radianPlanner.removeSelectedDriver('${driver.name}')" 
                            class="ml-4 text-red-400 hover:text-red-300">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
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

    async refreshAllDriversFullDetails() {
        const refreshBtn = document.getElementById('refresh-drivers-full-btn');
        const originalHtml = refreshBtn.innerHTML;

        try {
            // Update button to show loading state
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;

            this.uiManager.showNotification('Refreshing all driver details from iRacing...', 'info');

            const response = await fetch('/api/drivers/refresh-all-full', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Full details refresh failed');
            }

            // Reload driver data
            this.allData = await this.apiClient.fetchAllData();
            this.populateDriversDropdown();

            this.uiManager.showNotification(
                `Successfully refreshed full details for ${result.updatedCount}/${result.totalDrivers} drivers`,
                'success'
            );

            console.log(`✅ Full driver details refresh completed: ${result.updatedCount}/${result.totalDrivers} updated`);

        } catch (error) {
            console.error('❌ Full driver details refresh failed:', error);
            this.uiManager.showNotification(
                `Full driver details refresh failed: ${error.message}`,
                'error'
            );
        } finally {
            // Restore button
            refreshBtn.innerHTML = originalHtml;
            refreshBtn.disabled = false;
        }
    }

    async refreshWeatherData() {
        const refreshBtn = document.getElementById('refresh-weather-btn');
        const originalHtml = refreshBtn.innerHTML;

        try {
            // Update button to show loading state
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            refreshBtn.disabled = true;

            this.uiManager.showNotification('Refreshing weather data from iRacing...', 'info');

            const response = await fetch('/api/weather/refresh-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Weather refresh failed');
            }

            this.uiManager.showNotification(
                `Successfully refreshed weather data for ${result.updatedCount}/${result.totalEvents} events`,
                'success'
            );

            console.log(`✅ Weather refresh completed: ${result.updatedCount}/${result.totalEvents} updated`);

        } catch (error) {
            console.error('❌ Weather refresh failed:', error);
            this.uiManager.showNotification(
                `Weather refresh failed: ${error.message}`,
                'error'
            );
        } finally {
            // Restore button
            refreshBtn.innerHTML = originalHtml;
            refreshBtn.disabled = false;
        }
    }



    async addDriverByCustomerId() {
        const custIdInput = document.getElementById('new-driver-cust-id');
        const addBtn = document.getElementById('add-driver-by-id-btn');
        const custId = custIdInput.value.trim();

        if (!custId || isNaN(parseInt(custId))) {
            this.uiManager.showNotification('Please enter a valid iRacing Customer ID', 'error');
            return;
        }

        const originalHtml = addBtn.innerHTML;

        try {
            // Update button to show loading state
            addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            addBtn.disabled = true;

            this.uiManager.showNotification('Adding driver to database...', 'info');

            const response = await fetch('/api/drivers/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ custId: parseInt(custId) })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to add driver');
            }

            // Clear input field
            custIdInput.value = '';

            // Reload driver data to include the new driver
            this.allData = await this.apiClient.fetchAllData();
            this.populateDriversDropdown();

            this.uiManager.showNotification(
                `Successfully added driver: ${result.driver.display_name}`,
                'success'
            );

            console.log(`✅ Driver added: ${result.driver.display_name} (${result.driver.cust_id})`);

        } catch (error) {
            console.error('❌ Failed to add driver:', error);
            this.uiManager.showNotification(
                `Failed to add driver: ${error.message}`,
                'error'
            );
        } finally {
            // Restore button
            addBtn.innerHTML = originalHtml;
            addBtn.disabled = false;
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

    async handleSeriesSelection(seriesId) {
        if (!seriesId) {
            this.selectedSeries = null;
            this.hideSeriesLogo();
            console.log('❌ Series selection cleared');
            return;
        }

        // Find and store the selected series object
        this.selectedSeries = this.allData.series.find(s => s.series_id === parseInt(seriesId));
        if (!this.selectedSeries) {
            console.error(`❌ Series "${seriesId}" not found in series data`);
            return;
        }

        console.log('✅ Selected series:', this.selectedSeries);
        this.displaySeriesLogo();
        
        // Populate events dropdown with this series's events
        await this.populateEventsDropdown(seriesId);
    }

    async handleEventSelection(eventId) {
        if (!eventId) {
            console.log('❌ Event selection cleared');
            return;
        }

        // Populate sessions dropdown when event is selected
        await this.populateSessionsDropdown(eventId);
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
            iracing_track_id: trackDetails?.iracing_track_id || this.selectedTrack?.iracing_track_id || null,
            config_name: trackDetails?.config_name || null,
            location: trackDetails?.location || null,
            latitude: trackDetails?.latitude || null,
            longitude: trackDetails?.longitude || null,
            track_config_length: trackDetails?.track_config_length || null,
            logo: trackDetails?.logo ? `https://images-static.iracing.com${trackDetails.logo}` : null,
            track_image: (trackDetails?.track_small_image && trackDetails?.track_folder) ? 
                `https://images-static.iracing.com/${trackDetails.track_folder}/${trackDetails.track_small_image}` : null
        };

        // Collect selected car data (handle both nested and direct structures)
        const carDetails = this.selectedCar?.details || this.selectedCar;
        const carData = {
            name: this.selectedCar?.name || carDetails?.car_name || carDetails?.name || 'Unknown Car',
            id: this.selectedCar?.id || carDetails?.id || carDetails?.car_id || null,
            garage61_id: carDetails?.garage61_id || null,
            iracing_car_id: carDetails?.iracing_car_id || null,
            weight: carDetails?.car_weight || carDetails?.weight || null,
            horsepower: carDetails?.hp || carDetails?.horsepower || null,
            logo: (carDetails?.small_image && carDetails?.folder) ? 
                `https://images-static.iracing.com/${carDetails.folder}/${carDetails.small_image}` : null
        };

        // Collect selected drivers data
        const driversData = (this.selectedDrivers || []).map(driver => ({
            name: driver.name,
            firstName: driver.firstName,
            lastName: driver.lastName,
            garage61_slug: driver.garage61_slug,
            timezone: driver.timezone,
            safety_rating: driver.sports_car_safety_rating || driver.safety_rating,
            irating: driver.sports_car_irating || driver.irating,
            country: driver.country,
            sports_car_group_name: driver.sports_car_group_name
        }));
        
        console.log('🔍 DEBUG: Collected data structures:');
        console.log('   trackData:', trackData);
        console.log('   carData:', carData);
        console.log('   driversData:', driversData);
        console.log('🔍 DEBUG: Detailed data inspection:');
        console.log('   trackData.garage61_id:', trackData.garage61_id);
        console.log('   carData.garage61_id:', carData.garage61_id);
        console.log('   sessionDetails exists:', !!this.selectedSessionDetails);
        if (this.selectedSessionDetails) {
            console.log('   sessionDetails.start_time:', this.selectedSessionDetails.start_time);
            console.log('   sessionDetails.start_date:', this.selectedSessionDetails.start_date);
            console.log('   sessionDetails.session_name:', this.selectedSessionDetails.session_name);
            console.log('   sessionDetails keys:', Object.keys(this.selectedSessionDetails));
        }

        // Collect session details (tolerant to varying API field names)
        let sessionData;
        if (this.selectedSessionDetails) {
            const raw = this.selectedSessionDetails;

            // Try several possible field names for the real-world event datetime
            const sessionDateRaw = raw.session_date || raw.start_date || raw.startDate || raw.sessionDate || raw.event_date || null;

            // Try several possible fields for a start time (real-world or simulated fallback)
            let sessionStartRaw = raw.session_start_time || raw.start_time || raw.startTime || raw.simulated_start_time || raw.simulated_start || null;

            // If there is no explicit start time but we have a combined datetime, extract the time portion
            if (!sessionStartRaw && sessionDateRaw) {
                try {
                    sessionStartRaw = new Date(sessionDateRaw).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                    sessionStartRaw = null;
                }
            }

            // Timezone if provided by API
            const timezoneRaw = raw.timezone || raw.event_timezone || raw.timezone_name || raw.tz || null;

            sessionData = {
                session_name: raw.session_name || raw.session || 'Unknown Session',
                session_date: sessionDateRaw || null,
                session_start_time: sessionStartRaw || 'Not selected',
                session_length: raw.duration_minutes || raw.session_length || null,
                time_of_day: raw.time_of_day || null,
                simulated_start_time: raw.simulated_start_time || null,
                event_id: raw.event_id || raw.id || null,
                timezone: timezoneRaw,
                available_car_classes: raw.available_car_classes || []
            };
        } else {
            sessionData = {
                session_name: 'Unknown Session',
                session_date: null,
                session_start_time: 'Not selected',
                session_length: null,
                time_of_day: null,
                simulated_start_time: null,
                event_id: null,
                available_car_classes: []
            };
        }

        // Collect series data
        const seriesData = this.selectedSeries ? {
            name: this.selectedSeries.series_name || 'Unknown Series',
            id: this.selectedSeries.series_id || null,
            logo: this.selectedSeries.logo ? `https://images-static.iracing.com${this.selectedSeries.logo}` : null
        } : null;

        // Collect weather data if available
        const weatherData = this.currentWeatherData || null;

        // Collect strategy data if available
        const strategyData = this.currentStrategies || [];

        const eventData = {
            track: trackData,
            car: carData,
            drivers: driversData,
            session: sessionData,
            series: seriesData,
            weather: weatherData,
            strategies: strategyData,
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

        // AUTO-POPULATE FORM FIELDS FROM PAGE 1 SESSION DATA
        console.log('🔧 Auto-populating form fields from page 1 data...');
        
        // 1. Extract and populate race duration from session length
        const sessionLengthEl = document.getElementById('session-length');
        if (sessionLengthEl) {
            // Prefer numeric value from eventData.session.session_length (authoritative)
            const eventSessionLen = eventData?.session?.session_length;
            let totalMinutes = null;

            if (eventSessionLen !== null && eventSessionLen !== undefined) {
                totalMinutes = parseInt(eventSessionLen, 10) || 0;
                console.log(`📊 Using eventData.session.session_length: ${totalMinutes} minutes`);
            } else {
                // Fallback to dataset values on the element (older code path)
                const sessionHours = sessionLengthEl.dataset.sessionHours || '';
                const sessionMinutes = sessionLengthEl.dataset.sessionMinutes || '';
                console.log(`📊 Session duration dataset found: ${sessionHours}h ${sessionMinutes}m`);

                const rawHours = parseInt(sessionHours || 0, 10);
                const rawMinutes = parseInt(sessionMinutes || 0, 10);

                if (rawMinutes === 0 && rawHours > 23) {
                    // hours field actually contains minutes
                    totalMinutes = rawHours;
                } else {
                    totalMinutes = (rawHours * 60) + rawMinutes;
                }
            }

            const raceDurationDisplay = document.getElementById('race-duration-minutes-display');
            if (raceDurationDisplay) raceDurationDisplay.textContent = (totalMinutes || totalMinutes === 0) ? `${totalMinutes}` : '-';

            // Keep hidden inputs for compatibility and also normalize dataset values
            const raceDurationHoursEl = document.getElementById('race-duration-hours');
            const raceDurationMinutesEl = document.getElementById('race-duration-minutes');
            if (raceDurationHoursEl) raceDurationHoursEl.value = Math.floor((totalMinutes || 0) / 60) || 0;
            if (raceDurationMinutesEl) raceDurationMinutesEl.value = (totalMinutes || 0) % 60 || 0;
            try {
                if (sessionLengthEl && totalMinutes !== null) {
                    sessionLengthEl.dataset.sessionMinutes = ((totalMinutes || 0) % 60).toString();
                    sessionLengthEl.dataset.sessionHours = Math.floor((totalMinutes || 0) / 60).toString();
                    sessionLengthEl.dataset.sessionLength = (totalMinutes || 0).toString();
                }
            } catch (e) {
                // ignore dataset write failures
            }
        }

        // 2. Extract and populate race start time from race datetime
        const raceDatetimeEl = document.getElementById('race-datetime');
        if (raceDatetimeEl) {
            const raceTime = raceDatetimeEl.dataset.raceTime || '';
            const raceDate = raceDatetimeEl.dataset.raceDate || '';
            
            console.log(`📊 Race start time found: ${raceDate} ${raceTime}`);
            
            // Auto-populate the race start time form field
            const raceStartTimeEl = document.getElementById('race-start-time-page2');
            if (raceStartTimeEl && raceTime) {
                raceStartTimeEl.value = raceTime;
                console.log(`✅ Set race-start-time-page2 to: ${raceTime}`);
            }
        }

        // Populate track information with images
        const trackNameEl = document.getElementById('page2-track');
        const trackConfigEl = document.getElementById('page2-track-config');
        const trackImageEl = document.getElementById('track-image');
        const trackLogoEl = document.getElementById('track-logo');
        
        if (trackNameEl) trackNameEl.textContent = eventData.track?.name || 'Unknown Track';
        if (trackConfigEl) trackConfigEl.textContent = eventData.track?.config_name || '';
        
        // Set track background image
        if (trackImageEl && eventData.track?.track_image) {
            trackImageEl.src = eventData.track.track_image;
            trackImageEl.classList.remove('hidden');
        } else if (trackImageEl) {
            trackImageEl.classList.add('hidden');
        }
        
        // Set track logo overlay
        if (trackLogoEl && eventData.track?.logo) {
            trackLogoEl.src = eventData.track.logo;
            trackLogoEl.classList.remove('hidden');
        } else if (trackLogoEl) {
            trackLogoEl.classList.add('hidden');
        }

        // Populate car information with image
        const carNameEl = document.getElementById('page2-car');
        const carClassEl = document.getElementById('page2-car-class');
        const carLogoEl = document.getElementById('car-logo');
        
        if (carNameEl) carNameEl.textContent = eventData.car?.name || 'Unknown Car';
        if (carClassEl) carClassEl.textContent = eventData.car?.class || '';
        
        // Set car logo image
        if (carLogoEl && eventData.car?.logo) {
            carLogoEl.src = eventData.car.logo;
            carLogoEl.classList.remove('hidden');
        } else if (carLogoEl) {
            carLogoEl.classList.add('hidden');
        }

        // Populate series information with logo
        const seriesNameEl = document.getElementById('page2-series');
        const seriesLogoEl = document.getElementById('page2-series-logo');
        
        if (seriesNameEl) seriesNameEl.textContent = eventData.series?.name || 'Unknown Series';
        
        // Set series logo image
        if (seriesLogoEl && eventData.series?.logo) {
            seriesLogoEl.src = eventData.series.logo;
            seriesLogoEl.classList.remove('hidden');
        } else if (seriesLogoEl) {
            seriesLogoEl.classList.add('hidden');
        }

        // Populate session information using render helper so the date/time are formatted
        // in the current timezone (selected driver or session timezone)
        if (eventData.session) {
            const selectedDriver = window.radianPlanner && window.radianPlanner.selectedDriverForTime ? window.radianPlanner.selectedDriverForTime : null;
            this.renderPage2TimeWithDriver(selectedDriver, eventData.session);
        }

        // Populate drivers list with safety rating and iRating
        const driversListEl = document.getElementById('page2-drivers');
        // Compute Projected SOF (average iRating of drivers list)
        try {
            const sofEl = document.getElementById('page2-projected-sof');
            if (sofEl && eventData.drivers && eventData.drivers.length > 0) {
                const ratings = eventData.drivers.map(d => parseInt(d.irating || d.iRating || d.irating || 0, 10)).filter(Boolean);
                if (ratings.length > 0) {
                    const avg = Math.round(ratings.reduce((a,b) => a+b, 0) / ratings.length);
                    sofEl.textContent = avg.toString();
                } else {
                    sofEl.textContent = '-';
                }
            } else if (sofEl) {
                sofEl.textContent = '-';
            }
        } catch (e) {
            console.warn('Failed to compute Projected SOF', e);
        }
        if (driversListEl) {
            if (eventData.drivers && eventData.drivers.length > 0) {
                // Create detailed drivers display with ratings and flags
                const driversHtml = eventData.drivers.map((driver, idx) => {
                    const name = driver.name || 'Unknown Driver';
                    const safetyRating = driver.safety_rating || '';
                    const iRating = driver.irating || '';
                    const country = driver.country || '';
                    const groupName = driver.sports_car_group_name || '';
                    const countryFlag = getCountryFlagOrCode(country);
                    
                    // Get color for group name and clean display name
                    let groupColorClass = '';
                    const groupLetter = groupName.replace(/^Class\s*/i, '').trim().toUpperCase();
                    const displayGroupName = groupLetter; // Remove "Class" from display
                    
                    switch(groupLetter) {
                        case 'A':
                            groupColorClass = 'bg-blue-500 text-blue-800';
                            break;
                        case 'B':
                            groupColorClass = 'bg-green-500 text-green-800';
                            break;
                        case 'C':
                            groupColorClass = 'bg-yellow-500 text-yellow-800';
                            break;
                        case 'D':
                            groupColorClass = 'bg-red-500 text-red-800';
                            break;
                        default:
                            groupColorClass = 'bg-neutral-400 text-neutral-800';
                    }
                    
                    // Make each driver card clickable; include a data-index for identification
                    return `
                        <div class="driver-card bg-neutral-700 rounded-lg p-2 cursor-pointer" data-driver-index="${idx}">
                            <div class="flex items-center">
                                <div class="flex items-center justify-between w-28 px-2 py-1 rounded-full ${groupColorClass} text-xs">
                                    <span class="font-bold">${displayGroupName}</span>
                                    <span class="mx-1">${safetyRating}</span>
                                    <span class="font-bold">${iRating}</span>
                                </div>
                                <div class="ml-3 w-6 flex justify-center">
                                    ${countryFlag}
                                </div>
                                <div class="flex-1 px-2 min-w-0">
                                    <div class="driver-name text-neutral-200 font-medium text-sm leading-tight line-clamp-2 break-words">${name}</div>
                                </div>
                                <div class="text-neutral-400 text-xs text-right min-w-max ml-2">
                                    ${country}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                driversListEl.innerHTML = driversHtml;
                
                // Attach click handlers to driver cards to set selected driver timezone
                const driverCards = driversListEl.querySelectorAll('.driver-card');
                driverCards.forEach(card => {
                    card.addEventListener('click', (e) => {
                        const idx = parseInt(card.dataset.driverIndex, 10);
                        const selected = eventData.drivers[idx];
                        // store selected driver for time display
                        window.radianPlanner.selectedDriverForTime = selected;
                        // update UI highlight: reset all name backgrounds to light grey
                        const allNames = driversListEl.querySelectorAll('.driver-name');
                        allNames.forEach(n => {
                            n.style.backgroundColor = '#707070ff'; // neutral-600 (less blue)
                            n.style.padding = '0.1rem 0.25rem';
                            n.style.borderRadius = '4px';
                        });
                        // set selected name background to neutral dark grey
                        const nameEl = card.querySelector('.driver-name');
                        if (nameEl) {
                            nameEl.style.backgroundColor = '#3a3a3aff'; // neutral-800
                            nameEl.style.padding = '0.1rem 0.25rem';
                            nameEl.style.borderRadius = '4px';
                        }
                        // re-render the page2 time display using selected driver's timezone
                        this.renderPage2TimeWithDriver(selected, eventData.session);
                    });
                });
            } else {
                // Show placeholder when no drivers selected
                driversListEl.innerHTML = `
                    <div class="text-center text-neutral-500">
                        <i class="fas fa-users text-neutral-600 text-2xl mb-2"></i>
                        <div class="text-sm">No drivers selected</div>
                    </div>
                `;
            }
        }

        // If Garage61 analysis already ran, copy adjusted lap/fuel values into race inputs
        try {
            const adjustedLapEl = document.getElementById('g61-adjusted-laptime');
            const adjustedFuelEl = document.getElementById('g61-adjusted-fuel');
            if (adjustedLapEl && adjustedLapEl.textContent && adjustedLapEl.textContent !== '-') {
                const parts = adjustedLapEl.textContent.split(':');
                if (parts.length === 2) {
                    const mins = parseInt(parts[0], 10) || 0;
                    const secs = Math.floor(parseFloat(parts[1]) || 0);
                    const minsInput = document.getElementById('avg-lap-time-minutes');
                    const secsInput = document.getElementById('avg-lap-time-seconds');
                    if (minsInput) minsInput.value = mins;
                    if (secsInput) secsInput.value = secs;
                }
            }
            if (adjustedFuelEl && adjustedFuelEl.textContent && adjustedFuelEl.textContent !== '-') {
                const fuelText = adjustedFuelEl.textContent.replace('L', '').trim();
                const fuelInput = document.getElementById('fuel-per-lap-display-input');
                if (fuelInput) fuelInput.value = parseFloat(fuelText) || '';
            }
            
            // Update the adjustment display now that values are populated
            // Use the display-only function to avoid duplicate event listeners
            if (window.radianPlanner && window.radianPlanner.updateAdjustmentDisplayOnly) {
                window.radianPlanner.updateAdjustmentDisplayOnly();
            }
        } catch (e) {
            console.warn('Could not prefill race inputs from Garage61 adjusted values', e);
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
                // Filter laps by selected drivers like backup version
                const filteredLaps = this.garage61Client.filterLapsByDrivers(result.data, eventData.drivers);
                
                // DISPLAY ALL FILTERED LAPS (like backup) instead of just best per driver
                const tbody = document.querySelector('#garage61-lap-times table tbody');
                if (tbody) {
                    this.garage61Client.displayLapTimes(filteredLaps, tbody);
                    this.garage61Client.updateUI('content');
                }

                console.log(`✅ Displayed ${filteredLaps.length} lap times`);
            } else {
                console.warn('⚠️ No lap data found');
                this.garage61Client.updateUI('error', 'No lap data found for this car/track combination');
            }

        } catch (error) {
            console.error('❌ Garage61 fetch error:', error);
            this.garage61Client.updateUI('error', error.message);
        }
    }

    /**
     * Render page 2 event date/time using a driver's timezone (or session timezone fallback)
     * @param {Object} selectedDriver - driver object containing a `timezone` field (IANA)
     * @param {Object} session - session object with `session_date` or `simulated_start_time`
     */
    renderPage2TimeWithDriver(selectedDriver, session) {
        const sessionDateEl = document.getElementById('page2-race-date');
        const sessionTimeEl = document.getElementById('page2-race-time');
        const timezoneEl = document.getElementById('page2-timezone');

        const tz = (selectedDriver && selectedDriver.timezone) || (session && session.timezone) || 'Europe/London';

        const rawDate = session?.session_date || session?.simulated_start_time || session?.session_start_time || null;

        if (!rawDate) {
            if (sessionDateEl) sessionDateEl.textContent = 'Not selected';
            if (sessionTimeEl) sessionTimeEl.textContent = 'Not selected';
            if (timezoneEl) timezoneEl.textContent = tz;
            return;
        }

        const dt = new Date(rawDate);
        // Format date and time in selected timezone
        try {
            const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

            if (sessionDateEl) sessionDateEl.textContent = dateFormatter.format(dt);
            if (sessionTimeEl) sessionTimeEl.textContent = timeFormatter.format(dt);
            if (timezoneEl) timezoneEl.textContent = tz;
        } catch (e) {
            // Fallback to UTC/local formatting
            if (sessionDateEl) sessionDateEl.textContent = dt.toLocaleDateString('en-US');
            if (sessionTimeEl) sessionTimeEl.textContent = dt.toLocaleTimeString('en-US');
            if (timezoneEl) timezoneEl.textContent = tz;
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

    // ===============================
    // SHARE LINK FUNCTIONALITY
    // ===============================

    /**
     * Generate a shareable link for the current strategy
     */
    async generateShareLink() {
        try {
            // Collect stint driver and backup driver assignments from the table
            const stintDrivers = {};
            const stintBackupDrivers = {};
            const tbody = document.getElementById('stint-table-body');
            
            if (tbody) {
                const rows = tbody.querySelectorAll('tr[data-role="stint"]');
                rows.forEach((row, index) => {
                    // Get primary driver selection
                    const driverSelect = row.querySelector('.driver-select-stint');
                    if (driverSelect && driverSelect.value) {
                        stintDrivers[index] = driverSelect.value;
                    }
                    
                    // Get backup driver selection
                    const backupSelect = row.querySelector('.backup-select-stint');
                    if (backupSelect && backupSelect.value) {
                        stintBackupDrivers[index] = backupSelect.value;
                    }
                });
            }

            // Also collect from window storage as fallback
            if (window.stintDriverAssignments) {
                Object.assign(stintDrivers, window.stintDriverAssignments);
            }
            if (window.stintBackupDriverAssignments) {
                Object.assign(stintBackupDrivers, window.stintBackupDriverAssignments);
            }

            // Collect all current app state
            const strategyData = {
                // Page 1 selections
                selectedSeries: this.selectedSeries,
                selectedEvent: this.selectedSessionDetails,
                selectedTrack: this.selectedTrack,
                selectedCar: this.selectedCar,
                selectedDrivers: this.selectedDrivers,

                // Page 2 form data
                formData: this.collectPage2FormData(),

                // Strategy calculator state
                strategyState: this.strategyCalculator ? {
                    totalStints: this.strategyCalculator.totalStints,
                    raceDurationSeconds: this.strategyCalculator.raceDurationSeconds,
                    lapsPerStint: this.strategyCalculator.lapsPerStint,
                    pitStopTime: this.strategyCalculator.pitStopTime,
                    isLocalTimeMode: this.strategyCalculator.isLocalTimeMode,
                    selectedDriverForLocalTime: this.strategyCalculator.selectedDriverForLocalTime,
                    driverColorMap: this.strategyCalculator.driverColorMap
                } : null,

                // Driver assignments for each stint (CRITICAL FOR PERSISTENCE)
                stintDriverAssignments: stintDrivers,
                stintBackupDriverAssignments: stintBackupDrivers,

                // UI state (container collapsed/expanded states)
                uiState: {
                    weatherCollapsed: document.getElementById('weather-display-page2')?.classList.contains('collapsed') || false,
                    trackMapCollapsed: document.getElementById('track-map-container-page2')?.classList.contains('collapsed') || false
                },

                // Timestamp for when strategy was created
                createdAt: new Date().toISOString(),
                version: '1.0'
            };

            console.log('📤 Saving strategy data with driver assignments:', strategyData);

            // Save to server
            const response = await fetch('/api/strategies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(strategyData)
            });

            if (!response.ok) {
                throw new Error('Failed to save strategy');
            }

            const result = await response.json();
            const shareUrl = `${window.location.origin}${window.location.pathname}?strategy=${result.id}`;

            // Update UI
            const shareLinkOutput = document.getElementById('share-link-output');
            if (shareLinkOutput) {
                shareLinkOutput.value = shareUrl;
            }

            // Show save update button
            const saveUpdateBtn = document.getElementById('save-update-btn');
            if (saveUpdateBtn) {
                saveUpdateBtn.classList.remove('hidden');
                saveUpdateBtn.dataset.strategyId = result.id;
            }

            this.uiManager.showNotification('Share link generated successfully!', 'success');
            console.log('🔗 Generated share URL:', shareUrl);

        } catch (error) {
            console.error('❌ Failed to generate share link:', error);
            this.uiManager.showNotification('Failed to generate share link', 'error');
        }
    }

    /**
     * Copy the share link to clipboard
     */
    async copyShareLink() {
        const shareLinkOutput = document.getElementById('share-link-output');
        if (!shareLinkOutput || !shareLinkOutput.value) {
            this.uiManager.showNotification('No share link to copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(shareLinkOutput.value);
            this.uiManager.showNotification('Share link copied to clipboard!', 'success');
        } catch (error) {
            console.error('❌ Failed to copy to clipboard:', error);
            // Fallback for older browsers
            shareLinkOutput.select();
            document.execCommand('copy');
            this.uiManager.showNotification('Share link copied to clipboard!', 'success');
        }
    }

    /**
     * Update an existing shared strategy - uses identical data collection as generateShareLink
     */
    async updateShareLink() {
        const saveUpdateBtn = document.getElementById('save-update-btn');
        const strategyId = saveUpdateBtn?.dataset.strategyId;

        if (!strategyId) {
            this.uiManager.showNotification('No strategy to update', 'error');
            return;
        }

        try {
            // IDENTICAL DATA COLLECTION AS generateShareLink()
            // Collect stint driver and backup driver assignments from the table
            const stintDrivers = {};
            const stintBackupDrivers = {};
            const tbody = document.getElementById('stint-table-body');
            
            if (tbody) {
                const rows = tbody.querySelectorAll('tr[data-role="stint"]');
                rows.forEach((row, index) => {
                    // Get primary driver selection
                    const driverSelect = row.querySelector('.driver-select-stint');
                    if (driverSelect && driverSelect.value) {
                        stintDrivers[index] = driverSelect.value;
                    }
                    
                    // Get backup driver selection
                    const backupSelect = row.querySelector('.backup-select-stint');
                    if (backupSelect && backupSelect.value) {
                        stintBackupDrivers[index] = backupSelect.value;
                    }
                });
            }

            // Also collect from window storage as fallback
            if (window.stintDriverAssignments) {
                Object.assign(stintDrivers, window.stintDriverAssignments);
            }
            if (window.stintBackupDriverAssignments) {
                Object.assign(stintBackupDrivers, window.stintBackupDriverAssignments);
            }

            // Collect all current app state - IDENTICAL TO generateShareLink()
            const strategyData = {
                // Page 1 selections
                selectedSeries: this.selectedSeries,
                selectedEvent: this.selectedSessionDetails,
                selectedTrack: this.selectedTrack,
                selectedCar: this.selectedCar,
                selectedDrivers: this.selectedDrivers,

                // Page 2 form data
                formData: this.collectPage2FormData(),

                // Strategy calculator state
                strategyState: this.strategyCalculator ? {
                    totalStints: this.strategyCalculator.totalStints,
                    raceDurationSeconds: this.strategyCalculator.raceDurationSeconds,
                    lapsPerStint: this.strategyCalculator.lapsPerStint,
                    pitStopTime: this.strategyCalculator.pitStopTime,
                    isLocalTimeMode: this.strategyCalculator.isLocalTimeMode,
                    selectedDriverForLocalTime: this.strategyCalculator.selectedDriverForLocalTime,
                    driverColorMap: this.strategyCalculator.driverColorMap
                } : null,

                // Driver assignments for each stint (CRITICAL FOR PERSISTENCE)
                stintDriverAssignments: stintDrivers,
                stintBackupDriverAssignments: stintBackupDrivers,

                // UI state (container collapsed/expanded states)
                uiState: {
                    weatherCollapsed: document.getElementById('weather-display-page2')?.classList.contains('collapsed') || false,
                    trackMapCollapsed: document.getElementById('track-map-container-page2')?.classList.contains('collapsed') || false
                },

                // Timestamp for when strategy was updated
                updatedAt: new Date().toISOString(),
                version: '1.0'
            };

            console.log('📤 Updating strategy data to server:', strategyData);

            // Update on server using PUT instead of POST
            const response = await fetch(`/api/strategies/${strategyId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(strategyData)
            });

            if (!response.ok) {
                throw new Error('Failed to update strategy');
            }

            this.uiManager.showNotification('Strategy updated successfully!', 'success');
            console.log('✅ Strategy updated successfully!');

        } catch (error) {
            console.error('❌ Failed to update strategy:', error);
            this.uiManager.showNotification('Failed to update strategy', 'error');
        }
    }

    /**
     * Check for shared strategy in URL parameters and load it
     */
    async checkForSharedStrategy() {
        const urlParams = new URLSearchParams(window.location.search);
        const strategyId = urlParams.get('strategy');

        if (!strategyId) {
            return; // No shared strategy in URL
        }

        try {
            const response = await fetch(`/api/strategies/${strategyId}`);
            if (!response.ok) {
                throw new Error('Strategy not found');
            }

            const strategyData = await response.json();
            console.log('📥 Loaded shared strategy:', strategyData);

            // Apply shared strategy data
            if (strategyData.selectedSeries) {
                const seriesSelect = document.getElementById('series-select');
                if (seriesSelect) {
                    seriesSelect.value = strategyData.selectedSeries.series_id;
                    await this.handleSeriesSelection(strategyData.selectedSeries.series_id);
                }
            }

            if (strategyData.selectedEvent) {
                const eventSelect = document.getElementById('event-select');
                if (eventSelect) {
                    eventSelect.value = strategyData.selectedEvent.event_id;
                    await this.handleEventSelection(strategyData.selectedEvent.event_id);
                }
                
                // CRITICAL: Restore selectedSessionDetails from saved data
                // This is normally set by populateRaceInformation() but we skip that when loading shared strategies
                this.selectedSessionDetails = strategyData.selectedEvent;
                console.log('✅ Restored selectedSessionDetails:', this.selectedSessionDetails);
                
                // CRITICAL: Call populateRaceInformation to set race-datetime and event-datetime data attributes
                // These are needed for the time toggle to work correctly
                if (strategyData.selectedEvent && strategyData.selectedEvent.session_id) {
                    console.log('📅 Populating race information to set data attributes for time toggle');
                    await this.populateRaceInformation(strategyData.selectedEvent.session_id);
                }
            }

            if (strategyData.selectedTrack) {
                const trackSelect = document.getElementById('track-select');
                if (trackSelect) {
                    trackSelect.value = strategyData.selectedTrack.name;
                    this.handleTrackSelection(strategyData.selectedTrack.name);

                    // Load track map if available
                    const trackMapContainer = document.getElementById('track-map-container');
                    if (trackMapContainer && strategyData.selectedTrack.track_map_layers) {
                        trackMapContainer.classList.remove('collapsed');
                    }
                }
            }

            if (strategyData.selectedCar) {
                await this.populateCarsByClass(strategyData.selectedCar.class_id);
                const carSelect = document.getElementById('car-select');
                if (carSelect) {
                    carSelect.value = strategyData.selectedCar.car_id;
                }
                // Populate car details using the same method as normal selection
                await this.populateCarDetails(
                    strategyData.selectedCar.car_id || strategyData.selectedCar.id, 
                    strategyData.selectedCar.car_name || strategyData.selectedCar.name
                );
            }

            // Check for Garage61 data now that car and track are selected
            console.log('🔍 Checking for Garage61 data after loading shared strategy...');
            this.checkGarage61Data();

            if (strategyData.selectedDrivers && Array.isArray(strategyData.selectedDrivers)) {
                this.selectedDrivers = strategyData.selectedDrivers;
                this.updateDriversList();
            }

            // Set session metadata for strategy calculator (needed for weather/track loading)
            if (this.strategyCalculator && strategyData.selectedEvent && strategyData.selectedTrack) {
                this.strategyCalculator.setSessionMetadata(
                    strategyData.selectedTrack.track_id,
                    strategyData.selectedEvent.event_id
                );

                // Load weather and track components now that metadata is set
                await this.strategyCalculator.loadWeatherComponent();
                await this.strategyCalculator.loadTrackMapComponent();
            }

            // Apply Page 2 form data
            if (strategyData.formData) {
                this.applyPage2FormData(strategyData.formData);
            }

            // Apply strategy calculator state
            if (strategyData.strategyState && this.strategyCalculator) {
                Object.assign(this.strategyCalculator, strategyData.strategyState);
            }

            // Apply UI state (container collapsed/expanded states)
            if (strategyData.uiState) {
                // Weather container state
                const weatherContainer = document.getElementById('weather-display-page2');
                if (weatherContainer) {
                    if (strategyData.uiState.weatherCollapsed) {
                        weatherContainer.classList.add('collapsed');
                    } else {
                        weatherContainer.classList.remove('collapsed');
                    }
                }

                // Track map container state
                const trackMapContainer = document.getElementById('track-map-container-page2');
                if (trackMapContainer) {
                    if (strategyData.uiState.trackMapCollapsed) {
                        trackMapContainer.classList.add('collapsed');
                    } else {
                        trackMapContainer.classList.remove('collapsed');
                    }
                }
            }

            // Navigate to Page 2 if we have form data
            if (strategyData.formData) {
                this.uiManager.showPage2();
                
                // Store stint assignments for restoration after calculation
                if (strategyData.stintDriverAssignments) {
                    window.stintDriverAssignments = strategyData.stintDriverAssignments;
                }
                if (strategyData.stintBackupDriverAssignments) {
                    window.stintBackupDriverAssignments = strategyData.stintBackupDriverAssignments;
                }
                
                // Show save update button and store strategy ID for updates
                const saveUpdateBtn = document.getElementById('save-update-btn');
                if (saveUpdateBtn) {
                    saveUpdateBtn.classList.remove('hidden');
                    saveUpdateBtn.dataset.strategyId = strategyId;
                    console.log('✅ Showing save update button for strategy:', strategyId);
                }
                
                // Show the share link output
                const shareLinkOutput = document.getElementById('share-link-output');
                if (shareLinkOutput) {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?strategy=${strategyId}`;
                    shareLinkOutput.value = shareUrl;
                }
                
                // Automatically calculate the strategy to show results
                console.log('🔄 Auto-calculating strategy from shared link...');
                setTimeout(async () => {
                    // CRITICAL: Pass drivers to strategyCalculator BEFORE calculating
                    // This ensures the driver dropdowns are populated in the stint table
                    if (this.strategyCalculator && this.selectedDrivers) {
                        console.log('✅ Setting drivers on strategyCalculator before calculateStrategy:', {
                            driverCount: this.selectedDrivers.length,
                            drivers: this.selectedDrivers.map(d => d.name)
                        });
                        this.strategyCalculator.setSelectedDrivers(this.selectedDrivers);
                    }
                    
                    await this.calculateStrategy();
                    
                    // ✅ NEW: If there are slider adjustments, recalculate to apply them
                    if (strategyData.formData && (parseFloat(strategyData.formData.fuelSlider) !== 0 || parseFloat(strategyData.formData.lapTimeSlider) !== 0)) {
                        console.log('🔄 Applying saved slider adjustments:', {
                            fuelSlider: strategyData.formData.fuelSlider,
                            lapTimeSlider: strategyData.formData.lapTimeSlider
                        });
                        if (this.strategyCalculator) {
                            await this.strategyCalculator.recalculateWithAdjustments();
                        }
                    }
                    
                    // Restore stint driver assignments after table is generated
                    this.restoreStintDriverAssignments(strategyData);
                    
                    // Reset the flag after calculation
                    this.isLoadingFromSharedLink = false;
                }, 500); // Small delay to ensure Page 2 is fully loaded
            }

        } catch (error) {
            console.error('❌ Failed to apply shared strategy:', error);
            throw error;
        }
    }

    /**
     * Apply Page 2 form data from shared strategy
     */
    applyPage2FormData(formData) {
        // Helper function to set value if element exists
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element && value !== undefined && value !== null) {
                element.value = value;
            }
        };

        setValue('race-duration-hours', formData.raceDurationHours);
        setValue('race-duration-minutes', formData.raceDurationMinutes);
        setValue('avg-lap-time-minutes', formData.avgLapTimeMinutes);
        setValue('avg-lap-time-seconds', formData.avgLapTimeSeconds);
        setValue('fuel-per-lap-display-input', formData.fuelPerLap);
        setValue('tank-capacity-display-input', formData.tankCapacity);
        setValue('pit-stop-time', formData.pitStopTime);
        setValue('fuel-slider', formData.fuelSlider || '0');
        setValue('lap-time-slider', formData.lapTimeSlider || '0');

        // Trigger adjustment display updates
        this.updateAdjustmentDisplayOnly();
    }

    /**
     * Update slider displays without triggering recalculation
     */
    updateAdjustmentDisplayOnly() {
        // Do NOT reset sliders - preserve any saved adjustments from shared strategy
        const fuelSlider = document.getElementById('fuel-slider');
        const lapTimeSlider = document.getElementById('lap-time-slider');

        // Just update the display text showing the current slider values
        if (fuelSlider) {
            const fuelValue = parseFloat(fuelSlider.value) || 0;
            document.getElementById('fuel-slider-value').textContent = fuelValue.toFixed(2);
        }
        
        if (lapTimeSlider) {
            const lapTimeValue = parseFloat(lapTimeSlider.value) || 0;
            document.getElementById('lap-time-slider-value').textContent = lapTimeValue.toFixed(2);
        }

        // Update displays if strategy calculator has the method
        if (this.strategyCalculator && this.strategyCalculator.updateSliderDisplays) {
            this.strategyCalculator.updateSliderDisplays();
        }
    }

    /**
     * Restore stint driver assignments from shared strategy data
     * Called after the stint table is generated to populate the driver dropdowns
     * @param {Object} strategyData - Strategy data from shared link
     */
    restoreStintDriverAssignments(strategyData) {
        try {
            const tbody = document.getElementById('stint-table-body');
            if (!tbody) {
                console.warn('⚠️ Stint table body not found, cannot restore assignments');
                return;
            }

            const rows = tbody.querySelectorAll('tr[data-role="stint"]');
            
            if (strategyData.stintDriverAssignments) {
                // Restore primary driver assignments
                Object.entries(strategyData.stintDriverAssignments).forEach(([stintIndex, driverName]) => {
                    const index = parseInt(stintIndex);
                    const row = rows[index];
                    if (row) {
                        const driverSelect = row.querySelector('.driver-select-stint');
                        if (driverSelect) {
                            driverSelect.value = driverName;
                            console.log(`✅ Restored primary driver "${driverName}" for stint ${index + 1}`);
                            
                            // Apply driver color to the row
                            if (this.strategyCalculator) {
                                this.strategyCalculator.applyDriverColorToRow(row, driverName);
                            }
                        }
                    }
                });
            }

            if (strategyData.stintBackupDriverAssignments) {
                // Restore backup driver assignments
                Object.entries(strategyData.stintBackupDriverAssignments).forEach(([stintIndex, backupDriverName]) => {
                    const index = parseInt(stintIndex);
                    const row = rows[index];
                    if (row) {
                        const backupSelect = row.querySelector('.backup-select-stint');
                        if (backupSelect) {
                            backupSelect.value = backupDriverName;
                            console.log(`✅ Restored backup driver "${backupDriverName}" for stint ${index + 1}`);
                        }
                    }
                });
            }

            // Restore time mode toggle state
            if (strategyData.strategyState && strategyData.strategyState.isLocalTimeMode) {
                const toggleSwitch = document.querySelector('.toggle-switch');
                if (toggleSwitch && !toggleSwitch.classList.contains('active')) {
                    toggleSwitch.click(); // Toggle to local time mode
                    console.log('✅ Restored local time mode');
                }

                // Restore selected driver for local time if present
                if (strategyData.strategyState.selectedDriverForLocalTime) {
                    const dropdown = document.getElementById('driver-timezone-dropdown');
                    if (dropdown) {
                        dropdown.value = strategyData.strategyState.selectedDriverForLocalTime.name;
                        console.log(`✅ Restored driver timezone selection: ${strategyData.strategyState.selectedDriverForLocalTime.name}`);
                    }
                }
            }

            console.log('✅ All stint driver assignments restored');
        } catch (error) {
            console.error('❌ Failed to restore stint driver assignments:', error);
        }
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