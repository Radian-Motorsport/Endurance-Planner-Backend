/**
 * Garage61 API Integration Module
 * 
 * Self-contained module that handles both API calls and server proxy logic.
 * No separate server needed - includes authentication and CORS handling.
 * 
 * Usage:
 * import { searchLapData, formatLapTime, getWindDirection } from './garage61-api.js';
 */

// Configuration
const GARAGE61_TOKEN = 'MWVKZTRMOGETNDCZOS0ZMJUZLTK2ODITNJBJZMQ5NMU4M2I5';
const GARAGE61_API_URL = 'https://garage61.net/api/v1/laps';
const TEAM_NAME = 'radian-motorsport';

/**
 * Make direct API call to Garage61 with proper authentication
 * @param {string} carId - Car ID
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} - API response
 */
async function fetchFromGarage61API(carId, trackId) {
    const params = new URLSearchParams();
    params.append('cars', carId);
    params.append('tracks', trackId);
    params.append('teams', TEAM_NAME);
    
    const url = `${GARAGE61_API_URL}?${params.toString()}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${GARAGE61_TOKEN}`,
            'User-Agent': 'RadianPlanner/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Garage61 API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
        success: true,
        data: data.items || [],
        total: data.total || 0
    };
}

/**
 * Main function to search for lap data
 * @param {Object} params - Search parameters
 * @param {string|string[]} params.cars - Car ID(s) to search for
 * @param {string|string[]} params.tracks - Track ID(s) to search for
 * @param {string|string[]} params.drivers - Driver name(s) to filter by (optional)
 * @returns {Promise<Object>} - { success: boolean, data: Array, error: string }
 */
export async function searchLapData(params) {
    try {
        const { cars, tracks, drivers } = params;

        // Validate required parameters
        if (!cars || !tracks) {
            return {
                success: false,
                data: [],
                error: 'Both cars and tracks parameters are required'
            };
        }

        // Convert single values to arrays
        const carIds = Array.isArray(cars) ? cars : [cars];
        const trackIds = Array.isArray(tracks) ? tracks : [tracks];
        const driverNames = drivers ? (Array.isArray(drivers) ? drivers : [drivers]) : [];

        // Make API calls for each car/track combination
        const allResults = [];
        
        for (const carId of carIds) {
            for (const trackId of trackIds) {
                try {
                    const result = await fetchFromGarage61API(carId, trackId);
                    if (result.success) {
                        allResults.push(...result.data);
                    }
                } catch (error) {
                    console.warn(`Failed to fetch data for car ${carId} at track ${trackId}:`, error);
                }
            }
        }

        // Filter by drivers if specified
        let filteredResults = allResults;
        if (driverNames.length > 0) {
            filteredResults = allResults.filter(lap => {
                const driverName = lap.driver ? (lap.driver.name || lap.driver.slug || '') : '';
                return driverNames.some(filterName => 
                    driverName.toLowerCase().includes(filterName.toLowerCase())
                );
            });
        }

        return {
            success: true,
            data: filteredResults,
            error: null
        };

    } catch (error) {
        return {
            success: false,
            data: [],
            error: error.message
        };
    }
}

/**
 * Fetch lap data for a specific car/track combination
 * @param {string} carId - Car ID
 * @param {string} trackId - Track ID
 * @returns {Promise<Object>} - API response
 */
async function fetchLapData(carId, trackId) {
    return await fetchFromGarage61API(carId, trackId);
}

/**
 * Server setup function for integrating into existing Express servers
 * Call this to add Garage61 proxy endpoint to your server
 * @param {Object} app - Express app instance
 */
