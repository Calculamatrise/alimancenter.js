import Adhan from "../utils/adhan.js";

export default {
	description: "Check the time for tarawih tonight.",
	defaultMemberPermissions: BigInt(1 << 8),
	dmPermission: false,
	async execute(interaction, options) {
		let location = options.getString('location');
		return Adhan.fetch('Isha', { address: location || 'Vancouver, BC, Canada' }).then(info => {
			let minutes = info.timeRemaining % 60;
			let hours = (info.timeRemaining - minutes) / 60;
			let timeRemaining = '';
			info.offset > 0 || (hours > 0 && (timeRemaining += hours + ' hours'),
			minutes > 0 && (hours > 0 && (timeRemaining += ' and '),
			timeRemaining += minutes + ' minutes'));
			return {
				content: "Tarawih is " + (timeRemaining ? 'in ' + timeRemaining : 'now') + "; " + info.time,
				// ephemeral: location !== null
			}
		}).catch(err => {
			return {
				content: err.message || "Something went wrong! Failed to find your timezone.",
				ephemeral: true
			}
		})
	},
	options: [{
		name: "location",
		description: "Enter your city, province, and country for location-sepecific timings.",
		type: 3
	}]
}