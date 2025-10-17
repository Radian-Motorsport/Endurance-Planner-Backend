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
            
            // Populate track name
            const trackNameElement = document.getElementById('track-name');
            if (trackNameElement && sessionDetails.track_name) {
                trackNameElement.textContent = sessionDetails.track_name;
            }
            
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
        const elements = ['race-datetime', 'event-datetime', 'session-length', 'track-name'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
        
        // Clear car selection
        this.clearCarSelection();
        
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
                carHpElement.textContent = selectedCar.car_hp ? 
                    `${selectedCar.car_hp} HP` : '-';
            }
            
            // Populate car image
            const carImageElement = document.getElementById('car-image');
            if (carImageElement && selectedCar.small_image) {
                const imageUrl = `https://images-static.iracing.com/${selectedCar.small_image}`;
                carImageElement.src = imageUrl;
                carImageElement.alt = selectedCar.car_name || 'Car Image';
                carImageElement.classList.remove('hidden');
                
                // Handle image load errors
                carImageElement.onerror = function() {
                    console.warn('❌ Failed to load car image:', imageUrl);
                    this.classList.add('hidden');
                };
            } else if (carImageElement) {
                carImageElement.classList.add('hidden');
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