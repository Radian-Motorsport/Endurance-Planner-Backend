/**
 * Garage61 Client - Direct API Integration
 * Calls Garage61 API directly without database dependency
 */

class Garage61Client {
    constructor(token) {
        this.baseURL = 'https://garage61.net/api/v1';
        this.token = token;
        this.teamName = 'radian-motorsport';
    }

    async makeRequest(endpoint) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'RadianDiscordBot/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Garage61 API Error: ${error.message}`);
            throw error;
        }
    }

    async getCars() {
        console.log('🚗 Fetching cars from Garage61...');
        const data = await this.makeRequest('/cars');
        // API returns {items: [...]} not array directly
        return data.items || data || [];
    }

    async getTracks() {
        console.log('🏁 Fetching tracks from Garage61...');
        const data = await this.makeRequest('/tracks');
        // API returns {items: [...]} not array directly
        return data.items || data || [];
    }

    async getDrivers() {
        console.log('👤 Fetching drivers from Garage61...');
        const data = await this.makeRequest('/drivers');
        return Array.isArray(data) ? data : [];
    }

    async getTeamMembers(teamId) {
        console.log(`👥 Fetching team members for ${teamId}...`);
        const data = await this.makeRequest(`/teams/${teamId}`);
        return data.members || [];
    }

    async getLapTimes(carId, trackId, options = {}) {
        const params = new URLSearchParams();
        params.append('cars', carId);
        params.append('tracks', trackId);
        params.append('teams', this.teamName);
        
        // Add wetness filter if specified
        if (options.minConditionsTrackWetness !== undefined) {
            params.append('minConditionsTrackWetness', options.minConditionsTrackWetness);
        }
        if (options.maxConditionsTrackWetness !== undefined) {
            params.append('maxConditionsTrackWetness', options.maxConditionsTrackWetness);
        }
        
        console.log(`🏎️  API URL: ${this.baseURL}/laps?${params.toString()}`);
        
        const response = await this.makeRequest(`/laps?${params.toString()}`);
        console.log(`📦 API returned ${response.items?.length || 0} laps`);
        return response.items || [];
    }

    async searchLaps(options = {}) {
        const { cars, tracks, drivers, teams, seasons, group, minConditionsTrackWetness, maxConditionsTrackWetness } = options;
        console.log('🔍 Searching laps with filters:', options);
        
        const params = new URLSearchParams();
        
        if (cars) params.append('cars', Array.isArray(cars) ? cars.join(',') : cars);
        if (tracks) params.append('tracks', Array.isArray(tracks) ? tracks.join(',') : tracks);
        if (drivers) params.append('drivers', Array.isArray(drivers) ? drivers.join(',') : drivers);
        if (teams) params.append('teams', Array.isArray(teams) ? teams.join(',') : teams);
        if (seasons) params.append('seasons', Array.isArray(seasons) ? seasons.join(',') : seasons);
        if (group) params.append('group', group);
        if (minConditionsTrackWetness !== undefined) params.append('minConditionsTrackWetness', minConditionsTrackWetness);
        if (maxConditionsTrackWetness !== undefined) params.append('maxConditionsTrackWetness', maxConditionsTrackWetness);
        
        // Default to team if no filters
        if (!params.toString()) {
            params.append('teams', this.teamName);
        }
        
        const response = await this.makeRequest(`/laps?${params.toString()}`);
        return response.items || [];
    }

    formatLapTime(seconds) {
        if (!seconds || seconds <= 0) return 'N/A';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}

module.exports = Garage61Client;
