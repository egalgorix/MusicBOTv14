const { requireQueue } = require("../lib/voice");
const { nowPlayingEmbed } = require("../lib/embeds");

module.exports = {
  name: "nowplaying",
  usage: "/nowplaying",
  category: "Bot",
  description: "Show the currently playing song.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction, { sameChannel: false });
    if (!queue) return;
    return interaction
      .reply({ embeds: [nowPlayingEmbed(queue, interaction)] })
      .catch((err) => console.error("[nowplaying]", err.message));
  },
};
