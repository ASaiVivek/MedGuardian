const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule-settings')
        .setDescription('Configure meal times and schedule settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { scheduleManager }) {
        try {
            const settings = await scheduleManager.getSettings(interaction.guild);
            const embed = await scheduleManager.createScheduleSettingsEmbed(interaction.guild);
            const buttons = scheduleManager.createScheduleManagementButtons();

            await interaction.reply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });

            // Handle button interactions
            const collector = interaction.channel.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (buttonInteraction) => {
                try {
                    switch (buttonInteraction.customId) {
                        case 'configure_meal_times':
                            const modal = scheduleManager.createMealTimesModal(settings);
                            await buttonInteraction.showModal(modal);
                            break;

                        case 'regenerate_schedules':
                            await buttonInteraction.deferReply({ ephemeral: true });
                            const success = await scheduleManager.generateSchedules(interaction.guild);
                            
                            if (success) {
                                await buttonInteraction.editReply({
                                    content: '✅ **Schedules Regenerated Successfully!**\n\nAll medicine schedules have been updated based on current settings and medicines.'
                                });
                            } else {
                                await buttonInteraction.editReply({
                                    content: '❌ Failed to regenerate schedules. Please try again.'
                                });
                            }
                            break;

                        case 'view_schedules':
                            const schedulesEmbed = await scheduleManager.createSchedulesListEmbed(interaction.guild);
                            await buttonInteraction.reply({ embeds: [schedulesEmbed], ephemeral: true });
                            break;
                    }
                } catch (error) {
                    console.error('Error handling schedule button interaction:', error);
                    await buttonInteraction.reply({
                        content: '❌ An error occurred. Please try again.',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', () => {
                // Disable buttons after timeout
                const disabledButtons = new ActionRowBuilder()
                    .addComponents(
                        buttons.components.map(button => 
                            ButtonBuilder.from(button).setDisabled(true)
                        )
                    );

                interaction.editReply({ components: [disabledButtons] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in schedule-settings command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading schedule settings.',
                ephemeral: true
            });
        }
    },
};