export function setupGarage61Server(app) {
    // Add CORS headers for Garage61 API calls
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/garage61')) {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
        }
        next();
    });

    // Garage61 API proxy endpoint (for legacy compatibility)
    app.get('/api/garage61/laps', async (req, res) => {
        try {
            const { cars, tracks, teams } = req.query;

            if (!cars || !tracks) {
                return res.status(400).json({
                    success: false,
                    error: 'Both cars and tracks parameters are required'
                });
            }

            const params = new URLSearchParams();
            params.append('cars', cars);
            params.append('tracks', tracks);
            params.append('teams', teams || TEAM_NAME);

            const url = `${GARAGE61_API_URL}?${params.toString()}`;
            
            console.log('Proxying Garage61 request to:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${GARAGE61_TOKEN}`,
                    'User-Agent': 'RadianPlanner/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Garage61 API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            console.log('Garage61 response status:', response.status);
            console.log('Garage61 response data:', {
                total: data.total,
                itemCount: data.items ? data.items.length : 0
            });

            res.json(data);

        } catch (error) {
            console.error('Garage61 proxy error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    console.log('🏁 Garage61 API proxy endpoints added to server');
}

/**
 * Format lap time from seconds to MM:SS.sss format
 * @param {number} seconds - Lap time in seconds
 * @returns {string} - Formatted lap time
 */
export function formatLapTime(seconds) {
    if (!seconds || seconds <= 0) return 'N/A';
    
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    
    return `${minutes}:${secs.padStart(6, '0')}`;
}

/**
 * Convert wind direction from radians to compass direction
 * @param {number} radians - Wind direction in radians
 * @returns {string} - Compass direction (N, NE, E, SE, S, SW, W, NW)
 */
export function getWindDirection(radians) {
    if (radians === undefined || radians === null) return 'N/A';
    
    // Convert radians to degrees
    let degrees = radians * (180 / Math.PI);
    
    // Normalize to 0-360 degrees
    degrees = ((degrees % 360) + 360) % 360;
    
    // Convert to compass direction
    if (degrees >= 337.5 || degrees < 22.5) return 'N';
    else if (degrees >= 22.5 && degrees < 67.5) return 'NE';
    else if (degrees >= 67.5 && degrees < 112.5) return 'E';
    else if (degrees >= 112.5 && degrees < 157.5) return 'SE';
    else if (degrees >= 157.5 && degrees < 202.5) return 'S';
    else if (degrees >= 202.5 && degrees < 247.5) return 'SW';
    else if (degrees >= 247.5 && degrees < 292.5) return 'W';
    else if (degrees >= 292.5 && degrees < 337.5) return 'NW';
    else return 'N';
}

/**
 * Get cloud description from numeric value
 * @param {number} cloudValue - Cloud level (1-4)
 * @returns {string} - Cloud description
 */
export function getCloudDescription(cloudValue) {
    const cloudTypes = {
        1: 'Clear skies',
        2: 'Partly cloudy', 
        3: 'Mostly cloudy',
        4: 'Overcast'
    };
    return cloudTypes[cloudValue] || `Cloud level ${cloudValue}`;
}

/**
 * Convert wind velocity from m/s to mph
 * @param {number} ms - Wind velocity in m/s
 * @returns {number} - Wind velocity in mph
 */
export function convertWindToMph(ms) {
    if (ms === undefined || ms === null) return null;
    return ms * 2.237;
}

/**
 * Convert relative humidity from 0-1 scale to percentage
 * @param {number} humidity - Relative humidity (0-1 scale)
 * @returns {number} - Humidity percentage
 */
export function convertHumidityToPercent(humidity) {
    if (humidity === undefined || humidity === null) return null;
    return humidity * 100;
}

/**
 * Format sector times from sectors array
 * @param {Array} sectors - Array of sector objects
 * @returns {string} - Formatted sector times string
 */
export function formatSectorTimes(sectors) {
    if (!sectors || !Array.isArray(sectors) || sectors.length === 0) {
        return 'N/A';
    }
    
    return sectors.map((sector, i) => {
        if (sector && sector.sectorTime && typeof sector.sectorTime === 'number') {
            const incomplete = sector.incomplete ? ' (incomplete)' : '';
            return `S${i+1}: ${sector.sectorTime.toFixed(3)}${incomplete}`;
        } else {
            return `S${i+1}: N/A`;
        }
    }).join(', ');
}

/**
 * Get the best lap time from an array of laps
 * @param {Array} laps - Array of lap objects
 * @returns {Object|null} - Best lap object or null if no laps
 */
export function getBestLap(laps) {
    if (!laps || !Array.isArray(laps) || laps.length === 0) {
        return null;
    }
    
    return laps.reduce((best, current) => {
        if (!best || (current.lapTime && current.lapTime < best.lapTime)) {
            return current;
        }
        return best;
    }, null);
}

/**
 * Group laps by driver
 * @param {Array} laps - Array of lap objects
 * @returns {Object} - Object with driver names as keys and lap arrays as values
 */
export function groupLapsByDriver(laps) {
    if (!laps || !Array.isArray(laps)) {
        return {};
    }
    
    return laps.reduce((groups, lap) => {
        const driverName = lap.driver ? (lap.driver.name || lap.driver.slug || 'Unknown') : 'Unknown';
        
        if (!groups[driverName]) {
            groups[driverName] = [];
        }
        
        groups[driverName].push(lap);
        return groups;
    }, {});
}

/**
 * Sort laps by lap time (fastest first)
 * @param {Array} laps - Array of lap objects
 * @returns {Array} - Sorted array of laps
 */
export function sortLapsByTime(laps) {
    if (!laps || !Array.isArray(laps)) {
        return [];
    }
    
    return [...laps].sort((a, b) => {
        if (!a.lapTime) return 1;
        if (!b.lapTime) return -1;
        return a.lapTime - b.lapTime;
    });
}

/**
 * Calculate average lap time from an array of laps
 * @param {Array} laps - Array of lap objects
 * @returns {number|null} - Average lap time in seconds or null
 */
export function calculateAverageLapTime(laps) {
    if (!laps || !Array.isArray(laps) || laps.length === 0) {
        return null;
    }
    
    const validLaps = laps.filter(lap => lap.lapTime && lap.lapTime > 0);
    if (validLaps.length === 0) {
        return null;
    }
    
    const totalTime = validLaps.reduce((sum, lap) => sum + lap.lapTime, 0);
    return totalTime / validLaps.length;
}

// Export configuration for external use
export const CONFIG = {
    GARAGE61_API_URL,
    TEAM_NAME,
    GARAGE61_TOKEN: GARAGE61_TOKEN.substring(0, 8) + '...' // Only show partial token for security
};