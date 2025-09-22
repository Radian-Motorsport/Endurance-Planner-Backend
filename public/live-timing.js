// Live Timing JavaScript for Radian Planner
// Global race state variables
let liveRaceRemainingSeconds = 0;
let liveStintDurationSeconds = 0;
let liveTimerInterval;
let liveStintStartTimestamp = 0;
let isRaceRunning = false;
let isPitting = false;
let pitStopTime = 0;

// Stint tracking arrays
let completedStints = [];
let stintNumber = 1;
let currentStintActive = 1;
let currentPitActive = 0; 
let livePitRemainingSeconds = 0;

// Load configuration from localStorage on page load
document.addEventListener('DOMContentLoaded', function() {
    loadConfiguration();
    setupEventHandlers();
    handleRecalculation();
});

function loadConfiguration() {
    const config = localStorage.getItem('radianPlannerConfig');
    if (config) {
        const data = JSON.parse(config);
        
        // Update display elements with saved configuration
        document.getElementById('total-race-time-display').textContent = 
            `${data.raceDurationHours || 0}:${String(data.raceDurationMinutes || 0).padStart(2, '0')}:00`;
        
        // Initialize race duration for calculations
        const hours = parseInt(data.raceDurationHours) || 0;
        const minutes = parseInt(data.raceDurationMinutes) || 0;
        liveRaceRemainingSeconds = (hours * 3600) + (minutes * 60);
        
        // Update countdown timer display
        document.getElementById('countdown-timer').textContent = formatTime(liveRaceRemainingSeconds);
        
        // Store config data for calculations
        window.raceConfig = data;
        
        // Calculate initial stint plan
        calculateStintDuration();
        populateStintTableFromLiveInputs(liveRaceRemainingSeconds);
    }
}

// Time formatting functions
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatLapTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    return {
        minutes: paddedMinutes,
        seconds: paddedSeconds
    };
}

// Race control functions
function startRace() {
    if (liveRaceRemainingSeconds <= 0) {
        alert("Please configure race duration in the Setup page first.");
        return;
    }

    clearInterval(liveTimerInterval);
    liveStintStartTimestamp = Date.now();
    isRaceRunning = true;
    isPitting = false;
    
    completedStints = [];
    stintNumber = 1;
    currentStintActive = 1;
    currentPitActive = 0;
    livePitRemainingSeconds = 0;

    updateStatusDisplays(); 
    
    calculateStintDuration();
    populateStintTableFromLiveInputs(liveRaceRemainingSeconds);

    liveTimerInterval = setInterval(updateTimer, 1000);
    
    const toggleButton = document.getElementById('race-toggle');
    toggleButton.innerHTML = '<i class="fa-solid fa-stop mr-2"></i>STOP RACE';
    toggleButton.classList.remove('bg-green-600', 'hover:bg-green-700');
    toggleButton.classList.add('bg-red-600', 'hover:bg-red-700');
    
    // Show live race elements
    document.getElementById('timers').classList.remove('hidden');
    document.getElementById('stint-trackers').classList.remove('hidden');
    document.getElementById('live-table').classList.remove('hidden');
    
    const pitTimerElement = document.getElementById('pit-timer-countdown');
    if (pitTimerElement) {
        pitTimerElement.classList.add('hidden');
    }
}

function stopRace() {
    clearInterval(liveTimerInterval);
    isRaceRunning = false;
    isPitting = false;
    
    const toggleButton = document.getElementById('race-toggle');
    toggleButton.innerHTML = '<i class="fa-solid fa-play mr-2"></i>START RACE';
    toggleButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    toggleButton.classList.add('bg-green-600', 'hover:bg-green-700');
    
    // Hide live race elements
    document.getElementById('timers').classList.add('hidden');
    document.getElementById('stint-trackers').classList.add('hidden');
    
    const pitTimerElement = document.getElementById('pit-timer-countdown');
    if (pitTimerElement) {
        pitTimerElement.classList.add('hidden');
    }
    
    // Reset countdown to original race duration
    loadConfiguration();
}

function toggleRace() {
    if (isRaceRunning) {
        stopRace();
    } else {
        startRace();
    }
}

