const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help and documentation for MedGuardian'),

    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🏥 MedGuardian Help')
                .setColor(0x3498db)
                .setDescription('Track medicine schedules in Discord with meal-time reminders and daily compliance.')
                .addFields(
                    {
                        name: '🚀 Getting Started',
                        value: '1. `/setup-medguardian` — set up channels and roles\n2. `/schedule-settings` — configure meal times\n3. `/add-medicine` — add medicines with dropdowns\n4. `/my-medicines` — see your schedule and today\'s status',
                        inline: false
                    },
                    {
                        name: '👨‍⚕️ Tracker Commands (Admin)',
                        value: '• `/add-medicine` — guided add with user picker\n• `/edit-medicine` — edit with autocomplete\n• `/medicine-manager` — button-based management\n• `/schedule-settings` — meal times and schedules\n• `/update-intake` — manually correct intake\n• `/delete-medicine` — remove a medicine',
                        inline: false
                    },
                    {
                        name: '🎯 Target Commands',
                        value: '• `/my-medicines` — view medicines and today\'s status (✅ taken, ⏳ pending, ❌ missed)\n• Respond to reminders in #medicine-reminders with buttons',
                        inline: false
                    },
                    {
                        name: '⏰ Schedule Options',
                        value: '**Meal-based:** before/after breakfast, lunch, dinner\n**Custom time:** use `08:00` or `custom_22:00` for fixed times (e.g., bedtime vitamins)',
                        inline: false
                    },
                    {
                        name: '📊 Automatic Features',
                        value: '✅ Reminders at scheduled times\n✅ One reminder per dose per day\n✅ Low inventory alerts\n✅ Missed dose alerts to trackers\n✅ Daily summary at 9 PM server timezone\n✅ Snooze for 15 minutes',
                        inline: false
                    }
                )
                .setFooter({ text: 'All data stays in your Discord server — no external database' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in help command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading help documentation.',
                ephemeral: true
            });
        }
    }
};
