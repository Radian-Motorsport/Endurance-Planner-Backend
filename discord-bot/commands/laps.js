const { SlashCommandBuilder } = require('discord.js');
const Garage61Client = require('../modules/garage61-client');
const { createLapTimesEmbed } = require('../utils/formatters');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('laps')
        .setDescription('Get lap times for a car/track combination')
        .addIntegerOption(option =>
            option.setName('track')
                .setDescription('Search for track name')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('condition')
                .setDescription('Track condition filter')
                .setRequired(true)
                .addChoices(
                    { name: 'ALL', value: 'ALL' },
                    { name: 'DRY', value: 'DRY' },
                    { name: 'WET', value: 'WET' }
                )
        )
        .addIntegerOption(option =>
            option.setName('cargroup')
                .setDescription('Select car class (GT3, GT4, GTE, etc.) - optional if car specified')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('car')
                .setDescription('Search for specific car name - optional if cargroup specified')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('driver')
                .setDescription('Filter by driver name (optional)')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const carGroupId = interaction.options.getInteger('cargroup');
            const carId = interaction.options.getInteger('car');
            const trackId = interaction.options.getInteger('track');
            const condition = interaction.options.getString('condition');
            const driverFilter = interaction.options.getString('driver');

            // Must specify either cargroup OR car
            if (!carGroupId && !carId) {
                return await interaction.editReply({ content: '❌ Please specify either a car group or a specific car' });
            }

            const g61 = new Garage61Client(process.env.GARAGE61_TOKEN);
            const cache = require('../modules/cache');

            let carIds;
            let carName;

            if (carGroupId) {
                // Get car IDs from the selected car group
                const carGroups = cache.getCarGroups();
                const carGroup = carGroups.find(g => g.id === carGroupId);
                if (!carGroup) {
                    return await interaction.editReply({ content: '❌ Car group not found' });
                }
                carIds = carGroup.cars.join(',');
                carName = carGroup.name;
                console.log(`🏁 Fetching laps for ${carGroup.name} (${carGroup.cars.length} cars)`);
            } else {
                // Single car
                carIds = carId.toString();
                const cars = cache.getCars();
                const car = cars.find(c => c.id === carId);
                carName = car?.name || `Car ${carId}`;
                console.log(`🏁 Fetching laps for ${carName}`);
            }

            // Fetch lap times with wetness filter using searchLaps
            const fetchOptions = {
                cars: carIds,
                tracks: trackId,
                teams: 'radian-motorsport'
            };
            
            if (condition === 'WET') {
                fetchOptions.minConditionsTrackWetness = 1;
            } else if (condition === 'DRY') {
                fetchOptions.maxConditionsTrackWetness = 0;
            }
            
            const laps = await g61.searchLaps(fetchOptions);
            console.log(`📊 Total laps fetched: ${laps.length}`);
            
            // Log all John's laps to compare with Garage61
            const johnLaps = laps.filter(lap => lap.driver?.firstName === 'John' && lap.driver?.lastName === 'Sowerby');
            console.log(`🔍 John's laps found: ${johnLaps.length}`);
            johnLaps.forEach(lap => {
                console.log(`  ID: ${lap.id}, Time: ${lap.lapTime}, Date: ${lap.startTime}, Track Wetness: ${lap.trackWetness}, Tire: ${lap.tireCompound}, Season: ${lap.season?.shortName}`);
            });

            // Filter by condition (WET/DRY/ALL)
            let filteredLaps = laps.filter(lap => {
                if (condition === 'ALL') return true;
                
                // WET = wet track OR wet tires
                const hasWetTrack = lap.trackWetness > 0;
                const hasWetTires = lap.tireCompound === 2;  // Wet tires are compound 2
                const isWet = hasWetTrack || hasWetTires;
                
                // DRY = dry track AND dry tires  
                const isDry = lap.trackWetness === 0 && lap.tireCompound === 1;  // Dry tires are compound 1
                
                console.log(`🌧️  ${lap.driver?.firstName} ${lap.driver?.lastName}: trackWet=${hasWetTrack}, wetTires=${hasWetTires}, tireCompound=${lap.tireCompound}, isWet=${isWet}`);
                
                if (condition === 'WET') return isWet;
                if (condition === 'DRY') return isDry;
                return true;
            });
            console.log(`✅ Filtered laps (${condition}): ${filteredLaps.length}`);

            // Filter by driver if specified
            if (driverFilter) {
                filteredLaps = filteredLaps.filter(lap => {
                    const fullName = `${lap.driver?.firstName || ''} ${lap.driver?.lastName || ''}`.trim().toLowerCase();
                    return fullName.includes(driverFilter.toLowerCase());
                });
            }

            // Sort by fastest lap time
            filteredLaps = filteredLaps.sort((a, b) => a.lapTime - b.lapTime);

            // Get track name
            const tracks = cache.getTracks();
            const track = tracks.find(t => t.id === trackId);
            const trackName = track?.name || `Track ${trackId}`;

            // Create embed and send
            const embed = createLapTimesEmbed(filteredLaps, carName, trackName, g61);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in laps command:', error);
            await interaction.editReply({
                content: `❌ Error fetching lap times: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
