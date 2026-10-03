const { EmbedBuilder } = require("discord.js");
const { tr, reply } = require("../lib/reply");
const { footer } = require("../lib/embeds");
const config = require("../config");

const ORDER = ["play", "pause", "resume", "skip", "stop", "list", "nowplaying", "ping", "help"];

function commandText(interaction, name) {
  const text = tr(interaction, `help.commands.${name}`);
  return text.startsWith("help.commands.") ? null : text;
}

module.exports = {
  name: "help",
  usage: "/help",
  category: "Bot",
  description: "Show the commands. Only a Discord token is required.",
  descriptionLocalizations: {
    tr: "Komutları gösterir. Sadece Discord token gerekir.",
    fr: "Affiche les commandes. Seul le token Discord est nécessaire.",
  },
  options: [
    {
      name: "command",
      description: "One command, for example play",
      descriptionLocalizations: {
        tr: "Tek komut, örneğin play",
        fr: "Une commande, par exemple play",
      },
      type: 3,
      required: false,
    },
  ],
  run: async (client, interaction) => {
    const asked = interaction.options.getString("command")?.replace(/^\//, "").toLowerCase();
    if (asked) {
      const text = commandText(interaction, asked);
      if (!text) {
        return reply(interaction, { content: tr(interaction, "error.unknowncommand"), ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(config.embed.info)
        .setTitle(`/${asked}`)
        .setDescription(text)
        .setFooter(footer());
      return reply(interaction, { embeds: [embed], ephemeral: true });
    }

    const lines = ORDER.map((name) => `**/${name}** — ${commandText(interaction, name) || name}`);
    const embed = new EmbedBuilder()
      .setColor(config.embed.info)
      .setTitle(tr(interaction, "help.title"))
      .setDescription(
        `${tr(interaction, "help.intro")}\n\n${lines.join("\n")}\n\n**${tr(interaction, "help.usage")}**\n${tr(interaction, "help.examples")}\n\n${tr(interaction, "help.buttons")}`
      )
      .setFooter(footer());
    return reply(interaction, { embeds: [embed], ephemeral: true });
  },
};
