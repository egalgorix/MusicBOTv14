const { PermissionsBitField } = require("discord.js");
const { tr, reply } = require("../lib/reply");
const { requireGuild } = require("../lib/voice");
const { songEmbed, controlRow, errorEmbed } = require("../lib/embeds");
const { remember } = require("../lib/session");
const { extractPlayable } = require("../plugins/youtube");

module.exports = {
  name: "play",
  usage: "/play <name>",
  category: "Bot",
  description: "Play a song name or a YouTube link.",
  descriptionLocalizations: {
    tr: "Şarkı adı veya YouTube linki çalar.",
    fr: "Joue un titre ou un lien YouTube.",
  },
  options: [
    {
      name: "music_name",
      description: "Song name, or a YouTube video, Shorts or playlist link",
      descriptionLocalizations: {
        tr: "Şarkı adı ya da YouTube video, Shorts veya çalma listesi linki",
        fr: "Titre, ou lien YouTube, Shorts ou playlist",
      },
      type: 3,
      required: true,
    },
  ],
  run: async (client, interaction) => {
    if (!(await requireGuild(interaction))) return;
    const query = extractPlayable(interaction.options.getString("music_name", true));
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
