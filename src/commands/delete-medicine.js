const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-medicine')
        .setDescription('Delete a medicine from tracking')
        .addStringOption(option =>
            option.setName('medicine_id')
                .setDescription('ID of the medicine to delete')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { medicineManager }) {
        try {
            const medicineId = interaction.options.getString('medicine_id');

            // Get medicine details before deletion
            const medicine = await medicineManager.getMedicineById(interaction.guild, medicineId);
            if (!medicine) {
                return await interaction.reply({
                    content: '❌ Medicine not found. Use `/medicine-manager` → **View All** to see available medicine IDs.',
                    ephemeral: true
                });
            }

            // Delete the medicine
            const success = await medicineManager.deleteMedicine(interaction.guild, medicineId, interaction.user.id);

            if (success) {
                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Medicine Deleted Successfully')
                    .setColor(0xe74c3c)
                    .addFields(
                        { name: '💊 Medicine Name', value: medicine.name, inline: true },
                        { name: '💉 Dosage', value: medicine.dosage, inline: true },
                        { name: '👤 Target', value: `<@${medicine.target_id}>`, inline: true },
                        { name: '🆔 Medicine ID', value: `\`${medicineId}\``, inline: true }
                    )
                    .setFooter({ text: 'Schedules were updated automatically' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: '❌ Failed to delete medicine. Please try again.',
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error in delete-medicine command:', error);
            await interaction.reply({
                content: '❌ An error occurred while deleting the medicine.',
                ephemeral: true
            });
        }
    },
};
