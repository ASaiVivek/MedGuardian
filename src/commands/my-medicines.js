const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatFrequency } = require('../constants/frequencies');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('my-medicines')
        .setDescription('View your assigned medicines, schedules, and today\'s status'),

    async execute(interaction, { medicineManager, scheduleManager, fileManager }) {
        try {
            const targetId = interaction.user.id;
            const medicines = await medicineManager.getMedicinesForTarget(interaction.guild, targetId);
            const settings = await scheduleManager.getSettings(interaction.guild);
            const timezone = settings.timezone || 'Asia/Kolkata';

            if (medicines.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('💊 My Medicines')
                    .setColor(0x95a5a6)
                    .setDescription('**No medicines assigned to you.**\n\nAsk your tracker (server admin) to add medicines using `/add-medicine`.')
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const schedules = await scheduleManager.getSchedulesForTarget(interaction.guild, targetId);
            const todaysIntake = await fileManager.getTodaysIntakeSummary(interaction.guild, targetId, timezone);

            const takenCount = todaysIntake.filter(l => l.type.includes('taken')).length;
            const missedCount = todaysIntake.filter(l => l.type.includes('missed')).length;

            const embed = new EmbedBuilder()
                .setTitle('💊 My Medicines')
                .setColor(0x3498db)
                .setDescription(`**${medicines.length} medicine(s) assigned** — Today: ✅ ${takenCount} taken, ❌ ${missedCount} missed`)
                .setTimestamp();

            for (let i = 0; i < medicines.length; i++) {
                const medicine = medicines[i];
                const medicineSchedules = schedules.filter(s => s.medicine_id === medicine.id);

                let scheduleText = 'No active schedules';
                if (medicineSchedules.length > 0) {
                    const lines = [];
                    for (const schedule of medicineSchedules) {
                        const intake = await fileManager.getScheduleIntakeToday(
                            interaction.guild,
                            schedule.id,
                            timezone
                        );
                        const statusIcon = intake?.status === 'taken' ? '✅'
                            : intake?.status === 'missed' ? '❌'
                            : '⏳';
                        lines.push(`${statusIcon} ${schedule.reminder_time} — ${formatFrequency([schedule.frequency])}`);
                    }
                    scheduleText = lines.join('\n');
                }

                const inventoryStatus = medicine.inventory <= 0 ? '❌ Out of stock'
                    : medicine.inventory <= 5 ? '⚠️ Low stock'
                    : medicine.inventory <= 15 ? '🟡 Medium stock' : '✅ Good stock';

                embed.addFields({
                    name: `${i + 1}. ${medicine.name}`,
                    value: `💉 **Dosage:** ${medicine.dosage}\n📦 **Inventory:** ${medicine.inventory || 0} (${inventoryStatus})\n📅 **Today:**\n${scheduleText}`,
                    inline: false
                });
            }

            embed.addFields({
                name: '📱 How to respond to reminders',
                value: 'In #medicine-reminders, tap ✅ **Taken**, ❌ **Missed**, or ⏰ **Snooze** when you get a reminder.',
                inline: false
            });

            embed.setFooter({
                text: `Timezone: ${timezone} | ⏳ = pending today`
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in my-medicines command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching your medicines.',
                ephemeral: true
            });
        }
    }
};
