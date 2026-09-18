const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const moment = require('moment-timezone');
const { buildReminderId, buildVerifyId } = require('../utils/interactionIds');
const { TAKEN_TYPES, MISSED_TYPES } = require('../constants/frequencies');

class NotificationManager {
    constructor(client, fileManager) {
        this.client = client;
        this.fileManager = fileManager;
        this.activeReminders = new Map();
        this.reminderTimeouts = new Map();
    }

    async checkAndSendReminders() {
        try {
            for (const [, guild] of this.client.guilds.cache) {
                await this.processGuildReminders(guild);
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    async processGuildReminders(guild) {
        try {
            const ScheduleManager = require('./scheduleManager');
            const sm = new ScheduleManager(this.fileManager);
            const settings = await sm.getSettings(guild);
            const timezone = settings.timezone || 'Asia/Kolkata';
            const dateKey = moment.tz(timezone).format('YYYY-MM-DD');

            const dueSchedules = await sm.getTodaysSchedules(guild);

            for (const schedule of dueSchedules) {
                const reminderKey = `${guild.id}_${schedule.id}_${dateKey}`;

                if (this.activeReminders.has(reminderKey)) {
                    continue;
                }

                await this.sendMedicineReminder(guild, schedule, dateKey);
                this.activeReminders.set(reminderKey, Date.now());
            }

            this.cleanupOldReminders();
        } catch (error) {
            console.error(`Error processing reminders for guild ${guild.id}:`, error);
        }
    }

    async sendMedicineReminder(guild, schedule, dateKey) {
        try {
            const reminderChannel = await this.fileManager.getReminderChannel(guild);
            if (!reminderChannel) return;

            const MedicineManager = require('./medicineManager');
            const mm = new MedicineManager(this.fileManager);
            const medicine = await mm.getMedicineById(guild, schedule.medicine_id);

            if (!medicine) return;

            const timingLabel = schedule.frequency.startsWith('custom_')
                ? `At ${schedule.reminder_time}`
                : schedule.frequency.replace(/_/g, ' ');

            const embed = new EmbedBuilder()
                .setTitle('💊 Medicine Reminder')
                .setColor(0xf39c12)
                .setDescription('**Time to take your medicine!**')
                .addFields(
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '💉 Dosage', value: medicine.dosage, inline: true },
                    { name: '⏰ Timing', value: timingLabel, inline: true },
                    { name: '📦 Inventory', value: `${medicine.inventory || 0} remaining`, inline: true }
                )
                .setFooter({ text: `Scheduled for ${schedule.reminder_time}` })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(buildReminderId('taken', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('✅ Taken')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(buildReminderId('missed', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('❌ Missed')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(buildReminderId('snooze', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('⏰ Snooze 15min')
                        .setStyle(ButtonStyle.Secondary)
                );

            const reminderMessage = await reminderChannel.send({
                content: `<@${schedule.target_id}>`,
                embeds: [embed],
                components: [buttons]
            });

            const reminderKey = `${guild.id}_${schedule.id}_${dateKey}`;
            const missedTimeout = setTimeout(async () => {
                try {
                    if (!this.reminderTimeouts.has(reminderKey)) return;
                    await this.handleAutomaticMissedDose(guild, medicine, schedule, dateKey);
                    this.reminderTimeouts.delete(reminderKey);
                } catch (error) {
                    console.error('Error in automatic missed dose detection:', error);
                }
            }, 30 * 60 * 1000);

            this.reminderTimeouts.set(reminderKey, {
                timeout: missedTimeout,
                messageId: reminderMessage.id,
                channelId: reminderChannel.id,
                medicine,
                schedule,
                dateKey
            });

            await this.fileManager.logActivity(guild, {
                type: 'reminder_sent',
                schedule_id: schedule.id,
                medicine_id: schedule.medicine_id,
                medicine_name: medicine.name,
                target_id: schedule.target_id,
                reminder_time: schedule.reminder_time,
                message: `Reminder sent for ${medicine.name}`
            });
        } catch (error) {
            console.error('Error sending medicine reminder:', error);
        }
    }

    async handleAutomaticMissedDose(guild, medicine, schedule, dateKey) {
        try {
            const alreadyHandled = await this.fileManager.isScheduleHandledToday(
                guild,
                schedule.id,
                schedule.timezone
            );
            if (alreadyHandled) return;

            await this.fileManager.logActivity(guild, {
                type: 'medicine_missed_auto',
                schedule_id: schedule.id,
                medicine_id: medicine.id,
                medicine_name: medicine.name,
                target_id: schedule.target_id,
                missed_at: new Date().toISOString(),
                detection_method: 'automatic_timeout',
                message: `Automatic missed dose detection for ${medicine.name}`
            });

            await this.notifyTrackersOfMissedDose(guild, medicine, schedule);

            const reminderKey = `${guild.id}_${schedule.id}_${dateKey}`;
            const reminderData = this.reminderTimeouts.get(reminderKey);
            if (reminderData) {
                try {
                    const channel = await this.client.channels.fetch(reminderData.channelId);
                    const message = await channel.messages.fetch(reminderData.messageId);

                    const expiredEmbed = new EmbedBuilder()
                        .setTitle('⏰ Medicine Reminder - Expired')
                        .setColor(0x95a5a6)
                        .setDescription('**This reminder expired and was marked as missed.**')
                        .addFields(
                            { name: '💊 Medicine', value: medicine.name, inline: true },
                            { name: '👤 Target', value: `<@${schedule.target_id}>`, inline: true },
                            { name: '🚨 Status', value: 'Automatically marked as missed', inline: true }
                        )
                        .setFooter({ text: 'Trackers have been notified for verification' })
                        .setTimestamp();

                    await message.edit({ embeds: [expiredEmbed], components: [] });
                } catch (editError) {
                    console.error('Error updating expired reminder message:', editError);
                }
            }
        } catch (error) {
            console.error('Error handling automatic missed dose:', error);
        }
    }

    async handleMedicineResponse(interaction, action, medicineId, targetId, scheduleId, dateKey) {
        try {
            if (interaction.user.id !== targetId) {
                return interaction.reply({
                    content: '❌ You can only respond to your own medicine reminders.',
                    ephemeral: true
                });
            }

            const reminderKey = `${interaction.guild.id}_${scheduleId}_${dateKey}`;
            if (this.reminderTimeouts.has(reminderKey)) {
                const reminderData = this.reminderTimeouts.get(reminderKey);
                clearTimeout(reminderData.timeout);
                this.reminderTimeouts.delete(reminderKey);
            }

            const MedicineManager = require('./medicineManager');
            const mm = new MedicineManager(this.fileManager);
            const medicine = await mm.getMedicineById(interaction.guild, medicineId);

            if (!medicine) {
                return interaction.reply({
                    content: '❌ Medicine not found.',
                    ephemeral: true
                });
            }

            let responseMessage = '';
            let embedColor = 0x3498db;
            const baseLog = {
                schedule_id: scheduleId,
                medicine_id: medicineId,
                medicine_name: medicine.name,
                target_id: targetId
            };

            switch (action) {
                case 'taken':
                    await mm.updateInventory(interaction.guild, medicineId, -1, interaction.user.id, this);
                    await this.fileManager.logActivity(interaction.guild, {
                        ...baseLog,
                        type: 'medicine_taken',
                        taken_at: new Date().toISOString(),
                        taken_by: interaction.user.id,
                        response_method: 'button_click',
                        message: `${medicine.name} taken by target`
                    });
                    responseMessage = `✅ **Medicine Taken!**\n💊 ${medicine.name} (${medicine.dosage})\n📦 Inventory: ${Math.max(0, (medicine.inventory || 1) - 1)} remaining`;
                    embedColor = 0x2ecc71;
                    break;

                case 'missed':
                    await this.fileManager.logActivity(interaction.guild, {
                        ...baseLog,
                        type: 'medicine_missed_manual',
                        missed_at: new Date().toISOString(),
                        reported_by: interaction.user.id,
                        response_method: 'button_click',
                        message: `${medicine.name} marked as missed by target`
                    });
                    await this.notifyTrackersOfMissedDose(interaction.guild, medicine, {
                        id: scheduleId,
                        target_id: targetId
                    });
                    responseMessage = `❌ **Dose Marked as Missed**\n💊 ${medicine.name}\n⚠️ Tracker has been notified`;
                    embedColor = 0xe74c3c;
                    break;

                case 'snooze':
                    await this.fileManager.logActivity(interaction.guild, {
                        ...baseLog,
                        type: 'medicine_snoozed',
                        snoozed_at: new Date().toISOString(),
                        snoozed_by: interaction.user.id,
                        snooze_duration: 15,
                        message: `${medicine.name} snoozed for 15 minutes`
                    });
                    await this.scheduleSnoozeReminder(interaction.guild, medicine, {
                        id: scheduleId,
                        target_id: targetId
                    }, dateKey, 15);
                    responseMessage = `⏰ **Reminder Snoozed**\n💊 ${medicine.name}\n🔔 You'll be reminded again in 15 minutes`;
                    embedColor = 0xf39c12;
                    break;
            }

            const responseEmbed = new EmbedBuilder()
                .setDescription(responseMessage)
                .setColor(embedColor)
                .setFooter({ text: `Response recorded at ${new Date().toLocaleTimeString()}` })
                .setTimestamp();

            await interaction.update({ embeds: [responseEmbed], components: [] });
        } catch (error) {
            console.error('Error handling medicine response:', error);
            const reply = { content: '❌ An error occurred while processing your response.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    async handleTrackerVerification(interaction, verifyAction, medicineId, targetId, scheduleId, dateKey) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({
                    content: '❌ Only administrators (trackers) can verify medicine intake status.',
                    ephemeral: true
                });
            }

            const MedicineManager = require('./medicineManager');
            const mm = new MedicineManager(this.fileManager);
            const medicine = await mm.getMedicineById(interaction.guild, medicineId);

            if (!medicine) {
                return interaction.reply({
                    content: '❌ Medicine not found.',
                    ephemeral: true
                });
            }

            let responseMessage = '';
            let embedColor = 0x3498db;
            let logType = '';
            const baseLog = {
                schedule_id: scheduleId,
                medicine_id: medicineId,
                medicine_name: medicine.name,
                target_id: targetId,
                verified_by: interaction.user.id,
                verified_at: new Date().toISOString()
            };

            switch (verifyAction) {
                case 'taken':
                    await mm.updateInventory(interaction.guild, medicineId, -1, interaction.user.id, this);
                    logType = 'medicine_taken_verified';
                    responseMessage = `✅ **Verified: Medicine Actually Taken**\n💊 ${medicine.name} for <@${targetId}>\n📦 Inventory updated`;
                    embedColor = 0x2ecc71;
                    break;

                case 'missed':
                    logType = 'medicine_missed_confirmed';
                    responseMessage = `❌ **Confirmed: Dose Missed**\n💊 ${medicine.name} for <@${targetId}>`;
                    embedColor = 0xe74c3c;
                    break;

                case 'late':
                    await mm.updateInventory(interaction.guild, medicineId, -1, interaction.user.id, this);
                    logType = 'medicine_taken_late';
                    responseMessage = `⏰ **Verified: Taken Late**\n💊 ${medicine.name} for <@${targetId}>\n📦 Inventory updated`;
                    embedColor = 0xf39c12;
                    break;
            }

            await this.fileManager.logActivity(interaction.guild, {
                ...baseLog,
                type: logType,
                message: `Tracker verified ${verifyAction} status for ${medicine.name}`
            });

            const responseEmbed = new EmbedBuilder()
                .setDescription(responseMessage)
                .setColor(embedColor)
                .setFooter({ text: `Verified by ${interaction.user.displayName}` })
                .setTimestamp();

            await interaction.update({
                content: '✅ **Tracker Verification Complete**',
                embeds: [responseEmbed],
                components: []
            });
        } catch (error) {
            console.error('Error handling tracker verification:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the verification.',
                ephemeral: true
            });
        }
    }

    async notifyTrackersOfMissedDose(guild, medicine, schedule) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            const settings = await this.fileManager.readData(guild, 'settings.json');
            const timezone = settings.timezone || 'Asia/Kolkata';
            const dateKey = moment.tz(timezone).format('YYYY-MM-DD');

            const trackers = guild.members.cache.filter(member =>
                member.permissions.has('Administrator') && !member.user.bot
            );

            const embed = new EmbedBuilder()
                .setTitle('⚠️ Missed Dose Alert')
                .setColor(0xe74c3c)
                .setDescription('**Target missed their medicine dose**')
                .addFields(
                    { name: '👤 Target', value: `<@${schedule.target_id}>`, inline: true },
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '💉 Dosage', value: medicine.dosage, inline: true },
                    { name: '⏰ Time', value: moment.tz(timezone).format('HH:mm'), inline: true },
                    { name: '📅 Date', value: dateKey, inline: true },
                    { name: '📦 Inventory', value: `${medicine.inventory || 0} remaining`, inline: true }
                )
                .setFooter({ text: 'Trackers can verify the actual status below' })
                .setTimestamp();

            const verificationButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(buildVerifyId('taken', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('✅ Actually Taken')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(buildVerifyId('missed', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('❌ Confirm Missed')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(buildVerifyId('late', medicine.id, schedule.target_id, schedule.id, dateKey))
                        .setLabel('⏰ Taken Late')
                        .setStyle(ButtonStyle.Secondary)
                );

            const mentionTrackers = trackers.map(tracker => `<@${tracker.id}>`).join(' ');

            await logChannel.send({
                content: `🚨 **Missed Dose Alert** ${mentionTrackers}`,
                embeds: [embed],
                components: [verificationButtons]
            });
        } catch (error) {
            console.error('Error notifying trackers:', error);
        }
    }

    async scheduleSnoozeReminder(guild, medicine, schedule, dateKey, minutes) {
        try {
            setTimeout(async () => {
                const handled = await this.fileManager.isScheduleHandledToday(guild, schedule.id);
                if (handled) return;

                const reminderChannel = await this.fileManager.getReminderChannel(guild);
                if (!reminderChannel) return;

                const embed = new EmbedBuilder()
                    .setTitle('🔔 Snooze Reminder')
                    .setColor(0xf39c12)
                    .setDescription('**Snooze time is up! Time to take your medicine.**')
                    .addFields(
                        { name: '💊 Medicine', value: medicine.name, inline: true },
                        { name: '💉 Dosage', value: medicine.dosage, inline: true }
                    )
                    .setTimestamp();

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(buildReminderId('taken', medicine.id, schedule.target_id, schedule.id, dateKey))
                            .setLabel('✅ Taken')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(buildReminderId('missed', medicine.id, schedule.target_id, schedule.id, dateKey))
                            .setLabel('❌ Missed')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(buildReminderId('snooze', medicine.id, schedule.target_id, schedule.id, dateKey))
                            .setLabel('⏰ Snooze 15min')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await reminderChannel.send({
                    content: `<@${schedule.target_id}> 🔔 **Snooze Reminder**`,
                    embeds: [embed],
                    components: [buttons]
                });
            }, minutes * 60 * 1000);
        } catch (error) {
            console.error('Error scheduling snooze reminder:', error);
        }
    }

    async sendLowInventoryAlert(guild, medicine) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('📦 Low Inventory Alert')
                .setColor(0xf39c12)
                .setDescription('**Medicine inventory is running low**')
                .addFields(
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '📦 Remaining', value: `${medicine.inventory || 0} doses`, inline: true },
                    { name: '👤 Target', value: `<@${medicine.target_id}>`, inline: true }
                )
                .setFooter({ text: 'Please restock soon to avoid missing doses' })
                .setTimestamp();

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

    cleanupOldReminders() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        for (const [key, timestamp] of this.activeReminders.entries()) {
            if (timestamp < oneDayAgo) {
                this.activeReminders.delete(key);
            }
        }
    }

    async sendDailySummary(guild) {
        try {
            const logChannel = await this.fileManager.getLogChannel(guild);
            if (!logChannel) return;

            const settings = await this.fileManager.readData(guild, 'settings.json');
            const timezone = settings.timezone || 'Asia/Kolkata';
            const today = moment.tz(timezone).format('YYYY-MM-DD');

            const logs = await this.fileManager.readData(guild, 'logs.json');
            const todaysLogs = (logs.logs || []).filter(log => log.timestamp?.startsWith(today));

            const taken = todaysLogs.filter(log => TAKEN_TYPES.includes(log.type)).length;
            const missed = todaysLogs.filter(log => MISSED_TYPES.includes(log.type)).length;
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
