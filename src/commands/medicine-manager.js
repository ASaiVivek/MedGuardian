const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
                .setDescription('**Manage medicines for your server**\n\nSelect an action below to get started:')
                .addFields(
                    {
                        name: '➕ Add Medicine',
                        value: 'Add a new medicine with dosage, frequency, and target',
                        inline: true
                    },
                    {
                        name: '✏️ Edit Medicine',
                        value: 'Modify existing medicine details',
                        inline: true
                    },
                    {
                        name: '🗑️ Delete Medicine',
                        value: 'Remove a medicine from tracking',
                        inline: true
                    },
                    {
                        name: '📋 View All',
                        value: 'Display all medicines in this server',
                        inline: true
                    }
                )
                .setFooter({ text: 'Only administrators can manage medicines' })
                .setTimestamp();

            const buttons = medicineManager.createMedicineManagementButtons();

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
                        case 'add_medicine':
                            const modal = medicineManager.createAddMedicineModal();
                            await buttonInteraction.showModal(modal);
                            break;

                        case 'view_medicines':
                            const listEmbed = await medicineManager.createMedicineListEmbed(interaction.guild);
                            await buttonInteraction.reply({ embeds: [listEmbed], ephemeral: true });
                            break;

                        case 'edit_medicine':
                            await buttonInteraction.reply({
                                content: '✏️ **Edit Medicine**\n\nTo edit a medicine, use the command:\n`/edit-medicine <medicine_id> <field> <new_value>`\n\nUse `/medicine-manager` → **View All** to see medicine IDs.',
                                ephemeral: true
                            });
                            break;

                        case 'delete_medicine':
                            await buttonInteraction.reply({
                                content: '🗑️ **Delete Medicine**\n\nTo delete a medicine, use the command:\n`/delete-medicine <medicine_id>`\n\nUse `/medicine-manager` → **View All** to see medicine IDs.',
                                ephemeral: true
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Error handling button interaction:', error);
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
            console.error('Error in medicine-manager command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading the medicine manager.',
                ephemeral: true
            });
        }
    },
};
