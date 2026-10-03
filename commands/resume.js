const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");

module.exports = {
  name: "resume",
  usage: "/resume",
  category: "Bot",
  description: "Resume the paused song.",
  run: async (client, interaction) => {
    const queue = await requireQueue(interaction);
    if (!queue) return;
    if (!queue.paused) return reply(interaction, tr(interaction, "error.musicalreadyplaying"));
    await queue.resume();
    return reply(interaction, tr(interaction, "succes.musicresummed"));
  },
};
