function remember(client, interaction, song, query, messageId) {
  client.nowPlaying.set(interaction.guild.id, {
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
  });
}

function forget(client, guildId) {
  client.nowPlaying.delete(guildId);
}

function ownerId(client, guildId) {
  return client.nowPlaying.get(guildId)?.userId || null;
}

module.exports = { remember, forget, ownerId };
