const fs = require("fs");
const path = require("path");
const { Collection, InteractionContextType, ApplicationIntegrationType } = require("discord.js");
const { tr } = require("./lib/reply");

module.exports = function loadCommands(client) {
  client.commands = new Collection();
  client.slashCommands = new Collection();

  const dir = path.join(__dirname, "commands");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".js"));
  const payload = [];

  for (const file of files) {
    const command = require(path.join(dir, file));
    if (!command?.name || typeof command.run !== "function") continue;
    client.slashCommands.set(command.name, command);
    payload.push({
      name: command.name,
      description: String(command.description || "Music command").slice(0, 100),
      descriptionLocalizations: command.descriptionLocalizations,
      options: command.options,
      dmPermission: false,
      contexts: [InteractionContextType.Guild],
      integrationTypes: [ApplicationIntegrationType.GuildInstall],
    });
  }

  client.once("clientReady", async () => {
    try {
      if (client.config.guildId) {
        const guild = await client.guilds.fetch(client.config.guildId);
        await guild.commands.set(payload);
      } else {
        await client.application.commands.set(payload);
      }
      console.log(`[SlashCommands] ${payload.length} commands registered.`);
    } catch (err) {
      console.error("[SlashCommands]", err);
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) {
      await interaction
        .reply({ content: tr(interaction, "error.unknowncommand"), ephemeral: true })
        .catch(() => {});
      return;
    }
    try {
      await command.run(client, interaction, client.config);
    } catch (err) {
      console.error(`[command:${command.name}]`, err);
      const body = { content: tr(interaction, "error.commandfailed"), ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(body).catch(() => {});
      } else {
        await interaction.reply(body).catch(() => {});
      }
    }
  });
};
