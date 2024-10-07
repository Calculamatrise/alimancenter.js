export default {
	async execute(interaction, options) {
		const event = options.getString('event');
		const mentions = options.getRole('mentions');
		const context = interaction.context === 0 ? 'guild' : 'user';
		let channel = interaction.channel;
		if (interaction.context === 2) {
			channel = await interaction.user.createDM(true).catch(err => null);
			if (channel === null) {
				return {
					content: "Something went wrong! Failed to create a DM with the target user.",
					ephemeral: true
				}
			}
		}

		return interaction.client.database[context + 's'].update(interaction[context].id, {
			reminders: 'user' === context ? [event] : {
				[event]: {
					channelId: channel.id,
					mentions: mentions && [mentions.id]
				}
			}
		}).then(() => {
			return {
				content: `Successfully enabled ${event.replace(/(?=[A-Z])/g, ' ').toLowerCase()} reminders for ${interaction.context === 0 ? 'this server in ' + channel.name : 'you in your DMs'}.`,
				ephemeral: true
			}
		}).catch(err => {
			return {
				content: err.message || "Something went wrong! Failed to unset reminder.",
				ephemeral: true
			}
		})
	}
}