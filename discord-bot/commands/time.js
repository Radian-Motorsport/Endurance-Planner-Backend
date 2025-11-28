const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Convert a date and time to Discord timestamp')
        .addIntegerOption(option =>
            option.setName('day')
                .setDescription('Day (1-31)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(31)
        )
        .addIntegerOption(option =>
            option.setName('month')
                .setDescription('Month (1-12)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(12)
        )
        .addIntegerOption(option =>
            option.setName('year')
                .setDescription('Year (e.g., 2025)')
                .setRequired(false)
                .setMinValue(2000)
                .setMaxValue(2100)
        )
        .addIntegerOption(option =>
            option.setName('hour')
                .setDescription('Hour (0-23)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(23)
        )
        .addIntegerOption(option =>
            option.setName('minute')
                .setDescription('Minute (0-59)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(59)
        ),

    async execute(interaction) {
        try {
            let day = interaction.options.getInteger('day');
            let month = interaction.options.getInteger('month');
            let year = interaction.options.getInteger('year');
            let hour = interaction.options.getInteger('hour');
            let minute = interaction.options.getInteger('minute');

            // If no date provided, use today
            const now = new Date();
            if (day === null) {
                day = now.getDate();
            }
            if (month === null) {
                month = now.getMonth() + 1;
            }
            if (year === null) {
                year = now.getFullYear();
            }

            // If no time provided, use current time
            if (hour === null) {
                hour = now.getHours();
            }
            if (minute === null) {
                minute = now.getMinutes();
            }

            // Create date object
            const date = new Date(year, month - 1, day, hour, minute, 0);

            // Check if date is valid
            if (isNaN(date.getTime())) {
                return await interaction.reply({
                    content: '❌ Invalid date or time provided.',
                    ephemeral: true
                });
            }

            // Convert to Unix timestamp (seconds)
            const unixTimestamp = Math.floor(date.getTime() / 1000);

            // Show timestamp with relative time
            const timestamp = `<t:${unixTimestamp}:f> (<t:${unixTimestamp}:R>)`;

            await interaction.reply(timestamp);

        } catch (error) {
            console.error('Error in time command:', error);
            await interaction.reply({
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
