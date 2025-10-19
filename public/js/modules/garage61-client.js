/**
 * Garage61 Integration Module
 * Handles Garage61 API communication and lap time data processing
 * Extracted from monolithic index.html to improve maintainability
 */

export class Garage61Client {
    constructor() {
        this.baseURL = 'https://garage61.net/api/v1';
        this.teamName = 'radian-motorsport';
        this.proxyURL = '/api/garage61/laps';
    }

    /**
     * Fetch lap times data for specific car and track
     * @param {number} carId - Garage61 car ID
     * @param {number} trackId - Garage61 track ID
     * @returns {Promise<Object>} Lap times data
     */
    async fetchLapTimes(carId, trackId) {
        console.log(`🔥 fetchGarage61Data called with carId: ${carId}, trackId: ${trackId}`);
        
        try {
            console.log(`Fetching Garage61 data for car ${carId} at track ${trackId}`);
            
            const response = await this.callAPI(carId, trackId);
            
            console.log('🔥 RAW API Response:', JSON.stringify(response, null, 2));
            console.log('🔥 API Response data array:', response.data);
            console.log('🔥 First lap item:', response.data?.[0]);
            
            if (!response.success) {
                throw new Error(response.error || 'API call failed');
            }

            return {
                success: true,
                data: response.data,
                total: response.total
            };

        } catch (error) {
            console.error('🚨 Garage61 API Error:', error);
            throw error;
        }
    }

    /**
     * Call Garage61 API through server proxy
     * @param {number} carId - Car ID
     * @param {number} trackId - Track ID
     * @returns {Promise<Object>} API response
     */
    async callAPI(carId, trackId) {
        const params = new URLSearchParams();
        params.append('cars', carId);
        params.append('tracks', trackId);
        params.append('teams', this.teamName);
        
        const proxyUrl = `${this.proxyURL}?${params.toString()}`;
        
        console.log('🌐 Using server proxy URL:', proxyUrl);
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('📡 Proxy response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Proxy Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('📦 Server proxy data received:', {
            total: data.total,
            itemsCount: data.items ? data.items.length : 0,
            firstItem: data.items && data.items.length > 0 ? data.items[0] : null
        });
        
