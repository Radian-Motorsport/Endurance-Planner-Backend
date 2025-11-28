const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Garage61Client = require('./modules/garage61-client');
const cache = require('./modules/cache');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.commands = new Collection();

// Load commands from /commands folder
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
    }
}

// Ready event
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🚀 Online and serving ${client.guilds.cache.size} server(s)`);
    
    // Populate cache on startup
    const g61 = new Garage61Client(process.env.GARAGE61_TOKEN);
    await cache.updateCache(g61);
});

// Interaction handling
client.on('interactionCreate', async (interaction) => {
    // Handle autocomplete
    if (interaction.isAutocomplete()) {
        const { commandName, options } = interaction;
        const focusedOption = options.getFocused(true);

        try {
            let choices = [];

            if (focusedOption.name === 'car') {
                const cars = cache.getCars();
                choices = cars
                    .filter(c => c.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25)
                    .map(c => ({ name: c.name, value: c.id }));
            } else if (focusedOption.name === 'track') {
                const tracks = cache.getTracks();
                choices = tracks
                    .filter(t => {
                        const trackName = `${t.name} ${t.variant || ''}`.trim().toLowerCase();
                        return trackName.includes(focusedOption.value.toLowerCase());
                    })
                    .slice(0, 25)
                    .map(t => {
                        const displayName = t.variant ? `${t.name} - ${t.variant}` : t.name;
                        return { name: displayName, value: t.id };
                    });
            } else if (focusedOption.name === 'driver') {
                const drivers = cache.getDrivers();
                choices = drivers
                    .filter(d => {
                        const name = `${d.firstName || ''} ${d.lastName || ''}`.trim().toLowerCase();
                        return name.includes(focusedOption.value.toLowerCase());
                    })
                    .slice(0, 25)
                    .map(d => ({ 
                        name: `${d.firstName || ''} ${d.lastName || ''}`.trim(), 
                        value: `${d.firstName || ''} ${d.lastName || ''}`.trim() 
                    }));
            }

            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete error:', error);
            await interaction.respond([]);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        console.log(`⚡ Running command: ${interaction.commandName}`);
        console.log(`📍 Guild: ${interaction.guild?.name} | User: ${interaction.user.username}`);
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);
        
        const errorMessage = {
            content: `❌ Error executing command: ${error.message}`,
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
