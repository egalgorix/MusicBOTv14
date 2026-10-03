const Music = require("../models/music");

function remember(client, interaction, song, query, messageId) {
  const record = {
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    interactionId: messageId || "",
    music: query,
    userId: interaction.user.id,
    title: song.name || "",
    uploader: song.uploader?.name || "",
    time: song.formattedDuration || "",
    views: song.views == null ? "" : String(song.views),
    thumbnail: song.thumbnail || "",
    video: song.url || "",
  };
  client.nowPlaying.set(interaction.guild.id, record);
  if (!client.mongoReady) return;
  Music.findOneAndUpdate({ guildId: record.guildId }, record, {
    upsert: true,
    setDefaultsOnInsert: true,
  }).catch((err) => console.error("[mongo]", err.message));
}

async function forget(client, guildId) {
  client.nowPlaying.delete(guildId);
  if (!client.mongoReady) return;
  await Music.deleteOne({ guildId }).catch((err) => console.error("[mongo]", err.message));
}

function ownerId(client, guildId) {
  return client.nowPlaying.get(guildId)?.userId || null;
}

module.exports = { remember, forget, ownerId };
