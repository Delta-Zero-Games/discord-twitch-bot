const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('end-delta')
        .setDescription('Stop Delta and leave voice channel'),

    async execute(interaction, bot) {
        try {
            // Disconnect from voice
            await bot.voiceManager.disconnect();

            // Send confirmation
            await interaction.reply({
                content: 'Delta has been deactivated.',
                ephemeral: false
            });

        } catch (error) {
            console.error('Error stopping Delta:', error);
            await interaction.reply({
                content: 'Error stopping Delta. Please try again.',
                ephemeral: true
            });
        }
    },
};