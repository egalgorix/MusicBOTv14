const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");

module.exports = {
  name: "pause",
  usage: "/pause",
  category: "Bot",
  description: "Pause the current song.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction);
    if (!queue) return;
    if (queue.paused) return reply(interaction, tr(interaction, "error.musicalreadystoped"));
    await queue.pause();
    return reply(interaction, tr(interaction, "succes.musicpaused"));
  },
};
