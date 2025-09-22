const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');

// Global state for the race
let raceState = {
    isRaceRunning: false,
    raceTimeRemaining: 0,
    stintNumber: 1,
    totalPitStops: 0,
    isPitting: false,
    pitTimeRemaining: 0,
    nextPitStop: 0,
    stintData: [],
    completedStints: [],
    lapsPerStint: 0,
    stintDuration: 0,
    fuelPerLap: 0,
    avgLapTime: 0,
    estLaps: 0,
    fuelAdjustment: 0,
    lapTimeAdjustment: 0,
    pitStopTime: 0
};

let raceInterval = null;
let stintStartTimestamp = 0;

// Set up the Express app to serve your static files
const app = express();
const server = http.createServer(app);

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

// Set up the WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('Client connected');
    
    // Send the current state to the new client immediately
    ws.send(JSON.stringify(raceState));

    ws.on('message', message => {
        const msg = JSON.parse(message);
        console.log('Received message:', msg);

        switch (msg.type) {
            case 'recalculate':
                handleRecalculation(msg.inputs);
                break;
            case 'toggleRace':
                toggleRace();
                break;
            case 'pitExit':
                handlePitExit();
                break;
            case 'liveAdjustments':
                handleLiveAdjustments(msg.data);
                break;
            case 'addRepairTime':
                handleAddRepairTime(msg.data);
                break;
            case 'completeRepair':
                handleCompleteRepair();
                break;
        }

        // After every action, send the updated state back to all clients
        broadcastState();
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// --- Core Race Logic Functions ---
function toggleRace() {
    if (raceState.isRaceRunning) {
        stopRace();
    } else {
        startRace();
    }
}

function startRace() {
    // Prevent starting if a race is already running
    if (raceState.isRaceRunning) return;

    // Set initial race state from the last known inputs
    // Assuming a 'recalculate' has been run at least once
    raceState.isRaceRunning = true;
    raceState.stintNumber = 1;
    raceState.totalPitStops = 0;
    raceState.completedStints = [];
    stintStartTimestamp = Date.now();
    
    // Start the race timer
    raceInterval = setInterval(updateRaceTime, 1000);
}

function stopRace() {
    clearInterval(raceInterval);
    raceState.isRaceRunning = false;
    raceState.isPitting = false;
    // Reset state for a new race
    raceState.raceTimeRemaining = 0; 
    raceState.stintNumber = 1;
    raceState.totalPitStops = 0;
    raceState.completedStints = [];
    raceState.stintData = [];
}

function updateRaceTime() {
    if (!raceState.isRaceRunning) return;

    raceState.raceTimeRemaining = Math.max(0, raceState.raceTimeRemaining - 1);
    
    if (raceState.isPitting) {
        raceState.pitTimeRemaining = Math.max(0, raceState.pitTimeRemaining - 1);
        if (raceState.pitTimeRemaining <= 0) {
            raceState.isPitting = false;
            stintStartTimestamp = Date.now();
            // Re-calculate the stint plan from the current race state
            handleRecalculation({
                raceDuration: raceState.raceTimeRemaining,
                avgLapTime: raceState.avgLapTime,
                fuelPerLap: raceState.fuelPerLap,
                tankCapacity: raceState.tankCapacity,
                pitStopSeconds: raceState.pitStopTime,
                isLive: true
            });
        }
    } else {
        const elapsedStintTime = Math.floor((Date.now() - stintStartTimestamp) / 1000);
        raceState.nextPitStop = Math.max(0, raceState.stintDuration - elapsedStintTime);
        if (raceState.nextPitStop <= 0 && raceState.raceTimeRemaining > 0) {
            // End of stint, trigger a pit stop
            handlePitEntry();
        }
    }
    
    // Race has ended
    if (raceState.raceTimeRemaining <= 0) {
        stopRace();
    }
    
    broadcastState();
}

function handleRecalculation(data) {
    const { raceDuration, avgLapTime, fuelPerLap, tankCapacity, pitStopSeconds } = data;
    
    // Update global state with the new values
    raceState.raceTimeRemaining = raceDuration;
    raceState.avgLapTime = avgLapTime;
    raceState.fuelPerLap = fuelPerLap;
    raceState.tankCapacity = tankCapacity;
    raceState.pitStopTime = pitStopSeconds;
    
    const actualFuelPerLap = raceState.fuelPerLap + raceState.fuelAdjustment;
    const actualAvgLapTime = raceState.avgLapTime + raceState.lapTimeAdjustment;

    if (raceDuration <= 0 || actualAvgLapTime <= 0 || actualFuelPerLap <= 0 || tankCapacity <= 0) {
        raceState.stintData = [];
        return;
    }

    const lapsPerStint = Math.floor(tankCapacity / actualFuelPerLap);
    const stintDurationSeconds = lapsPerStint * actualAvgLapTime;
    
    raceState.lapsPerStint = lapsPerStint;
    raceState.stintDuration = stintDurationSeconds;
    raceState.estLaps = Math.floor(raceDuration / actualAvgLapTime);

    // Rebuild the stint plan from scratch
    let stintData = [];
    let currentTimeSeconds = 0;
    
    // Add completed stints from the state
    raceState.completedStints.forEach((stint, index) => {
        const stintEnd = currentTimeSeconds + stint.stintDuration;
        stintData.push({
            stintNumber: stint.stintNumber,
            startTime: currentTimeSeconds,
            endTime: stintEnd,
            stintDuration: stint.stintDuration,
            laps: stint.stintLaps,
            fuel: stint.stintFuel,
            isCurrent: false,
            isPit: false
        });
        currentTimeSeconds = stintEnd;
        
        const pitEnd = currentTimeSeconds + raceState.pitStopTime;
        stintData.push({
            stintNumber: `PIT ${index + 1}`,
            startTime: currentTimeSeconds,
            endTime: pitEnd,
            stintDuration: raceState.pitStopTime,
            laps: '-',
            fuel: '-',
            isCurrent: false,
            isPit: true
        });
        currentTimeSeconds = pitEnd;
    });

    // Add future stints
    let remainingRaceTime = raceDuration - currentTimeSeconds;
    let nextStintNumber = raceState.completedStints.length + 1;
    let totalLaps = 0; // Total laps from the plan
    
    while (remainingRaceTime > 0) {
        const stintStart = currentTimeSeconds;
        let currentStintDuration = Math.min(stintDurationSeconds, remainingRaceTime);
        let lapsInStint = Math.floor(currentStintDuration / actualAvgLapTime);

        // Adjust last stint to match remaining time
        if (remainingRaceTime < stintDurationSeconds) {
            currentStintDuration = remainingRaceTime;
            lapsInStint = Math.floor(currentStintDuration / actualAvgLapTime);
        }
        
        const stintEnd = stintStart + currentStintDuration;
        const stintFuel = lapsInStint * actualFuelPerLap;
        
        stintData.push({
            stintNumber: nextStintNumber,
            startTime: stintStart,
            endTime: stintEnd,
            stintDuration: currentStintDuration,
            laps: lapsInStint,
            fuel: stintFuel,
            isCurrent: nextStintNumber === raceState.stintNumber && !raceState.isPitting,
            isPit: false
        });
        
        currentTimeSeconds = stintEnd;
        remainingRaceTime -= currentStintDuration;
        totalLaps += lapsInStint;
        nextStintNumber++;
        
        // Add a pit stop if there's more time left
        if (remainingRaceTime > 0) {
            const pitStart = currentTimeSeconds;
            const pitEnd = pitStart + raceState.pitStopTime;
            stintData.push({
                stintNumber: `PIT ${nextStintNumber - 1}`,
                startTime: pitStart,
                endTime: pitEnd,
                stintDuration: raceState.pitStopTime,
                laps: '-',
                fuel: '-',
                isCurrent: nextStintNumber - 1 === raceState.totalPitStops + 1 && raceState.isPitting,
                isPit: true
            });
            currentTimeSeconds = pitEnd;
            remainingRaceTime -= raceState.pitStopTime;
        }
    }
    
    raceState.stintData = stintData;
    broadcastState();
}

function handlePitEntry() {
    // Record the completed stint data
    const elapsedStintTime = Math.floor((Date.now() - stintStartTimestamp) / 1000);
    const lapsInStint = Math.floor(elapsedStintTime / (raceState.avgLapTime + raceState.lapTimeAdjustment));
    const fuelUsed = lapsInStint * (raceState.fuelPerLap + raceState.fuelAdjustment);
    
    raceState.completedStints.push({
        stintNumber: raceState.stintNumber,
        stintDuration: elapsedStintTime,
        stintLaps: lapsInStint,
        stintFuel: fuelUsed
    });
    
    raceState.stintNumber++;
    raceState.totalPitStops++;
    raceState.isPitting = true;
    raceState.pitTimeRemaining = raceState.pitStopTime;
    
    broadcastState();
}

function handlePitExit() {
    // Record the completed stint data before the unplanned stop
    const elapsedStintTime = Math.floor((Date.now() - stintStartTimestamp) / 1000);
    const lapsInStint = Math.floor(elapsedStintTime / (raceState.avgLapTime + raceState.lapTimeAdjustment));
    const fuelUsed = lapsInStint * (raceState.fuelPerLap + raceState.fuelAdjustment);
    
    raceState.completedStints.push({
        stintNumber: raceState.stintNumber,
        stintDuration: elapsedStintTime,
        stintLaps: lapsInStint,
        stintFuel: fuelUsed
    });
    
    raceState.stintNumber++;
    raceState.totalPitStops++;

    // Immediately start the new stint
    raceState.isPitting = false;
    stintStartTimestamp = Date.now();
    
    // Reset repair time inputs on the client side (handled by client)
    
    // Recalculate plan based on new remaining time
    handleRecalculation({
        raceDuration: raceState.raceTimeRemaining,
        avgLapTime: raceState.avgLapTime,
        fuelPerLap: raceState.fuelPerLap,
        tankCapacity: raceState.tankCapacity,
        pitStopSeconds: raceState.pitStopTime,
        isLive: true
    });
}

function handleLiveAdjustments(data) {
    raceState.fuelAdjustment = data.fuelAdjustment;
    raceState.lapTimeAdjustment = data.lapTimeAdjustment;
    // Re-calculate the plan with the new slider values
    handleRecalculation({
        raceDuration: raceState.raceTimeRemaining,
        avgLapTime: raceState.avgLapTime,
        fuelPerLap: raceState.fuelPerLap,
        tankCapacity: raceState.tankCapacity,
        pitStopSeconds: raceState.pitStopTime,
        isLive: true
    });
}

function handleAddRepairTime(data) {
    if (raceState.isPitting) {
        raceState.pitTimeRemaining += data.repairTimeInSeconds;
    }
}

function handleCompleteRepair() {
    if (raceState.isPitting) {
        raceState.pitTimeRemaining = 0;
    }
}

// Function to broadcast the current race state to all connected clients
function broadcastState() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(raceState));
        }
    });
}


