export default {
	async execute(interaction, options) {
		const event = options.getString('event');
		const mentions = options.getRole('mentions');
		const context = interaction.context === 0 ? 'guild' : 'user';
		if (null !== mentions) {
			return interaction.client.database[context + 's'].delete(interaction[context].id, {
				reminders: {
					[event]: { mentions: [mentions.id] }
				}
			}).then(() => {
				return {
					content: `Successfully removed a mention from ${event.replace(/(?=[A-Z])/g, ' ').toLowerCase()} reminders ${interaction.context === 0 ? 'for this server' : 'for you'}.`,
					ephemeral: true
				}
			}).catch(err => {
				return {
					content: err.message || "Something went wrong! Failed to unset reminder.",
					ephemeral: true
				}
			});
		}

		return interaction.client.database[context + 's'].delete(interaction[context].id, { reminders: [event] }).then(() => {
			return {
				content: `Successfully disabled ${event.replace(/(?=[A-Z])/g, ' ').toLowerCase()} reminders ${interaction.context === 0 ? 'for this server' : 'for you'}.`,
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