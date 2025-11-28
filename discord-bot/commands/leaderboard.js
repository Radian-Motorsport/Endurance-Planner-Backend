const { SlashCommandBuilder } = require('discord.js');
const Garage61Client = require('../modules/garage61-client');
const { createLeaderboardEmbed } = require('../utils/formatters');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Get leaderboard for a car/track combination')
        .addIntegerOption(option =>
            option.setName('car')
                .setDescription('Search for car name')
                .setRequired(true)
                .setAutocomplete(true)
        )
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
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const carId = interaction.options.getInteger('car');
            const trackId = interaction.options.getInteger('track');
            const condition = interaction.options.getString('condition');

            const g61 = new Garage61Client(process.env.GARAGE61_TOKEN);

            // Fetch lap times and filter by condition
            const laps = await g61.getLapTimes(carId, trackId);
            const filtered = laps.filter(lap => {
                if (condition === 'ALL') return true;
                const hasWetTrack = lap.trackWetness > 0;
                const hasWetTires = lap.tireCompound === 2;
                const isWet = hasWetTrack || hasWetTires;
                const isDry = lap.trackWetness === 0 && lap.tireCompound === 1;
                if (condition === 'WET') return isWet;
                if (condition === 'DRY') return isDry;
                return true;
            });
            const sorted = filtered.sort((a, b) => a.lapTime - b.lapTime);

            // Get unique drivers (best lap per driver)
            const driverBests = {};
            sorted.forEach(lap => {
                const driver = lap.driver ? `${lap.driver.firstName || ''} ${lap.driver.lastName || ''}`.trim() : 'Unknown';
                if (!driverBests[driver] || lap.lapTime < driverBests[driver].lapTime) {
                    driverBests[driver] = lap;
                }
            });

            const leaderboard = Object.values(driverBests).sort((a, b) => a.lapTime - b.lapTime);

            // Get car and track names
            const cars = await g61.getCars();
            const tracks = await g61.getTracks();
            const car = cars.find(c => c.id === carId);
            const track = tracks.find(t => t.id === trackId);

            const carName = car?.name || `Car ${carId}`;
            const trackName = track?.name || `Track ${trackId}`;

            // Create embed and send
            const embed = createLeaderboardEmbed(leaderboard, carName, trackName, g61, condition);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in leaderboard command:', error);
            await interaction.editReply({
                content: `❌ Error fetching leaderboard: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
