const { REST, Routes } = require('discord.js');
require('dotenv').config();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('🧹 Clearing all commands...');

        // Delete all GLOBAL commands
        console.log('🔄 Fetching global commands...');
        const globalCommands = await rest.get(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)
        );
        
        if (globalCommands.length > 0) {
            console.log(`🗑️  Found ${globalCommands.length} global commands, deleting...`);
            await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: [] }
            );
            console.log('✅ Deleted all global commands');
        } else {
            console.log('✅ No global commands found');
        }

        // Delete all GUILD commands
        console.log('🔄 Fetching guild commands...');
        const guildCommands = await rest.get(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID)
        );
        
        if (guildCommands.length > 0) {
            console.log(`🗑️  Found ${guildCommands.length} guild commands, deleting...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
                { body: [] }
            );
            console.log('✅ Deleted all guild commands');
        } else {
            console.log('✅ No guild commands found');
        }

        console.log('');
        console.log('🎉 All commands cleared! Now run: node discord-bot/deploy-commands.js');
        
    } catch (error) {
        console.error('❌ Error clearing commands:', error);
    }
})();
