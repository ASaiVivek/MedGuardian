const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('medicine-manager')
        .setDescription('Manage medicines for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { medicineManager }) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🏥 Medicine Manager')
                .setColor(0x3498db)
                .setDescription('**Manage medicines for your server**\n\nUse the buttons below, or try `/add-medicine` for a guided form with dropdowns.')
                .addFields(
                    { name: '➕ Add', value: 'Add a new medicine', inline: true },
                    { name: '✏️ Edit', value: 'Select and edit a medicine', inline: true },
                    { name: '🗑️ Delete', value: 'Select and remove a medicine', inline: true },
                    { name: '📋 View All', value: 'List all medicines with IDs', inline: true },
                    { name: '⚡ Quick add', value: 'Use `/add-medicine` with dropdown menus', inline: true },
                    { name: '🔧 Quick edit', value: 'Use `/edit-medicine` with autocomplete', inline: true }
                )
                .setFooter({ text: 'Schedules regenerate automatically when medicines change' })
                .setTimestamp();

            const buttons = medicineManager.createMedicineManagementButtons();

            await interaction.reply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in medicine-manager command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading the medicine manager.',
                ephemeral: true
            });
        }
    }
};
