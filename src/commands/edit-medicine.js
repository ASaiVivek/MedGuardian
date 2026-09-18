const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { MEAL_FREQUENCIES, parseFrequencies, formatFrequency } = require('../constants/frequencies');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-medicine')
        .setDescription('Edit an existing medicine')
        .addStringOption(option =>
            option.setName('medicine')
                .setDescription('Medicine to edit')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New medicine name'))
        .addStringOption(option =>
            option.setName('dosage')
                .setDescription('New dosage'))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('New target user'))
        .addIntegerOption(option =>
            option.setName('inventory')
                .setDescription('Updated stock count')
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('frequency')
                .setDescription('Replace all schedules with this primary one')
                .addChoices(...MEAL_FREQUENCIES))
        .addStringOption(option =>
            option.setName('frequency_2')
                .setDescription('Additional schedule')
                .addChoices(...MEAL_FREQUENCIES))
        .addStringOption(option =>
            option.setName('custom_time')
                .setDescription('Custom time in HH:MM (replaces schedules if used alone)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction, { medicineManager }) {
        const focused = interaction.options.getFocused().toLowerCase();
        const medicines = await medicineManager.getMedicines(interaction.guild);

        const choices = medicines
            .filter(med => med.name.toLowerCase().includes(focused) || med.id.includes(focused))
            .slice(0, 25)
            .map(med => ({
                name: `${med.name} (${med.dosage})`.slice(0, 100),
                value: med.id
            }));

        await interaction.respond(choices);
    },

    async execute(interaction, { medicineManager }) {
        try {
            const medicineId = interaction.options.getString('medicine');
            const existing = await medicineManager.getMedicineById(interaction.guild, medicineId);

            if (!existing) {
                return interaction.reply({
                    content: '❌ Medicine not found.',
                    ephemeral: true
                });
            }

            const updates = { updated_by: interaction.user.id };
            let hasChanges = false;

            const name = interaction.options.getString('name');
            const dosage = interaction.options.getString('dosage');
            const target = interaction.options.getUser('target');
            const inventory = interaction.options.getInteger('inventory');
            const customTime = interaction.options.getString('custom_time');

            if (name) { updates.name = name; hasChanges = true; }
            if (dosage) { updates.dosage = dosage; hasChanges = true; }
            if (target) { updates.target_id = target.id; hasChanges = true; }
            if (inventory !== null) { updates.inventory = inventory; hasChanges = true; }

            const freq1 = interaction.options.getString('frequency');
            const freq2 = interaction.options.getString('frequency_2');
            if (freq1 || freq2 || customTime) {
                const frequencies = [freq1, freq2].filter(Boolean);
                if (customTime) {
                    const { valid, invalid } = parseFrequencies(customTime);
                    if (invalid.length > 0) {
                        return interaction.reply({
                            content: '❌ Custom time must be in HH:MM format.',
                            ephemeral: true
                        });
                    }
                    frequencies.push(...valid);
                }
                if (frequencies.length === 0) {
                    return interaction.reply({
                        content: '❌ Provide at least one frequency when updating schedules.',
                        ephemeral: true
                    });
                }
                updates.frequency = [...new Set(frequencies)];
                hasChanges = true;
            }

            if (!hasChanges) {
                return interaction.reply({
                    content: '❌ No changes provided. Specify at least one field to update.',
                    ephemeral: true
                });
            }

            const success = await medicineManager.updateMedicine(interaction.guild, medicineId, updates);

            if (!success) {
                return interaction.reply({
                    content: '❌ Failed to update medicine.',
                    ephemeral: true
                });
            }

            const updated = await medicineManager.getMedicineById(interaction.guild, medicineId);
            const embed = new EmbedBuilder()
                .setTitle('✅ Medicine Updated')
                .setColor(0x2ecc71)
                .addFields(
                    { name: '💊 Name', value: updated.name, inline: true },
                    { name: '💉 Dosage', value: updated.dosage, inline: true },
                    { name: '👤 Target', value: `<@${updated.target_id}>`, inline: true },
                    { name: '⏰ Schedule', value: formatFrequency(updated.frequency), inline: false },
                    { name: '📦 Inventory', value: String(updated.inventory || 0), inline: true }
                )
                .setFooter({ text: 'Schedules were regenerated automatically' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in edit-medicine command:', error);
            await interaction.reply({
                content: '❌ An error occurred while editing the medicine.',
                ephemeral: true
            });
        }
    }
};
