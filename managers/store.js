export default class {
	#channel = null;
	#clientId = null;
	#defaults = null;
	#defaultMessageId = null;
	#messages = null;
	cache = new Map();
	constructor(channel, clientId, defaults) {
		this.#channel = channel,
		this.#clientId = clientId,
		typeof defaults == 'object' && defaults != null && this.#createDefaults(defaults)
	}
	async #createDefaults(defaults) {
		let channel = this.#channel
		  , filter = message => message.author.id === this.#clientId
		  , messages = channel.messages.cache.filter(filter);
		if (messages.size < 1) {
			messages = await channel.messages.fetch().then(messages => {
				return messages.filter(filter)
			});
		}

		messages = Array.from(messages.values()),
		messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
		let message = messages[0];
		if (message) {
			let content = message.content;
			if (content.startsWith('```JSON')) {
				let savedDefaults = JSON.parse(content.replace(/^`{3}json|`{3}$/gi, ''));
				if (defaults && JSON.stringify(defaults) != JSON.stringify(savedDefaults)) {
					let newContent = '```JSON\n' + JSON.stringify(defaults, null, 4) + '```';
					newContent !== content && await message.edit(newContent);
				}
			}
		} else if (defaults) {
			message = await channel.send('```JSON\n' + JSON.stringify(defaults, null, 4) + '```');
		}

		message && (this.#defaultMessageId = message.id);
		return this.#defaults = defaults
	}
	async #createEntry(data) {
		if (typeof data != 'object') {
			throw new TypeError("Entry is not an object.")
		}

		let channel = this.#channel
		  , entry = await channel.send(JSON.stringify(data));
		this.#messages ||= [],
		this.#messages.unshift(entry);
		return entry
	}
	async #findEntry(key, fallback) {
		if (!key) {
			throw new TypeError("Key must be a string, or a number greater than 0.");
		}
		let entries = await this.entries()
		  , entry = entries.find(entry => {
			let data = JSON.parse(entry.content);
			return data.hasOwnProperty(key)
		});
		return entry || (fallback && entries[0])
	}
	async #findAndParseEntry(key) {
		let entry = await this.#findEntry(key);
		return (entry && JSON.parse(entry.content)) ?? null
	}
	async _enforceTemplate() {
		let entries = await this.entries();
		for (let entry of entries) {
			let data = JSON.parse(entry.content);
			for (let key in data) {
				let filtered = recursiveFilter(data[key], this.#defaults);
				filtered && (data[key] = filtered,
				this.cache.set(key, filtered)) || (delete data[key],
				this.cache.delete(key))
			}

			entry.content !== JSON.stringify(data) && await entry.edit(JSON.stringify(data))
		}
	}
	async entries() {
		if (this.#messages !== null) {
			return this.#messages;
		}

		let channel = this.#channel
		  , filter = message => message.author.id === this.#clientId && message.id !== this.#defaultMessageId && /^{|}$/gi.test(message.content)
		  , messages = channel.messages.cache.filter(filter);
		if (messages.size < 1) {
			messages = await channel.messages.fetch().then(messages => {
				return messages.filter(filter)
			});
			if (messages.size < 1) {
				return [];
			}
		}

		messages = Array.from(messages.values()).sort((a, b) => a.content.length - b.content.length),
		this.#messages = messages,
		this.cache = new Map(this.#messages.reduce((combined, entry) => combined.concat(Object.entries(JSON.parse(entry.content))), []));
		return messages
	}
	create = this.update;
	async fetch(key, { force } = {}) {
		if (!force && this.cache.has(key)) {
			return this.cache.get(key);
		}
		let entry = await this.#findAndParseEntry(key);
		return (entry && entry[key]) ?? null
	}
	async has(key) {
		return null !== await this.fetch(key)
	}
	async set(key, value) {
		let message = await this.#findEntry(key, true)
		  , data = message ? JSON.parse(message.content) : {}
		  , newValue = Object.assign({}, /* this.#defaults, */ value);
		newValue = Object.fromEntries(Object.entries(newValue).filter(([key, value]) => {
			if (key in this.#defaults) {
				let defaultValue = this.#defaults[key];
				return null === defaultValue || typeof value == typeof defaultValue;
			}

			return false
		}));
		if (JSON.stringify(data[key]) !== JSON.stringify(newValue)) {
			data[key] = newValue,
			this.cache.set(key, newValue);
			if (message) {
				let content = JSON.stringify(data);
				if (content.length > 2e3) {
					delete data[key],
					await this.#createEntry({ [key]: newValue });
				}

				message.content !== content && await message.edit(JSON.stringify(data));
			} else {
				await this.#createEntry(data);
			}
		}

		return newValue
	}
	async update(key, value) {
		return this.set(key, Object.assign({}, merge(Object.assign({}, await this.fetch(key)), value)))
	}
	async delete(key, ...properties) {
		let entry = await this.#findEntry(key);
		if (entry) {
			let data = JSON.parse(entry);
			if (properties.length > 0) {
				for (const query of properties) {
					if (query instanceof Object) {
						recursivePurge(data[key], query);
					} else if (typeof query == 'string' && data[key].hasOwnProperty(query)) {
						delete data[key][query];
					}
				}
			}

			let keys = Object.keys(data[key]);
			if (keys.length < 1 || properties.length < 1) {
				delete data[key],
				this.cache && this.cache.delete(key);
			} else {
				this.cache ||= new Map(),
				this.cache.set(key, data[key]);
			}

			keys = Object.keys(data);
			if (keys.length > 0) {
				await entry.edit(JSON.stringify(data));
			} else {
				await entry.delete();
			}
			return true;
		}

		return false
	}
	async destroy() {
		await this.#channel.delete(),
		this.#channel = null,
		this.#defaults = null,
		this.#defaultMessageId = null,
		this.#messages = null,
		this.cache = null
	}
}

function merge(parent, ...objects) {
	if (Array.isArray(parent)) return parent.concat(...objects.flat());
	for (const object of objects) {
		for (const key in object) {
			if (!object.hasOwnProperty(key)) continue;
			if (parent[key] instanceof Object) {
				parent[key] = merge(parent[key], object[key]);
				continue;
			}

			parent[key] = object[key]
		}
	}

	return parent
}

function recursivePurge(parent, object) {
	if (Array.isArray(parent)) {
		for (const key of object) {
			let index = parent.indexOf(key);
			if (index < 0) continue;
			parent.splice(index, 1);
		}
		return parent;
	}
	for (const key in object) {
		if (!object.hasOwnProperty(key)) continue;
		if (object[key] instanceof Object) {
			parent[key] = recursivePurge(parent[key], object[key]);
			continue;
		}

		delete parent[key]
	}

	return parent
}

function recursiveFilter(object, template) {
	for (let key in object) {
		if (!template.hasOwnProperty(key) || JSON.stringify(object[key]) === JSON.stringify(template[key]) || object[key] === null) {
			delete object[key];
		} else if (object[key] instanceof Object) {
			let filtered = recursiveFilter(object[key], template[key]);
			filtered && (object[key] = filtered) || delete object[key]
		}

		Object.keys(object) < 1 && (object = null)
	}

	return object
}