// Stint and pit management functions
function calculateStintDuration() {
    if (!window.raceConfig) return;
    
    const fuelTankSize = parseFloat(window.raceConfig.tankCapacity) || 0;
    let fuelUsePerLap = parseFloat(window.raceConfig.fuelPerLap) || 0;
    const avgLapTimeMinutes = parseInt(window.raceConfig.lapTimeMinutes) || 0;
    const avgLapTimeSeconds = parseFloat(window.raceConfig.lapTimeSeconds) || 0;

    const fuelSliderAdjustment = parseFloat(document.getElementById('fuel-slider').value) || 0;
    fuelUsePerLap += fuelSliderAdjustment;
    
    const lapTimeSliderAdjustment = parseFloat(document.getElementById('laptime-slider').value) || 0;
    const avgLapTimeInSeconds = ((avgLapTimeMinutes * 60) + avgLapTimeSeconds) + lapTimeSliderAdjustment;

    const pitStopMinutes = parseInt(window.raceConfig.pitStopMinutes) || 0;
    const pitStopSeconds = parseInt(window.raceConfig.pitStopSeconds) || 0;
    pitStopTime = (pitStopMinutes * 60) + pitStopSeconds;

    if (fuelTankSize > 0 && fuelUsePerLap > 0 && avgLapTimeInSeconds > 0) {
        const lapsPerStint = Math.floor(fuelTankSize / fuelUsePerLap);
        liveStintDurationSeconds = lapsPerStint * avgLapTimeInSeconds;
    } else {
        liveStintDurationSeconds = 0;
    }
}

function simulateAutomaticPitEntry() {
    if (!window.raceConfig) return;
    
    // Record the completed stint
    const currentStintDuration = Math.floor((Date.now() - liveStintStartTimestamp) / 1000);
    const avgLapTimeInSeconds = (parseInt(window.raceConfig.lapTimeMinutes) * 60) + (parseFloat(window.raceConfig.lapTimeSeconds));
    const currentStintLaps = avgLapTimeInSeconds > 0 ? Math.floor(currentStintDuration / avgLapTimeInSeconds) : 0;
    const fuelUsePerLap = parseFloat(window.raceConfig.fuelPerLap) || 0;
    const currentStintFuel = currentStintLaps * fuelUsePerLap;

    completedStints.push({
        stintNumber: stintNumber,
        stintDuration: currentStintDuration,
        stintLaps: currentStintLaps,
        stintFuel: currentStintFuel
    });

    stintNumber++;
    currentStintActive++;
    
    // Start the pit cycle
    isPitting = true;
    currentPitActive++;
    livePitRemainingSeconds = pitStopTime;
    
    updateStatusDisplays();

    const pitTimerElement = document.getElementById('pit-timer-countdown');
    if (pitTimerElement) {
        pitTimerElement.classList.remove('hidden');
    }
    
    // Recalculate and re-render the table
    populateStintTableFromLiveInputs(liveRaceRemainingSeconds);
}

function simulatePitExit() {
    if (!isRaceRunning) return;
    if (!window.raceConfig) return;

    // Record the unplanned pit stop
    const currentStintDuration = Math.floor((Date.now() - liveStintStartTimestamp) / 1000);
    const avgLapTimeInSeconds = (parseInt(window.raceConfig.lapTimeMinutes) * 60) + (parseFloat(window.raceConfig.lapTimeSeconds));
    const currentStintLaps = avgLapTimeInSeconds > 0 ? Math.floor(currentStintDuration / avgLapTimeInSeconds) : 0;
    const fuelUsePerLap = parseFloat(window.raceConfig.fuelPerLap) || 0;
    const currentStintFuel = currentStintLaps * fuelUsePerLap;

    completedStints.push({
        stintNumber: stintNumber,
        stintDuration: currentStintDuration,
        stintLaps: currentStintLaps,
        stintFuel: currentStintFuel
    });
    stintNumber++;
    currentStintActive++;
    currentPitActive++;
    
    // Exit pit and start new stint
    isPitting = false;
    
    // Show pit exit banner
    const pitExitBanner = document.getElementById('pit-exit-banner');
    if (pitExitBanner) {
        pitExitBanner.classList.remove('hidden');
        setTimeout(() => {
            pitExitBanner.classList.add('hidden');
        }, 10000);
    }

    liveStintStartTimestamp = Date.now();
    
    const pitTimerElement = document.getElementById('pit-timer-countdown');
    if (pitTimerElement) {
        pitTimerElement.classList.add('hidden');
    }
    
    // Recalculate the entire plan
    populateStintTableFromLiveInputs(liveRaceRemainingSeconds);
    updateStatusDisplays();
}

