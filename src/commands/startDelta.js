const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start-delta')
        .setDescription('Start Delta and join voice channel'),

    async execute(interaction, bot) {
        // Check if user is in a voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'You must be in a voice channel to use this command.',
                ephemeral: true
            });
        }

        try {
            // Join voice channel
            await bot.voiceManager.joinChannel(voiceChannel);

            // Send confirmation
            await interaction.reply({
                content: 'Delta initialized and ready for testing.',
                ephemeral: false
            });

        } catch (error) {
            console.error('Error starting Delta:', error);
            await interaction.reply({
                content: 'Error initializing Delta. Please try again.',
                ephemeral: true
            });
        }
    },
};