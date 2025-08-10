const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update-intake')
        .setDescription('Manually update medicine intake status (Tracker only)')
        .addStringOption(option =>
            option.setName('medicine_id')
                .setDescription('ID of the medicine')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Target user who took/missed the medicine')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Intake status')
                .setRequired(true)
                .addChoices(
                    { name: '✅ Taken (on time)', value: 'taken' },
                    { name: '⏰ Taken (late)', value: 'taken_late' },
                    { name: '❌ Missed', value: 'missed' },
                    { name: '🔄 Undo missed (was actually taken)', value: 'undo_missed' }
                ))
        .addStringOption(option =>
            option.setName('notes')
                .setDescription('Optional notes about the intake')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { medicineManager, fileManager }) {
        try {
            const medicineId = interaction.options.getString('medicine_id');
            const targetUser = interaction.options.getUser('target');
            const status = interaction.options.getString('status');
            const notes = interaction.options.getString('notes') || '';

            // Get medicine details
            const medicine = await medicineManager.getMedicineById(interaction.guild, medicineId);
            if (!medicine) {
                return await interaction.reply({
                    content: '❌ Medicine not found. Use `/medicine-manager` → **View All** to see available medicine IDs.',
                    ephemeral: true
                });
            }

            // Verify target is assigned to this medicine
            if (medicine.target_id !== targetUser.id) {
                return await interaction.reply({
                    content: `❌ Medicine ${medicine.name} is not assigned to ${targetUser.displayName}. It's assigned to <@${medicine.target_id}>.`,
                    ephemeral: true
                });
            }

            let responseMessage = '';
            let embedColor = 0x3498db;
            let logType = '';
            let inventoryChange = 0;

            switch (status) {
                case 'taken':
                    inventoryChange = -1;
                    logType = 'medicine_taken_manual';
                    responseMessage = `✅ **Intake Recorded: Taken On Time**\n💊 ${medicine.name}\n👤 Target: ${targetUser.displayName}\n📝 Manually recorded by tracker`;
                    embedColor = 0x2ecc71;
                    break;

                case 'taken_late':
                    inventoryChange = -1;
                    logType = 'medicine_taken_late_manual';
                    responseMessage = `⏰ **Intake Recorded: Taken Late**\n💊 ${medicine.name}\n👤 Target: ${targetUser.displayName}\n📝 Late intake recorded by tracker`;
                    embedColor = 0xf39c12;
                    break;

                case 'missed':
                    logType = 'medicine_missed_manual';
                    responseMessage = `❌ **Intake Recorded: Missed**\n💊 ${medicine.name}\n👤 Target: ${targetUser.displayName}\n📝 Missed dose recorded by tracker`;
                    embedColor = 0xe74c3c;
                    break;

                case 'undo_missed':
                    inventoryChange = -1;
                    logType = 'medicine_missed_corrected';
                    responseMessage = `🔄 **Correction: Previously Missed Dose Was Actually Taken**\n💊 ${medicine.name}\n👤 Target: ${targetUser.displayName}\n📝 Status corrected by tracker`;
                    embedColor = 0x9b59b6;
                    break;
            }

            // Update inventory if medicine was taken
            if (inventoryChange !== 0) {
                const success = await medicineManager.updateInventory(
                    interaction.guild, 
                    medicineId, 
                    inventoryChange, 
                    interaction.user.id
                );
                
                if (!success) {
                    return await interaction.reply({
                        content: '❌ Failed to update inventory. Please try again.',
                        ephemeral: true
                    });
                }
            }

            // Log the manual intake update
            await fileManager.logActivity(interaction.guild, {
                type: logType,
                medicine_id: medicineId,
                medicine_name: medicine.name,
                target_id: targetUser.id,
                target_name: targetUser.displayName,
                updated_by: interaction.user.id,
                updated_by_name: interaction.user.displayName,
                status: status,
                notes: notes,
                manual_entry: true,
                timestamp: new Date().toISOString(),
                message: `Manual intake update: ${status} for ${medicine.name}`
            });

            // Create response embed
            const embed = new EmbedBuilder()
                .setTitle('📝 Manual Intake Update')
                .setDescription(responseMessage)
                .setColor(embedColor)
                .addFields(
                    { name: '💊 Medicine', value: medicine.name, inline: true },
                    { name: '💉 Dosage', value: medicine.dosage, inline: true },
                    { name: '📦 Inventory', value: `${(medicine.inventory || 0) + inventoryChange} remaining`, inline: true }
                )
                .setFooter({ text: `Updated by ${interaction.user.displayName}` })
                .setTimestamp();

            if (notes) {
                embed.addFields({ name: '📝 Notes', value: notes, inline: false });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

            // Send notification to log channel for audit trail
            const logChannel = await fileManager.getLogChannel(interaction.guild);
            if (logChannel) {
                const auditEmbed = new EmbedBuilder()
                    .setTitle('📋 Manual Intake Update - Audit Log')
                    .setDescription(`**Tracker manually updated medicine intake status**`)
                    .addFields(
                        { name: '👨‍⚕️ Tracker', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '👤 Target', value: `<@${targetUser.id}>`, inline: true },
                        { name: '💊 Medicine', value: medicine.name, inline: true },
                        { name: '📊 Status', value: status.replace('_', ' '), inline: true },
                        { name: '⏰ Time', value: new Date().toLocaleString(), inline: true }
                    )
                    .setColor(embedColor)
                    .setTimestamp();

                if (notes) {
                    auditEmbed.addFields({ name: '📝 Notes', value: notes, inline: false });
                }

                await logChannel.send({ embeds: [auditEmbed] });
            }

        } catch (error) {
            console.error('Error in update-intake command:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the intake status.',
                ephemeral: true
            });
        }
    },
};
