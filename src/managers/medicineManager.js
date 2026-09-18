const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { parseFrequencies, formatFrequency, MEAL_FREQUENCY_VALUES } = require('../constants/frequencies');

class MedicineManager {
    constructor(fileManager, scheduleManager = null) {
        this.fileManager = fileManager;
        this.scheduleManager = scheduleManager;
    }

    setScheduleManager(scheduleManager) {
        this.scheduleManager = scheduleManager;
    }

    async getMedicines(guild) {
        const data = await this.fileManager.readData(guild, 'medicines.json');
        return data.medicines || [];
    }

    async addMedicine(guild, medicineData) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');

            const newMedicine = {
                id: `med_${Date.now()}`,
                created_at: new Date().toISOString(),
                notes: '',
                low_stock_threshold: null,
                ...medicineData
            };

            medicines.medicines.push(newMedicine);
            medicines.guild_id = guild.id;

            const success = await this.fileManager.writeData(guild, 'medicines.json', medicines);

            if (success) {
                await this.fileManager.logActivity(guild, {
                    type: 'medicine_added',
                    medicine_id: newMedicine.id,
                    medicine_name: newMedicine.name,
                    added_by: medicineData.added_by,
                    message: `Medicine ${newMedicine.name} added`
                });
                await this.regenerateSchedules(guild);
            }

