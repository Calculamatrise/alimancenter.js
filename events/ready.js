import Adhan from "../utils/adhan.js";

export default async function () {
	await this.application.fetch();
	this.application.supportGuildId ||= '433783980345655306';
	await this.guilds.fetch(this.application.supportGuildId).then(guild => {
		return Object.defineProperty(this.application, 'supportGuild', { value: guild, writable: true })
	}).catch(err => console.warn("Support guild not found!", '[' + this.application.supportGuildId + ']', err));

	console.log(`Logged in as ${this.user.tag}`);
	this.user.presence.set({
		status: "dnd",
		activities: [{
			name: "Rebooting due to changes...",
			type: 4
		}]
	});

	await this.connectClients();
	await this.updateCommands();

	console.log(`Ready when you are, ${this.application.owner.username}!`);
	this.user.presence.set(this._defaultPresence);

	let nextPrayer = await Adhan.next();
	// this.emit('adhanStart', nextPrayer); // emit for testing
	nextPrayer && (this._nextPrayerTimeout = setTimeout(this.emit.bind(this), nextPrayer.timeRemaining * 6e4, 'adhanStart', nextPrayer))
}