const { EmbedBuilder } = require("discord.js");
const { t } = require("i18next");
const { footer } = require("../lib/embeds");

module.exports = {
  name: "ping",
  usage: "/ping",
  category: "Bot",
  description: "Show bot latency.",
  run: async (client, interaction) => {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Pong!")
      .addFields(
        {
          name: `${t("ping.discord_latency", { lng: interaction.locale })}:`,
          value: `${client.ws.ping}ms`,
          inline: true,
        },
        {
          name: `${t("ping.bot_latency", { lng: interaction.locale })}:`,
          value: `${Date.now() - interaction.createdTimestamp}ms`,
          inline: true,
        }
      )
      .setFooter(footer());
    return interaction.reply({ embeds: [embed] }).catch((err) => console.error("[ping]", err.message));
  },
};
