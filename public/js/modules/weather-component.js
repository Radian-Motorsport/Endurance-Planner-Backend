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
        this.driversChart = null;
        this.container = null;
        this.weatherData = null;
        this.stintData = null;
        this.currentRaceTime = null; // Seconds since race start
        
        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Container with id '${this.containerId}' not found`);
        }
        
        this.container = container;
        this.injectStyles();
        
        // Add window resize listener for chart responsiveness
        this.resizeListener = () => this.resize();
        window.addEventListener('resize', this.resizeListener);
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
                    position: relative;
                }
                
                .chakra-tabs__tab[aria-selected="true"] {
                    color: #a3a3a3 !important;
                }
                
                .chakra-tabs__tab[aria-selected="true"]::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 50%;
                    height: 3px;
                    background-color: #2563eb;
                }
                
                .chakra-tabs__tab-panel {
                    display: none;
                }
                
                .chakra-tabs__tab-panel[aria-hidden="false"] {
                    display: block;
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
            <div style="width: 100%; overflow: visible;">
                <div class="p-4 sm:p-1" style="width: 100%;">
                    <div class="chakra-tabs">
                        <div class="chakra-tabs__tablist" role="tablist">
                            <button class="chakra-tabs__tab" role="tab" aria-selected="false" data-tab="temperature">
                                Temperature
                            </button>
                            <button class="chakra-tabs__tab" role="tab" aria-selected="true" data-tab="clouds">
                                Clouds & Precipitation
                            </button>
                            <button class="chakra-tabs__tab" role="tab" aria-selected="false" data-tab="drivers">
                                Drivers
                            </button>
                        </div>

                        <!-- Temperature Tab Panel -->
                        <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="true" id="temperature-panel">
                            <div id="${this.containerId}-temperature-chart" style="width: 100%; height: 300px; margin-top: 16px;"></div>
                        </div>

                        <!-- Clouds & Precipitation Tab Panel -->
                        <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="false" id="clouds-panel">
                            <div id="${this.containerId}-clouds-chart" style="width: 100%; height: 300px; margin-top: 16px;"></div>
                        </div>

                        <!-- Drivers Tab Panel -->
                        <div class="chakra-tabs__tab-panel" role="tabpanel" aria-hidden="true" id="drivers-panel">
                            <div id="${this.containerId}-drivers-chart" style="width: 100%; height: 300px; margin-top: 16px;"></div>
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
            } else if (tabName === 'drivers' && this.driversChart) {
                this.driversChart.resize();
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
        
        // Render drivers chart only if stint data is available
        if (this.stintData) {
            this.renderDriversChart();
        }
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
        
        // Calculate current time index by matching time of day
        let currentTimeIndex = -1;
        if (this.currentRaceTime !== null) {
            // currentRaceTime is seconds since midnight (sessionTimeOfDay from telemetry)
            const currentHours = Math.floor(this.currentRaceTime / 3600) % 24;
            const currentMinutes = Math.floor((this.currentRaceTime % 3600) / 60);
            
            // Find forecast item with closest matching time of day
            let closestDiff = Infinity;
            for (let i = 0; i < forecast.length; i++) {
                const forecastDate = new Date(forecast[i].timestamp);
                const forecastHours = forecastDate.getUTCHours();
                const forecastMinutes = forecastDate.getUTCMinutes();
                
                // Calculate difference in minutes
                const forecastTimeInMinutes = forecastHours * 60 + forecastMinutes;
                const currentTimeInMinutes = currentHours * 60 + currentMinutes;
                const diff = Math.abs(forecastTimeInMinutes - currentTimeInMinutes);
                
                if (diff < closestDiff) {
                    closestDiff = diff;
                    currentTimeIndex = i;
                }
            }
        }

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
                axisLine: { lineStyle: { color: '#adadadff' } },
                axisLabel: { color: '#adadadff', fontSize: 10, rotate: 45 }
            },
            yAxis: [
                {
                    type: 'value',
                    position: 'left',
                    axisLine: { lineStyle: { color: '#d6d6d6ff' } },
                    axisLabel: { color: '#d6d6d6ff', fontSize: 12, formatter: '{value}' },
                    splitLine: { lineStyle: { color: '#6E7079', opacity: 0.2 } }
                },
                {
                    type: 'value',
                    position: 'right',
                    min: 0,
                    max: 100,
                    axisLine: { lineStyle: { color: '#d6d6d6ff' } },
                    axisLabel: { color: '#d6d6d6ff', fontSize: 12, formatter: '{value}' },
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
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        animation: true,
                        animationDuration: 1000,
                        animationEasing: 'cubicOut',
                        data: [
                            ...(raceStartIndex >= 0 ? [{
                                xAxis: raceStartIndex,
                                lineStyle: { color: '#22c55e', width: 2, type: 'solid' },
                                label: { show: false },
                                symbol: 'none'
                            }] : []),
                            ...(currentTimeIndex >= 0 ? [{
                                xAxis: currentTimeIndex,
                                lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
                                label: { show: false },
                                symbol: 'none'
                            }] : [])
                        ]
                    }
                },
                {
                    name: 'Humidity (%)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: humidity,
                    lineStyle: { color: '#c41cfcff', width: 2 },
                    itemStyle: { color: '#c41cfcff' },
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
        const precipitationChance = forecast.map(item => this.convertPrecipitationChance(item.precip_chance));
        const precipitationAmount = forecast.map(item => item.precip_amount);
        
        const raceStartIndex = forecast.findIndex((item, index) => 
            item.affects_session && (index === 0 || !forecast[index-1].affects_session)
        );
        
        // Calculate interval from timestamps
        let intervalSeconds = 900;
        if (forecast.length >= 2) {
            const time1 = new Date(forecast[0].timestamp).getTime() / 1000;
            const time2 = new Date(forecast[1].timestamp).getTime() / 1000;
            intervalSeconds = time2 - time1;
        }
        
        // Calculate current time index based on race time
        let currentTimeIndex = -1;
        if (this.currentRaceTime !== null && raceStartIndex >= 0) {
            const indexOffset = Math.round(this.currentRaceTime / intervalSeconds);
            currentTimeIndex = raceStartIndex + indexOffset;
            if (currentTimeIndex >= forecast.length) {
                currentTimeIndex = forecast.length - 1;
            }
        }

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
                axisLine: { lineStyle: { color: '#adadadff' } },
                axisLabel: { color: '#adadadff', fontSize: 10, rotate: 45 }
            },
            yAxis: [
                {
                    type: 'value', 
                    position: 'left',
                    min: 0, 
                    max: 100,
                    axisLine: { lineStyle: { color: '#d6d6d6ff' } },
                    axisLabel: { color: '#d6d6d6ff', fontSize: 12, formatter: '{value}' },
                    splitLine: { lineStyle: { color: '#6E7079', opacity: 0.2 } }
                },
                {
                    type: 'value', 
                    position: 'right',
                    min: 0, 
                    max: 100,
                    axisLine: { lineStyle: { color: '#d6d6d6ff' } },
                    axisLabel: { color: '#d6d6d6ff', fontSize: 12, formatter: '{value}' },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Cloud Cover (%)', 
                    type: 'line', 
                    yAxisIndex: 0,
                    data: cloudCover,
                    lineStyle: { color: '#1c76fcff', width: 2 },
                    itemStyle: { color: '#1c76fcff' },
                    smooth: true, 
                    symbol: 'none',
                    markLine: {
                        silent: true,
                        symbol: 'none',
                        animation: true,
                        animationDuration: 1000,
                        animationEasing: 'cubicOut',
                        data: [
                            ...(raceStartIndex >= 0 ? [{
                                xAxis: raceStartIndex,
                                lineStyle: { color: '#22c55e', width: 2, type: 'solid' },
                                label: { show: false },
                                symbol: 'none'
                            }] : []),
                            ...(currentTimeIndex >= 0 ? [{
                                xAxis: currentTimeIndex,
                                lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
                                label: { show: false },
                                symbol: 'none'
                            }] : [])
                        ]
                    }
                },
                {
                    name: 'Precipitation Chance (%)', 
                    type: 'line', 
                    yAxisIndex: 1,
                    data: precipitationChance,
                    lineStyle: { color: '#00d6e1ff', width: 2 },
                    itemStyle: { color: '#00d6e1ff' },
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
                        <strong>Session:</strong> ${isRace ? 'Race' : 'Practice/Quali'}
                    </div>`;
                }
            }
        };

        this.cloudsChart.setOption(option);
    }
    
    renderDriversChart() {
        console.log('🏁 WeatherComponent: Rendering drivers chart...');
        console.log('   Container ID:', this.containerId);
        console.log('   Stint data:', this.stintData);
        console.log('   Weather data:', this.weatherData ? 'present' : 'missing');
        
        if (this.driversChart) {
            this.driversChart.dispose();
        }
        
        const container = document.getElementById(`${this.containerId}-drivers-chart`);
        console.log('   Container element:', container);
        
        if (!container) {
            console.error('❌ Drivers chart container not found! Looking for:', `${this.containerId}-drivers-chart`);
            return;
        }
        
        if (!this.stintData || !this.stintData.stints || this.stintData.stints.length === 0) {
            console.warn('⚠️ No stint data available for drivers chart');
            console.log('   stintData:', this.stintData);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #a3a3a3;">No stint data available. Please calculate strategy first.</div>';
            return;
        }
        
        console.log('   Found', this.stintData.stints.length, 'stints to display');
        
        this.driversChart = echarts.init(container);
        
        const stints = this.stintData.stints;
        const driverColorMap = this.stintData.driverColorMap || {};
        const forecast = this.weatherData.weather_forecast;
        
        // Define color palette matching stint-table.css driver colors EXACTLY
        // CSS mapping: driver-color-0=Cyan, 1=Purple, 2=Pink, 3=Lime, 4=Yellow, 5=Red, 6=Green, 7=Blue
        const driverColors = [
            'rgba(6, 182, 212, 0.2)',    // driver-color-0: 
            'rgba(168, 85, 247, 0.2)',   // driver-color-1: 
            'rgba(236, 72, 153, 0.2)',   // driver-color-2: 
            'rgba(34, 197, 94, 0.2)',    // driver-color-3: 
            'rgba(251, 191, 36, 0.2)',   // driver-color-4: 
            'rgba(245, 101, 101, 0.2)',    // driver-color-5: 
            'rgba(16, 185, 129, 0.2)',   // driver-color-6: 
            
            // 
        
      
        ];
        
        const defaultColor = 'rgba(115, 115, 115, 0.3)'; // driver-color-default
        
        // Build series data for stacked bar chart
        const stintLabels = stints.map((stint, i) => `Stint ${i + 1}`);
        
        // Build legend entries for each driver and organize data by driver
        const driverSeriesMap = new Map(); // Map of driver name -> array of {value, stintIndex}
        
        const stintData = stints.map((stint, i) => {
            const driverName = stint.driverName || 'Unassigned';
            
            // Skip unassigned stints entirely - don't add them to the chart or data structure
            if (driverName === 'Unassigned') {
                return null; // Return null instead of an object with value:0
            }
            
            const colorIndex = driverColorMap[driverName];
            const color = colorIndex !== undefined ? driverColors[colorIndex] : defaultColor;
            const laps = Math.floor(stint.laps || 0); // Round down laps for chart display only
            
            // Build data structure for this stint
            if (!driverSeriesMap.has(driverName)) {
                driverSeriesMap.set(driverName, {
                    color: color,
                    data: new Array(stints.length).fill(null)
                });
            }
            
            // Add laps to this driver's series at this stint index
            const driverSeries = driverSeriesMap.get(driverName);
            driverSeries.data[i] = laps;
            
            console.log(`   Stint ${i + 1}:`, {
                driver: driverName,
                colorIndex: colorIndex,
                color: color,
                laps: laps + ' (rounded from ' + (stint.laps || 0).toFixed(1) + ')',
                startTime: stint.startTime,
                endTime: stint.endTime
            });
            
            return {
                value: laps,
                itemStyle: { color: color },
                driverName: driverName,
                startTime: stint.startTime,
                endTime: stint.endTime,
                originalLaps: stint.laps // Keep original for tooltip if needed
            };
        });
        
        console.log('   Chart data prepared:', {
            labels: stintLabels,
            dataPoints: stintData.length,
            uniqueDrivers: driverSeriesMap.size,
            drivers: Array.from(driverSeriesMap.keys())
        });
        
        // Build series array with one series per driver for proper legend display and stacking
        const driverSeries = Array.from(driverSeriesMap.entries()).map(([driverName, seriesData]) => ({
            name: driverName,
            type: 'bar',
            stack: 'stints', // CRITICAL: Stack all drivers in the same column using 'stints' stack ID
            data: seriesData.data.map((value, index) => {
                if (value === null || value === 0) return 0; // Use 0 for stacking, not null
                return {
                    value: value,
                    itemStyle: { color: seriesData.color }
                };
            }),
            barWidth: '60%',
            label: { show: false },
            emphasis: {
                focus: 'series'
            }
        }));
        
        // Create day/night markings based on weather data
        const dayNightSeries = this.createDayNightMarkingsForDrivers(forecast, stints);
        
        const option = {
            grid: { left: '60px', right: '60px', top: '60px', bottom: '80px' },
            legend: {
                data: Array.from(driverSeriesMap.entries()).map(([driverName, seriesData]) => ({
                    name: driverName,
                    itemStyle: { color: seriesData.color }
                })),
                top: '10px',
                textStyle: { color: '#d4d4d8' },
                itemGap: 20
            },
            xAxis: {
                type: 'category',
                data: stintLabels,
                axisLine: { lineStyle: { color: '#adadadff' } },
                axisLabel: { color: '#adadadff', fontSize: 10, rotate: 45 }
            },
            yAxis: {
                type: 'value',
                name: 'Laps in Stint',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { color: '#d4d4d8', fontSize: 12 },
                axisLine: { lineStyle: { color: '#d6d6d6ff' } },
                axisLabel: { color: '#d6d6d6ff', fontSize: 12 },
                splitLine: { lineStyle: { color: '#6E7079', opacity: 0.2 } }
            },
            series: [
                ...driverSeries,
                ...dayNightSeries
            ],
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    
                    // Find the driver series (not day/night markings)
                    const driverParams = params.filter(p => driverSeriesMap.has(p.seriesName) && p.value > 0);
                    if (driverParams.length === 0) return '';
                    
                    // Get the stint index from the first valid param
                    const stintIndex = driverParams[0].dataIndex;
                    const stintInfo = stints[stintIndex]; // Use original stints array, not stintData
                    
                    if (!stintInfo) return '';
                    
                    const startTime = new Date(stintInfo.startTime).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });
                    const endTime = new Date(stintInfo.endTime).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                    });
                    
                    // Show info for the driver assigned to this stint
                    const driverName = stintInfo.driverName || 'Unassigned';
                    const driverLaps = stintInfo.laps ? Math.floor(stintInfo.laps) : 0;
                    
                    return `<div style="color: black;">
                        <strong>Stint ${stintIndex + 1}</strong><br>
                        <strong>Driver:</strong> ${driverName}<br>
                        <strong>Start:</strong> ${startTime}<br>
                        <strong>End:</strong> ${endTime}<br>
                        <strong>Laps:</strong> ${driverLaps}
                    </div>`;
                }
            }
        };
        
        console.log('   Setting ECharts option:', option);
        this.driversChart.setOption(option);
        console.log('✅ Drivers chart rendered successfully');
    }
    
    createDayNightMarkingsForDrivers(forecast, stints) {
        // Simplified day/night overlay for drivers chart
        // This creates a subtle background showing day/night periods
        if (!forecast || forecast.length === 0 || !stints || stints.length === 0) {
            return [];
        }
        
        // Calculate which stints are during day vs night based on stint start times
        const dayStints = [];
        const nightStints = [];
        
        stints.forEach((stint, index) => {
            // Find the weather forecast entry closest to stint start time
            const stintStartTime = stint.startTime.getTime();
            const closestForecast = forecast.reduce((prev, curr) => {
                const prevDiff = Math.abs(new Date(prev.timestamp).getTime() - stintStartTime);
                const currDiff = Math.abs(new Date(curr.timestamp).getTime() - stintStartTime);
                return currDiff < prevDiff ? curr : prev;
            });
            
            if (closestForecast.is_sun_up) {
                dayStints.push(index);
            } else {
                nightStints.push(index);
            }
        });
        
        // Create continuous ranges for day/night markings
        const dayRanges = this.createContinuousRanges(dayStints);
        const nightRanges = this.createContinuousRanges(nightStints);
        
        return [
            {
                name: 'Day',
                type: 'bar',
                data: [],
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgba(255, 225, 0, 0.08)'
                    },
                    data: dayRanges.map(range => [
                        { xAxis: range.start },
                        { xAxis: range.end }
                    ])
                }
            },
            {
                name: 'Night',
                type: 'bar',
                data: [],
                markArea: {
                    silent: true,
                    itemStyle: {
                        color: 'rgba(29, 29, 29, 0.3)'
                    },
                    data: nightRanges.map(range => [
                        { xAxis: range.start },
                        { xAxis: range.end }
                    ])
                }
            }
        ];
    }
    
    createContinuousRanges(indices) {
        if (indices.length === 0) return [];
        
        const ranges = [];
        let rangeStart = indices[0];
        let rangeEnd = indices[0];
        
        for (let i = 1; i < indices.length; i++) {
            if (indices[i] === rangeEnd + 1) {
                rangeEnd = indices[i];
            } else {
                ranges.push({ start: rangeStart, end: rangeEnd });
                rangeStart = indices[i];
                rangeEnd = indices[i];
            }
        }
        
        ranges.push({ start: rangeStart, end: rangeEnd });
        return ranges;
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
                        color: 'rgba(255, 225, 0, 0.05)'  // Yellow for day - more transparent
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
                        color: 'rgba(29, 29, 29, 0.61)'  // Dark grey for night - more transparent
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
        // Based on sample data: 1260=67°F, 1843=70°F
        // TODO: Verify these ranges with other weather data - seems oddly specific
        const minTemp = 1260, maxTemp = 1843, minF = 67, maxF = 70;
        return Math.round(((temp - minTemp) / (maxTemp - minTemp)) * (maxF - minF) + minF);
    }
    
    convertCloudCover(cloudCover) {
        // Cloud cover is already a percentage (407-1000 represents ~40.7%-100%)
        return Math.round(cloudCover / 10);
    }
    
    convertHumidity(humidity) {
        // Humidity where 10000 = 100%
        return Math.round(humidity / 100);
    }
    
    convertPrecipitationChance(precipChance) {
        // Precipitation chance where 10000 = 100%
        return Math.round(precipChance / 100);
    }
    
    showError(message) {
        this.container.innerHTML = `
            <div class="weather-component-wrapper">
                <div class="weather-component-header">
                    <svg style="width: 20px; height: 20px; color: #666;" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                    </svg>
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
        if (this.driversChart) {
            this.driversChart.dispose();
            this.driversChart = null;
        }
        this.weatherData = null;
        this.stintData = null;
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
    
    setStintData(stintData) {
        console.log('📊 WeatherComponent: Setting stint data:', stintData);
        this.stintData = stintData;
        
        // Render drivers chart immediately if weather data and echarts are available
        if (this.weatherData && typeof echarts !== 'undefined') {
            console.log('🎨 Triggering renderDriversChart from setStintData');
            this.renderDriversChart();
        } else {
            console.warn('⚠️ Cannot render drivers chart yet:', {
                hasWeatherData: !!this.weatherData,
                hasEcharts: typeof echarts !== 'undefined'
            });
        }
    }
    
    setCurrentRaceTime(raceTimeSeconds) {
        console.log('⏰ setCurrentRaceTime called:', raceTimeSeconds, 'seconds');
        console.log('⏰ Charts exist?', !!this.temperatureChart, !!this.cloudsChart);
        console.log('⏰ Weather data exists?', !!this.weatherData);
        
        this.currentRaceTime = raceTimeSeconds;
        
        // Update just the red line without full re-render
        if (this.temperatureChart && this.cloudsChart && this.weatherData) {
            console.log('⏰ Calling updateRedLine()...');
            this.updateRedLine();
        } else {
            console.log('⏰ NOT calling updateRedLine - missing requirements');
        }
    }
    
    updateRedLine() {
        if (!this.weatherData || !this.weatherData.weather_forecast) {
            return;
        }
        const forecast = this.weatherData.weather_forecast;
        
        // Find race start index
        const raceStartIndex = forecast.findIndex((item, index) => 
            item.affects_session && (index === 0 || !forecast[index-1].affects_session)
        );
        
        // Calculate current time index by matching time of day
        let currentTimeIndex = -1;
        if (this.currentRaceTime !== null) {
            // currentRaceTime is seconds since midnight (sessionTimeOfDay from telemetry)
            const currentHours = Math.floor(this.currentRaceTime / 3600) % 24;
            const currentMinutes = Math.floor((this.currentRaceTime % 3600) / 60);
            
            // Find forecast item with closest matching time of day
            let closestDiff = Infinity;
            for (let i = 0; i < forecast.length; i++) {
                const forecastDate = new Date(forecast[i].timestamp);
                const forecastHours = forecastDate.getUTCHours();
                const forecastMinutes = forecastDate.getUTCMinutes();
                
                // Calculate difference in minutes
                const forecastTimeInMinutes = forecastHours * 60 + forecastMinutes;
                const currentTimeInMinutes = currentHours * 60 + currentMinutes;
                const diff = Math.abs(forecastTimeInMinutes - currentTimeInMinutes);
                
                if (diff < closestDiff) {
                    closestDiff = diff;
                    currentTimeIndex = i;
                }
            }
        }
        
        // Update markLine data for both charts
        const markLineData = [
            ...(raceStartIndex >= 0 ? [{
                xAxis: raceStartIndex,
                lineStyle: { color: '#22c55e', width: 2, type: 'solid' },
                label: { show: false },
                symbol: 'none'
            }] : []),
            ...(currentTimeIndex >= 0 ? [{
                xAxis: currentTimeIndex,
                lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
                label: { show: false },
                symbol: 'none'
            }] : [])
        ];
        
        // Update temperature chart - only update the first series' markLine
        this.temperatureChart.setOption({
            series: [{
                markLine: {
                    silent: true,
                    symbol: 'none',
                    animation: false,
                    data: markLineData
                }
            }]
        });
        
        // Update clouds chart - only update the first series' markLine
        this.cloudsChart.setOption({
            series: [{
                markLine: {
                    silent: true,
                    symbol: 'none',
                    animation: false,
                    data: markLineData
                }
            }]
        });
    }
    
    resize() {
        if (this.temperatureChart) this.temperatureChart.resize();
        if (this.cloudsChart) this.cloudsChart.resize();
        if (this.driversChart) this.driversChart.resize();
    }
    
    destroy() {
        // Clean up event listeners
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
        
        // Dispose charts
        if (this.temperatureChart) {
            this.temperatureChart.dispose();
            this.temperatureChart = null;
        }
        if (this.cloudsChart) {
            this.cloudsChart.dispose();
            this.cloudsChart = null;
        }
        if (this.driversChart) {
            this.driversChart.dispose();
            this.driversChart = null;
        }
        
        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}