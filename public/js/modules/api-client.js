/**
 * API Client Module
 * Handles all server communication for RadianPlanner
 * Extracted from monolithic index.html to improve maintainability
 */

export class APIClient {
    constructor() {
        this.baseURL = '';
        this.garage61BaseURL = 'https://garage61.net/api/v1';
    }

    /**
     * Fetch all data needed for dropdowns
     * @returns {Promise<{drivers: Array, cars: Array, tracks: Array}>}
     */
    async fetchAllData() {
        try {
            console.log('🔄 Starting to fetch data from API...');
            
            // Fetch data from individual endpoints
            const [driversResponse, carsResponse, tracksResponse] = await Promise.all([
                fetch('/api/drivers'),
                fetch('/api/cars'),
                fetch('/api/tracks')
            ]);

            if (!driversResponse.ok || !carsResponse.ok || !tracksResponse.ok) {
                throw new Error('One or more API endpoints failed');
            }

            const drivers = await driversResponse.json();
            const cars = await carsResponse.json();
            const tracks = await tracksResponse.json();
            
            console.log(`✅ Data loaded: ${drivers.length} drivers, ${cars.length} cars, ${tracks.length} tracks`);
            
            return { drivers, cars, tracks };
        } catch (error) {
            console.error('❌ Failed to fetch data:', error);
            throw new Error('Could not load dropdown data from the server. Please refresh the page or check the server status.');
        }
    }

    /**
     * Fetch drivers from server
     * @returns {Promise<Array>}
     */
    async fetchDrivers() {
        const response = await fetch('/api/drivers');
        if (!response.ok) throw new Error('Failed to fetch drivers');
        return await response.json();
    }

    /**
     * Fetch cars from server
     * @returns {Promise<Array>}
     */
    async fetchCars() {
        const response = await fetch('/api/cars');
        if (!response.ok) throw new Error('Failed to fetch cars');
        return await response.json();
    }

    /**
     * Fetch tracks from server
     * @returns {Promise<Array>}
     */
    async fetchTracks() {
        const response = await fetch('/api/tracks');
        if (!response.ok) throw new Error('Failed to fetch tracks');
        return await response.json();
    }

    /**
     * Fetch endurance racing series
     * @returns {Promise<Array>}
     */
    async fetchSeries() {
        const response = await fetch('/api/series');
        if (!response.ok) throw new Error('Failed to fetch series');
        return await response.json();
    }

    /**
     * Fetch events for a specific series
     * @param {number} seriesId - Series ID
     * @returns {Promise<Array>}
     */
    async fetchEvents(seriesId) {
        const response = await fetch(`/api/events/${seriesId}`);
        if (!response.ok) throw new Error('Failed to fetch events');
        return await response.json();
    }

    /**
     * Fetch sessions for a specific event
     * @param {number} eventId - Event ID
     * @returns {Promise<Array>}
     */
    async fetchSessions(eventId) {
        const response = await fetch(`/api/sessions/${eventId}`);
        if (!response.ok) throw new Error('Failed to fetch sessions');
        return await response.json();
    }

    /**
     * Save strategy to server
     * @param {Object} strategyData - Strategy data to save
     * @returns {Promise<Object>} Response with strategy ID
     */
    async saveStrategy(strategyData) {
        const response = await fetch('/api/strategies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(strategyData)
        });
        if (!response.ok) throw new Error('Failed to save strategy');
        return await response.json();
    }

    /**
     * Load strategy from server
     * @param {string} strategyId - Strategy ID to load
     * @returns {Promise<Object>} Strategy data
     */
    async loadStrategy(strategyId) {
        const response = await fetch(`/api/strategies/${strategyId}`);
        if (!response.ok) throw new Error('Failed to load shared strategy');
        return await response.json();
    }

    /**
     * Update existing strategy
     * @param {string} strategyId - Strategy ID to update
     * @param {Object} strategyData - Updated strategy data
     * @returns {Promise<Object>} Response
     */
    async updateStrategy(strategyId, strategyData) {
        const response = await fetch(`/api/strategies/${strategyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(strategyData)
        });
        if (!response.ok) throw new Error('Failed to update strategy');
        return await response.json();
    }

    /**
     * Add new driver
     * @param {Object} driverData - Driver information
     * @returns {Promise<Object>} Response
     */
    async addDriver(driverData) {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drivers: [driverData] })
        });
        if (!response.ok) throw new Error('Failed to add driver');
        return await response.json();
    }

    /**
     * Add new car
     * @param {Object} carData - Car information
     * @returns {Promise<Object>} Response
     */
    async addCar(carData) {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cars: [carData] })
        });
        if (!response.ok) throw new Error('Failed to add car');
        return await response.json();
    }

    /**
     * Add new track
     * @param {Object} trackData - Track information
     * @returns {Promise<Object>} Response
     */
    async addTrack(trackData) {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracks: [trackData] })
        });
        if (!response.ok) throw new Error('Failed to add track');
        return await response.json();
    }

    /**
     * Delete driver
     * @param {string} driverName - Driver name to delete
     * @returns {Promise<Object>} Response
     */
    async deleteDriver(driverName) {
        const response = await fetch(`/api/drivers/${encodeURIComponent(driverName)}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete driver');
        return await response.json();
    }

    /**
     * Delete car
     * @param {number} garage61Id - Car Garage61 ID to delete
     * @returns {Promise<Object>} Response
     */
    async deleteCar(garage61Id) {
        const response = await fetch(`/api/cars/${garage61Id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete car');
        return await response.json();
    }

    /**
     * Delete track
     * @param {number} garage61Id - Track Garage61 ID to delete
     * @returns {Promise<Object>} Response
     */
    async deleteTrack(garage61Id) {
        const response = await fetch(`/api/tracks/${garage61Id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete track');
        return await response.json();
    }
}