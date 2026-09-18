const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { MEAL_FREQUENCIES, parseFrequencies, formatFrequency } = require('../constants/frequencies');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-medicine')
        .setDescription('Add a medicine with schedules')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Medicine name')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('dosage')
                .setDescription('Dosage (e.g., 1 tablet)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Who takes this medicine')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('inventory')
                .setDescription('Current stock count')
                .setRequired(true)
                .setMinValue(0))
        .addStringOption(option =>
            option.setName('frequency')
                .setDescription('Primary schedule')
                .setRequired(true)
                .addChoices(...MEAL_FREQUENCIES))
        .addStringOption(option =>
            option.setName('frequency_2')
                .setDescription('Additional schedule (optional)')
                .addChoices(...MEAL_FREQUENCIES))
        .addStringOption(option =>
            option.setName('frequency_3')
                .setDescription('Additional schedule (optional)')
                .addChoices(...MEAL_FREQUENCIES))
        .addStringOption(option =>
            option.setName('custom_time')
                .setDescription('Custom time in HH:MM (e.g., 08:00 for morning)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { medicineManager }) {
        try {
            const name = interaction.options.getString('name');
            const dosage = interaction.options.getString('dosage');
            const target = interaction.options.getUser('target');
            const inventory = interaction.options.getInteger('inventory');
            const customTime = interaction.options.getString('custom_time');

            const frequencies = [
                interaction.options.getString('frequency'),
                interaction.options.getString('frequency_2'),
                interaction.options.getString('frequency_3')
            ].filter(Boolean);

            if (customTime) {
                const { valid, invalid } = parseFrequencies(customTime);
                if (invalid.length > 0) {
                    return interaction.reply({
                        content: '❌ Custom time must be in HH:MM format (e.g., 08:00).',
                        ephemeral: true
                    });
                }
                frequencies.push(...valid);
            }

            const uniqueFrequencies = [...new Set(frequencies)];

            const medicineData = {
                name,
                dosage,
                frequency: uniqueFrequencies,
                inventory,
                target_id: target.id,
                added_by: interaction.user.id
            };

            const newMedicine = await medicineManager.addMedicine(interaction.guild, medicineData);

            if (!newMedicine) {
                return interaction.reply({
                    content: '❌ Failed to add medicine. Please try again.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Medicine Added')
                .setColor(0x2ecc71)
                .addFields(
                    { name: '💊 Name', value: name, inline: true },
                    { name: '💉 Dosage', value: dosage, inline: true },
                    { name: '👤 Target', value: `<@${target.id}>`, inline: true },
                    { name: '⏰ Schedule', value: formatFrequency(uniqueFrequencies), inline: false },
                    { name: '📦 Inventory', value: String(inventory), inline: true },
                    { name: '🆔 ID', value: `\`${newMedicine.id}\``, inline: true }
                )
                .setFooter({ text: 'Reminders will be sent automatically at scheduled times' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error in add-medicine command:', error);
            await interaction.reply({
                content: '❌ An error occurred while adding the medicine.',
                ephemeral: true
            });
        }
    }
};
