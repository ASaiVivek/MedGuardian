const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('my-medicines')
        .setDescription('View your assigned medicines and schedules'),

    async execute(interaction, { medicineManager, scheduleManager }) {
        try {
            const targetId = interaction.user.id;
            const medicines = await medicineManager.getMedicinesForTarget(interaction.guild, targetId);

            if (medicines.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('💊 My Medicines')
                    .setColor(0x95a5a6)
                    .setDescription('**No medicines assigned to you.**\n\nContact your tracker (server admin) to add medicines for you.')
                    .setTimestamp();

                return await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('💊 My Medicines')
                .setColor(0x3498db)
                .setDescription(`**You have ${medicines.length} medicine(s) assigned:**`)
                .setTimestamp();

            // Get schedules for this target
            const schedules = await scheduleManager.getSchedulesForTarget(interaction.guild, targetId);
            const settings = await scheduleManager.getSettings(interaction.guild);

            for (let i = 0; i < medicines.length; i++) {
                const medicine = medicines[i];
                const medicineSchedules = schedules.filter(s => s.medicine_id === medicine.id);
                
                let scheduleText = 'No active schedules';
                if (medicineSchedules.length > 0) {
                    scheduleText = medicineSchedules.map(s => 
                        `⏰ ${s.reminder_time} (${s.frequency.replace(/_/g, ' ')})`
                    ).join('\n');
                }

                const inventoryStatus = medicine.inventory <= 0 ? '❌ Out of stock' :
                                     medicine.inventory <= 5 ? '⚠️ Low stock' :
                                     medicine.inventory <= 15 ? '🟡 Medium stock' : '✅ Good stock';

                embed.addFields({
                    name: `${i + 1}. ${medicine.name}`,
                    value: `💉 **Dosage:** ${medicine.dosage}\n📦 **Inventory:** ${medicine.inventory || 0} (${inventoryStatus})\n📅 **Schedule:**\n${scheduleText}`,
                    inline: false
                });
            }

            embed.addFields({
                name: '📱 How to Use',
                value: '• You\'ll receive reminders in #medicine-reminders\n• Click ✅ **Taken** when you take medicine\n• Click ❌ **Missed** if you miss a dose\n• Click ⏰ **Snooze** to be reminded in 15 minutes',
                inline: false
            });

            embed.setFooter({ 
                text: `Timezone: ${settings.timezone || 'Asia/Kolkata'} | Use /my-medicines to refresh` 
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in my-medicines command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching your medicines.',
                ephemeral: true
            });
        }
    },
};