            return success ? newMedicine : null;
        } catch (error) {
            console.error('Error adding medicine:', error);
            return null;
        }
    }

    async updateMedicine(guild, medicineId, updates) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');
            const medicineIndex = medicines.medicines.findIndex(med => med.id === medicineId);

            if (medicineIndex === -1) {
                return false;
            }

            const oldMedicine = { ...medicines.medicines[medicineIndex] };
            medicines.medicines[medicineIndex] = {
                ...medicines.medicines[medicineIndex],
                ...updates,
                updated_at: new Date().toISOString()
            };

            const success = await this.fileManager.writeData(guild, 'medicines.json', medicines);

            if (success) {
                await this.fileManager.logActivity(guild, {
                    type: 'medicine_updated',
                    medicine_id: medicineId,
                    medicine_name: medicines.medicines[medicineIndex].name,
                    updated_by: updates.updated_by,
                    changes: this.getChanges(oldMedicine, medicines.medicines[medicineIndex]),
                    message: `Medicine ${medicines.medicines[medicineIndex].name} updated`
                });
                await this.regenerateSchedules(guild);
            }

            return success;
        } catch (error) {
            console.error('Error updating medicine:', error);
            return false;
        }
    }

    async deleteMedicine(guild, medicineId, deletedBy) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');
            const medicineIndex = medicines.medicines.findIndex(med => med.id === medicineId);

            if (medicineIndex === -1) {
                return false;
            }

            const deletedMedicine = medicines.medicines[medicineIndex];
            medicines.medicines.splice(medicineIndex, 1);

            const success = await this.fileManager.writeData(guild, 'medicines.json', medicines);

            if (success) {
                await this.fileManager.logActivity(guild, {
                    type: 'medicine_deleted',
                    medicine_id: medicineId,
                    medicine_name: deletedMedicine.name,
                    deleted_by: deletedBy,
                    message: `Medicine ${deletedMedicine.name} deleted`
                });
                await this.regenerateSchedules(guild);
            }

            return success;
        } catch (error) {
            console.error('Error deleting medicine:', error);
            return false;
        }
    }

    async regenerateSchedules(guild) {
        if (!this.scheduleManager) return;
        try {
            await this.scheduleManager.generateSchedules(guild);
        } catch (error) {
            console.error('Error regenerating schedules:', error);
        }
    }

    async getMedicineById(guild, medicineId) {
        const medicines = await this.getMedicines(guild);
        return medicines.find(med => med.id === medicineId);
    }

    async getMedicinesForTarget(guild, targetId) {
        const medicines = await this.getMedicines(guild);
        return medicines.filter(med => med.target_id === targetId);
    }

    async updateInventory(guild, medicineId, change, updatedBy, notificationManager = null) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');
            const medicineIndex = medicines.medicines.findIndex(med => med.id === medicineId);
            if (medicineIndex === -1) return false;

            const medicine = medicines.medicines[medicineIndex];
            const settings = this.scheduleManager
                ? await this.scheduleManager.getSettings(guild)
                : await this.fileManager.readData(guild, 'settings.json');
            const threshold = medicine.low_stock_threshold ?? settings.low_inventory_threshold ?? 5;

            const newInventory = Math.max(0, (medicine.inventory || 0) + change);
            medicines.medicines[medicineIndex].inventory = newInventory;
            medicines.medicines[medicineIndex].updated_at = new Date().toISOString();

            const success = await this.fileManager.writeData(guild, 'medicines.json', medicines);

            if (success && newInventory <= threshold && newInventory > 0) {
                await this.fileManager.logActivity(guild, {
                    type: 'inventory_low',
                    medicine_id: medicineId,
                    medicine_name: medicine.name,
                    remaining_count: newInventory,
                    message: `Low inventory alert for ${medicine.name}`
                });

                if (notificationManager) {
                    const updatedMedicine = await this.getMedicineById(guild, medicineId);
                    await notificationManager.sendLowInventoryAlert(guild, updatedMedicine);
                }
            }

            return success;
        } catch (error) {
            console.error('Error updating inventory:', error);
            return false;
        }
    }

    async createMedicineListEmbed(guild, targetId = null) {
        const medicines = targetId
            ? await this.getMedicinesForTarget(guild, targetId)
            : await this.getMedicines(guild);

        const embed = new EmbedBuilder()
            .setTitle('💊 Medicine List')
            .setColor(0x3498db)
            .setTimestamp();

        if (medicines.length === 0) {
            embed.setDescription('No medicines found.');
            return embed;
        }

        const medicineList = medicines.map((med, index) => {
            const inventoryStatus = this.getInventoryStatus(med.inventory);
            const target = targetId ? '' : `\n👤 **Target:** <@${med.target_id}>`;

            return `**${index + 1}. ${med.name}**
💊 **Dosage:** ${med.dosage}
⏰ **Frequency:** ${formatFrequency(med.frequency)}
📦 **Inventory:** ${med.inventory || 0} ${inventoryStatus}${target}
🆔 **ID:** \`${med.id}\``;
        }).join('\n\n');

        embed.setDescription(medicineList);
        return embed;
    }

    createMedicineManagementButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mg|mgr|add')
                    .setLabel('➕ Add Medicine')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('mg|mgr|edit')
                    .setLabel('✏️ Edit Medicine')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('mg|mgr|delete')
                    .setLabel('🗑️ Delete Medicine')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('mg|mgr|view')
                    .setLabel('📋 View All')
                    .setStyle(ButtonStyle.Success)
            );
    }

    createMedicineSelectMenu(medicines, action) {
        if (medicines.length === 0) return null;

        const options = medicines.slice(0, 25).map(med => ({
            label: med.name.slice(0, 100),
            description: `${med.dosage} — <@${med.target_id}>`.slice(0, 100),
            value: med.id
        }));

        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`mg|select|${action}`)
                    .setPlaceholder(`Select a medicine to ${action}`)
                    .addOptions(options)
            );
    }

    createAddMedicineModal() {
        const modal = new ModalBuilder()
            .setCustomId('medicine_add_modal')
            .setTitle('Add New Medicine');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_name')
                    .setLabel('Medicine Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., Vitamin D, Aspirin')
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_dosage')
                    .setLabel('Dosage')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 1 tablet, 5ml syrup')
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_frequency')
                    .setLabel('Frequency (comma-separated)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('before_breakfast, after_dinner, 08:00')
                    .setRequired(true)
                    .setMaxLength(200)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_inventory')
                    .setLabel('Initial Inventory Count')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 30')
                    .setRequired(true)
                    .setMaxLength(10)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_target')
                    .setLabel('Target User ID or @mention')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('User ID or @username')
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );

        return modal;
    }

    createEditMedicineModal(medicine) {
        const modal = new ModalBuilder()
            .setCustomId(`medicine_edit_modal|${medicine.id}`)
            .setTitle(`Edit: ${medicine.name.slice(0, 40)}`);

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_name')
                    .setLabel('Medicine Name')
                    .setStyle(TextInputStyle.Short)
                    .setValue(medicine.name)
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_dosage')
                    .setLabel('Dosage')
                    .setStyle(TextInputStyle.Short)
                    .setValue(medicine.dosage)
                    .setRequired(true)
                    .setMaxLength(50)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_frequency')
                    .setLabel('Frequency (comma-separated)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(Array.isArray(medicine.frequency) ? medicine.frequency.join(', ') : String(medicine.frequency || ''))
                    .setRequired(true)
                    .setMaxLength(200)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_inventory')
                    .setLabel('Inventory Count')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(medicine.inventory || 0))
                    .setRequired(true)
                    .setMaxLength(10)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('medicine_target')
                    .setLabel('Target User ID or @mention')
                    .setStyle(TextInputStyle.Short)
                    .setValue(medicine.target_id)
                    .setRequired(true)
                    .setMaxLength(100)
            )
        );

        return modal;
    }

    async handleManagementButton(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Only administrators can manage medicines.',
                ephemeral: true
            });
        }

        const action = interaction.customId.split('|')[2];

        switch (action) {
            case 'add':
                return interaction.showModal(this.createAddMedicineModal());

            case 'view': {
                const listEmbed = await this.createMedicineListEmbed(interaction.guild);
                return interaction.reply({ embeds: [listEmbed], ephemeral: true });
            }

            case 'edit':
            case 'delete': {
                const medicines = await this.getMedicines(interaction.guild);
                if (medicines.length === 0) {
                    return interaction.reply({
                        content: '❌ No medicines to manage. Add one first.',
                        ephemeral: true
                    });
                }

                const selectMenu = this.createMedicineSelectMenu(medicines, action);
                return interaction.reply({
                    content: action === 'edit'
                        ? '✏️ Select a medicine to edit:'
                        : '🗑️ Select a medicine to delete:',
                    components: [selectMenu],
                    ephemeral: true
                });
            }
        }
    }

    async handleMedicineSelect(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Only administrators can manage medicines.',
                ephemeral: true
            });
        }

        const action = interaction.customId.split('|')[2];
        const medicineId = interaction.values[0];
        const medicine = await this.getMedicineById(interaction.guild, medicineId);

        if (!medicine) {
            return interaction.update({
                content: '❌ Medicine not found. It may have been deleted.',
                components: []
            });
        }

        if (action === 'edit') {
            return interaction.showModal(this.createEditMedicineModal(medicine));
        }

        const success = await this.deleteMedicine(interaction.guild, medicineId, interaction.user.id);
        const embed = new EmbedBuilder()
            .setTitle(success ? '🗑️ Medicine Deleted' : '❌ Delete Failed')
            .setColor(success ? 0xe74c3c : 0x95a5a6)
            .setDescription(success
                ? `**${medicine.name}** has been removed. Schedules were updated automatically.`
                : 'Could not delete the medicine. Please try again.')
            .setTimestamp();

        return interaction.update({ content: null, embeds: [embed], components: [] });
    }

    async handleModalSubmit(interaction) {
        if (interaction.customId === 'medicine_add_modal') {
            return this.handleAddMedicineModal(interaction);
        }
        if (interaction.customId.startsWith('medicine_edit_modal|')) {
            const medicineId = interaction.customId.split('|')[1];
            return this.handleEditMedicineModal(interaction, medicineId);
        }
    }

    async parseMedicineFormFields(interaction) {
        const name = interaction.fields.getTextInputValue('medicine_name');
        const dosage = interaction.fields.getTextInputValue('medicine_dosage');
        const frequencyInput = interaction.fields.getTextInputValue('medicine_frequency');
        const inventory = parseInt(interaction.fields.getTextInputValue('medicine_inventory'));
        const targetInput = interaction.fields.getTextInputValue('medicine_target');
        const targetId = targetInput.replace(/[<@!>]/g, '');

        const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!targetMember) {
            return { error: '❌ Invalid target user. Please provide a valid user ID or mention.' };
        }

        const { valid: frequencies, invalid } = parseFrequencies(frequencyInput);
        if (invalid.length > 0) {
            const validOptions = [...MEAL_FREQUENCY_VALUES, 'HH:MM (custom time)'].join(', ');
            return { error: `❌ Invalid frequency: ${invalid.join(', ')}\nValid options: ${validOptions}` };
        }
        if (frequencies.length === 0) {
            return { error: '❌ At least one frequency is required.' };
        }

        return {
            data: {
                name,
                dosage,
                frequency: frequencies,
                inventory: isNaN(inventory) ? 0 : inventory,
                target_id: targetId
            }
        };
    }

    async handleAddMedicineModal(interaction) {
        try {
            const parsed = await this.parseMedicineFormFields(interaction);
            if (parsed.error) {
                return interaction.reply({ content: parsed.error, ephemeral: true });
            }

            const medicineData = {
                ...parsed.data,
                added_by: interaction.user.id
            };

            const newMedicine = await this.addMedicine(interaction.guild, medicineData);

            if (newMedicine) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Medicine Added Successfully')
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: '💊 Name', value: medicineData.name, inline: true },
                        { name: '💉 Dosage', value: medicineData.dosage, inline: true },
                        { name: '⏰ Frequency', value: formatFrequency(medicineData.frequency), inline: false },
                        { name: '📦 Inventory', value: String(medicineData.inventory), inline: true },
                        { name: '👤 Target', value: `<@${medicineData.target_id}>`, inline: true },
                        { name: '🆔 Medicine ID', value: `\`${newMedicine.id}\``, inline: true }
                    )
                    .setFooter({ text: 'Reminder schedules were generated automatically' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: '❌ Failed to add medicine. Please try again.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error handling add medicine modal:', error);
            await interaction.reply({
                content: '❌ An error occurred while adding the medicine.',
                ephemeral: true
            });
        }
    }

    async handleEditMedicineModal(interaction, medicineId) {
        try {
            const parsed = await this.parseMedicineFormFields(interaction);
            if (parsed.error) {
                return interaction.reply({ content: parsed.error, ephemeral: true });
            }

            const success = await this.updateMedicine(interaction.guild, medicineId, {
                ...parsed.data,
                updated_by: interaction.user.id
            });

            if (success) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Medicine Updated')
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: '💊 Name', value: parsed.data.name, inline: true },
                        { name: '💉 Dosage', value: parsed.data.dosage, inline: true },
                        { name: '⏰ Frequency', value: formatFrequency(parsed.data.frequency), inline: false },
                        { name: '📦 Inventory', value: String(parsed.data.inventory), inline: true },
                        { name: '👤 Target', value: `<@${parsed.data.target_id}>`, inline: true }
                    )
                    .setFooter({ text: 'Reminder schedules were regenerated automatically' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({
                    content: '❌ Failed to update medicine. Please try again.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error handling edit medicine modal:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the medicine.',
                ephemeral: true
            });
        }
    }

    getInventoryStatus(inventory) {
        if (inventory <= 0) return '❌';
        if (inventory <= 5) return '⚠️';
        if (inventory <= 15) return '🟡';
        return '✅';
    }

    formatFrequency(frequencies) {
        return formatFrequency(frequencies);
    }

    getChanges(oldMed, newMed) {
        const changes = {};
        const fields = ['name', 'dosage', 'frequency', 'inventory', 'target_id'];

        fields.forEach(field => {
            if (JSON.stringify(oldMed[field]) !== JSON.stringify(newMed[field])) {
                changes[field] = {
                    old: oldMed[field],
                    new: newMed[field]
                };
            }
        });

        return changes;
    }
}

module.exports = MedicineManager;
