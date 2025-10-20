// A single WebSocket connection to your server
// The URL will automatically be correct for both local and Render deployment
const ws = new WebSocket(`wss://${window.location.host}`);

// --- Helper Functions to format data from the server ---
// This function converts seconds into a formatted HH:MM:SS string
function formatTime(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// This function updates the dynamic table with new stint data
function updateStintTable(stints) {
    const tableBody = document.getElementById('live-stint-table-body');
    tableBody.innerHTML = ''; // Clear the table first
    stints.forEach(stint => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-1 py-2 text-center text-sm">${stint.stintNumber}</td>
            <td class="px-1 py-2 text-center text-sm">${formatTime(stint.startTime)}</td>
            <td class="px-1 py-2 text-center text-sm">${formatTime(stint.endTime)}</td>
            <td class="px-1 py-2 text-center text-sm">${formatTime(stint.duration)}</td>
            <td class="px-1 py-2 text-center text-sm">${stint.laps}</td>
            <td class="px-1 py-2 text-center text-sm">${stint.fuel.toFixed(2)}L</td>
        `;
        tableBody.appendChild(row);
    });
}

// --- WebSocket Event Handlers ---
// Listen for messages from the server
ws.onmessage = (event) => {
    const raceState = JSON.parse(event.data);

    // Update the main countdown timer
    document.getElementById('countdown-timer').textContent = formatTime(raceState.raceTimeRemaining);

    // Update the next pit stop timer
    document.getElementById('next-pitstop-time').textContent = formatTime(raceState.nextPitStop);

    // Update all the summary values
    document.getElementById('live-est-laps-display').textContent = raceState.estLaps.toFixed(0);
    document.getElementById('live-stint-duration-display').textContent = formatTime(raceState.stintDuration);
    document.getElementById('live-laps-per-stint-display').textContent = raceState.lapsPerStint.toFixed(0);
    document.getElementById('live-pit-stops-display').textContent = raceState.totalPitStops.toFixed(0);
    document.getElementById('live-total-fuel-display').textContent = raceState.totalFuel.toFixed(2) + "L";
    document.getElementById('live-fuel-per-lap-display').textContent = raceState.fuelPerLap.toFixed(2) + "L";

    // Update the stint table
    updateStintTable(raceState.stintData);
};

// Log when the connection is opened and closed
ws.onopen = () => {
    console.log('Connected to server');
};

ws.onclose = () => {
    console.log('Disconnected from server');
};

// --- Event Listeners to Send Commands to the Server ---

// Handle the main calculation button
document.getElementById('calculate-page3-button').addEventListener('click', () => {
    const liveRaceDurationHours = parseFloat(document.getElementById('live-race-duration-hours').value) || 0;
    const liveRaceDurationMinutes = parseFloat(document.getElementById('live-race-duration-minutes').value) || 0;
    const liveAvgLapTimeMinutes = parseFloat(document.getElementById('live-avg-lap-time-minutes').value) || 0;
    const liveAvgLapTimeSeconds = parseFloat(document.getElementById('live-avg-lap-time-seconds').value) || 0;
    const liveFuelPerLap = parseFloat(document.getElementById('live-fuel-per-lap-display-input').value) || 0;
    const liveTankCapacity = parseFloat(document.getElementById('live-tank-capacity-display-input').value) || 0;

    const initialData = {
        raceDuration: liveRaceDurationHours * 3600 + liveRaceDurationMinutes * 60,
        avgLapTime: liveAvgLapTimeMinutes * 60 + liveAvgLapTimeSeconds,
        fuelPerLap: liveFuelPerLap,
        tankCapacity: liveTankCapacity
    };

    ws.send(JSON.stringify({ type: 'recalculate', data: initialData }));
});

// Handle the Start/Stop button
document.getElementById('live-start-stop-button').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'toggleRace' }));
});

// Handle the Pit Exit button
document.getElementById('live-pit-exit-button').addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'pitExit' }));
});

// Handle the adjustment sliders on Page 2 (Strategy Page)
const fuelSlider = document.getElementById('fuel-slider');
const lapTimeSlider = document.getElementById('lap-time-slider');

function updateAdjustmentDisplay() {
    // Get base values from form
    const fuelPerLap = parseFloat(document.getElementById('fuel-per-lap-display-input')?.value) || 0;
    const lapTimeMinutes = parseInt(document.getElementById('avg-lap-time-minutes')?.value) || 0;
    const lapTimeSeconds = parseInt(document.getElementById('avg-lap-time-seconds')?.value) || 0;
    
    // Get slider adjustments
    const fuelAdjustment = parseFloat(fuelSlider?.value) || 0;
    const lapTimeAdjustment = parseFloat(lapTimeSlider?.value) || 0;
    
    // Calculate effective values
    const effectiveFuel = fuelPerLap + fuelAdjustment;
    const effectiveLapTime = (lapTimeMinutes * 60) + lapTimeSeconds + lapTimeAdjustment;
    
    // Update displays
    const fuelDisplay = document.getElementById('fuel-per-lap-adjustment');
    const lapTimeDisplay = document.getElementById('lap-time-adjustment');
    
    if (fuelDisplay) {
        fuelDisplay.textContent = effectiveFuel.toFixed(2) + ' L';
    }
    if (lapTimeDisplay) {
        const minutes = Math.floor(effectiveLapTime / 60);
        const seconds = (effectiveLapTime % 60).toFixed(0);
        lapTimeDisplay.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}

if (fuelSlider) {
    fuelSlider.addEventListener('input', () => {
        document.getElementById('fuel-slider-value').textContent = parseFloat(fuelSlider.value).toFixed(2);
        updateAdjustmentDisplay();
        // Trigger strategy recalculation if available
        if (window.radianPlanner && window.radianPlanner.strategyCalculator) {
            window.radianPlanner.strategyCalculator.recalculateWithAdjustments();
        }
    });
}

if (lapTimeSlider) {
    lapTimeSlider.addEventListener('input', () => {
        document.getElementById('lap-time-slider-value').textContent = parseFloat(lapTimeSlider.value).toFixed(2);
        updateAdjustmentDisplay();
        // Trigger strategy recalculation if available
        if (window.radianPlanner && window.radianPlanner.strategyCalculator) {
            window.radianPlanner.strategyCalculator.recalculateWithAdjustments();
        }
    });
}

// Handle +/- buttons for adjustment sliders on Page 2
const adjustmentButtons = document.querySelectorAll('button[data-adjust]');
adjustmentButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const adjustType = button.dataset.adjust;
        const adjustValue = parseFloat(button.dataset.value);
        
        if (adjustType === 'fuel') {
            const slider = document.getElementById('fuel-slider');
            const newValue = Math.max(-2.0, Math.min(2.0, parseFloat(slider.value) + adjustValue));
            slider.value = newValue;
            document.getElementById('fuel-slider-value').textContent = newValue.toFixed(2);
            updateAdjustmentDisplay();
            if (window.radianPlanner && window.radianPlanner.strategyCalculator) {
                window.radianPlanner.strategyCalculator.recalculateWithAdjustments();
            }
        } else if (adjustType === 'lapTime') {
            const slider = document.getElementById('lap-time-slider');
            const newValue = Math.max(-3, Math.min(3, parseFloat(slider.value) + adjustValue));
            slider.value = newValue;
            document.getElementById('lap-time-slider-value').textContent = newValue.toFixed(2);
            updateAdjustmentDisplay();
            if (window.radianPlanner && window.radianPlanner.strategyCalculator) {
                window.radianPlanner.strategyCalculator.recalculateWithAdjustments();
            }
        }
    });
});