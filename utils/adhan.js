import EventEmitter from "events";

export default class Adhan extends EventEmitter {
	_timeout = null;
	constructor(/* info */) {
		Object.defineProperty(this, '_timeout', { enumerable: false }),
		this._start()
	}

	async _start() {
		const nextPrayer = await this.constructor.next();
		nextPrayer && (this._timeout && clearTimeout(this._timeout),
		this._timeout = setTimeout(this.emit.bind(this), nextPrayer.timeRemaining * 6e4, 'call', nextPrayer))
	}

	static _calculateMinutesRemaining(time, { date, offsetDate = 0 }) {
		let [hour, minute] = time.match(/\d+/g);
		let minutes = parseInt(hour) * 60 + parseInt(minute);
		let currentMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
		let minutesRemaining = minutes + offsetDate * 1440 - currentMinutes;
		return minutesRemaining
	}

	static cache = new Map();
	// cache results
	static async _fetchTimings(date, { force, offsetMonth = 0 } = {}) {
		offsetMonth && date.setMonth(date.getMonth() + offsetMonth);
		if (this.cache.size > 11 && 0 === date.getMonth()) {
			this.cache.clear();
		} if (!force && this.cache.has(date.getMonth())) {
			return this.cache.get(date.getMonth());
		}
		return fetch("https://al-imancenter.com/api/prayerTimeTable?" + new URLSearchParams({
			prayerMonth: date.toLocaleString('default', { month: 'long' }),
			prayerYear: date.getFullYear()
		}).toString()).then(r => r.json()).then(data => {
			let timings = data.sort((a, b) => a.prayerDay - b.prayerDay) // .map(({ prayerSchedule }) => /* prayerSchedule */ )
			.map(data => {
				data.timings = Object.fromEntries(Object.entries(data.prayerSchedule).map(([, value]) => [this.toPrayer(value.salah), value.type] /* Object.values(value) */));
				return data
			});
			this.cache.set(date.getMonth(), timings);
			return timings
		})
	}

	static prayers = ['FAJR', 'ZHUR', 'ASR', 'MAGHRIB', 'ISHA'];
	static async fetch(prayer) {
		if (typeof prayer == 'string') {
			prayer = this.toPrayer(prayer);
			return this.timings(Object.assign({}, Array.prototype.slice.call(arguments, 1), { prayer })).then(timings => {
				if (!timings.hasOwnProperty(prayer)) {
					throw new Error("Unrecognized prayer code: " + prayer);
				}
				return timings[prayer]
			});
		}

		return this.timings(...arguments)
	}

	static async current() {
		let timings = await this.timings({ appendNext: true, filterExpired: true });
		return Object.values(timings).find(prayer => prayer.timeRemaining < 0 && !prayer.passed)
	}

	static async next() {
		let timings = await this.timings({ appendNext: true, filterExpired: true });
		return Object.values(timings).find(prayer => prayer.timeRemaining > 0)
	}

	static async timings({ appendNext, filterExpired, filter, filterPrayers = true, force, offsetDate = 0, prayer } = {}) {
		let date = new Date();
		date.setTime(date.getTime() - date.getTimezoneOffset() * 6e4),
		offsetDate && date.setDate(date.getDate() + offsetDate);
		return this._fetchTimings(date, { force }).then(data => {
			offsetDate && date.setDate(date.getDate() - offsetDate),
			date.setTime(Date.parse(date.toLocaleString('en-US', { timeZone: 'America/Vancouver' })));
			let time = date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				hourCycle: 'h23',
				minute: '2-digit',
				timeZone: 'UTC'
			});
			let today = data[date.getDate() - 1];
			let timings = today.timings;
			filterPrayers && (timings = this.filterNonDailyPrayers(timings));
			let remaining = this.filterPassedTimes(timings, time);
			prayer && !remaining[this.toPrayer(prayer)] && (remaining = {});
			Object.keys(remaining).length > 0 ? filterExpired && (timings = remaining,
			Object.keys(remaining).length < 5 && appendNext && (today = data[date.getDate() % data.length],
			Object.assign(timings, Object.fromEntries(Object.entries(this.filterNonDailyPrayers(today.timings)).filter(([key]) => !timings.hasOwnProperty(key)))))) : (offsetDate += 1,
			today = data[(date.getDate() - 1 + offsetDate) % data.length],
			timings = this.filterNonDailyPrayers(today.timings));
			return Object.fromEntries(Object.entries(timings).map(([key, value]) => {
				return [key, {
					adhan: value.AZAAN,
					iqama: value.IQAMA,
					offset: offsetDate,
					prayer: key,
					time: value.AZAAN.time,
					timeRemaining: this._calculateMinutesRemaining(value.AZAAN.time, {
						date,
						offsetDate: key.toUpperCase() === 'ISHA' ? offsetDate++ : offsetDate
					})
				}]
			}).map(([key, value], index, arr) => {
				let next = arr[(index + 1) % arr.length];
				return [key, Object.assign(value, {
					passed: value.timeRemaining < 0 && next && next[1].timeRemaining < 0
				})]
			}))
		})
	}

	static filterNonDailyPrayers(timings) {
		return Object.fromEntries(Object.entries(timings).filter(([key]) => this.prayers.includes(key.toUpperCase())))
	}

	static filterPassedTimes(timings, time) {
		let entries = Object.entries(timings).reverse();
		return Object.fromEntries(entries.filter(([,value], index) => (value.IQAMA.time || value) > time || (entries[index - 1] && (entries[index - 1][1].IQAMA.time || entries[index - 1][1]) > time)).reverse())
	}

	static toPrayer(string) {
		return string.toLowerCase().replace(/^\w/, c => c.toUpperCase())
	}
}