import { CommandInteractionOptionResolver } from "discord.js";

export default async function (interaction) {
	let command = interaction.commandName, subcommand, subcommandgroup;
	interaction.hasOwnProperty('options') && ([subcommand, subcommandgroup] = [interaction.options.getSubcommand(false), interaction.options.getSubcommandGroup(false)]);
	subcommandgroup && (command += subcommandgroup.replace(/^./, char => char.toUpperCase()));
	subcommand && (command += subcommand.replace(/^./, char => char.toUpperCase()));
	let args = interaction.options?.data || [];
	if (interaction.hasOwnProperty('customId') || interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
		typeof interaction.customId == 'string' && ([command, ...args] = interaction.customId.split('-'));
		subcommand = command.split(/(?=[A-Z])/).slice(1).at(-1);
		subcommand &&= subcommand.toLowerCase();
		args = args.map(value => ({ value })) || [];
		if (interaction.isStringSelectMenu()) {
			interaction.values.forEach(item => args.push({ value: item.value ?? item }));
		}
	}

	if (this.interactions.has(command, interaction.commandType ?? 1)) {
		const event = this.interactions.get(command, interaction.commandType ?? 1);
		const isRepliable = interaction.isRepliable();
		if (!isRepliable && !interaction.responded) {
			return interaction.respond(await event.focus(interaction, interaction.options.getFocused(true)))
				.catch(error => console.error("FocusedInteraction:", error.message));
		} else if ((event.blacklist !== void 0 && event.blacklist.has(interaction.user.id)) || (event.whitelist !== void 0 && !event.whitelist.has(interaction.user.id))) {
			return interaction.reply({
				content: event.response || "Insufficient privledges.",
				ephemeral: true
			});
		}

		let method = 'execute';
		if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
			let parent = this.interactions.get(command.replace(/[A-Z].*/g, ''));
			let options = event?.options || parent?.options?.find(option => option.name == subcommand)?.options;
			if (options) interaction.options = new CommandInteractionOptionResolver(interaction.client, args.map((argument, index) => Object.assign(options[index], argument)));
			method = interaction.isStringSelectMenu() ? 'select' : 'click';
			event.hasOwnProperty(method) || (method = 'execute');
			!interaction.deferred && !interaction.replied && (event[method][Symbol.toStringTag] || event[method].constructor.name) === 'AsyncFunction' && await interaction.deferUpdate()
		}

		let data;
		if (data = await (async () => event[method](interaction, interaction.options, args))().catch(err => {
			console.warn("InteractionExecute", err)
		})) {
			await interaction[interaction.deferred ? 'editReply' : interaction.replied ? 'followUp' : 'reply'](data).catch(({ message }) => {
				console.error("InteractionCreate:", message);
			});
		} else if (isRepliable && !interaction.replied) {
			await interaction[(interaction.deferred ? 'editR' : 'r') + 'eply']({
				content: "Something went wrong! Please try again later.",
				ephemeral: true
			});
		}

		this.setIdle(false)
	}
}