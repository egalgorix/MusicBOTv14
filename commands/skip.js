const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");
const { simpleEmbed, controlRow } = require("../lib/embeds");
const config = require("../config");

module.exports = {
  name: "skip",
  usage: "/skip",
  category: "Bot",
  description: "Skip the current song.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction);
    if (!queue) return;
    if (queue.songs.length < 2) {
      return reply(interaction, tr(interaction, "error.nosongqueue"));
    }
    await interaction.deferReply();
    let song;
    try {
      song = await queue.skip();
    } catch (err) {
      console.error("[skip]", err);
      return interaction.editReply(tr(interaction, "error.nosongqueue")).catch(() => {});
    }
    const embed = simpleEmbed(
      tr(interaction, "succes.songskipsucces"),
      song?.url ? `**[${song.name}](${song.url})**` : tr(interaction, "succes.songskipsucces"),
      config.embed.success
    );
    if (song?.uploader?.name) {
      embed.addFields({
        name: tr(interaction, "music.author"),
        value: song.uploader.url ? `[${song.uploader.name}](${song.uploader.url})` : song.uploader.name,
        inline: true,
      });
    }
    if (song?.formattedDuration) {
      embed.addFields({
        name: tr(interaction, "music.time"),
        value: song.formattedDuration,
        inline: true,
      });
    }
    if (song?.thumbnail) embed.setImage(song.thumbnail);
    return interaction
      .editReply({ embeds: [embed], components: [controlRow("volumes", "loops")] })
      .catch((err) => console.error("[skip]", err.message));
  },
};
