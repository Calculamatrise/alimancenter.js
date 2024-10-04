export default async function(guild) {
	this.database.guilds.delete(guild.id).catch(err => {
		console.warn("Failed to delete guild from database:", err)
	})
}