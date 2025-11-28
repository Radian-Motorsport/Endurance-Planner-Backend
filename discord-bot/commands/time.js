const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Convert a date and time to Discord timestamp format')
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date (YYYY-MM-DD format, e.g., 2025-11-28)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time (HH:MM format in 24h, e.g., 14:30)')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            let dateStr = interaction.options.getString('date');
            let timeStr = interaction.options.getString('time');

            // If no date provided, use today
            if (!dateStr) {
                const now = new Date();
                dateStr = now.toISOString().split('T')[0];
            }

            // If no time provided, use current time
            if (!timeStr) {
                const now = new Date();
                timeStr = now.toISOString().split('T')[1].substring(0, 5);
            }

            // Parse date
            const dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
                return await interaction.reply({
                    content: '❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-11-28)',
                    ephemeral: true
                });
            }

            // Parse time
            const timeParts = timeStr.split(':');
            if (timeParts.length !== 2) {
                return await interaction.reply({
                    content: '❌ Invalid time format. Use HH:MM (e.g., 14:30)',
                    ephemeral: true
                });
            }

            // Create date object
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
            const day = parseInt(dateParts[2]);
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);

            const date = new Date(year, month, day, hours, minutes, 0);

            // Check if date is valid
            if (isNaN(date.getTime())) {
                return await interaction.reply({
                    content: '❌ Invalid date or time provided.',
                    ephemeral: true
                });
            }

            // Convert to Unix timestamp (seconds)
            const unixTimestamp = Math.floor(date.getTime() / 1000);

            // Display formats
            const formats = {
                'Default': `<t:${unixTimestamp}>`,
                'Short Date': `<t:${unixTimestamp}:d>`,
                'Long Date': `<t:${unixTimestamp}:D>`,
                'Short Time': `<t:${unixTimestamp}:t>`,
                'Long Time': `<t:${unixTimestamp}:T>`,
                'Short Date/Time': `<t:${unixTimestamp}:f>`,
                'Long Date/Time': `<t:${unixTimestamp}:F>`,
                'Relative': `<t:${unixTimestamp}:R>`
            };

            // Build response
            let response = `📅 **${dateStr} ${timeStr}**\n\n**Unix Timestamp:** \`${unixTimestamp}\`\n\n**Discord Format Examples:**\n\n`;
            
            for (const [name, format] of Object.entries(formats)) {
                response += `**${name}:** ${format}\n`;
            }

            await interaction.reply(response);

        } catch (error) {
            console.error('Error in time command:', error);
            await interaction.reply({
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
