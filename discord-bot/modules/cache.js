// Cache for Garage61 data
let carsCache = [];
let tracksCache = [];
let driversCache = [];
let carGroupsCache = [];
let lastUpdate = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function updateCache(g61Client) {
    const now = Date.now();
    if (lastUpdate && (now - lastUpdate) < CACHE_DURATION) {
        return; // Cache still valid
    }

    try {
        console.log('🔄 Updating Garage61 cache...');
        [carsCache, tracksCache, driversCache, carGroupsCache] = await Promise.all([
            g61Client.getCars(),
            g61Client.getTracks(),
            g61Client.getTeamMembers('radian-motorsport'),
            g61Client.getCarGroups()
        ]);
        lastUpdate = now;
        console.log(`✅ Cache updated: ${carsCache.length} cars, ${tracksCache.length} tracks, ${driversCache.length} drivers, ${carGroupsCache.length} car groups`);
    } catch (error) {
        console.error('❌ Failed to update cache:', error.message);
    }
}

function getCars() {
    return carsCache;
}

function getTracks() {
    return tracksCache;
}

function getDrivers() {
    return driversCache;
}

function getCarGroups() {
    return carGroupsCache;
}

module.exports = {
    updateCache,
    getCars,
    getTracks,
    getDrivers,
    getCarGroups
};
