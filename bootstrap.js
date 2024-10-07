import Client from "./client/Client.js";
import { GatewayIntentBits, Partials } from "discord.js";

export const client = new Client({
	allowedMentions: {
		parse: [
			'users',
			'roles'
		],
		repliedUser: true
	},
	intents: [
		GatewayIntentBits.AutoModerationConfiguration,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.MessageContent
	],
	partials: [
		Partials.Channel // Required to receive DMs
	],
	presence: {
		status: 'idle',
		activities: [{
			name: "كلمة الله",
			type: 2
		}]
	}
});

await client.config();

client.login(process.env.TOKEN)