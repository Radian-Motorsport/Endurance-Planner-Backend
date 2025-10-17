// Weather API proxy and event integration endpoints
const express = require('express');
const https = require('https');
const { Pool } = require('pg');

// API endpoints for weather forecast integration

/**
 * Get weather URL for a specific event
 * GET /api/events/:eventId/weather
 */
async function getEventWeather(req, res) {
    const { eventId } = req.params;
    
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        const result = await pool.query(
            'SELECT event_id, event_name, weather_url, start_time FROM events WHERE event_id = $1',
            [eventId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = result.rows[0];
        
        if (!event.weather_url) {
            return res.status(404).json({ error: 'No weather data available for this event' });
        }

        res.json({
            event_id: event.event_id,
            event_name: event.event_name,
            weather_url: event.weather_url,
            start_time: event.start_time
        });

    } catch (error) {
        console.error('Error fetching event weather:', error);
        res.status(500).json({ error: 'Failed to fetch event weather data' });
    }
}

/**
 * Proxy weather data from iRacing API
 * GET /api/weather-proxy?url=<encoded_weather_url>
 */
async function proxyWeatherData(req, res) {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'Weather URL is required' });
    }

    try {
        // Decode the URL
        const weatherUrl = decodeURIComponent(url);
        
        // Validate it's an iRacing weather URL
        if (!weatherUrl.includes('iracing.com') && !weatherUrl.includes('weather')) {
            return res.status(400).json({ error: 'Invalid weather URL' });
        }

        // Make request to iRacing API
        const weatherData = await fetchWeatherData(weatherUrl);
        
        // Process and return the data
        res.json(weatherData);

    } catch (error) {
        console.error('Error proxying weather data:', error);
        res.status(500).json({ error: 'Failed to fetch weather data from iRacing' });
    }
}

/**
 * Get all events with weather data available
 * GET /api/events/with-weather
 */
async function getEventsWithWeather(req, res) {
    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        const result = await pool.query(`
            SELECT 
                event_id,
                event_name,
                series_name,
                track_name,
                start_time,
                weather_url,
                CASE 
                    WHEN weather_url IS NOT NULL THEN true 
                    ELSE false 
                END as has_weather
            FROM events 
            WHERE weather_url IS NOT NULL 
            ORDER BY start_time ASC
            LIMIT 100
        `);

        res.json({
            events: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Error fetching events with weather:', error);
        res.status(500).json({ error: 'Failed to fetch events with weather data' });
    }
}

/**
 * Fetch weather data from iRacing API with authentication
 */
async function fetchWeatherData(weatherUrl) {
    return new Promise((resolve, reject) => {
        // Parse the URL to get hostname and path
        const url = new URL(weatherUrl);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'RadianPlanner/1.0',
                'Accept': 'application/json',
                // Add authentication headers if needed
                // 'Authorization': 'Bearer ' + token
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('Invalid JSON response from weather API'));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Weather API request timeout'));
        });

        req.end();
    });
}

/**
 * Update weather URL for an event
 * PUT /api/events/:eventId/weather
 */
async function updateEventWeather(req, res) {
    const { eventId } = req.params;
    const { weather_url } = req.body;
    
    if (!weather_url) {
        return res.status(400).json({ error: 'Weather URL is required' });
    }

    try {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        const result = await pool.query(
            'UPDATE events SET weather_url = $1 WHERE event_id = $2 RETURNING event_id, event_name, weather_url',
            [weather_url, eventId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({
            message: 'Weather URL updated successfully',
            event: result.rows[0]
        });

    } catch (error) {
        console.error('Error updating event weather:', error);
        res.status(500).json({ error: 'Failed to update event weather URL' });
    }
}

module.exports = {
    getEventWeather,
    proxyWeatherData,
    getEventsWithWeather,
    updateEventWeather,
    fetchWeatherData
};

/* 
Usage Examples:

1. Add to your Express server routes:
   app.get('/api/events/:eventId/weather', getEventWeather);
   app.get('/api/weather-proxy', proxyWeatherData);
   app.get('/api/events/with-weather', getEventsWithWeather);
   app.put('/api/events/:eventId/weather', updateEventWeather);

2. Open weather forecast for specific event:
   http://localhost:3000/weather-forecast.html?event_id=12345

3. Open weather forecast with direct URL:
   http://localhost:3000/weather-forecast.html?weather_url=https://...

4. Integration in event list:
   <a href="/weather-forecast.html?event_id=${event.event_id}" target="_blank">
       View Weather Forecast
   </a>
*/