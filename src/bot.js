const { Client, GatewayIntentBits, Collection, Events, PermissionFlagsBits, ChannelType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config();

const FileManager = require('./utils/fileManager');
const MedicineManager = require('./managers/medicineManager');
const ScheduleManager = require('./managers/scheduleManager');
const NotificationManager = require('./managers/notificationManager');

/**
 * MedGuardianBot - Main Discord bot class that orchestrates all functionality
 * 
 * This class serves as the central hub for:
 * - Discord client management and event handling
 * - Command registration and execution
 * - Manager class coordination (medicine, schedule, notifications)
 * - Automated reminder scheduling
 */
class MedGuardianBot {
    /**
     * Initialize the MedGuardian bot with all required components
     * Sets up Discord client, managers, event handlers, and command loading
     */
    constructor() {
        // Initialize Discord client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,           // Access to guild information
                GatewayIntentBits.GuildMessages,    // Read/send messages
                GatewayIntentBits.MessageContent,   // Access message content
                GatewayIntentBits.GuildMembers      // Access member information
            ]
        });

        // Initialize core components
        this.commands = new Collection();                                           // Store slash commands
        this.fileManager = new FileManager();                                      // Handle Discord file storage
        this.medicineManager = new MedicineManager(this.fileManager);              // Medicine CRUD operations
        this.scheduleManager = new ScheduleManager(this.fileManager);              // Schedule management
        this.notificationManager = new NotificationManager(this.client, this.fileManager); // Reminders & alerts

        // Setup bot functionality
        this.setupEventHandlers();
        this.loadCommands();
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            console.log(`🏥 MedGuardian Bot is ready! Logged in as ${this.client.user.tag}`);
            this.startScheduler();
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        });

        this.client.on(Events.GuildCreate, async (guild) => {
            console.log(`📥 Added to new guild: ${guild.name} (${guild.id})`);
        });
    }

    async handleSlashCommand(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, {
                fileManager: this.fileManager,
                medicineManager: this.medicineManager,
                scheduleManager: this.scheduleManager,
                notificationManager: this.notificationManager
            });
        } catch (error) {
            console.error('Error executing command:', error);
            const reply = { content: '❌ There was an error executing this command!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    async handleButtonInteraction(interaction) {
        // Handle medicine reminder buttons (taken, missed, snooze)
        const customIdParts = interaction.customId.split('_');
        const action = customIdParts[0];
        
        if (['taken', 'missed', 'snooze'].includes(action)) {
            const [, medicineId, targetId, reminderKey] = customIdParts;
            await this.notificationManager.handleMedicineResponse(interaction, action, medicineId, targetId, reminderKey);
        }
        // Handle tracker verification buttons (verify_taken, verify_missed, verify_late)
        else if (action === 'verify') {
            const [, verifyAction, medicineId, targetId, timestamp] = customIdParts;
            await this.notificationManager.handleTrackerVerification(interaction, verifyAction, medicineId, targetId, timestamp);
        }
    }

    async handleModalSubmit(interaction) {
        // Handle modal form submissions
        if (interaction.customId.startsWith('medicine_')) {
            await this.medicineManager.handleModalSubmit(interaction);
        } else if (interaction.customId.startsWith('schedule_')) {
            await this.scheduleManager.handleModalSubmit(interaction);
        }
    }

    loadCommands() {
        const fs = require('fs');
        const path = require('path');
        const commandsPath = path.join(__dirname, 'commands');
        
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
        }

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            this.commands.set(command.data.name, command);
        }
    }

    startScheduler() {
        // Check for medicine reminders every minute
        cron.schedule('* * * * *', async () => {
            try {
                await this.notificationManager.checkAndSendReminders();
            } catch (error) {
                console.error('Error in scheduler:', error);
            }
        });

        console.log('⏰ Medicine reminder scheduler started');
    }

    async deployCommands() {
        const commands = [];
        this.commands.forEach(command => {
            commands.push(command.data.toJSON());
        });

        const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('🔄 Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );

            console.log('✅ Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('❌ Error deploying commands:', error);
        }
    }

    async start() {
        await this.deployCommands();
        await this.client.login(process.env.DISCORD_TOKEN);
    }
}

// Start the bot
if (require.main === module) {
    const bot = new MedGuardianBot();
    bot.start().catch(console.error);
}

module.exports = MedGuardianBot;
