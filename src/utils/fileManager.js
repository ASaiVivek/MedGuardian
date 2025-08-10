const { AttachmentBuilder } = require('discord.js');

class FileManager {
    constructor() {
        this.dataChannelName = 'medicine-data';
        this.reminderChannelName = 'medicine-reminders';
        this.logChannelName = 'medicine-logs';
    }

    /**
     * Get or create the data channel for storing JSON files
     */
    async getDataChannel(guild) {
        let channel = guild.channels.cache.find(ch => ch.name === this.dataChannelName);
        
        if (!channel) {
            channel = await guild.channels.create({
                name: this.dataChannelName,
                type: 0, // Text channel
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: ['ViewChannel', 'SendMessages']
                    },
                    {
                        id: guild.members.me,
                        allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'ManageMessages']
                    }
                ]
            });
        }
        
        return channel;
    }

    /**
     * Get or create the reminder channel for notifications
     */
    async getReminderChannel(guild) {
        let channel = guild.channels.cache.find(ch => ch.name === this.reminderChannelName);
        
        if (!channel) {
            channel = await guild.channels.create({
                name: this.reminderChannelName,
                type: 0, // Text channel
                topic: '💊 Medicine reminders and notifications appear here'
            });
        }
        
        return channel;
    }

    /**
     * Get or create the log channel for activity logs
     */
    async getLogChannel(guild) {
        let channel = guild.channels.cache.find(ch => ch.name === this.logChannelName);
        
        if (!channel) {
            channel = await guild.channels.create({
                name: this.logChannelName,
                type: 0, // Text channel
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: ['ViewChannel']
                    },
                    {
                        id: guild.members.me,
                        allow: ['ViewChannel', 'SendMessages']
                    }
                ],
                topic: '📋 Medicine activity logs and missed dose alerts'
            });
        }
        
        return channel;
    }

    /**
     * Read JSON data from a file in the data channel
     */
    async readData(guild, filename) {
        try {
            const dataChannel = await this.getDataChannel(guild);
            const messages = await dataChannel.messages.fetch({ limit: 50 });
            
            // Find the message with the requested file
            const fileMessage = messages.find(msg => 
                msg.attachments.size > 0 && 
                msg.attachments.first().name === filename
            );

            if (!fileMessage) {
                return this.getDefaultData(filename);
            }

            const attachment = fileMessage.attachments.first();
            const response = await fetch(attachment.url);
            const data = await response.text();
            
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading ${filename}:`, error);
            return this.getDefaultData(filename);
        }
    }

    /**
     * Write JSON data to a file in the data channel
     */
    async writeData(guild, filename, data) {
        try {
            const dataChannel = await this.getDataChannel(guild);
            
            // Delete existing file message
            const messages = await dataChannel.messages.fetch({ limit: 50 });
            const existingMessage = messages.find(msg => 
                msg.attachments.size > 0 && 
                msg.attachments.first().name === filename
            );

            if (existingMessage) {
                await existingMessage.delete();
            }

            // Create new file attachment
            const jsonString = JSON.stringify(data, null, 2);
            const buffer = Buffer.from(jsonString, 'utf8');
            const attachment = new AttachmentBuilder(buffer, { name: filename });

            // Send new file message
            await dataChannel.send({
                content: `📄 Updated: ${filename} - ${new Date().toISOString()}`,
                files: [attachment]
            });

            return true;
        } catch (error) {
            console.error(`Error writing ${filename}:`, error);
            return false;
        }
    }

    /**
     * Get default data structure for different file types
     */
    getDefaultData(filename) {
        const defaults = {
            'medicines.json': {
                version: '1.0',
                guild_id: null,
                medicines: []
            },
            'targets.json': {
                version: '1.0',
                guild_id: null,
                targets: []
            },
            'schedules.json': {
                version: '1.0',
                guild_id: null,
                schedules: []
            },
            'settings.json': {
                version: '1.0',
                guild_id: null,
                meal_times: {
                    breakfast: {
                        start: '07:00',
                        end: '10:00'
                    },
                    lunch: {
                        start: '12:00',
                        end: '14:00'
                    },
                    dinner: {
                        start: '19:00',
                        end: '21:00'
                    }
                },
                timezone: 'Asia/Kolkata',
                reminder_advance_minutes: 15
            },
            'logs.json': {
                version: '1.0',
                guild_id: null,
                logs: []
            }
        };

        return defaults[filename] || { version: '1.0', data: [] };
    }

    /**
     * Log an activity to the logs file
     */
    async logActivity(guild, activity) {
        try {
            const logs = await this.readData(guild, 'logs.json');
            
            const logEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                guild_id: guild.id,
                ...activity
            };

            logs.logs.unshift(logEntry); // Add to beginning
            
            // Keep only last 1000 logs
            if (logs.logs.length > 1000) {
                logs.logs = logs.logs.slice(0, 1000);
            }

            await this.writeData(guild, 'logs.json', logs);
            
            // Also send to log channel if it's an important event
            if (['medicine_missed', 'inventory_low', 'setup_complete'].includes(activity.type)) {
                await this.sendToLogChannel(guild, logEntry);
            }

            return true;
        } catch (error) {
            console.error('Error logging activity:', error);
            return false;
        }
    }

    /**
     * Send important logs to the log channel
     */
    async sendToLogChannel(guild, logEntry) {
        try {
            const logChannel = await this.getLogChannel(guild);
            
            let message = '';
            let color = 0x3498db; // Blue default

            switch (logEntry.type) {
                case 'medicine_missed':
                    message = `⚠️ **Missed Dose Alert**\n${logEntry.target_name} missed ${logEntry.medicine_name} at ${logEntry.scheduled_time}`;
                    color = 0xe74c3c; // Red
                    break;
                case 'inventory_low':
                    message = `📦 **Low Inventory Alert**\n${logEntry.medicine_name} has only ${logEntry.remaining_count} doses left`;
                    color = 0xf39c12; // Orange
                    break;
                case 'setup_complete':
                    message = `✅ **Setup Complete**\nMedGuardian has been successfully configured for this server`;
                    color = 0x2ecc71; // Green
                    break;
            }

            if (message) {
                await logChannel.send({
                    embeds: [{
                        description: message,
                        color: color,
                        timestamp: logEntry.timestamp
                    }]
                });
            }
        } catch (error) {
            console.error('Error sending to log channel:', error);
        }
    }

    /**
     * Initialize all data files for a new guild
     */
    async initializeGuild(guild) {
        try {
            const files = ['medicines.json', 'targets.json', 'schedules.json', 'settings.json', 'logs.json'];
            
            for (const filename of files) {
                const defaultData = this.getDefaultData(filename);
                defaultData.guild_id = guild.id;
                await this.writeData(guild, filename, defaultData);
            }

            await this.logActivity(guild, {
                type: 'setup_complete',
                message: 'MedGuardian initialized for guild'
            });

            return true;
        } catch (error) {
            console.error('Error initializing guild:', error);
            return false;
        }
    }
}

module.exports = FileManager;
