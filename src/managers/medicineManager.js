const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');

class MedicineManager {
    constructor(fileManager) {
        this.fileManager = fileManager;
    }

    /**
     * Get all medicines for a guild
     */
    async getMedicines(guild) {
        const data = await this.fileManager.readData(guild, 'medicines.json');
        return data.medicines || [];
    }

    /**
     * Add a new medicine
     */
    async addMedicine(guild, medicineData) {
        try {
            const medicines = await this.fileManager.readData(guild, 'medicines.json');
            
            const newMedicine = {
                id: `med_${Date.now()}`,
                created_at: new Date().toISOString(),
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
            }

            return success ? newMedicine : null;
        } catch (error) {
            console.error('Error adding medicine:', error);
            return null;
        }
    }

    /**
     * Update an existing medicine
     */
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
            }

            return success;
        } catch (error) {
            console.error('Error updating medicine:', error);
            return false;
        }
    }

    /**
     * Delete a medicine
     */
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
            }

            return success;
        } catch (error) {
            console.error('Error deleting medicine:', error);
            return false;
        }
    }

    /**
     * Get medicine by ID
     */
    async getMedicineById(guild, medicineId) {
        const medicines = await this.getMedicines(guild);
        return medicines.find(med => med.id === medicineId);
    }

    /**
     * Get medicines for a specific target
     */
    async getMedicinesForTarget(guild, targetId) {
        const medicines = await this.getMedicines(guild);
        return medicines.filter(med => med.target_id === targetId);
    }

    /**
     * Update medicine inventory
     */
    async updateInventory(guild, medicineId, change, updatedBy) {
        try {
            const medicine = await this.getMedicineById(guild, medicineId);
            if (!medicine) return false;

            const newInventory = Math.max(0, (medicine.inventory || 0) + change);
            const success = await this.updateMedicine(guild, medicineId, {
                inventory: newInventory,
                updated_by: updatedBy
            });

            // Check for low inventory alert
            if (newInventory <= 5 && newInventory > 0) {
                await this.fileManager.logActivity(guild, {
                    type: 'inventory_low',
                    medicine_id: medicineId,
                    medicine_name: medicine.name,
                    remaining_count: newInventory,
                    message: `Low inventory alert for ${medicine.name}`
                });
            }

            return success;
        } catch (error) {
            console.error('Error updating inventory:', error);
            return false;
        }
    }

    /**
     * Create medicine list embed
     */
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
⏰ **Frequency:** ${this.formatFrequency(med.frequency)}
📦 **Inventory:** ${med.inventory || 0} ${inventoryStatus}${target}
🆔 **ID:** \`${med.id}\``;
        }).join('\n\n');

        embed.setDescription(medicineList);
        return embed;
    }

    /**
     * Create medicine management buttons
     */
    createMedicineManagementButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_medicine')
                    .setLabel('➕ Add Medicine')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('edit_medicine')
                    .setLabel('✏️ Edit Medicine')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('delete_medicine')
                    .setLabel('🗑️ Delete Medicine')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('view_medicines')
                    .setLabel('📋 View All')
                    .setStyle(ButtonStyle.Success)
            );
    }

    /**
     * Create add medicine modal
     */
    createAddMedicineModal() {
        const modal = new ModalBuilder()
            .setCustomId('medicine_add_modal')
            .setTitle('Add New Medicine');

        const nameInput = new TextInputBuilder()
            .setCustomId('medicine_name')
            .setLabel('Medicine Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Vitamin D, Aspirin')
            .setRequired(true)
            .setMaxLength(100);

        const dosageInput = new TextInputBuilder()
            .setCustomId('medicine_dosage')
            .setLabel('Dosage')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 1000 IU, 100mg, 2 tablets')
            .setRequired(true)
            .setMaxLength(50);

        const frequencyInput = new TextInputBuilder()
            .setCustomId('medicine_frequency')
            .setLabel('Frequency (before_breakfast, after_lunch, etc.)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('before_breakfast, after_lunch, before_dinner')
            .setRequired(true)
            .setMaxLength(100);

        const inventoryInput = new TextInputBuilder()
            .setCustomId('medicine_inventory')
            .setLabel('Initial Inventory Count')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 30')
            .setRequired(true)
            .setMaxLength(10);

        const targetInput = new TextInputBuilder()
            .setCustomId('medicine_target')
            .setLabel('Target User ID (or @mention)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('User ID or @username')
            .setRequired(true)
            .setMaxLength(100);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(dosageInput),
            new ActionRowBuilder().addComponents(frequencyInput),
            new ActionRowBuilder().addComponents(inventoryInput),
            new ActionRowBuilder().addComponents(targetInput)
        );

        return modal;
    }

    /**
     * Handle modal submissions
     */
    async handleModalSubmit(interaction) {
        if (interaction.customId === 'medicine_add_modal') {
            await this.handleAddMedicineModal(interaction);
        }
    }

    /**
     * Handle add medicine modal submission
     */
    async handleAddMedicineModal(interaction) {
        try {
            const name = interaction.fields.getTextInputValue('medicine_name');
            const dosage = interaction.fields.getTextInputValue('medicine_dosage');
            const frequency = interaction.fields.getTextInputValue('medicine_frequency');
            const inventory = parseInt(interaction.fields.getTextInputValue('medicine_inventory'));
            const targetInput = interaction.fields.getTextInputValue('medicine_target');

            // Parse target ID from mention or direct ID
            let targetId = targetInput.replace(/[<@!>]/g, '');
            
            // Validate target exists in guild
            const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
            if (!targetMember) {
                return await interaction.reply({
                    content: '❌ Invalid target user. Please provide a valid user ID or mention.',
                    ephemeral: true
                });
            }

            // Validate frequency format
            const validFrequencies = [
                'before_breakfast', 'after_breakfast',
                'before_lunch', 'after_lunch', 
                'before_dinner', 'after_dinner'
            ];
            
            const frequencies = frequency.split(',').map(f => f.trim());
            const invalidFreqs = frequencies.filter(f => !validFrequencies.includes(f));
            
            if (invalidFreqs.length > 0) {
                return await interaction.reply({
                    content: `❌ Invalid frequency options: ${invalidFreqs.join(', ')}\nValid options: ${validFrequencies.join(', ')}`,
                    ephemeral: true
                });
            }

            const medicineData = {
                name,
                dosage,
                frequency: frequencies,
                inventory: isNaN(inventory) ? 0 : inventory,
                target_id: targetId,
                added_by: interaction.user.id
            };

            const newMedicine = await this.addMedicine(interaction.guild, medicineData);

            if (newMedicine) {
                const embed = new EmbedBuilder()
                    .setTitle('✅ Medicine Added Successfully')
                    .setColor(0x2ecc71)
                    .addFields(
                        { name: '💊 Name', value: name, inline: true },
                        { name: '💉 Dosage', value: dosage, inline: true },
                        { name: '⏰ Frequency', value: frequencies.join(', '), inline: true },
                        { name: '📦 Inventory', value: inventory.toString(), inline: true },
                        { name: '👤 Target', value: `<@${targetId}>`, inline: true },
                        { name: '🆔 Medicine ID', value: `\`${newMedicine.id}\``, inline: true }
                    )
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

    /**
     * Get inventory status emoji
     */
    getInventoryStatus(inventory) {
        if (inventory <= 0) return '❌';
        if (inventory <= 5) return '⚠️';
        if (inventory <= 15) return '🟡';
        return '✅';
    }

    /**
     * Format frequency for display
     */
    formatFrequency(frequencies) {
        if (!Array.isArray(frequencies)) return frequencies;
        return frequencies.map(f => f.replace(/_/g, ' ')).join(', ');
    }

    /**
     * Get changes between old and new medicine objects
     */
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
