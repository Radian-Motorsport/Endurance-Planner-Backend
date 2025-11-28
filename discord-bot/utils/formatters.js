const { EmbedBuilder } = require('discord.js');

function getWindDirection(radians) {
    let degrees = (radians * 180 / Math.PI) % 360;
    if (degrees < 0) degrees += 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
}

function createLapTimesEmbed(laps, carName, trackName, g61Client) {
    const embed = new EmbedBuilder()
        .setColor(0x1e90ff)
        .setTitle(`Lap Times - ${carName} @ ${trackName}`)
        .setTimestamp();

    if (!laps || laps.length === 0) {
        embed.setDescription('No lap data found.');
        return embed;
    }

    // Find fastest sectors across all laps
    const fastestSectors = {};
    laps.forEach(lap => {
        if (lap.sectors && lap.sectors.length > 0) {
            lap.sectors.forEach((sector, i) => {
                if (!fastestSectors[i] || sector.sectorTime < fastestSectors[i]) {
                    fastestSectors[i] = sector.sectorTime;
                }
            });
        }
    });

    // Calculate averages
    const numericLapTimes = laps.map(l => l.lapTime).filter(Boolean);
    const numericFuel = laps.map(l => l.fuelUsed).filter(Boolean);
    const avgLap = numericLapTimes.length ? (numericLapTimes.reduce((a,b)=>a+b,0)/numericLapTimes.length) : null;
    const avgFuel = numericFuel.length ? (numericFuel.reduce((a,b)=>a+b,0)/numericFuel.length) : null;

    const lapDetails = laps.slice(0, 10).map((lap, idx) => {
        const driver = lap.driver ? `${lap.driver.firstName || ''} ${lap.driver.lastName || ''}`.trim() : 'Unknown';
        const time = g61Client.formatLapTime(lap.lapTime);
        const fuel = lap.fuelUsed ? `${lap.fuelUsed.toFixed(2)}L` : 'N/A';
        
        // Sectors with highlighting for fastest
        const sectors = lap.sectors && lap.sectors.length > 0 ? 
            lap.sectors.map((s, i) => {
                const isFastest = s.sectorTime === fastestSectors[i];
                return isFastest ? `**S${i+1}: ${s.sectorTime.toFixed(3)}**` : `S${i+1}: ${s.sectorTime.toFixed(3)}`;
            }).join(' | ') : 'N/A';
        
        // Weather
        const cloudMap = {1: 'Clear', 2: 'Partly Cloudy', 3: 'Mostly Cloudy', 4: 'Overcast'};
        const weather = cloudMap[lap.clouds] || 'Unknown';
        const airTemp = lap.airTemp ? `${lap.airTemp.toFixed(1)}°C` : '?';
        const trackTemp = lap.trackTemp ? `${lap.trackTemp.toFixed(1)}°C` : '?';
        const windSpeed = lap.windVel ? `${(lap.windVel * 2.237).toFixed(1)}mph` : '0mph';
        const windDir = lap.windDir ? getWindDirection(lap.windDir) : 'N';
        const humidity = lap.relativeHumidity ? `${(lap.relativeHumidity * 100).toFixed(0)}%` : '0%';
        const trackUsage = lap.trackUsage ? `${lap.trackUsage}%` : '0%';
        const trackWetness = lap.trackWetness ? `${lap.trackWetness}%` : '0%';
        const condition = trackWetness !== '0%' ? 'WET' : 'DRY';
        
        // Date and season
        const lapDate = lap.startTime ? new Date(lap.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
        const season = lap.season?.name || 'Unknown Season';
        
        return {
            name: `${idx + 1}. ${driver} - ${time} ${condition}`,
            value: 
                `**Date:** ${lapDate} | **Season:** ${season}\n` +
                `**Fuel:** ${fuel}\n` +
                `**Sectors:** ${sectors}\n` +
                `**Weather:** ${weather}\n` +
                `**Humidity:** ${humidity}\n` +
                `**Air Temp:** ${airTemp}\n` +
                `**Track Temp:** ${trackTemp}\n` +
                `**Wind:** ${windSpeed} ${windDir}\n` +
                `**Track Usage:** ${trackUsage}\n` +
                `**Track Wetness:** ${trackWetness}`,
            inline: false
        };
    });

    embed.addFields(...lapDetails);
    
    if (avgLap && avgFuel) {
        embed.setFooter({ text: `Avg Lap: ${g61Client.formatLapTime(avgLap)} | Avg Fuel: ${avgFuel.toFixed(2)}L` });
    }

    return embed;
}

function createDriverDetailEmbed(lap, carName, trackName, g61Client) {
    const driverName = lap.driver ? `${lap.driver.firstName || ''} ${lap.driver.lastName || ''}`.trim() : 'Unknown Driver';
    const condition = lap.trackWetness > 0 ? 'WET' : 'DRY';
    
    const embed = new EmbedBuilder()
        .setColor(0x32cd32)
        .setTitle(`${driverName} - ${carName} @ ${trackName} ${condition}`)
        .setTimestamp();

    if (lap) {
        const lapTime = g61Client.formatLapTime(lap.lapTime);
        const cloudMap = {1: 'Clear', 2: 'Partly Cloudy', 3: 'Mostly Cloudy', 4: 'Overcast'};
        const weather = cloudMap[lap.clouds] || 'Unknown';
        const sectors = lap.sectors?.map((s, i) => `S${i+1}: ${s.sectorTime.toFixed(3)}`).join(' | ') || 'N/A';
        const windSpeed = lap.windVel ? `${(lap.windVel * 2.237).toFixed(1)}mph` : '0mph';
        const windDir = lap.windDir ? getWindDirection(lap.windDir) : 'N';
        
        const lapDate = lap.startTime ? new Date(lap.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
        const season = lap.season?.name || 'Unknown Season';
        
        embed.addFields(
            { name: 'Date', value: lapDate, inline: false },
            { name: 'Season', value: season, inline: false },
            { name: 'Lap Time', value: lapTime, inline: false },
            { name: 'Fuel Used', value: `${lap.fuelUsed?.toFixed(2) || 'N/A'}L`, inline: false },
            { name: 'Sectors', value: sectors, inline: false },
            { name: 'Air Temp', value: `${lap.airTemp?.toFixed(1) || '?'}°C`, inline: false },
            { name: 'Track Temp', value: `${lap.trackTemp?.toFixed(1) || '?'}°C`, inline: false },
            { name: 'Weather', value: weather, inline: false },
            { name: 'Humidity', value: `${(lap.relativeHumidity * 100).toFixed(0)}%`, inline: false },
            { name: 'Wind', value: `${windSpeed} ${windDir}`, inline: false },
            { name: 'Track Usage', value: `${lap.trackUsage || 0}%`, inline: false },
            { name: 'Track Wetness', value: `${lap.trackWetness || 0}%`, inline: false }
        );
    }

    return embed;
}

function createLeaderboardEmbed(laps, carName, trackName, g61Client, condition = 'ALL') {
    const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`Leaderboard - ${carName} @ ${trackName} ${condition}`)
        .setTimestamp();

    if (!laps || laps.length === 0) {
        embed.setDescription('No lap data found.');
        return embed;
    }

    const leaderboard = laps.slice(0, 15).map((lap, idx) => {
        const driver = lap.driver ? `${lap.driver.firstName || ''} ${lap.driver.lastName || ''}`.trim() : 'Unknown';
        const time = g61Client.formatLapTime(lap.lapTime);
        const fuel = lap.fuelUsed ? `${lap.fuelUsed.toFixed(2)}L` : 'N/A';
        const wetness = lap.trackWetness > 0 ? 'WET' : 'DRY';
        const lapDate = lap.startTime ? new Date(lap.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
        return `${idx + 1}. **${driver}** ${wetness} - ${time} (${fuel}) - ${lapDate}`;
    }).join('\n');

    embed.setDescription(leaderboard || 'None');

    return embed;
}

module.exports = {
    createLapTimesEmbed,
    createDriverDetailEmbed,
    createLeaderboardEmbed
};
