import Adhan from "../utils/adhan.js";

export default {
	description: "Check the time for the iqama.",
	async execute(interaction, options) {
		let requestedPrayer = options.getString('prayer');
		return Adhan.timings({ prayer: requestedPrayer }).then(timings => {
			let prayer = timings[Adhan.toPrayer(requestedPrayer || Object.values(timings).find(prayer => prayer.timeRemaining > 0).prayer)];
			return prayer.prayer + ' Iqama is ' + (prayer.timeRemaining < 0 && !prayer.passed && prayer.timeRemaining > -1 ? 'now!' : 'at ' + prayer.iqama.display + (prayer.offset > 0 ? ' **tomorrow**.' : ''))
		}).catch(err => {
			return {
				content: err.message || "Something went wrong! Failed to find your timezone.",
				ephemeral: true
			}
		})
	},
	options: [{
		name: "prayer",
		description: "The prayer you wish to know the time of.",
		type: 3,
		choices: Adhan.prayers.map(prayer => ({
			name: prayer.toLowerCase().replace(/^\w/, c => c.toUpperCase()),
			value: prayer
		}))
	}]
}