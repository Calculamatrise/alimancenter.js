import { existsSync, readdir, readFile } from "fs";
import { extname } from "path";
import { Client } from "discord.js";

import DatabaseManager from "../managers/database.js";
import InteractionHandler from "../handlers/interactions.js";
import Adhan from "../utils/adhan.js";

export default class extends Client {
	_defaultPresence = {
		status: 'idle',
		activities: [{
			name: "كلمة الله",
			type: 2
		}]
	};
	supportServerId = "433783980345655306";
	commands = new Map();
	database = new DatabaseManager(this);
	developerMode = /^(dev|test)$/i.test(process.argv.at(2));
	interactions = new InteractionHandler();
	players = new Map();
	serverStorage = new DatabaseManager(this);
	terminalId = null;
	constructor() {
		super(...arguments);
		this.database.on('ready', async () => {
			Object.defineProperty(this, 'terminal', {
				value: await this.database.getChannel('terminal', { createIfNotExists: true }).then(terminal => {
					terminal && (this.terminalId = terminal.id);
					return terminal
				}),
				writable: true
			});
			await this.database.createStore('guilds', {
				reminders: {
					adhan: {
						channelId: null,
						mentions: []
					}
				},
				name: null
			});
			// this.database.guilds._enforceTemplate();
			await this.database.createStore('users', { reminders: [] });
			// this.database.users._enforceTemplate()

			// let nextPrayer = await Adhan.next();
			// this.emit('adhanStart', nextPrayer); // emit for testing

			// store member stats in the guild? — this would not
			// require a database, and it would allow the server
			// owner to reset the stats whenever they'd like.
			// await this.database.createStore('members', {
			// 	guilds: []
			// });
		});
		this.database.on('error', error => {
			console.error("Database:", error.message);
		});
		this.database.on('disconnected', () => {
			console.warn("I've lost connection to the database!");
		})
	}

	#import(directory, callback) {
		return new Promise((resolve, reject) => {
			readdir(directory, async (error, events) => {
				if (error) reject(error);
				let result = [];
				for (const event of events) {
					if (extname(event)) {
						result.push(await import(`.${directory}/${event}`).then(function (data) {
							return [
								directory.split('/').slice(2).concat(/^index\.js$/.test(event) ? '' : event.replace(extname(event), '')).map((event, index) => index > 0 ? event.replace(/^./, m => m.toUpperCase()) : event).join(''),
								data
							]
						}));
					} else {
						result.push(...await this.#import(`${directory}/${event}`));
					}
				}

				result = new Map(result);
				typeof callback == 'function' && callback(result);
				resolve(result)
			})
		})
	}

	async config() {
		if (!existsSync('.env')) return;
		return new Promise((resolve, reject) => {
			readFile('.env', (err, data) => {
				if (err !== null) reject(err);
				const content = data.toString();
				if (content.length > 0) {
					for (const match of content.split('\n')) {
						const [key, value] = match.split(/[\s=]+/, 2);
						if (!key || !value) continue;
						process.env[key] = value;
					}
				}
				resolve()
			})
		})
	}

	async connectClients() {
		await this.database.connect('433783980345655306').catch(err => {
			console.warn('Database anchor guild not found!', err.message)
		})
	}

	async login() {
		await this.#import("./events", events => {
			events.forEach((event, name) => {
				this.on(name, event.default)
			})
		});

		await this.#import("./interactions", events => {
			events.forEach(({ default: module }, name) => {
				'description' in module && (module.name ??= name.replace(/.*(?=[A-Z])/, '').toLowerCase());
				if ('menus' in module) {
					for (const menu in module.menus) {
						if (typeof module.menus[menu] != 'object') continue;
						module.menus[menu].name ??= name.replace(/.*(?=[A-Z])/, '').toLowerCase();
					}
				}
				// this.commands.set(name, module);
				this.interactions.on(name, module)
			})
		});

		this.developerMode && (await this.config(),
		arguments[0] = process.env.DEV_TOKEN);
		return super.login(...arguments)
	}

	setCommands() {
		const { commands } = (this.developerMode ? this.guilds.cache.get(this.supportServerId) : this.application);
		return commands.set(Array.from(this.interactions.values()).reduce((commands, data) => {
			if (typeof data.menus == 'object' && data.menus !== null) {
				for (let menu in data.menus) {
					commands.push(data.menus[menu]);
				}
				delete data.menus;
			}
			if (!data.name) return commands;
			return commands.concat(data)
		}, []))
	}

	#presenceTimeout = null;
	setPresence(presence, timeout = 6e4) {
		presence && (this.#idleTimeout && clearTimeout(this.#idleTimeout),
		this.#presenceTimeout && clearTimeout(this.#presenceTimeout),
		this.#presenceTimeout = setTimeout(() => this.user.presence.set(this._defaultPresence), timeout ?? 6e4));
		return this.user.presence.set(presence || this._defaultPresence)
	}

	#idleTimeout = null;
	setIdle(status = true, timeout = 6e4) {
		status || this.#presenceTimeout || (this.#idleTimeout && clearTimeout(this.#idleTimeout),
		this.#idleTimeout = setTimeout(() => this.user.setStatus('idle'), timeout ?? 6e4));
		return this.user.setStatus(status ? 'idle' : 'online')
	}

	async updateCommands() {
		const { commands } = (this.developerMode ? this.guilds.cache.get(this.supportServerId) : this.application);
		const live = await commands.fetch();
		const newCommands = new Map(Array.from(this.interactions.entries()).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([key, value]) => [key, typeof value == 'object' ? Object.assign(new value.constructor, value) : value]))]));
		// console.log(live)
		for (const command of live.values()) {
			// await command.delete();
			let newCommand = this.interactions.get(command.name, command.type);
			if (!newCommand) {
				await command.delete();
				live.delete(command.id);
				this.emit('applicationCommandDelete', command);
				console.log('Deleted Command:', command.name, command.type);
			} else if (this.interactions.constructor.prototype.delete.call(newCommands, command.name, command.type)) {
				if (command.type != 1) {
					for (let menu of Object.values(newCommand.menus).filter(menu => menu.name == command.name && menu.type == command.type)) {
						newCommand = menu;
						break
					}
				}
				newCommand.options && (command.constructor.optionsEqual(command.options, newCommand.options, true) || (this.emit('applicationCommandUpdate', await command.edit(newCommand)),
				console.log('Edited Command:', command.name, command.type)))
			}
		}

		for (const data of newCommands.values()) {
			const clone = Object.assign({}, data);
			if (typeof data.menus == 'object' && data.menus !== null) {
				let menus = Object.values(data.menus);
				for (let menu of menus.filter(menu => typeof menu == 'object')) {
					this.emit('applicationCommandCreate', await commands.create(menu));
				}
				delete clone.menus;
			}
			if (!clone.name) continue;
			this.emit('applicationCommandCreate', await commands.create(clone))
		}

		this.emit('applicationCommandRefresh', commands)
	}
}