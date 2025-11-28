const { SlashCommandBuilder } = require('discord.js');
const Garage61Client = require('../modules/garage61-client');
const { createDriverDetailEmbed } = require('../utils/formatters');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driver')
        .setDescription('Get a specific driver\'s best lap for a car/track combo')
        .addStringOption(option =>
            option.setName('driver')
                .setDescription('Driver name')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('condition')
                .setDescription('Track condition (optional - shows all if not specified)')
                .setRequired(false)
                .addChoices(
                    { name: 'ALL', value: 'ALL' },
                    { name: 'DRY', value: 'DRY' },
                    { name: 'WET', value: 'WET' }
                )
        )
        .addIntegerOption(option =>
            option.setName('car')
                .setDescription('Filter by car (optional)')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('track')
                .setDescription('Filter by track (optional)')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const driverName = interaction.options.getString('driver');
            const carId = interaction.options.getInteger('car');
            const trackId = interaction.options.getInteger('track');
            const condition = interaction.options.getString('condition');

            const g61 = new Garage61Client(process.env.GARAGE61_TOKEN);

            // If no condition specified, fetch both wet and dry laps separately
            let laps = [];
            
            if (!condition || condition === 'ALL') {
                // Fetch wet laps
                const wetOptions = { 
                    teams: 'radian-motorsport',
                    group: carId ? 'driver' : 'driver-car',
                    minConditionsTrackWetness: 1
                };
                if (carId) wetOptions.cars = carId;
                if (trackId) wetOptions.tracks = trackId;
                
                // Fetch dry laps
                const dryOptions = { 
                    teams: 'radian-motorsport',
                    group: carId ? 'driver' : 'driver-car',
                    maxConditionsTrackWetness: 0
                };
                if (carId) dryOptions.cars = carId;
                if (trackId) dryOptions.tracks = trackId;
                
                const wetLaps = await g61.searchLaps(wetOptions);
                const dryLaps = await g61.searchLaps(dryOptions);
                laps = [...wetLaps, ...dryLaps];
            } else {
                // Fetch laps with condition filter
                const searchOptions = { 
                    teams: 'radian-motorsport',
                    group: carId ? 'driver' : 'driver-car'
                };
                if (carId) searchOptions.cars = carId;
                if (trackId) searchOptions.tracks = trackId;
                
                if (condition === 'WET') {
                    searchOptions.minConditionsTrackWetness = 1;
                } else if (condition === 'DRY') {
                    searchOptions.maxConditionsTrackWetness = 0;
                }
                
                laps = await g61.searchLaps(searchOptions);
            }

            // Filter by driver name only (condition already filtered by API)
            const driverLaps = laps.filter(lap => {
                const fullName = `${lap.driver?.firstName || ''} ${lap.driver?.lastName || ''}`.trim().toLowerCase();
                return fullName.includes(driverName.toLowerCase());
            });

            if (driverLaps.length === 0) {
                await interaction.editReply({
                    content: `❌ No laps found for driver "${driverName}" with selected filters`,
                    ephemeral: true
                });
                return;
            }

            // Sort by lap time and limit to 5 results
            const topLaps = driverLaps.sort((a, b) => a.lapTime - b.lapTime).slice(0, 5);

            // If only one result, use detail view, otherwise use list view
            if (topLaps.length === 1) {
                const bestLap = topLaps[0];
                const carName = bestLap.car?.name || 'Unknown Car';
                const trackName = bestLap.track?.name || 'Unknown Track';
                const embed = createDriverDetailEmbed(bestLap, carName, trackName, g61);
                await interaction.editReply({ embeds: [embed] });
            } else {
                // Multiple results - show list with car names and full telemetry
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor(0x32cd32)
                    .setTitle(`${driverName} - Best Laps${trackId ? ` @ ${topLaps[0]?.track?.name || 'Track'}` : ''}`)
                    .setTimestamp();
                
                const lapFields = topLaps.map((lap, idx) => {
                    const time = g61.formatLapTime(lap.lapTime);
                    const carName = lap.car?.name || 'Unknown Car';
                    const trackName = lap.track?.name || 'Unknown Track';
                    const condition = lap.trackWetness > 0 ? 'WET' : 'DRY';
                    const lapDate = lap.startTime ? new Date(lap.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?';
                    const season = lap.season?.name || 'Unknown Season';
                    const fuel = lap.fuelUsed ? `${lap.fuelUsed.toFixed(2)}L` : 'N/A';
                    
                    const cloudMap = {1: 'Clear', 2: 'Partly Cloudy', 3: 'Mostly Cloudy', 4: 'Overcast'};
                    const weather = cloudMap[lap.clouds] || 'Unknown';
                    const airTemp = lap.airTemp ? `${lap.airTemp.toFixed(1)}°C` : '?';
                    const trackTemp = lap.trackTemp ? `${lap.trackTemp.toFixed(1)}°C` : '?';
                    const humidity = lap.relativeHumidity ? `${(lap.relativeHumidity * 100).toFixed(0)}%` : '0%';
                    const trackUsage = lap.trackUsage ? `${lap.trackUsage}%` : '0%';
                    const trackWetness = lap.trackWetness ? `${lap.trackWetness}%` : '0%';
                    
                    return {
                        name: `${idx + 1}. ${carName}${!trackId ? ` @ ${trackName}` : ''} - ${time} ${condition}`,
                        value: 
                            `**Date:** ${lapDate} | **Season:** ${season}\n` +
                            `**Fuel:** ${fuel}\n` +
                            `**Weather:** ${weather} | **Humidity:** ${humidity}\n` +
                            `**Air Temp:** ${airTemp} | **Track Temp:** ${trackTemp}\n` +
                            `**Track Usage:** ${trackUsage} | **Wetness:** ${trackWetness}`,
                        inline: false
                    };
                });
                
                embed.addFields(...lapFields);
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in driver command:', error);
            await interaction.editReply({
                content: `❌ Error fetching driver data: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
