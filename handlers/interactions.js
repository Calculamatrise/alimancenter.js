export default class extends Map {
	on(event, listener) {
		if (typeof event != 'string') {
			throw TypeError("INVALID_LISTENER");
		}

		return this.set(event, listener)
	}

	emit(event, ...args) {
		if (typeof event != 'string') {
			throw new TypeError("INVALID_EVENT");
		}

		let structure = this.get(event);
		if (typeof structure.execute == 'function') {
			return structure.execute(...args);
		}

		return false
	}

	delete(event, type) {
		if (type > 1) {
			let result = false;
			for (const [name, entry] of Array.from(this.entries()).filter(([, { menus }]) => typeof menus == 'object')) {
				for (const menu in entry.menus) {
					if (entry.menus[menu].name == event) {
						result = delete entry.menus[menu];
						if (Object.keys(entry.menus) < 1) {
							delete entry.menus;
							entry.name || super.delete(name)
						}
					}
				}
			}

			return result
		}

		const keys = Array.from(this.entries()).filter(([key, value]) => !value.menus && key.startsWith(event)).map(([key]) => key);
		if (!super.has(event) || keys.length > 1) {
			for (const key of keys) {
				super.delete(key);
			}

			return keys.length > 0
		}

		return super.delete(event)
	}

	get(event, type) {
		if (type > 1) {
			for (const item of this.values()) {
				for (const menu in item.menus) {
					if (item.menus[menu].name == event) {
						return item
					}
				}
			}

			return null
		}

		return super.get(event) ?? null
	}

	has(event, type) {
		if (type > 1) {
			for (const item of this.values()) {
				for (const menu in item.menus) {
					if (item.menus[menu].name == event) {
						return true
					}
				}
			}

			return false
		}

		return super.has(event)
	}

	getApplicationCommands() {
		return Array.from(this.values()).reduce((commands, data) => {
			data = deepClone(data);
			if (typeof data.menus == 'object' && data.menus !== null) {
				let menus = Object.values(data.menus);
				for (let menu of menus.filter(menu => typeof menu == 'object')) {
					commands.push(menu);
				}
				delete data.menus;
			}
			if (!data.name) return commands;
			return commands.concat(data)
		}, [])
	}

	filterOutdatedCommands(commands) {

	}
}

function deepClone(object) {
	let clone = new object.constructor();
	for (let key in object) {
		if (object[key] instanceof Object) {
			clone[key] = deepClone(object[key]);
			continue;
		}

		clone[key] = object[key];
	}
	return clone
}