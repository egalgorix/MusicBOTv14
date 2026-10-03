const { PermissionsBitField } = require("discord.js");
const { tr, reply } = require("../lib/reply");
const { requireGuild } = require("../lib/voice");
const { songEmbed, controlRow, errorEmbed } = require("../lib/embeds");
const { remember } = require("../lib/session");

module.exports = {
  name: "play",
  usage: "/play <name>",
  category: "Bot",
  description: "Play a song or playlist.",
  options: [
    {
      name: "music_name",
      description: "Song name or a YouTube, Spotify, SoundCloud or Deezer link",
      type: 3,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    if (!(await requireGuild(interaction))) return;
    const query = interaction.options.getString("music_name", true).trim();
    const voiceChannel = interaction.member.voice?.channel;
    if (!voiceChannel) {
      return reply(interaction, { content: tr(interaction, "error.notvoicechannel"), ephemeral: true });
    }
    const me = interaction.guild.members.me;
    const perms = me ? voiceChannel.permissionsFor(me) : null;
    if (
      perms &&
      (!perms.has(PermissionsBitField.Flags.Connect) || !perms.has(PermissionsBitField.Flags.Speak))
    ) {
      return reply(interaction, { content: tr(interaction, "error.botnoperm"), ephemeral: true });
    }
    const existing = client.distube.getQueue(interaction.guildId);
    if (existing?.voiceChannel && existing.voiceChannel.id !== voiceChannel.id) {
      return reply(interaction, { content: tr(interaction, "error.notsamechannel"), ephemeral: true });
    }

    await interaction.deferReply();
    const before = existing?.songs.length || 0;
    try {
      await client.distube.play(voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
        metadata: { query, userId: interaction.user.id },
      });
    } catch (err) {
      console.error("[play]", err);
      if (before === 0) {
        const stuck = client.distube.getQueue(interaction.guildId);
        if (stuck) await stuck.stop().catch(() => {});
        client.distube.voices.leave(interaction.guildId);
      }
      return interaction.editReply({ embeds: [errorEmbed(interaction, err)] }).catch(() => {});
    }

    const queue = client.distube.getQueue(interaction.guildId);
    const song = queue?.songs[Math.min(before, (queue?.songs.length || 1) - 1)] || queue?.songs[0];
    if (!queue || !song) {
      return interaction.editReply({ content: tr(interaction, "succes.tracksplayed") }).catch(() => {});
    }
    const embed = songEmbed(song, interaction, {
      queued: before > 0,
      queueLength: queue.songs.length,
    });
    const message = await interaction.editReply({
      embeds: [embed],
      components: [controlRow("volume", "loop")],
    });
    remember(client, interaction, song, query, message?.id);
  },
};