// Timer update function
function updateTimer() {
    const now = Date.now();
    
    // Update race countdown
    liveRaceRemainingSeconds = Math.max(0, liveRaceRemainingSeconds - 1);
    document.getElementById('countdown-timer').textContent = formatTime(liveRaceRemainingSeconds);

    if (isPitting) {
        // Pit countdown logic
        livePitRemainingSeconds = Math.max(0, livePitRemainingSeconds - 1);
        const pitTimerElement = document.getElementById('pit-timer-countdown');
        if (pitTimerElement) {
            pitTimerElement.textContent = formatTime(livePitRemainingSeconds);
        }

        if (livePitRemainingSeconds <= 0) {
            // Pit countdown is over, start next stint
            isPitting = false;
            if (pitTimerElement) {
                pitTimerElement.classList.add('hidden');
            }
            liveStintStartTimestamp = Date.now();
            populateStintTableFromLiveInputs(liveRaceRemainingSeconds);
        }
    } else {
        // On-track stint countdown logic
        const elapsed = Math.floor((now - liveStintStartTimestamp) / 1000);
        const stintTimeRemaining = Math.max(0, liveStintDurationSeconds - elapsed);
        
        // Update stint timer display
        document.getElementById('stint-timer').textContent = formatTime(stintTimeRemaining);
        
        // Automatic pit trigger
        if (stintTimeRemaining <= 0 && liveRaceRemainingSeconds > 0) {
            simulateAutomaticPitEntry();
        }
    }
    
    // Update race timer display
    const raceElapsed = (parseInt(window.raceConfig?.raceDurationHours || 0) * 3600) + 
                       (parseInt(window.raceConfig?.raceDurationMinutes || 0) * 60) - 
                       liveRaceRemainingSeconds;
    document.getElementById('race-timer').textContent = formatTime(raceElapsed);
    
    // Update pit timer display
    if (isPitting) {
        document.getElementById('pit-timer').textContent = formatTime(livePitRemainingSeconds);
    } else {
        document.getElementById('pit-timer').textContent = "00:00";
    }
    
    // Check for race finish
    if (liveRaceRemainingSeconds <= 0) {
        clearInterval(liveTimerInterval);
        document.getElementById('countdown-timer').textContent = "RACE FINISHED!";
        stopRace();
    }
}

