import EventEmitter from "events";
import DataStoreManager from "./store.js";

const VIEW_CHANNELS = BigInt(1 << 10);
export default class extends EventEmitter {
	#client = null;
	#category = null;
	#serverId = null;
	constructor(client, listener) {
		super();
		this.#client = client;
		typeof listener == 'function' && this.once('ready', listener.bind(this))
	}
	async connect(id) {
		if (!this.#client) {
			throw new Error("Client is missing!");
		}
		this.#serverId = id;
		this.#category = await this.createCategory(this.#client.application?.id || this.#client.user.id);
		this.emit('ready')
	}
	async createCategory(name) {
		let id = this.#serverId;
		let server = this.#client.guilds.cache.get(id);
		if (!server) {
			server = await this.#client.guilds.fetch(id);
			if (!server) {
				throw new Error("Server [" + id + "] not found.");
			}
		}

		let categories = server.channels.cache.filter(channel => channel.type);
		if (categories.size < 1) {
			categories = await server.channels.fetch().then(categories => {
				return categories.filter(channel => channel && channel.type === 4)
			})
		}

		let category = categories.find(category => category.name === name);
		if (!category) {
			category = await server.channels.create({
				name,
				permissionOverwrites: [{
					id,
					deny: [VIEW_CHANNELS]
				}, {
					id: this.#client.user.id,
					allow: [VIEW_CHANNELS]
				}],
				type: 4
			})
		}
		return category
	}
	async createBackup(name) {
		let store = this[name];
		let entries = await store.entries();
		if (entries.length > 0) {
			let data = JSON.stringify(entries.reduce((combined, entry) => Object.assign(combined, JSON.parse(entry.content)), {}), null, 4);
			let payload = {
				files: [{
					attachment: Buffer.from(data),
					name: name + '.backup.json'
				}]
			};

			let channel = await this.getChannel('backup', { createIfNotExists: true });
			let messages = channel.messages.cache;
			messages.size < 1 && (messages = await channel.messages.fetch());
			messages = messages.map(message => Array.from(message.attachments.values()));
			let attachments = messages.flat();
			attachments = await Promise.all(attachments.map(attachment => fetch(attachment.url).then(r => r.text()))).catch(err => {
				console.error("An error occurred while fetching backup attachments for the database: " + err.message);
				return []
			});
			let match = attachments.find(cache => cache === data);
			if (!match) {
				await channel.send(payload).catch(err => {
					console.error("Failed to save a backup for the database: " + err.message);
				})
			}
		}
	}
	async createStore(name, defaults, dontBackup) {
		let channel = await this.getChannel(name, { createIfNotExists: true });
		let dataStore = new DataStoreManager(channel, this.#client.user.id, defaults);
		this[name] = dataStore;
		dontBackup || await this.createBackup(name);
		return dataStore
	}
	async getChannel(name, { createIfNotExists } = {}) {
		if (!this.#category) {
			throw new Error("Database is not connected!");
		}

		let filter = channel => channel.parentId === this.#category.id;
		let server = this.#category.guild;
		let channels = server.channels.cache.filter(filter);
		if (channels.size < 1) {
			channels = await server.channels.fetch().then(channels => {
				return channels.filter(filter)
			})
		}

		let channel = channels.find(channel => channel.name === name);
		if (!channel && createIfNotExists) {
			channel = await server.channels.create({
				name,
				parent: this.#category
			})
		}
		return channel ?? null
	}
	async getStore(name) {
		let channel = await this.getChannel(name);
		if (channel) {
			let dataStore = new DataStoreManager(channel, this.#client.user.id);
			this[name] = dataStore;
			return dataStore;
		}

		const { createIfNotExists } = Object.assign({}, Array.prototype.slice.call(arguments, 1).pop());
		return createIfNotExists ? this.createStore(...Array.prototype.slice.call(arguments, 1)) : null
	}
	async deleteStore(name) {
		let channel = await this.getStore(name);
		if (channel) {
			await channel.delete();
			delete this[name];
			return true
		}
		return false
	}
	destroy() {
		this.#category = null;
		this.#client = null;
		this.#serverId = null;
		this.emit('disconnected');
		this.removeAllListeners()
	}
}