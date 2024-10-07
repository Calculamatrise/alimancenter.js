import Adhan from "../utils/adhan.js";

export default async function () {
	console.log(`Logged in as ${this.user.tag}`);
	await this.application.fetch();
	if (!this.application.guildId) {
		let guildId = '433783980345655306';
		await this.guilds.fetch(guildId).then(guild => {
			Object.defineProperty(this.application, 'guild', { value: guild, writable: true }),
			this.application.guildId = guild.id
		}).catch(err => console.warn("Support guild not found!", '[' + guildId + ']', err));
	}

	this.user.presence.set({
		status: "dnd",
		activities: [{
			name: "Rebooting due to changes...",
			type: 4
		}]
	});

	await this.connectClients();
	await this.updateCommands();

	let owner = this.application.owner;
	'owner' in owner && (owner = owner.owner.user);
	console.log(`Ready when you are, ${owner.username}!`);

	let nextPrayer = await Adhan.next();
	// this.emit('adhanStart', nextPrayer); // emit for testing
	nextPrayer && (this._nextPrayerTimeout = setTimeout(this.emit.bind(this), nextPrayer.timeRemaining * 6e4, 'adhanStart', nextPrayer));

	this.options.presence.activities = [{
		name: nextPrayer.prayer + ' is at ' + nextPrayer.adhan.display,
		type: 4
	}],
	this.user.presence.set(this.options.presence),
	this.updateDescription()
}