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

// Handle the adjustment sliders
const fuelSlider = document.getElementById('fuel-slider');
const lapTimeSlider = document.getElementById('live-lap-time-adjustment-slider');

fuelSlider.addEventListener('input', () => {
    document.getElementById('live-fuel-slider-value').textContent = fuelSlider.value;
    ws.send(JSON.stringify({ type: 'adjustFuel', value: parseFloat(fuelSlider.value) }));
});

lapTimeSlider.addEventListener('input', () => {
    document.getElementById('live-lap-time-slider-value').textContent = lapTimeSlider.value;
    ws.send(JSON.stringify({ type: 'adjustLapTime', value: parseFloat(lapTimeSlider.value) }));
});