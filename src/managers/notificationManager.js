const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');

class NotificationManager {
    constructor(client, fileManager) {
        this.client = client;
        this.fileManager = fileManager;
        this.activeReminders = new Map(); // Track active reminders to avoid duplicates
        this.pendingTimeouts = new Map(); // Track pending missed dose timeouts
        this.reminderTimeouts = new Map(); // Track reminder response timeouts
    }

    /**
     * Check for due reminders and send notifications
     */
    async checkAndSendReminders() {
        try {
            const guilds = this.client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                await this.processGuildReminders(guild);
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    /**
     * Process reminders for a specific guild
     */
    async processGuildReminders(guild) {
        try {
            const scheduleManager = require('./scheduleManager');
            const sm = new scheduleManager(this.fileManager);
            
            const dueSchedules = await sm.getTodaysSchedules(guild);
            
            for (const schedule of dueSchedules) {
                const reminderKey = `${guild.id}_${schedule.id}_${moment().format('YYYY-MM-DD')}`;
                
                // Skip if already sent today
                if (this.activeReminders.has(reminderKey)) {
                    continue;
                }

                await this.sendMedicineReminder(guild, schedule);
                this.activeReminders.set(reminderKey, Date.now());
            }

            // Clean up old reminders (older than 24 hours)
            this.cleanupOldReminders();
        } catch (error) {
            console.error(`Error processing reminders for guild ${guild.id}:`, error);
        }
    }

    /**
     * Send medicine reminder notification with automatic missed dose detection
     */
    async sendMedicineReminder(guild, schedule) {
        try {
            const reminderChannel = await this.fileManager.getReminderChannel(guild);
            if (!reminderChannel) return;

            const medicineManager = require('./medicineManager');
            const mm = new medicineManager(this.fileManager);
            const medicine = await mm.getMedicineById(guild, schedule.medicine_id);
            
            if (!medicine) return;

            const embed = new EmbedBuilder()
                .setTitle('💊 Medicine Reminder')
                .setColor(0xf39c12)
                .setDescription(`**Time to take your medicine!**`)
                .addFields(
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '💉 Dosage', value: medicine.dosage, inline: true },
                    { name: '⏰ Timing', value: schedule.frequency.replace(/_/g, ' '), inline: true },
                    { name: '📦 Inventory', value: `${medicine.inventory || 0} remaining`, inline: true }
                )
                .setFooter({ text: `Reminder for ${schedule.meal_time} time` })
                .setTimestamp();

            const reminderKey = `${guild.id}_${schedule.medicine_id}_${schedule.target_id}_${Date.now()}`;
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`taken_${schedule.medicine_id}_${schedule.target_id}_${reminderKey}`)
                        .setLabel('✅ Taken')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`missed_${schedule.medicine_id}_${schedule.target_id}_${reminderKey}`)
                        .setLabel('❌ Missed')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`snooze_${schedule.medicine_id}_${schedule.target_id}_${reminderKey}`)
                        .setLabel('⏰ Snooze 15min')
                        .setStyle(ButtonStyle.Secondary)
                );

            const reminderMessage = await reminderChannel.send({
                content: `<@${schedule.target_id}>`,
                embeds: [embed],
                components: [buttons]
            });

            // Set up automatic missed dose detection (30 minutes timeout)
            const missedTimeout = setTimeout(async () => {
                try {
                    // Check if reminder was already responded to
                    if (!this.reminderTimeouts.has(reminderKey)) {
                        return; // Already handled
                    }

                    // Mark as missed and notify trackers
                    await this.handleAutomaticMissedDose(guild, medicine, schedule.target_id, reminderKey);
                    
                    // Clean up tracking
                    this.reminderTimeouts.delete(reminderKey);
                } catch (error) {
                    console.error('Error in automatic missed dose detection:', error);
                }
            }, 30 * 60 * 1000); // 30 minutes

            // Track this reminder for timeout management
            this.reminderTimeouts.set(reminderKey, {
                timeout: missedTimeout,
                messageId: reminderMessage.id,
                channelId: reminderChannel.id,
                medicine: medicine,
                targetId: schedule.target_id,
                scheduleId: schedule.id
            });

            // Log the reminder
            await this.fileManager.logActivity(guild, {
                type: 'reminder_sent',
                schedule_id: schedule.id,
                medicine_id: schedule.medicine_id,
                medicine_name: medicine.name,
                target_id: schedule.target_id,
                reminder_time: schedule.reminder_time,
                reminder_key: reminderKey,
                message: `Reminder sent for ${medicine.name}`
            });

        } catch (error) {
            console.error('Error sending medicine reminder:', error);
        }
    }

    /**
     * Handle automatic missed dose detection when timeout expires
     */
    async handleAutomaticMissedDose(guild, medicine, targetId, reminderKey) {
        try {
            // Log as automatically detected missed dose
            await this.fileManager.logActivity(guild, {
                type: 'medicine_missed_auto',
                medicine_id: medicine.id,
                medicine_name: medicine.name,
                target_id: targetId,
                reminder_key: reminderKey,
                missed_at: new Date().toISOString(),
                detection_method: 'automatic_timeout',
                message: `Automatic missed dose detection for ${medicine.name}`
            });

            // Immediately notify trackers with verification options
            await this.notifyTrackersOfMissedDose(guild, medicine, targetId);

            // Update the original reminder message to show it's expired
            const reminderData = this.reminderTimeouts.get(reminderKey);
            if (reminderData) {
                try {
                    const channel = await this.client.channels.fetch(reminderData.channelId);
                    const message = await channel.messages.fetch(reminderData.messageId);
                    
                    const expiredEmbed = new EmbedBuilder()
                        .setTitle('⏰ Medicine Reminder - Expired')
                        .setColor(0x95a5a6)
                        .setDescription(`**This reminder has expired and was marked as missed.**`)
                        .addFields(
                            { name: '💊 Medicine', value: medicine.name, inline: true },
                            { name: '👤 Target', value: `<@${targetId}>`, inline: true },
                            { name: '🚨 Status', value: 'Automatically marked as missed', inline: true }
                        )
                        .setFooter({ text: 'Trackers have been notified for verification' })
                        .setTimestamp();

                    await message.edit({
                        embeds: [expiredEmbed],
                        components: [] // Remove buttons
                    });
                } catch (editError) {
                    console.error('Error updating expired reminder message:', editError);
                }
            }

        } catch (error) {
            console.error('Error handling automatic missed dose:', error);
        }
    }

    /**
     * Handle medicine response buttons (taken, missed, snooze)
     */
    async handleMedicineResponse(interaction, action, medicineId, targetId, reminderKey) {
        try {
            // Verify the user is the target
            if (interaction.user.id !== targetId) {
                return await interaction.reply({
                    content: '❌ You can only respond to your own medicine reminders.',
                    ephemeral: true
                });
            }

            // Cancel the automatic missed dose timeout since user responded
            if (reminderKey && this.reminderTimeouts.has(reminderKey)) {
                const reminderData = this.reminderTimeouts.get(reminderKey);
                clearTimeout(reminderData.timeout);
                this.reminderTimeouts.delete(reminderKey);
            }

            const medicineManager = require('./medicineManager');
            const scheduleManager = require('./scheduleManager');
            const mm = new medicineManager(this.fileManager);
            const sm = new scheduleManager(this.fileManager);

            const medicine = await mm.getMedicineById(interaction.guild, medicineId);
            if (!medicine) {
                return await interaction.reply({
                    content: '❌ Medicine not found.',
                    ephemeral: true
                });
            }

            let responseMessage = '';
            let embedColor = 0x3498db;

            switch (action) {
                case 'taken':
                    // Update inventory
                    await mm.updateInventory(interaction.guild, medicineId, -1, interaction.user.id);
                    
                    // Log as completed
                    await this.fileManager.logActivity(interaction.guild, {
                        type: 'medicine_taken',
                        medicine_id: medicineId,
                        medicine_name: medicine.name,
                        target_id: targetId,
                        taken_at: new Date().toISOString(),
                        taken_by: interaction.user.id,
                        reminder_key: reminderKey,
                        response_method: 'button_click',
                        message: `${medicine.name} taken by target`
                    });

                    responseMessage = `✅ **Medicine Taken Successfully!**\n💊 ${medicine.name} (${medicine.dosage})\n📦 Inventory: ${(medicine.inventory || 1) - 1} remaining`;
                    embedColor = 0x2ecc71;
                    break;

                case 'missed':
                    // Log as missed and notify trackers immediately
                    await this.fileManager.logActivity(interaction.guild, {
                        type: 'medicine_missed_manual',
                        medicine_id: medicineId,
                        medicine_name: medicine.name,
                        target_id: targetId,
                        missed_at: new Date().toISOString(),
                        reported_by: interaction.user.id,
                        reminder_key: reminderKey,
                        response_method: 'button_click',
                        message: `${medicine.name} marked as missed by target`
                    });

                    // Immediately notify trackers with verification options
                    await this.notifyTrackersOfMissedDose(interaction.guild, medicine, targetId);

                    responseMessage = `❌ **Dose Marked as Missed**\n💊 ${medicine.name}\n⚠️ Tracker has been notified immediately`;
                    embedColor = 0xe74c3c;
                    break;

                case 'snooze':
                    // Log snooze action
                    await this.fileManager.logActivity(interaction.guild, {
                        type: 'medicine_snoozed',
                        medicine_id: medicineId,
                        medicine_name: medicine.name,
                        target_id: targetId,
                        snoozed_at: new Date().toISOString(),
                        snoozed_by: interaction.user.id,
                        reminder_key: reminderKey,
                        snooze_duration: 15,
                        message: `${medicine.name} snoozed for 15 minutes`
                    });

                    // Schedule a new reminder in 15 minutes
                    await this.scheduleSnoozeReminder(interaction.guild, medicine, targetId, 15);

                    responseMessage = `⏰ **Reminder Snoozed**\n💊 ${medicine.name}\n🔔 You'll be reminded again in 15 minutes`;
                    embedColor = 0xf39c12;
                    break;
            }

            const responseEmbed = new EmbedBuilder()
                .setDescription(responseMessage)
                .setColor(embedColor)
                .setFooter({ text: `Response recorded at ${new Date().toLocaleTimeString()}` })
                .setTimestamp();

            // Update the original message to show response
            await interaction.update({
                embeds: [responseEmbed],
                components: [] // Remove buttons after response
            });

        } catch (error) {
            console.error('Error handling medicine response:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your response.',
                ephemeral: true
            });
        }
    }

    /**
     * Handle tracker verification of missed doses
     * Allows trackers to verify and correct the status of reported missed doses
     */
    async handleTrackerVerification(interaction, verifyAction, medicineId, targetId, timestamp) {
        try {
            // Verify the user is an admin (tracker)
            if (!interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({
                    content: '❌ Only administrators (trackers) can verify medicine intake status.',
                    ephemeral: true
                });
            }

            const medicineManager = require('./medicineManager');
            const mm = new medicineManager(this.fileManager);

            const medicine = await mm.getMedicineById(interaction.guild, medicineId);
            if (!medicine) {
                return await interaction.reply({
                    content: '❌ Medicine not found.',
                    ephemeral: true
                });
            }

            let responseMessage = '';
            let embedColor = 0x3498db;
            let logType = '';
            let inventoryChange = 0;

            switch (verifyAction) {
                case 'taken':
                    // Target actually took the medicine - update inventory and log as taken
                    inventoryChange = -1;
                    logType = 'medicine_taken_verified';
                    responseMessage = `✅ **Verified: Medicine Actually Taken**\n💊 ${medicine.name} for <@${targetId}>\n📝 Status corrected by tracker\n📦 Inventory updated: ${(medicine.inventory || 1) - 1} remaining`;
                    embedColor = 0x2ecc71;
                    break;

                case 'missed':
                    // Confirm the dose was actually missed
                    logType = 'medicine_missed_confirmed';
                    responseMessage = `❌ **Confirmed: Dose Actually Missed**\n💊 ${medicine.name} for <@${targetId}>\n📝 Missed dose confirmed by tracker\n⚠️ Consider follow-up with target`;
                    embedColor = 0xe74c3c;
                    break;

                case 'late':
                    // Medicine was taken late - update inventory but log as late
                    inventoryChange = -1;
                    logType = 'medicine_taken_late';
                    responseMessage = `⏰ **Verified: Medicine Taken Late**\n💊 ${medicine.name} for <@${targetId}>\n📝 Late intake verified by tracker\n📦 Inventory updated: ${(medicine.inventory || 1) - 1} remaining`;
                    embedColor = 0xf39c12;
                    break;
            }

            // Update inventory if medicine was actually taken
            if (inventoryChange !== 0) {
                await mm.updateInventory(interaction.guild, medicineId, inventoryChange, interaction.user.id);
            }

            // Log the verification activity
            await this.fileManager.logActivity(interaction.guild, {
                type: logType,
                medicine_id: medicineId,
                medicine_name: medicine.name,
                target_id: targetId,
                verified_by: interaction.user.id,
                verified_at: new Date().toISOString(),
                original_timestamp: timestamp,
                message: `Tracker verified ${verifyAction} status for ${medicine.name}`
            });

            const responseEmbed = new EmbedBuilder()
                .setDescription(responseMessage)
                .setColor(embedColor)
                .setFooter({ text: `Verified by ${interaction.user.displayName}` })
                .setTimestamp();

            // Update the original message to show verification result
            await interaction.update({
                content: '✅ **Tracker Verification Complete**',
                embeds: [responseEmbed],
                components: [] // Remove buttons after verification
            });

        } catch (error) {
            console.error('Error handling tracker verification:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the verification.',
                ephemeral: true
            });
        }
    }

    /**
     * Notify trackers when a target misses a dose with verification options
     */
    async notifyTrackersOfMissedDose(guild, medicine, targetId) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            // Get guild members with admin permissions (trackers)
            const trackers = guild.members.cache.filter(member => 
                member.permissions.has('Administrator') && !member.user.bot
            );

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Missed Dose Alert')
                .setColor(0xe74c3c)
                .setDescription(`**Target missed their medicine dose**`)
                .addFields(
                    { name: '👤 Target', value: `<@${targetId}>`, inline: true },
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '💉 Dosage', value: medicine.dosage, inline: true },
                    { name: '⏰ Time', value: moment().format('HH:mm'), inline: true },
                    { name: '📅 Date', value: moment().format('YYYY-MM-DD'), inline: true },
                    { name: '📦 Inventory', value: `${medicine.inventory || 0} remaining`, inline: true }
                )
                .setFooter({ text: 'Trackers can verify if medicine was actually taken using buttons below' })
                .setTimestamp();

            // Add tracker verification buttons
            const verificationButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`verify_taken_${medicine.id}_${targetId}_${Date.now()}`)
                        .setLabel('✅ Actually Taken')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`verify_missed_${medicine.id}_${targetId}_${Date.now()}`)
                        .setLabel('❌ Confirm Missed')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`verify_late_${medicine.id}_${targetId}_${Date.now()}`)
                        .setLabel('⏰ Taken Late')
                        .setStyle(ButtonStyle.Secondary)
                );

            const mentionTrackers = trackers.map(tracker => `<@${tracker.id}>`).join(' ');

            await logChannel.send({
                content: `🚨 **Missed Dose Alert** ${mentionTrackers}\n\n**Tracker Action Required:** Please verify the actual status of this dose.`,
                embeds: [embed],
                components: [verificationButtons]
            });

        } catch (error) {
            console.error('Error notifying trackers:', error);
        }
    }

    /**
     * Schedule a snooze reminder
     */
    async scheduleSnoozeReminder(guild, medicine, targetId, minutes) {
        try {
            setTimeout(async () => {
                const reminderChannel = await this.fileManager.getReminderChannel(guild);
                if (!reminderChannel) return;

                const embed = new EmbedBuilder()
                    .setTitle('🔔 Snooze Reminder')
                    .setColor(0xf39c12)
                    .setDescription(`**Snooze time is up! Time to take your medicine.**`)
                    .addFields(
                        { name: '💊 Medicine', value: medicine.name, inline: true },
                        { name: '💉 Dosage', value: medicine.dosage, inline: true }
                    )
                    .setTimestamp();

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`taken_${medicine.id}_${targetId}`)
                            .setLabel('✅ Taken')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`missed_${medicine.id}_${targetId}`)
                            .setLabel('❌ Missed')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`snooze_${medicine.id}_${targetId}`)
                            .setLabel('⏰ Snooze 15min')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await reminderChannel.send({
                    content: `<@${targetId}> 🔔 **Snooze Reminder**`,
                    embeds: [embed],
                    components: [buttons]
                });

            }, minutes * 60 * 1000); // Convert minutes to milliseconds

        } catch (error) {
            console.error('Error scheduling snooze reminder:', error);
        }
    }

    /**
     * Send low inventory alert
     */
    async sendLowInventoryAlert(guild, medicine) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('📦 Low Inventory Alert')
                .setColor(0xf39c12)
                .setDescription(`**Medicine inventory is running low**`)
                .addFields(
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '📦 Remaining', value: `${medicine.inventory || 0} doses`, inline: true },
                    { name: '👤 Target', value: `<@${medicine.target_id}>`, inline: true }
                )
                .setFooter({ text: 'Please restock soon to avoid missing doses' })
                .setTimestamp();

            // Get trackers
            const trackers = guild.members.cache.filter(member => 
                member.permissions.has('Administrator') && !member.user.bot
            );

            const mentionTrackers = trackers.map(tracker => `<@${tracker.id}>`).join(' ');

            await logChannel.send({
                content: `📦 **Low Inventory Alert** ${mentionTrackers}`,
                embeds: [embed]
            });

        } catch (error) {
            console.error('Error sending low inventory alert:', error);
        }
    }

    /**
     * Clean up old reminder tracking
     */
    cleanupOldReminders() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const [key, timestamp] of this.activeReminders.entries()) {
            if (timestamp < oneDayAgo) {
                this.activeReminders.delete(key);
            }
        }
    }

    /**
     * Send daily summary to trackers
     */
    async sendDailySummary(guild) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            const logs = await this.fileManager.readData(guild, 'logs.json');
            const today = moment().format('YYYY-MM-DD');
            
            const todaysLogs = logs.logs.filter(log => 
                log.timestamp.startsWith(today)
            );

            const taken = todaysLogs.filter(log => log.type === 'medicine_taken').length;
            const missed = todaysLogs.filter(log => log.type === 'medicine_missed').length;
            const total = taken + missed;

            const embed = new EmbedBuilder()
                .setTitle('📊 Daily Medicine Summary')
                .setColor(0x3498db)
                .addFields(
                    { name: '✅ Taken', value: taken.toString(), inline: true },
                    { name: '❌ Missed', value: missed.toString(), inline: true },
                    { name: '📈 Compliance', value: total > 0 ? `${Math.round((taken / total) * 100)}%` : 'N/A', inline: true }
                )
                .setFooter({ text: `Summary for ${today}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Error sending daily summary:', error);
        }
    }
}

module.exports = NotificationManager;
