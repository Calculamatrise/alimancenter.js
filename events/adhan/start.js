import { ActivityType } from "discord.js";
import Adhan from "../../utils/adhan.js";

export default async function (prayerInfo) {
	this.setActivity({
		name: prayerInfo.prayer + ' Adhan',
		type: ActivityType.Streaming,
		url: 'https://twitch.tv/calculamatrise' // 'https://youtube.com/' + ['@alimancenter2705', 'channel/UCHUQC2oHOZHibKvbTQWUauA'][0] + '/live'
	}, 3e5, this.updateDescription.bind(this));
	for (let [guildId, guildData] of this.database.guilds.cache.entries()) {
		if (!guildData || !guildData.reminders || !guildData.reminders.adhan) continue;
		let config = guildData.reminders.adhan;
		this.channels.fetch(config.channelId).then(channel => {
			let suffix = '';
			config.mentions && (suffix += '\n-# *' + config.mentions.map(id => '<@&' + id + '>').join('') + '*');
			return channel.send({
				content: "It's time to pray **[" + prayerInfo.prayer + "](https://en.wikipedia.org/wiki/" + prayerInfo.prayer.replace(/^dh?uhr$/i, 'Zuhr') + "_prayer)**!" + suffix
			})
		}).catch(err => {
			console.warn('[AdhanStart]', err.message || 'Channel not found!');
			return this.database.guilds.delete(guildId, { reminders: ['adhan'] })
		});
	}

	for (let [userId, userData] of this.database.users.cache.entries()) {
		if (!userData || !userData.reminders || !userData.reminders.includes('adhan')) continue;
		this.users.fetch(userId).then(async user => {
			let channel = user.dmChannel || await user.createDM();
			if (!channel) {
				throw new Error("Channel does not exist");
			}

			return channel.send({ content: "It's time to pray **" + prayerInfo.prayer + "**!" })
		}).catch(err => {
			console.warn('[AdhanStart]', err.message || 'User not found!');
			return this.database.users.delete(userId, { reminders: ['adhan'] })
		});
	}

	let nextPrayer = await Adhan.next();
	nextPrayer || console.warn('[AdhanStart] Next prayer not found!', nextPrayer),
	nextPrayer && (this._nextPrayerTimeout = setTimeout(this.emit.bind(this), nextPrayer.timeRemaining * 6e4, 'adhanStart', nextPrayer)),
	this.setDefaultActivity({
		name: nextPrayer.prayer + ' is at ' + nextPrayer.adhan.display,
		type: ActivityType.Custom
	})
}