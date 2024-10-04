import Adhan from "../../utils/adhan.js";

const TEMPLATES = {
	'ADHAN': new RegExp("(?<=(?<!\\w)wh(?:en|at\\s+time)\\s+is\\s+)(" + Adhan.prayers.join('|') + ")", 'gi'),
	'TIME_UNTIL_ADHAN': new RegExp("(?<=(?<!\\w)how\\s+(?:long|much\\s+time)\\s+(?:(?:left|remains?)\\s+)?(?:un)?till?\\s+)(" + Adhan.prayers.join('|') + ")", 'gi')
}

export default async function(message) {
	for (let i in TEMPLATES) {
		let regex = TEMPLATES[i];
		let args = regex.exec(message.content);
		if (args === null) continue;
		let timing = await Adhan.fetch(args[0]).catch(err => {
			console.warn('Something went wrong!', err.message)
		});
		if (!timing) continue;
		switch (i) {
		case 'ADHAN':
			message.reply({
				content: timing.prayer + ' is at ' + timing.time,
				ephemeral: true
			});
			break;
		case 'TIME_UNTIL_ADHAN':
			let hours = Math.floor(timing.timeRemaining / 60)
			  , minutes = timing.timeRemaining % 60
			  , string = '';
			hours > 0 && (string += hours + ' hour',
			hours > 1 && (string += 's'),
			minutes > 0 && (string += ' and ')),
			minutes > 0 && (string += minutes + ' minute',
			minutes > 1 && (string += 's'));
			message.reply({
				content: string + ' until ' + timing.prayer,
				ephemeral: true
			});
		}
	}
}