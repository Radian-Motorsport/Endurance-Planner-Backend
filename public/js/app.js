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
        const seriesSelect = document.getElementById('seriesSelect');
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
        const carSelect = document.getElementById('car-select');
        if (!carSelect || !this.allData.cars) return;

        carSelect.innerHTML = '<option value="">Select a Car...</option>';
        
        // Filter out cars without names and sort alphabetically
        const validCars = this.allData.cars.filter(car => car && car.name);
        const sortedCars = validCars.sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        sortedCars.forEach(car => {
            const option = document.createElement('option');
            option.value = car.name;
            option.textContent = car.name;
            carSelect.appendChild(option);
        });

        console.log(`✅ Populated cars dropdown with ${sortedCars.length} cars`);
    }

    populateEventsDropdown(seriesId) {
        const eventsSelect = document.getElementById('eventsSelect');
        if (!eventsSelect || !this.allData.events) return;

        eventsSelect.innerHTML = '<option value="">Select Event</option>';
        
        const seriesEvents = this.allData.events.filter(event => 
            event.series_id === parseInt(seriesId)
        );
        
        seriesEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.event_id;
            option.textContent = event.event_name;
            eventsSelect.appendChild(option);
        });

        // Reset sessions dropdown
        const sessionsSelect = document.getElementById('sessionsSelect');
        if (sessionsSelect) {
            sessionsSelect.innerHTML = '<option value="">Select Session</option>';
        }
    }

    populateSessionsDropdown(eventId) {
        const sessionsSelect = document.getElementById('sessionsSelect');
        if (!sessionsSelect || !this.allData.sessions) return;

        sessionsSelect.innerHTML = '<option value="">Select Session</option>';
        
        const eventSessions = this.allData.sessions.filter(session => 
            session.event_id === parseInt(eventId)
        );
        
        eventSessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.session_id;
            option.textContent = session.session_name;
            sessionsSelect.appendChild(option);
        });
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
        const seriesSelect = document.getElementById('seriesSelect');
        const eventsSelect = document.getElementById('eventsSelect');
        const sessionsSelect = document.getElementById('sessionsSelect');

        if (seriesSelect) {
            seriesSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.populateEventsDropdown(e.target.value);
                }
            });
        }

        if (eventsSelect) {
            eventsSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.populateSessionsDropdown(e.target.value);
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