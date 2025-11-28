const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Convert a date and time to Discord timestamp')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date in DD-MM-YYYY format (e.g., 28-11-2025)')
                .setRequired(false)
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
            let dateStr = interaction.options.getString('date');
            let hour = interaction.options.getInteger('hour');
            let minute = interaction.options.getInteger('minute');

            // If no date provided, use today
            if (!dateStr) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                dateStr = `${day}-${month}-${year}`;
            }

            // If no time provided, use current time
            if (hour === null) {
                const now = new Date();
                hour = now.getHours();
                minute = now.getMinutes();
            }
            if (minute === null) {
                minute = 0;
            }

            // Parse date (DD-MM-YYYY)
            const dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
                return await interaction.reply({
                    content: '❌ Invalid date format. Use DD-MM-YYYY (e.g., 28-11-2025)',
                    ephemeral: true
                });
            }

            // Create date object
            const day = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
            const year = parseInt(dateParts[2]);

            const date = new Date(year, month, day, hour, minute, 0);

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
