const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");
const { forget } = require("../lib/session");

module.exports = {
  name: "stop",
  usage: "/stop",
  category: "Bot",
  description: "Stop playback and clear the queue.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction);
    if (!queue) return;
    await queue.stop();
    await forget(client, interaction.guild.id);
    return reply(interaction, tr(interaction, "succes.musicstopped"));
  },
};
