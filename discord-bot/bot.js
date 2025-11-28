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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping
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

// Message handling for prefix commands - MUST BE BEFORE LOGIN
client.on('messageCreate', async (message) => {
    console.log(`📨 MESSAGE RECEIVED: "${message.content}" from ${message.author.username} (bot: ${message.author.bot})`);
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    console.log(`⏰ PREFIX COMMAND DETECTED: ${message.content}`);
    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === 'time') {
        console.log(`⏰ !TIME COMMAND EXECUTING`);
        try {
            let day = args[0] ? parseInt(args[0]) : new Date().getDate();
            let month = args[1] ? parseInt(args[1]) : new Date().getMonth() + 1;
            let year = args[2] ? parseInt(args[2]) : new Date().getFullYear();
            let hour = args[3] ? parseInt(args[3]) : new Date().getHours();
            let minute = args[4] ? parseInt(args[4]) : 0;

            // Validate ranges
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return await message.reply({
                    content: '❌ Invalid date or time. Use: `!time [day] [month] [year] [hour] [minute]`\nExample: `!time 28 11 2025 20 30`',
                    allowedMentions: { repliedUser: false }
                });
            }

            const date = new Date(year, month - 1, day, hour, minute, 0);
            
            if (isNaN(date.getTime())) {
                return await message.reply({
                    content: '❌ Invalid date or time provided.',
                    allowedMentions: { repliedUser: false }
                });
            }

            const unixTimestamp = Math.floor(date.getTime() / 1000);
            const timestamp = `<t:${unixTimestamp}:f> (<t:${unixTimestamp}:R>)`;

            await message.reply({
                content: timestamp,
                allowedMentions: { repliedUser: false }
            });
        } catch (error) {
            console.error('Error in !time command:', error);
            await message.reply({
                content: `❌ Error: ${error.message}`,
                allowedMentions: { repliedUser: false }
            });
        }
    }
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
