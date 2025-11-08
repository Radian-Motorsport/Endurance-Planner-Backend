/**
 * EnviroTrace - A visualization component for environmental conditions
 */
class EnviroTrace {
  /**
   * Create a new environment trends visualization
   * @param {object} socket - Socket.io connection for telemetry
   * @param {string} canvasId - HTML canvas element ID to render on
   * @param {object} options - Configuration options
   */
  constructor(socket, canvasId, options = {}) {
    this.socket = socket;
    this.canvas = document.getElementById(canvasId);
    
    // Check if canvas exists
    if (!this.canvas) {
      console.error(`EnviroTrace: Canvas element with ID '${canvasId}' not found`);
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // Configuration with defaults
    this.options = {
      maxPoints: options.maxPoints || 3600, // 1 hour at 1 point per second
      trackTempColor: options.trackTempColor || 'orange',
      airTempColor: options.airTempColor || 'cyan',
      humidityColor: options.humidityColor || 'purple',
      precipitationColor: options.precipitationColor || '#87CEEB', // Light blue
      airPressureColor: options.airPressureColor || 'hotpink',
      tempScale: options.tempScale || 2, // Scale factor for temperature values
      sampleInterval: options.sampleInterval || 1000, // Milliseconds between samples (1 second)
      ...options
    };
    
    // Data buffer
    this.buffer = [];
    this.lastSampleTime = 0; // Track last sample timestamp
    
    // Load any existing data from localStorage
    this.loadFromStorage();
    
    // Set up telemetry listener
    this.setupListeners();
    
    // Start animation
    this.startAnimation();
    
    // Save data to localStorage periodically
    this.setupAutoSave();
  }
  
  /**
   * Set up socket event listeners
   */
  setupListeners() {
    this.socket.on('telemetry', (data) => {
      const values = data?.values;
      if (!values) return;
      
      // Use time-based sampling instead of count-based
      const now = Date.now();
      if (now - this.lastSampleTime < this.options.sampleInterval) return;
      this.lastSampleTime = now;
      
      // Environment data buffer
      this.buffer.push({
        trackTemp: values.TrackTemp,
        humidity: values.RelativeHumidity,
        precipitation: values.Precipitation, // Store precipitation instead of skies
        airPressure: values.AirPressure, // Store in Pa, will convert to mbar for display
        timestamp: now // Add timestamp for persistence filtering
      });
      
      // Clean up old data that exceeds maxPoints
      if (this.buffer.length > this.options.maxPoints) {
        this.buffer.shift();
      }
      
      // Also clean up data older than the time window (maxPoints * sampleInterval)
      const maxAge = this.options.maxPoints * this.options.sampleInterval;
      const cutoffTime = now - maxAge;
      this.buffer = this.buffer.filter(point => point.timestamp > cutoffTime);
    });
  }
  
  /**
   * Start the animation loop
   */
  startAnimation() {
    requestAnimationFrame(this.draw.bind(this));
  }
  
  /**
   * Draw the environment trends graph
   */
  draw() {
    // Check if canvas and context exist
    if (!this.canvas || !this.ctx) {
      return;
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.buffer.length === 0) {
      requestAnimationFrame(this.draw.bind(this));
      return;
    }
    
    // Time-based scaling: map the time window to canvas width
    const timeWindow = this.options.maxPoints * this.options.sampleInterval; // Total time window in ms
    const now = Date.now();
    const startTime = now - timeWindow;
    const xScale = this.canvas.width / timeWindow;
    const canvasHeight = this.canvas.height;
    
    // Filter data to only show points within the time window
    const dataToDisplay = this.buffer.filter(point => point.timestamp >= startTime);
    
    // Debug logging (less frequent)
    if (Math.random() < 0.01) {
      const oldestPoint = dataToDisplay.length > 0 ? dataToDisplay[0] : null;
      const newestPoint = dataToDisplay.length > 0 ? dataToDisplay[dataToDisplay.length - 1] : null;
      const timeSpan = newestPoint && oldestPoint ? (newestPoint.timestamp - oldestPoint.timestamp) / 1000 : 0;
      console.log(`Drawing ${dataToDisplay.length} of ${this.buffer.length} total points`);
      console.log(`Time span: ${timeSpan.toFixed(1)}s (window: ${timeWindow/1000}s)`);
    }
    
    // Track Temperature (scale from typical range 10-60°C to full canvas height)
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.trackTempColor;
    this.ctx.lineWidth = 1.5;
    dataToDisplay.forEach((point, i) => {
      if (point.trackTemp === null || point.trackTemp === undefined) return;
      // Position based on actual timestamp relative to time window
      const x = (point.timestamp - startTime) * xScale;
      // Scale temperature: map 0-60°C to 0-canvas height
      const y = canvasHeight - ((point.trackTemp / 60) * canvasHeight);
      i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
    
    // Humidity (0-1 or 0-100% maps to full canvas height)
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.humidityColor;
    this.ctx.lineWidth = 1.5;
    dataToDisplay.forEach((point, i) => {
      if (point.humidity === null || point.humidity === undefined) return;
      const x = (point.timestamp - startTime) * xScale;
      // Humidity: handle both 0-1 decimal and 0-100 percentage formats
      const humidityPercent = point.humidity > 1 ? point.humidity : point.humidity * 100;
      const y = canvasHeight - ((humidityPercent / 100) * canvasHeight);
      i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
    
    // Precipitation (0-1 or 0-100% scaled to canvas height)
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.precipitationColor;
    this.ctx.lineWidth = 1.5;
    dataToDisplay.forEach((point, i) => {
      if (point.precipitation === null || point.precipitation === undefined) return;
      const x = (point.timestamp - startTime) * xScale;
      // Precipitation: handle both 0-1 decimal and 0-100 percentage formats
      const precipitationPercent = point.precipitation > 1 ? point.precipitation : point.precipitation * 100;
      const y = canvasHeight - ((precipitationPercent / 100) * canvasHeight);
      i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
    });
    this.ctx.stroke();
    
    // Air Pressure (900-1100 mbar range maps to full canvas height)
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.options.airPressureColor;
    this.ctx.lineWidth = 1.5;
    dataToDisplay.forEach((point, i) => {
      if (point.airPressure === null || point.airPressure === undefined) return;
      const x = (point.timestamp - startTime) * xScale;
      
      // Debug air pressure values
      if (i === 0 || i === dataToDisplay.length - 1) {
        console.log(`Air pressure debug - Raw: ${point.airPressure}, Unit check: ${typeof point.airPressure}`);
      }
      
      // Convert Pa to mbar: 1 Pa = 0.01 mbar
      // But check if it's already in mbar (typical range 900-1100)
      let pressureMbar;
      if (point.airPressure > 10000) {
        // Likely in Pa, convert to mbar
        pressureMbar = point.airPressure * 0.01;
      } else {
        // Likely already in mbar
        pressureMbar = point.airPressure;
      }
      
      // Debug converted value and Y position
      if (i === 0 || i === dataToDisplay.length - 1) {
        console.log(`Air pressure: ${pressureMbar.toFixed(2)} mbar`);
      }
      
      // Scale 900-1100 mbar range (200 mbar total range) to canvas height
      // This gives better resolution for typical pressure variations
      const y = canvasHeight - (((pressureMbar - 900) / 200) * canvasHeight);
      
      // Debug Y position
      if (i === 0 || i === dataToDisplay.length - 1) {
        console.log(`Y position: ${y.toFixed(1)} (canvas height: ${canvasHeight}) - Range: 900-1100 mbar`);
      }
      
      // Clamp Y to canvas bounds to make it visible even if out of expected range
      const clampedY = Math.max(0, Math.min(canvasHeight, y));
      
      i === 0 ? this.ctx.moveTo(x, clampedY) : this.ctx.lineTo(x, clampedY);
    });
    this.ctx.stroke();
    
    requestAnimationFrame(this.draw.bind(this));
  }
  
  /**
   * Load buffer data from localStorage
   */
  loadFromStorage() {
    if (!window.storageManager) {
      console.warn('EnviroTrace: StorageManager not available');
      return;
    }
    
    try {
      const savedData = window.storageManager.loadVisualizationData('enviroTrace');
      if (savedData && Array.isArray(savedData)) {
        this.buffer = savedData;
        console.log(`EnviroTrace: Loaded ${this.buffer.length} data points from storage`);
      }
    } catch (error) {
      console.warn('EnviroTrace: Failed to load data from storage:', error);
      this.buffer = [];
    }
  }
  
  /**
   * Save buffer data to localStorage
   */
  saveToStorage() {
    if (!window.storageManager) {
      console.warn('EnviroTrace: StorageManager not available');
      return;
    }
    
    try {
      window.storageManager.saveVisualizationData('enviroTrace', this.buffer);
    } catch (error) {
      console.warn('EnviroTrace: Failed to save data to storage:', error);
    }
  }
  
  /**
   * Update the time range for the trace
   * @param {number} newMaxPoints - New maximum number of data points to display
   */
  updateTimeRange(newMaxPoints) {
    this.options.maxPoints = newMaxPoints;
    
    // Clean up data older than the new time window
    const maxAge = newMaxPoints * this.options.sampleInterval;
    const cutoffTime = Date.now() - maxAge;
    this.buffer = this.buffer.filter(point => point.timestamp > cutoffTime);
    
    console.log(`EnviroTrace: Updated time range to ${newMaxPoints} points (${maxAge/1000}s window)`);
    console.log(`EnviroTrace: Buffer now has ${this.buffer.length} points`);
  }
  
  /**
   * Set up automatic saving to localStorage
   */
  setupAutoSave() {
    // Save every 30 seconds
    setInterval(() => {
      this.saveToStorage();
    }, 30000);
    
    // Save when page is about to unload
    window.addEventListener('beforeunload', () => {
      this.saveToStorage();
    });
  }
}