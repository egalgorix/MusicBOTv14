const { tr, reply } = require("./reply");

async function requireGuild(interaction) {
  if (interaction.guild && interaction.member) return true;
  await reply(interaction, { content: tr(interaction, "error.dmerror"), ephemeral: true });
  return false;
}

async function requireQueue(interaction, { sameChannel = true } = {}) {
  if (!(await requireGuild(interaction))) return null;
  const queue = interaction.client.distube.getQueue(interaction.guildId);
  if (!queue || queue.songs.length === 0) {
    await reply(interaction, tr(interaction, "error.nosonglist"));
    return null;
  }
  if (sameChannel) {
    const voice = interaction.member.voice?.channel;
    if (!voice || voice.id !== queue.voiceChannel?.id) {
      await reply(interaction, tr(interaction, "error.notsamechannel"));
      return null;
    }
  }
  return queue;
}

function humanListeners(channel) {
  if (!channel) return 0;
  let count = 0;
  for (const [, state] of channel.guild.voiceStates.cache) {
    if (state.channelId !== channel.id) continue;
    if (state.id === channel.client.user?.id) continue;
    if (state.member?.user?.bot) continue;
    count += 1;
  }
  return count;
}

module.exports = { requireGuild, requireQueue, humanListeners };
