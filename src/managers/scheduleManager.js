const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const moment = require('moment-timezone');

class ScheduleManager {
    constructor(fileManager) {
        this.fileManager = fileManager;
    }

    /**
     * Get all schedules for a guild
     */
    async getSchedules(guild) {
        const data = await this.fileManager.readData(guild, 'schedules.json');
        return data.schedules || [];
    }

    /**
     * Get guild settings including meal times
     */
    async getSettings(guild) {
        const data = await this.fileManager.readData(guild, 'settings.json');
        return data;
    }

    /**
     * Update guild settings
     */
    async updateSettings(guild, updates, updatedBy) {
        try {
            const settings = await this.getSettings(guild);
            const updatedSettings = {
                ...settings,
                ...updates,
                updated_at: new Date().toISOString(),
                updated_by: updatedBy
            };

            const success = await this.fileManager.writeData(guild, 'settings.json', updatedSettings);

            if (success) {
                await this.fileManager.logActivity(guild, {
                    type: 'settings_updated',
                    updated_by: updatedBy,
                    changes: updates,
                    message: 'Guild settings updated'
                });
            }

            return success;
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }

    /**
     * Generate schedules for all medicines
     */
    async generateSchedules(guild) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');
            const settings = await this.getSettings(guild);
            const schedules = [];

            for (const medicine of medicines.medicines) {
                if (!medicine.frequency || !Array.isArray(medicine.frequency)) continue;

                for (const freq of medicine.frequency) {
                    const schedule = this.createScheduleFromFrequency(medicine, freq, settings);
                    if (schedule) {
                        schedules.push(schedule);
                    }
                }
            }

            const scheduleData = {
                version: '1.0',
                guild_id: guild.id,
                generated_at: new Date().toISOString(),
                schedules: schedules
            };

            await this.fileManager.writeData(guild, 'schedules.json', scheduleData);
            return true;
        } catch (error) {
            console.error('Error generating schedules:', error);
            return false;
        }
    }

    /**
     * Create schedule entry from frequency and settings
     */
    createScheduleFromFrequency(medicine, frequency, settings) {
        const mealTimes = settings.meal_times;
        const timezone = settings.timezone || 'Asia/Kolkata';
        const advanceMinutes = settings.reminder_advance_minutes || 15;

        let mealTime, timing;
        
        if (frequency.startsWith('before_')) {
            timing = 'before';
            mealTime = frequency.replace('before_', '');
        } else if (frequency.startsWith('after_')) {
            timing = 'after';
            mealTime = frequency.replace('after_', '');
        } else {
            return null;
        }

        if (!mealTimes[mealTime]) {
            return null;
        }

        // Calculate reminder time
        let reminderTime;
        if (timing === 'before') {
            // Remind 15 minutes before meal start time
            reminderTime = moment.tz(mealTimes[mealTime].start, 'HH:mm', timezone)
                .subtract(advanceMinutes, 'minutes')
                .format('HH:mm');
        } else {
            // Remind at meal end time (after meal)
            reminderTime = mealTimes[mealTime].end;
        }

        return {
            id: `sched_${medicine.id}_${frequency}`,
            medicine_id: medicine.id,
            medicine_name: medicine.name,
            target_id: medicine.target_id,
            frequency: frequency,
            meal_time: mealTime,
            timing: timing,
            reminder_time: reminderTime,
            timezone: timezone,
            active: true,
            created_at: new Date().toISOString()
        };
    }

    /**
     * Get today's schedules for reminders
     */
    async getTodaysSchedules(guild) {
        const schedules = await this.getSchedules(guild);
        const settings = await this.getSettings(guild);
        const timezone = settings.timezone || 'Asia/Kolkata';
        const now = moment.tz(timezone);
        
        return schedules.filter(schedule => {
            if (!schedule.active) return false;
            
            const reminderTime = moment.tz(schedule.reminder_time, 'HH:mm', timezone);
            const timeDiff = Math.abs(now.diff(reminderTime, 'minutes'));
            
            // Return schedules that should be reminded within 1 minute window
            return timeDiff <= 1;
        });
    }

    /**
     * Get schedules for a specific target
     */
    async getSchedulesForTarget(guild, targetId) {
        const schedules = await this.getSchedules(guild);
        return schedules.filter(schedule => schedule.target_id === targetId);
    }

    /**
     * Create meal times configuration modal
     */
    createMealTimesModal(currentSettings) {
        const modal = new ModalBuilder()
            .setCustomId('schedule_meal_times_modal')
            .setTitle('Configure Meal Times');

        const breakfastInput = new TextInputBuilder()
            .setCustomId('breakfast_times')
            .setLabel('Breakfast Time Range (HH:MM-HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('07:00-10:00')
            .setValue(`${currentSettings.meal_times.breakfast.start}-${currentSettings.meal_times.breakfast.end}`)
            .setRequired(true);

        const lunchInput = new TextInputBuilder()
            .setCustomId('lunch_times')
            .setLabel('Lunch Time Range (HH:MM-HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('12:00-14:00')
            .setValue(`${currentSettings.meal_times.lunch.start}-${currentSettings.meal_times.lunch.end}`)
            .setRequired(true);

        const dinnerInput = new TextInputBuilder()
            .setCustomId('dinner_times')
            .setLabel('Dinner Time Range (HH:MM-HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('19:00-21:00')
            .setValue(`${currentSettings.meal_times.dinner.start}-${currentSettings.meal_times.dinner.end}`)
            .setRequired(true);

        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Timezone')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Asia/Kolkata')
            .setValue(currentSettings.timezone || 'Asia/Kolkata')
            .setRequired(true);

        const advanceInput = new TextInputBuilder()
            .setCustomId('advance_minutes')
            .setLabel('Reminder Advance Time (minutes)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('15')
            .setValue((currentSettings.reminder_advance_minutes || 15).toString())
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(breakfastInput),
            new ActionRowBuilder().addComponents(lunchInput),
            new ActionRowBuilder().addComponents(dinnerInput),
            new ActionRowBuilder().addComponents(timezoneInput),
            new ActionRowBuilder().addComponents(advanceInput)
        );

        return modal;
    }

    /**
     * Create schedule settings embed
     */
    async createScheduleSettingsEmbed(guild) {
        const settings = await this.getSettings(guild);
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Schedule Settings')
            .setColor(0x3498db)
            .addFields(
                {
                    name: '🌅 Breakfast',
                    value: `${settings.meal_times.breakfast.start} - ${settings.meal_times.breakfast.end}`,
                    inline: true
                },
                {
                    name: '🌞 Lunch', 
                    value: `${settings.meal_times.lunch.start} - ${settings.meal_times.lunch.end}`,
                    inline: true
                },
                {
                    name: '🌙 Dinner',
                    value: `${settings.meal_times.dinner.start} - ${settings.meal_times.dinner.end}`,
                    inline: true
                },
                {
                    name: '🌍 Timezone',
                    value: settings.timezone || 'Asia/Kolkata',
                    inline: true
                },
                {
                    name: '⏰ Reminder Advance',
                    value: `${settings.reminder_advance_minutes || 15} minutes`,
                    inline: true
                }
            )
            .setTimestamp();

        return embed;
    }

    /**
     * Create schedule management buttons
     */
    createScheduleManagementButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('configure_meal_times')
                    .setLabel('⚙️ Configure Meal Times')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('regenerate_schedules')
                    .setLabel('🔄 Regenerate Schedules')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('view_schedules')
                    .setLabel('📅 View All Schedules')
                    .setStyle(ButtonStyle.Success)
            );
    }

    /**
     * Handle modal submissions
     */
    async handleModalSubmit(interaction) {
        if (interaction.customId === 'schedule_meal_times_modal') {
            await this.handleMealTimesModal(interaction);
        }
    }

    /**
     * Handle meal times configuration modal
     */
    async handleMealTimesModal(interaction) {
        try {
            const breakfastTimes = interaction.fields.getTextInputValue('breakfast_times');
            const lunchTimes = interaction.fields.getTextInputValue('lunch_times');
            const dinnerTimes = interaction.fields.getTextInputValue('dinner_times');
            const timezone = interaction.fields.getTextInputValue('timezone');
            const advanceMinutes = parseInt(interaction.fields.getTextInputValue('advance_minutes'));

            // Parse time ranges
            const parseTimeRange = (timeRange) => {
                const [start, end] = timeRange.split('-').map(t => t.trim());
                if (!start || !end) throw new Error('Invalid time range format');
                
                // Validate time format
                if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
                    throw new Error('Time must be in HH:MM format');
                }
                
                return { start, end };
            };

            const mealTimes = {
                breakfast: parseTimeRange(breakfastTimes),
                lunch: parseTimeRange(lunchTimes),
                dinner: parseTimeRange(dinnerTimes)
            };

            // Validate timezone
            if (!moment.tz.zone(timezone)) {
                return await interaction.reply({
                    content: '❌ Invalid timezone. Please use a valid timezone like Asia/Kolkata, America/New_York, etc.',
                    ephemeral: true
                });
            }

            // Validate advance minutes
            if (isNaN(advanceMinutes) || advanceMinutes < 0 || advanceMinutes > 60) {
                return await interaction.reply({
                    content: '❌ Reminder advance time must be a number between 0 and 60 minutes.',
                    ephemeral: true
                });
            }

            const updates = {
                meal_times: mealTimes,
                timezone: timezone,
                reminder_advance_minutes: advanceMinutes
            };

            const success = await this.updateSettings(interaction.guild, updates, interaction.user.id);

            if (success) {
                // Regenerate schedules with new settings
                await this.generateSchedules(interaction.guild);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Meal Times Updated Successfully')
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: '🌅 Breakfast', value: `${mealTimes.breakfast.start} - ${mealTimes.breakfast.end}`, inline: true },
                        { name: '🌞 Lunch', value: `${mealTimes.lunch.start} - ${mealTimes.lunch.end}`, inline: true },
                        { name: '🌙 Dinner', value: `${mealTimes.dinner.start} - ${mealTimes.dinner.end}`, inline: true },
                        { name: '🌍 Timezone', value: timezone, inline: true },
                        { name: '⏰ Reminder Advance', value: `${advanceMinutes} minutes`, inline: true }
                    )
                    .setFooter({ text: 'Schedules have been regenerated with new settings' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update meal times. Please try again.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error handling meal times modal:', error);
            await interaction.reply({
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            });
        }
    }

    /**
     * Create schedules list embed
     */
    async createSchedulesListEmbed(guild) {
        const schedules = await this.getSchedules(guild);
        const settings = await this.getSettings(guild);

        const embed = new EmbedBuilder()
            .setTitle('📅 Medicine Schedules')
            .setColor(0x3498db)
            .setTimestamp();

        if (schedules.length === 0) {
            embed.setDescription('No schedules found. Add medicines first, then generate schedules.');
            return embed;
        }

        // Group schedules by target
        const schedulesByTarget = {};
        for (const schedule of schedules) {
            if (!schedulesByTarget[schedule.target_id]) {
                schedulesByTarget[schedule.target_id] = [];
            }
            schedulesByTarget[schedule.target_id].push(schedule);
        }

        let description = '';
        for (const [targetId, targetSchedules] of Object.entries(schedulesByTarget)) {
            description += `\n**👤 <@${targetId}>**\n`;
            
            targetSchedules.forEach(schedule => {
                const status = schedule.active ? '✅' : '❌';
                description += `${status} **${schedule.medicine_name}**\n`;
                description += `   ⏰ ${schedule.reminder_time} (${schedule.frequency.replace(/_/g, ' ')})\n`;
            });
        }

        embed.setDescription(description);
        embed.setFooter({ text: `Timezone: ${settings.timezone || 'Asia/Kolkata'}` });

        return embed;
    }

    /**
     * Mark schedule as completed for today
     */
    async markScheduleCompleted(guild, scheduleId, completedBy) {
        try {
            await this.fileManager.logActivity(guild, {
                type: 'medicine_taken',
                schedule_id: scheduleId,
                completed_by: completedBy,
                completed_at: new Date().toISOString(),
                message: 'Medicine taken as scheduled'
            });

            return true;
        } catch (error) {
            console.error('Error marking schedule completed:', error);
            return false;
        }
    }

    /**
     * Mark schedule as missed
     */
    async markScheduleMissed(guild, scheduleId, targetId, medicineName) {
        try {
            await this.fileManager.logActivity(guild, {
                type: 'medicine_missed',
                schedule_id: scheduleId,
                target_id: targetId,
                target_name: `<@${targetId}>`,
                medicine_name: medicineName,
                missed_at: new Date().toISOString(),
                message: 'Medicine dose missed'
            });

            return true;
        } catch (error) {
            console.error('Error marking schedule missed:', error);
            return false;
        }
    }
}

module.exports = ScheduleManager;
