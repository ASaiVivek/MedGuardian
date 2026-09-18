const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const cron = require('node-cron');
require('dotenv').config();

const FileManager = require('./utils/fileManager');
const MedicineManager = require('./managers/medicineManager');
const ScheduleManager = require('./managers/scheduleManager');
const NotificationManager = require('./managers/notificationManager');
const { parseReminderId, parseVerifyId } = require('./utils/interactionIds');

class MedGuardianBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        this.commands = new Collection();
        this.fileManager = new FileManager();
        this.scheduleManager = new ScheduleManager(this.fileManager);
        this.medicineManager = new MedicineManager(this.fileManager, this.scheduleManager);
        this.notificationManager = new NotificationManager(this.client, this.fileManager);

        this.setupEventHandlers();
        this.loadCommands();
    }

    setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            console.log(`🏥 MedGuardian Bot is ready! Logged in as ${this.client.user.tag}`);
            this.startScheduler();
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (interaction.isAutocomplete()) {
                    await this.handleAutocomplete(interaction);
                } else if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                } else if (interaction.isButton()) {
                    await this.handleButtonInteraction(interaction);
                } else if (interaction.isStringSelectMenu()) {
                    await this.handleSelectMenuInteraction(interaction);
                } else if (interaction.isModalSubmit()) {
                    await this.handleModalSubmit(interaction);
                }
            } catch (error) {
                console.error('Unhandled interaction error:', error);
            }
        });

        this.client.on(Events.GuildCreate, async (guild) => {
            console.log(`📥 Added to new guild: ${guild.name} (${guild.id})`);
        });
    }

    async handleAutocomplete(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command?.autocomplete) return;

        try {
            await command.autocomplete(interaction, {
                fileManager: this.fileManager,
                medicineManager: this.medicineManager,
                scheduleManager: this.scheduleManager,
                notificationManager: this.notificationManager
            });
        } catch (error) {
            console.error('Error in autocomplete:', error);
        }
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
        const customId = interaction.customId;

        if (customId.startsWith('mg|mgr|')) {
            return this.medicineManager.handleManagementButton(interaction);
        }

        if (['configure_meal_times', 'regenerate_schedules', 'view_schedules'].includes(customId)) {
            return this.handleScheduleSettingsButton(interaction);
        }

        const reminder = parseReminderId(customId);
        if (reminder) {
            return this.notificationManager.handleMedicineResponse(
                interaction,
                reminder.action,
                reminder.medicineId,
                reminder.targetId,
                reminder.scheduleId,
                reminder.dateKey
            );
        }

        const verify = parseVerifyId(customId);
        if (verify) {
            return this.notificationManager.handleTrackerVerification(
                interaction,
                verify.action,
                verify.medicineId,
                verify.targetId,
                verify.scheduleId,
                verify.dateKey
            );
        }
    }

    async handleSelectMenuInteraction(interaction) {
        if (interaction.customId.startsWith('mg|select|')) {
            return this.medicineManager.handleMedicineSelect(interaction);
        }
    }

    async handleScheduleSettingsButton(interaction) {
        if (!interaction.memberPermissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Only administrators can manage schedules.',
                ephemeral: true
            });
        }

        switch (interaction.customId) {
            case 'configure_meal_times': {
                const settings = await this.scheduleManager.getSettings(interaction.guild);
                const modal = this.scheduleManager.createMealTimesModal(settings);
                return interaction.showModal(modal);
            }

            case 'regenerate_schedules': {
                await interaction.deferReply({ ephemeral: true });
                const success = await this.scheduleManager.generateSchedules(interaction.guild);
                return interaction.editReply({
                    content: success
                        ? '✅ **Schedules regenerated** based on current medicines and meal times.'
                        : '❌ Failed to regenerate schedules. Please try again.'
                });
            }

            case 'view_schedules': {
                const schedulesEmbed = await this.scheduleManager.createSchedulesListEmbed(interaction.guild);
                return interaction.reply({ embeds: [schedulesEmbed], ephemeral: true });
            }
        }
    }

    async handleModalSubmit(interaction) {
        if (interaction.customId.startsWith('medicine_')) {
            return this.medicineManager.handleModalSubmit(interaction);
        }
        if (interaction.customId.startsWith('schedule_')) {
            return this.scheduleManager.handleModalSubmit(interaction);
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
        cron.schedule('* * * * *', async () => {
            try {
                await this.notificationManager.checkAndSendReminders();
            } catch (error) {
                console.error('Error in reminder scheduler:', error);
            }
        });

        cron.schedule('0 * * * *', async () => {
            try {
                const moment = require('moment-timezone');
                for (const [, guild] of this.client.guilds.cache) {
                    const settings = await this.fileManager.readData(guild, 'settings.json');
                    const timezone = settings.timezone || 'Asia/Kolkata';
                    const now = moment.tz(timezone);
                    if (now.hour() === 21 && now.minute() === 0) {
                        await this.notificationManager.sendDailySummary(guild);
                    }
                }
            } catch (error) {
                console.error('Error in daily summary scheduler:', error);
            }
        });

        console.log('⏰ Medicine reminder scheduler started');
        console.log('📊 Daily summary scheduler started (21:00 per-server timezone)');
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
                { body: commands }
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

if (require.main === module) {
    const bot = new MedGuardianBot();
    bot.start().catch(console.error);
}

module.exports = MedGuardianBot;
