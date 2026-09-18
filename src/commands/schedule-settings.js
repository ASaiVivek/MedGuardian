const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule-settings')
        .setDescription('Configure meal times and schedule settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { scheduleManager }) {
        try {
            const embed = await scheduleManager.createScheduleSettingsEmbed(interaction.guild);
            const buttons = scheduleManager.createScheduleManagementButtons();

            await interaction.reply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in schedule-settings command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading schedule settings.',
                ephemeral: true
            });
        }
    }
};