        return {
            success: true,
            data: data.items || [],
            total: data.total || 0
        };
    }

    /**
     * Filter laps by selected drivers
     * @param {Array} laps - All laps data
     * @param {Array} selectedDrivers - Selected drivers array
     * @returns {Array} Filtered laps
     */
    filterLapsByDrivers(laps, selectedDrivers) {
        console.log('🔍 DEBUG: filterLapsByDrivers called with:', laps.length, 'laps');
        console.log('🔍 DEBUG: selectedDrivers:', selectedDrivers);
        
        if (!selectedDrivers || selectedDrivers.length === 0) {
            console.log('🔍 DEBUG: No selected drivers, returning all laps');
            return laps;
        }

        // Get garage61_slug values for selected drivers
        const selectedDriverSlugs = selectedDrivers.map(driver => driver.garage61_slug).filter(slug => slug !== null);
        const selectedDriverNames = selectedDrivers.map(driver => driver.name);

        console.log('🔍 DEBUG: Filtering for driver slugs:', selectedDriverSlugs);
        console.log('🔍 DEBUG: Filtering for driver names:', selectedDriverNames);
        
        // Show first few laps to see structure
        console.log('🔍 DEBUG: Sample lap structure:', laps.slice(0, 2));

        const filtered = laps.filter(lap => {
            const driverSlug = lap.driver ? lap.driver.slug : null;
            const driverName = lap.driver ? lap.driver.name : null;
            
            console.log(`🔍 DEBUG: Checking lap - driver: ${driverName}, slug: ${driverSlug}`);
            
            const slugMatch = selectedDriverSlugs.some(slug => 
                (driverSlug && driverSlug.toLowerCase() === slug.toLowerCase())
            );
            const nameMatch = selectedDriverNames.some(name => 
                (driverName && name.toLowerCase().includes(driverName.toLowerCase())) ||
                (driverName && driverName.toLowerCase().includes(name.toLowerCase()))
            );
            
            const matches = slugMatch || nameMatch;
            console.log(`🔍 DEBUG: Lap matches: ${matches} (slug: ${slugMatch}, name: ${nameMatch})`);
            return matches;
        });
        
        console.log('🔍 DEBUG: Filtered result:', filtered.length, 'laps');
        return filtered;
    }

    /**
     * Get best lap time for each driver
     * @param {Array} laps - Filtered laps data
     * @returns {Array} Best laps per driver
     */
    getDriverBestLaps(laps) {
        console.log('🔍 DEBUG: getDriverBestLaps called with:', laps.length, 'laps');
        
        const driverLaps = {};
        
        laps.forEach(lap => {
            const driverName = lap.driver ? lap.driver.name : 'Unknown';
            console.log(`🔍 DEBUG: Processing lap for driver: "${driverName}", lapTime: ${lap.lapTime}`);
            
            if (!driverLaps[driverName] || lap.lapTime < driverLaps[driverName].lapTime) {
                driverLaps[driverName] = lap;
                console.log(`🔍 DEBUG: New best lap for ${driverName}: ${lap.lapTime}`);
            }
        });
        
        const result = Object.values(driverLaps).sort((a, b) => a.lapTime - b.lapTime);
        console.log('🔍 DEBUG: Final best laps:', result);
        
        return result;
    }

    /**
     * Format lap time for display
     * @param {number} lapTimeMs - Lap time in milliseconds
     * @returns {string} Formatted lap time
     */
    formatLapTime(lapTimeMs) {
        // Handle both milliseconds and already formatted strings
        if (typeof lapTimeMs === 'string') {
            return lapTimeMs; // Already formatted
        }
        
        if (!lapTimeMs || lapTimeMs <= 0) {
            return "Invalid";
        }
        
        // Convert milliseconds to M:SS.sss format like backup version
        const totalMs = lapTimeMs;
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const milliseconds = totalMs % 1000;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }

    /**
     * Display lap times in table
     * @param {Array} bestLaps - Best laps data
     * @param {HTMLElement} tbody - Table body element
     */
    displayLapTimes(bestLaps, tbody) {
        tbody.innerHTML = '';
        
        if (bestLaps.length === 0) {
            tbody.innerHTML = `
                <tr class="bg-neutral-750">
                    <td colspan="4" class="py-6 px-6 text-center text-neutral-400 italic">
                        No lap data found for selected drivers at this car/track combination
                    </td>
                </tr>
            `;
            return;
        }

        bestLaps.forEach((lap, index) => {
            const row = document.createElement('tr');
            row.className = 'bg-neutral-750 hover:bg-neutral-700 transition-colors';
            
            const positionClass = index === 0 ? 'text-yellow-400 font-bold' : 
                                 index === 1 ? 'text-gray-400 font-semibold' : 
                                 index === 2 ? 'text-amber-600 font-semibold' : 
                                 'text-neutral-300';
            
            // Use backup version's driver name format 
            const driverName = lap.driver ? 
                `${lap.driver.firstName || ''} ${lap.driver.lastName || ''}`.trim() : 
                'Unknown';
            
            // Format fuel used properly
            const fuelUsed = lap.fuelUsed ? parseFloat(lap.fuelUsed).toFixed(2) + 'L' : 'N/A';
            
            // Format conditions like backup version
            const cloudMap = {1: 'Clear', 2: 'Partly Cloudy', 3: 'Mostly Cloudy', 4: 'Overcast'};
            const weather = cloudMap[lap.clouds] || 'Unknown';
            const airTemp = lap.airTemp ? `${lap.airTemp.toFixed(1)}°C` : '?°C';
            
            row.innerHTML = `
                <td class="py-3 px-6 ${positionClass}">${index + 1}</td>
                <td class="py-3 px-6 text-neutral-200 font-medium">${driverName}</td>
                <td class="py-3 px-6 text-blue-400 font-mono">${this.formatLapTime(lap.lapTime)}</td>
                <td class="py-3 px-6 text-neutral-400 text-sm">${weather} / ${airTemp}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    /**
     * Show/hide Garage61 section with loading states
     * @param {string} state - 'loading', 'content', 'error', 'hidden'
     * @param {string} errorMessage - Error message if state is 'error'
     */
    updateUI(state, errorMessage = '') {
        const lapTimesSection = document.getElementById('garage61-lap-times');
        const loadingDiv = document.getElementById('lap-times-loading');
        const errorDiv = document.getElementById('lap-times-error');
        const contentDiv = document.getElementById('lap-times-content');
        
        if (!lapTimesSection) return;

        // Reset all states
        lapTimesSection.classList.remove('hidden');
        loadingDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        contentDiv?.classList.add('hidden');

        switch (state) {
            case 'loading':
                loadingDiv?.classList.remove('hidden');
                break;
            case 'content':
                contentDiv?.classList.remove('hidden');
                break;
            case 'error':
                const errorMessageEl = document.getElementById('lap-times-error-message');
                if (errorMessageEl) errorMessageEl.textContent = errorMessage;
                errorDiv?.classList.remove('hidden');
                break;
            case 'hidden':
                lapTimesSection.classList.add('hidden');
                break;
        }
    }
}