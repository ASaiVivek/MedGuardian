const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-medguardian')
        .setDescription('Initialize MedGuardian for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, { fileManager }) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;

            // Check if already set up
            const existingData = await fileManager.readData(guild, 'settings.json');
            if (existingData.guild_id === guild.id) {
                return await interaction.editReply({
                    content: '⚠️ MedGuardian is already set up for this server. Use `/medicine-manager` to manage medicines.',
                });
            }

            // Create channels
            let dataChannel, reminderChannel, logChannel;

            try {
                // Create medicine-data channel (private)
                dataChannel = await guild.channels.create({
                    name: 'medicine-data',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                        },
                        {
                            id: guild.members.me,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ManageMessages
                            ]
                        }
                    ],
                    topic: '🔒 Private storage for medicine data (JSON files)'
                });

                // Create medicine-reminders channel (public)
                reminderChannel = await guild.channels.create({
                    name: 'medicine-reminders',
                    type: ChannelType.GuildText,
                    topic: '💊 Medicine reminders and notifications appear here'
                });

                // Create medicine-logs channel (admin only)
                logChannel = await guild.channels.create({
                    name: 'medicine-logs',
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: guild.members.me,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ]
                        }
                    ],
                    topic: '📋 Medicine activity logs and missed dose alerts'
                });

            } catch (channelError) {
                console.error('Error creating channels:', channelError);
                return await interaction.editReply({
                    content: '❌ Failed to create channels. Please ensure the bot has "Manage Channels" permission.',
                });
            }

            // Create Tracker and Target roles
            let trackerRole, targetRole;
            try {
                trackerRole = guild.roles.cache.find(r => r.name === 'Tracker')
                    || await guild.roles.create({
                        name: 'Tracker',
                        color: 0x3498db,
                        reason: 'MedGuardian caregiver role'
                    });

                targetRole = guild.roles.cache.find(r => r.name === 'Target')
                    || await guild.roles.create({
                        name: 'Target',
                        color: 0x2ecc71,
                        reason: 'MedGuardian medicine taker role'
                    });
            } catch (roleError) {
                console.error('Error creating roles:', roleError);
            }

            // Initialize data files
            const initSuccess = await fileManager.initializeGuild(guild);
            if (!initSuccess) {
                return await interaction.editReply({
                    content: '❌ Failed to initialize data files. Please try again.',
                });
            }

            // Create success embed
            const embed = new EmbedBuilder()
                .setTitle('🏥 MedGuardian Setup Complete!')
                .setColor(0x2ecc71)
                .setDescription('**MedGuardian has been successfully configured for this server.**')
                .addFields(
                    {
                        name: '📁 Channels Created',
                        value: `✅ ${dataChannel}\n✅ ${reminderChannel}\n✅ ${logChannel}`,
                        inline: false
                    },
                    {
                        name: '👥 Roles Created',
                        value: trackerRole && targetRole
                            ? `✅ ${trackerRole} — caregivers who manage medicines\n✅ ${targetRole} — people who take medicines`
                            : '⚠️ Could not create roles — assign Administrator to trackers manually',
                        inline: false
                    },
                    {
                        name: '🚀 Next Steps',
                        value: '1. Assign **Target** role to medicine takers\n2. `/schedule-settings` — set meal times\n3. `/add-medicine` — add medicines\n4. Check `/my-medicines` to verify',
                        inline: false
                    },
                    {
                        name: '📚 Commands',
                        value: '• `/add-medicine` — add with dropdowns\n• `/medicine-manager` — full management UI\n• `/schedule-settings` — meal times\n• `/my-medicines` — today\'s status\n• `/help` — documentation',
                        inline: false
                    }
                )
                .setFooter({ text: 'MedGuardian is ready to help track medicines!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Send welcome message to reminder channel
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🏥 Welcome to MedGuardian!')
                .setColor(0x3498db)
                .setDescription('This channel will be used for medicine reminders and notifications.')
                .addFields(
                    {
                        name: '🎯 For Targets (Medicine Takers)',
                        value: '• You\'ll receive reminders here\n• Click ✅ **Taken** when you take medicine\n• Click ❌ **Missed** if you miss a dose\n• Click ⏰ **Snooze** to be reminded in 15 minutes',
                        inline: false
                    },
                    {
                        name: '👨‍⚕️ For Trackers (Admins)',
                        value: '• Use `/medicine-manager` to add/edit medicines\n• Use `/schedule-settings` to configure meal times\n• Check #medicine-logs for missed dose alerts',
                        inline: false
                    }
                )
                .setTimestamp();

            await reminderChannel.send({ embeds: [welcomeEmbed] });

        } catch (error) {
            console.error('Error in setup command:', error);
            await interaction.editReply({
                content: '❌ An error occurred during setup. Please try again or contact support.',
            });
        }
    },
};
