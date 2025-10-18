/**
 * Weather Component Module
 * Standalone component for displaying interactive weather charts with ECharts
 * Can be imported and used in other projects
 */

export class WeatherComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            showTabs: true,
            maxHeight: '350px',
            autoLoadECharts: true,
            ...options
        };
        
        this.temperatureChart = null;
        this.cloudsChart = null;
        this.container = null;
        this.weatherData = null;
        
        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Container with id '${this.containerId}' not found`);
        }
        
        this.container = container;
        this.injectStyles();
    }
    
    injectStyles() {
        // Add weather component styles if not already present
        if (!document.getElementById('weather-component-styles')) {
            const style = document.createElement('style');
            style.id = 'weather-component-styles';
            style.textContent = `
                .chakra-tabs {
                    width: 100%;
                }
                
                .chakra-tabs__tablist {
                    display: flex;
                    border-bottom: 2px solid #404040;
                    margin-bottom: 24px;
                }
                
                .chakra-tabs__tab {
                    padding: 12px 24px;
                    background: none;
                    border: none;
                    font-size: 16px;
                    font-weight: 500;
                    color: #a3a3a3;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s;
                }
                
                .chakra-tabs__tab:hover {
                    color: #d4d4d8 !important;
                }
                
                .chakra-tabs__tab[aria-selected="true"] {
                    color: #22c55e !important;
                    border-bottom-color: #22c55e !important;
                }
                
                .chakra-tabs__tab-panel {
                    display: none;
                }
                
                .chakra-tabs__tab-panel[aria-hidden="false"] {
                    display: block;
                }
                
                .weather-chart-container {
                    width: 100%;
                    height: 400px;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    padding: 16px;
                    background: #262626;
                    position: relative;
                    min-height: 400px;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    async loadWeatherData(weatherUrl) {
        console.log('🌦️ WeatherComponent: Loading weather data from:', weatherUrl);
        
        try {
            // Use the weather proxy to avoid CORS issues
            const response = await fetch(`/api/weather-proxy?url=${encodeURIComponent(weatherUrl)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const weatherData = await response.json();
            console.log('🌦️ WeatherComponent: Weather data received:', weatherData);
            
            // Handle different weather data formats
            let processedWeatherData;
            if (Array.isArray(weatherData)) {
                processedWeatherData = { weather_forecast: weatherData };
            } else if (weatherData.weather_forecast) {
                processedWeatherData = weatherData;
            } else {
                throw new Error('Unexpected weather data format');
            }
            
            this.weatherData = processedWeatherData;
            this.render();
            
            return processedWeatherData;
            
        } catch (error) {
            console.error('❌ WeatherComponent: Failed to load weather data:', error);
            this.showError(error.message);
            throw error;
        }
    }
    
    render() {
        if (!this.weatherData) {
            this.showError('No weather data available');
            return;
        }
        
        // Show the container
        this.container.classList.remove('hidden');
        
        // Create the complete weather interface
        this.container.innerHTML = this.createHTML();
        
        // Load ECharts if needed
        if (this.options.autoLoadECharts) {
            this.loadECharts().then(() => {
                this.initializeTabs();
                this.renderCharts();
            });
        } else {
            this.initializeTabs();
            this.renderCharts();
        }
    }
    
    createHTML() {
        return `
            <div class="border-t border-neutral-700 pt-6">
                <h3 class="text-lg font-medium text-neutral-300 mb-4">Weather Forecast</h3>
                
                <div class="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
                    <div class="chakra-tabs">
                        <div class="chakra-tabs__tablist" role="tablist">
                            <button class="chakra-tabs__tab" role="tab" aria-selected="false" data-tab="temperature">
                                Temperature
                            </button>
                            <button class="chakra-tabs__tab" role="tab" aria-selected="true" data-tab="clouds">
                                Clouds & Precipitation
                            </button>
                        </div>

                        <!-- Temperature Tab Panel -->
                        <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="true" id="temperature-panel">
                            <div class="weather-chart-container">
                                <div id="${this.containerId}-temperature-chart" style="width: 100%; height: 360px;"></div>
                            </div>
                        </div>

                        <!-- Clouds & Precipitation Tab Panel -->
                        <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="false" id="clouds-panel">
                            <div class="weather-chart-container">
                                <div id="${this.containerId}-clouds-chart" style="width: 100%; height: 360px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    initializeTabs() {
        const tabs = this.container.querySelectorAll('.chakra-tabs__tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }
    
    switchTab(tabName) {
        // Update tab states
        this.container.querySelectorAll('.chakra-tabs__tab').forEach(tab => {
            const isSelected = tab.dataset.tab === tabName;
            tab.setAttribute('aria-selected', isSelected);
        });

        // Update panel visibility
        this.container.querySelectorAll('.chakra-tabs__tab-panel').forEach(panel => {
            const isVisible = panel.id === `${tabName}-panel`;
            panel.setAttribute('aria-hidden', !isVisible);
        });

        // Resize charts when switching tabs
        setTimeout(() => {
            if (tabName === 'temperature' && this.temperatureChart) {
                this.temperatureChart.resize();
            } else if (tabName === 'clouds' && this.cloudsChart) {
                this.cloudsChart.resize();
            }
        }, 100);
    }
    
    async loadECharts() {
        if (typeof echarts !== 'undefined') return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    renderCharts() {
        if (!this.weatherData || typeof echarts === 'undefined') return;
        
        this.renderTemperatureChart();
        this.renderCloudsChart();
    }
    
    renderTemperatureChart() {
        console.log('🌡️ WeatherComponent: Rendering temperature chart...');
        
        if (this.temperatureChart) {
            this.temperatureChart.dispose();
        }
        
        const container = document.getElementById(`${this.containerId}-temperature-chart`);
        if (!container) return;
        
        this.temperatureChart = echarts.init(container);
        
        const forecast = this.weatherData.weather_forecast;
        const timeLabels = this.generateTimeLabels(forecast);
        const temperatures = forecast.map(item => this.convertTemperature(item.raw_air_temp));
        const humidity = forecast.map(item => this.convertHumidity(item.rel_humidity));
        
        const raceStartIndex = forecast.findIndex((item, index) => 
            item.affects_session && (index === 0 || !forecast[index-1].affects_session)
        );

        const option = {
            grid: { left: '60px', right: '60px', top: '60px', bottom: '60px' },
            legend: {
                data: ['Temperature (°F)', 'Humidity (%)'],
                top: '10px',
                textStyle: { color: '#d4d4d8' }
            },
            xAxis: {
                type: 'category',
                data: timeLabels,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { color: '#6E7079', fontSize: 10, rotate: 45 }
            },
            yAxis: [
                {
                    type: 'value',
                    position: 'left',
                    axisLine: { lineStyle: { color: '#fbbf24' } },
                    axisLabel: { color: '#fbbf24', fontSize: 12, formatter: '{value}' },
                    splitLine: { lineStyle: { color: '#6E7079', opacity: 0.3 } }
                },
                {
                    type: 'value',
                    position: 'right',
                    min: 0,
                    max: 100,
                    axisLine: { lineStyle: { color: '#4ecdc4' } },
                    axisLabel: { color: '#4ecdc4', fontSize: 12, formatter: '{value}' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Temperature (°F)',
                    type: 'line',
                    yAxisIndex: 0,
                    data: temperatures,
                    lineStyle: { color: '#fbbf24', width: 2 },
                    itemStyle: { color: '#fbbf24' },
                    smooth: true,
                    symbol: 'none',
                    markLine: raceStartIndex >= 0 ? {
                        silent: true,
                        symbol: 'none',
                        data: [{
                            xAxis: raceStartIndex,
                            lineStyle: { color: '#22c55e', width: 2, type: 'solid' },
                            label: { show: false },
                            symbol: 'none'
                        }]
                    } : undefined
                },
                {
                    name: 'Humidity (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: humidity,
                    lineStyle: { color: '#4ecdc4', width: 2 },
                    itemStyle: { color: '#4ecdc4' },
                    smooth: true,
                    symbol: 'none'
                },
                ...this.createDayNightMarkings(forecast, timeLabels)
            ],
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const forecastItem = forecast[params[0].dataIndex];
                    const isRace = forecastItem.affects_session;
                    
                    const timestamp = new Date(forecastItem.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', 
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });
                    
                    const tempValue = params.find(p => p.seriesName === 'Temperature (°F)')?.value || 'N/A';
                    const humidityValue = params.find(p => p.seriesName === 'Humidity (%)')?.value || 'N/A';
                    
                    return `<div style="color: black;">
                        <strong>Time:</strong> ${timestamp}<br>
                        <strong>Temperature:</strong> ${tempValue}°F<br>
                        <strong>Humidity:</strong> ${humidityValue}%<br>
                        <strong>Session:</strong> ${isRace ? 'Race' : 'Practice/Quali'}
                    </div>`;
                }
            }
        };

        this.temperatureChart.setOption(option);
    }
    
    renderCloudsChart() {
        console.log('☁️ WeatherComponent: Rendering clouds chart...');
        
        if (this.cloudsChart) {
            this.cloudsChart.dispose();
        }
        
        const container = document.getElementById(`${this.containerId}-clouds-chart`);
        if (!container) return;
        
        this.cloudsChart = echarts.init(container);
        
        const forecast = this.weatherData.weather_forecast;
        const timeLabels = this.generateTimeLabels(forecast);
        const cloudCover = forecast.map(item => this.convertCloudCover(item.cloud_cover));
        const precipitationChance = forecast.map(item => item.precip_chance);
        const precipitationAmount = forecast.map(item => item.precip_amount);
        
        const raceStartIndex = forecast.findIndex((item, index) => 
            item.affects_session && (index === 0 || !forecast[index-1].affects_session)
        );

        const option = {
            grid: { left: '60px', right: '60px', top: '60px', bottom: '60px' },
            legend: {
                data: ['Cloud Cover (%)', 'Precipitation Chance (%)'],
                top: '10px',
                textStyle: { color: '#d4d4d8' }
            },
            xAxis: {
                type: 'category', 
                data: timeLabels,
                axisLine: { lineStyle: { color: '#6E7079' } },
                axisLabel: { color: '#6E7079', fontSize: 10, rotate: 45 }
            },
            yAxis: [
                {
                    type: 'value', 
                    position: 'left',
                    min: 0, 
                    max: 100,
                    axisLine: { lineStyle: { color: 'rgb(5,5,15)' } },
                    axisLabel: { color: 'rgb(5,5,15)', fontSize: 12, formatter: '{value}' },
                    splitLine: { lineStyle: { color: '#6E7079', opacity: 0.3 } }
                },
                {
                    type: 'value', 
                    position: 'right',
                    min: 0, 
                    max: 100,
                    axisLine: { lineStyle: { color: '#0B5559' } },
                    axisLabel: { color: '#0B5559', fontSize: 12, formatter: '{value}' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Cloud Cover (%)', 
                    type: 'line', 
                    yAxisIndex: 0,
                    data: cloudCover,
                    lineStyle: { color: 'rgb(5,5,15)', width: 2 },
                    itemStyle: { color: 'rgb(5,5,15)' },
                    smooth: true, 
                    symbol: 'none',
                    markLine: raceStartIndex >= 0 ? {
                        silent: true,
                        symbol: 'none',
                        data: [{
                            xAxis: raceStartIndex,
                            lineStyle: { color: '#22c55e', width: 2, type: 'solid' },
                            label: { show: false },
                            symbol: 'none'
                        }]
                    } : undefined
                },
                {
                    name: 'Precipitation Chance (%)', 
                    type: 'line', 
                    yAxisIndex: 1,
                    data: precipitationChance,
                    lineStyle: { color: '#0B5559', width: 2 },
                    itemStyle: { color: '#0B5559' },
                    smooth: true, 
                    symbol: 'none'
                },
                ...this.createDayNightMarkings(forecast, timeLabels)
            ],
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const dataIndex = params[0].dataIndex;
                    const forecastItem = forecast[dataIndex];
                    const isRace = forecastItem.affects_session;
                    
                    const timestamp = new Date(forecastItem.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', 
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });
                    
                    return `<div style="color: black;">
                        <strong>Time:</strong> ${timestamp}<br>
                        <strong>Cloud Cover:</strong> ${cloudCover[dataIndex]}%<br>
                        <strong>Precip Chance:</strong> ${precipitationChance[dataIndex]}%<br>
                        <strong>Precip Amount:</strong> ${precipitationAmount[dataIndex]}<br>
                        <strong>Session:</strong> ${isRace ? 'Race' : 'Practice/Quali'}
                    </div>`;
                }
            }
        };

        this.cloudsChart.setOption(option);
    }
    
    createDayNightMarkings(forecast, timeLabels) {
        const dayAreas = [];
        const nightAreas = [];
        let currentPeriod = null;
        let periodStart = 0;
        
        forecast.forEach((item, index) => {
            const isDay = item.is_sun_up;
            
            if (currentPeriod === null) {
                currentPeriod = isDay;
                periodStart = index;
            } else if (currentPeriod !== isDay) {
                // Period changed, add the previous period to appropriate array
                if (currentPeriod) {
                    dayAreas.push([{ xAxis: periodStart }, { xAxis: index - 1 }]);
                } else {
                    nightAreas.push([{ xAxis: periodStart }, { xAxis: index - 1 }]);
                }
                currentPeriod = isDay;
                periodStart = index;
            }
        });
        
        // Add the final period
        if (currentPeriod !== null) {
            if (currentPeriod) {
                dayAreas.push([{ xAxis: periodStart }, { xAxis: forecast.length - 1 }]);
            } else {
                nightAreas.push([{ xAxis: periodStart }, { xAxis: forecast.length - 1 }]);
            }
        }
        
        return [
            {
                name: 'Day',
                type: 'line',
                data: [],
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgba(255, 255, 0, 0.15)'  // Yellow for day - more transparent
                    },
                    data: dayAreas
                }
            },
            {
                name: 'Night',
                type: 'line',
                data: [],
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgba(0, 0, 139, 0.15)'  // Dark blue for night - more transparent
                    },
                    data: nightAreas
                }
            }
        ];
    }
    
    generateTimeLabels(forecast) {
        return forecast.map((item, index) => {
            const timestamp = new Date(item.timestamp);
            
            if (index % 4 === 0) {
                return timestamp.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true
                }).toLowerCase();
            }
            
            return '';
        });
    }
    
    convertTemperature(temp) {
        const minTemp = 1200, maxTemp = 1850, minF = 60, maxF = 85;
        return Math.round(((temp - minTemp) / (maxTemp - minTemp)) * (maxF - minF) + minF);
    }
    
    convertCloudCover(cloudCover) {
        const minCloud = 400, maxCloud = 1000;
        const percentage = Math.round(((cloudCover - minCloud) / (maxCloud - minCloud)) * 100);
        return Math.max(0, Math.min(100, percentage));
    }
    
    convertHumidity(humidity) {
        const minHumidity = 4000, maxHumidity = 7000;
        const percentage = Math.round(((humidity - minHumidity) / (maxHumidity - minHumidity)) * 100);
        return Math.max(0, Math.min(100, percentage));
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div class="weather-component-wrapper">
                <div class="weather-component-header">
                    <svg style="width: 20px; height: 20px; color: #666;" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                    </svg>
                    <h6 style="margin: 0 0 0 8px; font-size: 18px; font-weight: 600; color: #333;">Weather Forecast</h6>
                </div>
                <div class="weather-component-content">
                    <div style="text-align: center; color: #dc2626; padding: 20px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <p>Error loading weather data: ${message}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    hide() {
        this.container.classList.add('hidden');
    }
    
    show() {
        this.container.classList.remove('hidden');
    }
    
    dispose() {
        if (this.temperatureChart) {
            this.temperatureChart.dispose();
            this.temperatureChart = null;
        }
        if (this.cloudsChart) {
            this.cloudsChart.dispose();
            this.cloudsChart = null;
        }
        this.weatherData = null;
    }
    
    // Public API methods
    async loadAndDisplay(weatherUrl) {
        await this.loadWeatherData(weatherUrl);
        return this.weatherData;
    }
    
    updateData(weatherData) {
        this.weatherData = weatherData;
        this.render();
    }
    
    resize() {
        if (this.temperatureChart) this.temperatureChart.resize();
        if (this.cloudsChart) this.cloudsChart.resize();
    }
}