// Strategy calculation function
function populateStintTableFromLiveInputs(raceDurationInSeconds) {
    if (!window.raceConfig) return;
    
    const avgLapTimeMinutes = parseInt(window.raceConfig.lapTimeMinutes) || 0;
    const avgLapTimeSeconds = parseFloat(window.raceConfig.lapTimeSeconds) || 0;
    let fuelUsePerLap = parseFloat(window.raceConfig.fuelPerLap) || 0;
    const fuelTankSize = parseFloat(window.raceConfig.tankCapacity) || 0;

    const fuelSliderAdjustment = parseFloat(document.getElementById('fuel-slider').value) || 0;
    fuelUsePerLap += fuelSliderAdjustment;

    const lapTimeSliderAdjustment = parseFloat(document.getElementById('laptime-slider').value) || 0;
    const avgLapTimeInSeconds = ((avgLapTimeMinutes * 60) + avgLapTimeSeconds) + lapTimeSliderAdjustment;

    if (raceDurationInSeconds <= 0 || avgLapTimeInSeconds <= 0 || fuelUsePerLap <= 0 || fuelTankSize <= 0) {
        document.getElementById('live-overall-summary').classList.add('hidden');
        document.getElementById('live-table').classList.add('hidden');
        const tbody = document.getElementById('stint-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-neutral-500">Please configure race parameters in Setup page.</td></tr>';
        }
        return;
    }

    const lapsPerStint = Math.floor(fuelTankSize / fuelUsePerLap);
    const stintDurationSeconds = lapsPerStint * avgLapTimeInSeconds;
    const totalLaps = Math.floor(raceDurationInSeconds / avgLapTimeInSeconds);
    const totalStints = Math.ceil(raceDurationInSeconds / (stintDurationSeconds + pitStopTime));
    
    // Update summary displays
    document.getElementById('total-laps-display').textContent = totalLaps;
    document.getElementById('total-pit-stops-display').textContent = Math.max(0, totalStints - 1);
    document.getElementById('average-stint-duration-display').textContent = formatTime(stintDurationSeconds);
    
    // Populate stint table
    const tbody = document.getElementById('stint-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let currentTimeSeconds = 0;
    
    // Add completed stints
    completedStints.forEach((stint, index) => {
        const stintStart = currentTimeSeconds;
        const stintEnd = stintStart + stint.stintDuration;
        
        const stintRow = document.createElement('tr');
        stintRow.classList.add('bg-green-100', 'text-green-800');
        stintRow.innerHTML = `
            <td class="px-4 py-2 text-center font-bold">${stint.stintNumber}</td>
            <td class="px-4 py-2 text-center">${formatTime(stint.stintDuration)}</td>
            <td class="px-4 py-2 text-center">${stint.stintLaps}</td>
            <td class="px-4 py-2 text-center">${stint.stintFuel.toFixed(2)} L</td>
            <td class="px-4 py-2 text-center">✓ Completed</td>
        `;
        tbody.appendChild(stintRow);

        currentTimeSeconds = stintEnd + pitStopTime;
    });

    // Add remaining planned stints
    const remainingStintsCount = Math.ceil((raceDurationInSeconds - currentTimeSeconds) / (stintDurationSeconds + pitStopTime));
    
    for (let i = 0; i < remainingStintsCount; i++) {
        const stintLaps = Math.min(lapsPerStint, Math.floor((raceDurationInSeconds - currentTimeSeconds) / avgLapTimeInSeconds));
        const currentStintDuration = stintLaps * avgLapTimeInSeconds;
        const stintFuel = stintLaps * fuelUsePerLap;

        if (stintLaps <= 0) break;

        const stintNumberForTable = i + completedStints.length + 1;
        
        const stintRow = document.createElement('tr');

        if (!isPitting && stintNumberForTable === currentStintActive) {
            stintRow.classList.add('bg-yellow-200', 'text-yellow-800');
        } else {
            stintRow.classList.add('bg-neutral-100', 'text-neutral-800');
        }
        
        const status = (!isPitting && stintNumberForTable === currentStintActive) ? '🏁 Current' : '⏳ Planned';
        
        stintRow.innerHTML = `
            <td class="px-4 py-2 text-center font-bold">${stintNumberForTable}</td>
            <td class="px-4 py-2 text-center">${formatTime(currentStintDuration)}</td>
            <td class="px-4 py-2 text-center">${stintLaps}</td>
            <td class="px-4 py-2 text-center">${stintFuel.toFixed(2)} L</td>
            <td class="px-4 py-2 text-center">${status}</td>
        `;
        tbody.appendChild(stintRow);

        currentTimeSeconds += currentStintDuration + pitStopTime;
    }
    
    document.getElementById('live-overall-summary').classList.remove('hidden');
    document.getElementById('live-table').classList.remove('hidden');
}

// Event handlers and utility functions
function handleRecalculation() {
    calculateStintDuration();
    let raceDurationForCalculation = 0;
    if (isRaceRunning) {
        raceDurationForCalculation = liveRaceRemainingSeconds;
    } else if (window.raceConfig) {
        const hours = parseInt(window.raceConfig.raceDurationHours) || 0;
        const minutes = parseInt(window.raceConfig.raceDurationMinutes) || 0;
        raceDurationForCalculation = (hours * 3600) + (minutes * 60);
    }
    populateStintTableFromLiveInputs(raceDurationForCalculation);
}

function updateStatusDisplays() {
    const currentStintDisplay = document.getElementById('current-stint-display');
    const currentPitDisplay = document.getElementById('current-pit-display');
    
    if (currentStintDisplay) currentStintDisplay.textContent = currentStintActive;
    if (currentPitDisplay) currentPitDisplay.textContent = currentPitActive;
}

function setupEventHandlers() {
    // Race control buttons
    document.getElementById('race-toggle').addEventListener('click', toggleRace);
    document.getElementById('manual-pit-entry').addEventListener('click', simulateAutomaticPitEntry);
    document.getElementById('manual-pit-exit').addEventListener('click', simulatePitExit);

    // Slider controls
    const fuelSlider = document.getElementById('fuel-slider');
    const fuelSliderValue = document.getElementById('live-fuel-slider-value');
    const lapTimeSlider = document.getElementById('laptime-slider');
    const lapTimeSliderValue = document.getElementById('live-laptime-slider-value');

    if (fuelSlider) {
        fuelSlider.addEventListener('input', () => {
            fuelSliderValue.textContent = parseFloat(fuelSlider.value).toFixed(1);
            handleRecalculation();
        });
    }

    if (lapTimeSlider) {
        lapTimeSlider.addEventListener('input', () => {
            lapTimeSliderValue.textContent = lapTimeSlider.value + 's';
            handleRecalculation();
        });
    }

    // Adjust buttons for sliders
    const adjustButtons = document.querySelectorAll('.adjust-button');
    adjustButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sliderId = button.dataset.target;
            const step = parseFloat(button.dataset.step);
            const slider = document.getElementById(sliderId);

            if (slider) {
                let currentValue = parseFloat(slider.value);
                let newValue = currentValue + step;

                newValue = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), newValue));
                slider.value = newValue;
                
                const event = new Event('input', { bubbles: true });
                slider.dispatchEvent(event);
            }
        });
    });
}