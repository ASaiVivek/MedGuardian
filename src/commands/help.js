const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help and documentation for MedGuardian'),

    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🏥 MedGuardian Help & Documentation')
                .setColor(0x3498db)
                .setDescription('**MedGuardian** is a Discord bot for tracking medicine schedules with configurable meal times.')
                .addFields(
                    {
                        name: '🚀 Getting Started',
                        value: '1. **Setup:** `/setup-medguardian` (Admin only)\n2. **Configure meal times:** `/schedule-settings`\n3. **Add medicines:** `/medicine-manager`\n4. **View your medicines:** `/my-medicines`',
                        inline: false
                    },
                    {
                        name: '👨‍⚕️ For Trackers (Admins)',
                        value: '• `/setup-medguardian` - Initialize bot for server\n• `/medicine-manager` - Add/edit/delete medicines\n• `/schedule-settings` - Configure meal times & schedules\n• Check #medicine-logs for missed dose alerts',
                        inline: false
                    },
                    {
                        name: '🎯 For Targets (Medicine Takers)',
                        value: '• `/my-medicines` - View your assigned medicines\n• Receive reminders in #medicine-reminders\n• Click buttons: ✅ Taken, ❌ Missed, ⏰ Snooze\n• Trackers get notified of missed doses',
                        inline: false
                    },
                    {
                        name: '⏰ Medicine Frequency Options',
                        value: '• `before_breakfast` - Before breakfast meal\n• `after_breakfast` - After breakfast meal\n• `before_lunch` - Before lunch meal\n• `after_lunch` - After lunch meal\n• `before_dinner` - Before dinner meal\n• `after_dinner` - After dinner meal',
                        inline: false
                    },
                    {
                        name: '📊 Features',
                        value: '✅ Configurable meal times per server\n✅ Multiple medicines per target\n✅ Inventory tracking with low stock alerts\n✅ Missed dose notifications to trackers\n✅ Snooze reminders (15 minutes)\n✅ Activity logging and daily summaries',
                        inline: false
                    },
                    {
                        name: '🔧 Data Storage',
                        value: 'All data is stored as JSON files in your server\'s #medicine-data channel. Your data stays in your Discord server - no external databases used.',
                        inline: false
                    }
                )
                .setFooter({ text: 'MedGuardian - Bring Your Own Sheet Medicine Tracking' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in help command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading help documentation.',
                ephemeral: true
            });
        }
    },
};
