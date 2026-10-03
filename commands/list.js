const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");
const { footer, clip } = require("../lib/embeds");

module.exports = {
  name: "list",
  usage: "/list",
  category: "Bot",
  description: "Show the current queue.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction, { sameChannel: false });
    if (!queue) return;
    if (queue.songs.length === 1) return reply(interaction, tr(interaction, "error.nosongqueue"));
    const lines = queue.songs.slice(0, 25).map((song, index) => {
      const title = clip(song.name || song.id, 80);
      const duration = song.formattedDuration || "—";
      const prefix = index === 0 ? "▶" : `${index + 1}.`;
      return song.url
        ? `${prefix} [${title}](${song.url}) \`${duration}\``
        : `${prefix} ${title} \`${duration}\``;
    });
    const hidden = queue.songs.length - lines.length;
    let description = lines.join("\n");
    if (hidden > 0) description += `\n… +${hidden}`;
    const embed = new EmbedBuilder()
      .setTitle(tr(interaction, "music.queue"))
      .setDescription(clip(description, 4000))
      .setColor(config.embed.success)
      .setFooter(footer());
    return reply(interaction, { embeds: [embed] });
  },
};
