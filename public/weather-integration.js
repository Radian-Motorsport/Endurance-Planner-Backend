/**
 * Weather Forecast Integration Component
 * 
 * This component adds weather forecast functionality to existing event displays.
 * It checks if an event has weather data and adds appropriate UI elements.
 */

class WeatherIntegration {
    constructor() {
        this.eventsWithWeather = new Set();
        this.loadEventsWithWeather();
    }

    /**
     * Load list of events that have weather data available
     */
    async loadEventsWithWeather() {
        try {
            const response = await fetch('/api/events/with-weather');
            const data = await response.json();
            
            if (data.events && Array.isArray(data.events)) {
                data.events.forEach(event => {
                    this.eventsWithWeather.add(event.event_id);
                });
            }

            // Update any existing event displays
            this.updateEventDisplays();
            
        } catch (error) {
            console.error('Failed to load events with weather:', error);
        }
    }

    /**
     * Check if an event has weather data
     */
    hasWeatherData(eventId) {
        return this.eventsWithWeather.has(eventId);
    }

    /**
     * Create weather forecast button for an event
     */
    createWeatherButton(eventId, options = {}) {
        const {
            buttonText = '🌤️ Weather',
            className = 'weather-btn',
            style = 'small'
        } = options;

        const button = document.createElement('button');
        button.className = `${className} weather-forecast-btn weather-btn-${style}`;
        button.innerHTML = buttonText;
        button.title = 'View Weather Forecast';
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openWeatherForecast(eventId);
        });

        return button;
    }

    /**
     * Create weather forecast link for an event
     */
    createWeatherLink(eventId, options = {}) {
        const {
            linkText = '🌤️ View Weather',
            className = 'weather-link',
            target = '_blank'
        } = options;

        const link = document.createElement('a');
        link.href = `/weather-forecast.html?event_id=${eventId}`;
        link.target = target;
        link.className = className;
        link.innerHTML = linkText;
        link.title = 'View Weather Forecast';

        return link;
    }

    /**
     * Open weather forecast in new window/tab
     */
    openWeatherForecast(eventId, windowOptions = {}) {
        const {
            width = 1200,
            height = 800,
            popup = false
        } = windowOptions;

        const url = `/weather-forecast.html?event_id=${eventId}`;

        if (popup) {
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
            
            window.open(url, 'weather-forecast', features);
        } else {
            window.open(url, '_blank');
        }
    }

    /**
     * Add weather integration to event card/row
     */
    integrateWithEvent(eventElement, eventId, options = {}) {
        if (!this.hasWeatherData(eventId)) {
            return false;
        }

        const {
            position = 'append', // 'append', 'prepend', 'after-title', 'custom'
            container = null,
            buttonStyle = 'small',
            type = 'button' // 'button' or 'link'
        } = options;

        let weatherElement;
        if (type === 'link') {
            weatherElement = this.createWeatherLink(eventId, options);
        } else {
            weatherElement = this.createWeatherButton(eventId, { ...options, style: buttonStyle });
        }

        // Add element to event display
        if (container) {
            container.appendChild(weatherElement);
        } else {
            switch (position) {
                case 'prepend':
                    eventElement.insertBefore(weatherElement, eventElement.firstChild);
                    break;
                case 'after-title':
                    const title = eventElement.querySelector('h3, h4, .event-title, .event-name');
                    if (title) {
                        title.insertAdjacentElement('afterend', weatherElement);
                    } else {
                        eventElement.appendChild(weatherElement);
                    }
                    break;
                case 'append':
                default:
                    eventElement.appendChild(weatherElement);
                    break;
            }
        }

        return true;
    }

    /**
     * Auto-detect and update existing event displays
     */
    updateEventDisplays() {
        // Look for common event display patterns
        const selectors = [
            '[data-event-id]',
            '.event-item[data-id]',
            '.event-row[data-event]',
            '.event-card[data-event-id]'
        ];

        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                const eventId = element.dataset.eventId || 
                              element.dataset.id || 
                              element.dataset.event;
                              
                if (eventId && this.hasWeatherData(parseInt(eventId))) {
                    // Skip if already has weather button
                    if (element.querySelector('.weather-forecast-btn')) {
                        return;
                    }
                    
                    this.integrateWithEvent(element, parseInt(eventId), {
                        position: 'append',
                        buttonStyle: 'small'
                    });
                }
            });
        });
    }

    /**
     * Add weather column to existing tables
     */
    addWeatherColumnToTable(tableElement, eventIdColumn = 0, options = {}) {
        const {
            headerText = 'Weather',
            headerClass = 'weather-header',
            cellClass = 'weather-cell'
        } = options;

        // Add header
        const headerRow = tableElement.querySelector('thead tr, tr:first-child');
        if (headerRow) {
            const headerCell = document.createElement('th');
            headerCell.className = headerClass;
            headerCell.textContent = headerText;
            headerRow.appendChild(headerCell);
        }

        // Add cells
        const dataRows = tableElement.querySelectorAll('tbody tr, tr:not(:first-child)');
        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const eventIdCell = cells[eventIdColumn];
            
            if (eventIdCell) {
                const eventId = parseInt(eventIdCell.textContent) || 
                              parseInt(eventIdCell.dataset.eventId);
                
                const weatherCell = document.createElement('td');
                weatherCell.className = cellClass;
                
                if (eventId && this.hasWeatherData(eventId)) {
                    const button = this.createWeatherButton(eventId, {
                        buttonText: '🌤️',
                        style: 'mini'
                    });
                    weatherCell.appendChild(button);
                } else {
                    weatherCell.textContent = '-';
                }
                
                row.appendChild(weatherCell);
            }
        });
    }

    /**
     * Initialize weather integration on page load
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.updateEventDisplays());
        } else {
            this.updateEventDisplays();
        }

        // Watch for dynamically added events
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // Check if the added node is an event element
                            if (node.dataset && (node.dataset.eventId || node.dataset.id)) {
                                const eventId = parseInt(node.dataset.eventId || node.dataset.id);
                                if (eventId && this.hasWeatherData(eventId)) {
                                    this.integrateWithEvent(node, eventId);
                                }
                            }
                            
                            // Check for event elements within the added node
                            const eventElements = node.querySelectorAll && node.querySelectorAll('[data-event-id], [data-id]');
                            if (eventElements) {
                                eventElements.forEach(element => {
                                    const eventId = parseInt(element.dataset.eventId || element.dataset.id);
                                    if (eventId && this.hasWeatherData(eventId)) {
                                        this.integrateWithEvent(element, eventId);
                                    }
                                });
                            }
                        }
                    });
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
}

// CSS styles for weather buttons
const weatherStyles = `
    .weather-forecast-btn {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 12px;
        margin: 2px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        white-space: nowrap;
    }

    .weather-forecast-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        background: linear-gradient(135deg, #3d8bfe 0%, #00d2fe 100%);
    }

    .weather-forecast-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .weather-btn-small {
        font-size: 11px;
        padding: 4px 8px;
    }

    .weather-btn-mini {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
    }

    .weather-link {
        color: #4facfe;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .weather-link:hover {
        background: rgba(79, 172, 254, 0.1);
        color: #3d8bfe;
    }

    .weather-header {
        text-align: center;
        font-weight: 500;
        color: #4facfe;
    }

    .weather-cell {
        text-align: center;
        vertical-align: middle;
    }
`;

// Add styles to page
const styleSheet = document.createElement('style');
styleSheet.textContent = weatherStyles;
document.head.appendChild(styleSheet);

// Global weather integration instance
window.WeatherIntegration = WeatherIntegration;

// Auto-initialize if not manually controlled
if (typeof window.WEATHER_MANUAL_INIT === 'undefined') {
    window.weatherIntegration = new WeatherIntegration();
    window.weatherIntegration.init();
}

/*
Usage Examples:

1. Manual integration:
   const weather = new WeatherIntegration();
   weather.integrateWithEvent(eventElement, eventId);

2. Add to table:
   weather.addWeatherColumnToTable(tableElement, 0);

3. Create standalone button:
   const button = weather.createWeatherButton(eventId, {
       buttonText: 'View Weather',
       style: 'small'
   });

4. Check if event has weather:
   if (weather.hasWeatherData(eventId)) {
       // Show weather UI
   }

5. Open weather forecast:
   weather.openWeatherForecast(eventId, { popup: true });
*/