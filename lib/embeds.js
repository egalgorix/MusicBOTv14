const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const { tr } = require("./reply");

function footer() {
  const footerData = { text: config.footer.text };
  if (config.footer.icon) footerData.iconURL = config.footer.icon;
  return footerData;
}

function clip(value, max = 1024) {
  const text = value == null || value === "" ? "—" : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatNumber(views) {
  const value = Number(views);
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function progressBar(current, total) {
  const width = 16;
  if (!total || total <= 0) return `🔘${"▬".repeat(width)}`;
  const ratio = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(ratio * width);
  return `${"▬".repeat(filled)}🔘${"▬".repeat(Math.max(0, width - filled))}`;
}

function songEmbed(song, interaction, { queued = false, queueLength = 1 } = {}) {
  const title = queued
    ? tr(interaction, "succes.added")
    : tr(interaction, "succes.tracksplayed");
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(queued ? config.embed.info : config.embed.success)
    .setFooter(footer())
    .addFields(
      { name: tr(interaction, "music.title"), value: clip(song.name, 256), inline: true },
      { name: tr(interaction, "music.author"), value: authorLine(song, interaction), inline: true },
      {
        name: tr(interaction, "music.time"),
        value: clip(song.formattedDuration || song.duration || "—"),
        inline: true,
      },
      {
        name: tr(interaction, "music.views"),
        value: formatNumber(song.views),
        inline: true,
      },
      {
        name: tr(interaction, "music.video"),
        value: song.url ? `[${tr(interaction, "music.video")}](${song.url})` : "—",
        inline: true,
      }
    );
  if (queueLength > 1) {
    embed.addFields({
      name: tr(interaction, "music.queue"),
      value: String(queueLength),
      inline: true,
    });
  }
  if (song.thumbnail) embed.setImage(song.thumbnail);
  return embed;
}

function authorLine(song, interaction) {
  const name = song.uploader?.name || tr(interaction, "music.unknown");
  if (song.uploader?.url) return clip(`[${name}](${song.uploader.url})`, 1024);
  return clip(name, 1024);
}

function nowPlayingEmbed(queue, interaction) {
  const song = queue.songs[0];
  const embed = new EmbedBuilder()
    .setColor(config.embed.success)
    .setTitle(tr(interaction, "music.nowplaying"))
    .setDescription(`**[${clip(song.name, 200)}](${song.url || "https://youtube.com"})**`)
    .addFields(
      { name: tr(interaction, "music.author"), value: authorLine(song, interaction), inline: true },
      { name: tr(interaction, "music.volume"), value: `${queue.volume}%`, inline: true },
      { name: tr(interaction, "music.views"), value: formatNumber(song.views), inline: true },
      {
        name: tr(interaction, "music.likes"),
        value: song.likes == null ? "—" : formatNumber(song.likes),
        inline: true,
      },
      {
        name: tr(interaction, "music.filters"),
        value: clip(queue.filters.names.join(", ") || tr(interaction, "music.standard")),
        inline: true,
      },
      {
        name: tr(interaction, "music.progress"),
        value: clip(
          `${progressBar(queue.currentTime, song.duration)}\n${queue.formattedCurrentTime} / ${song.formattedDuration || "—"}`
        ),
        inline: false,
      }
    )
    .setFooter(footer());
  if (song.thumbnail) embed.setThumbnail(song.thumbnail);
  return embed;
}

function simpleEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color || config.embed.info)
    .setFooter(footer());
}

function controlRow(volumeId, loopId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setEmoji("🔊").setStyle(ButtonStyle.Secondary).setCustomId(volumeId),
    new ButtonBuilder().setEmoji("🌀").setStyle(ButtonStyle.Secondary).setCustomId(loopId)
  );
}

function errorEmbed(interaction, err) {
  const code = err?.errorCode || err?.code || "";
  let description = tr(interaction, "error.musicerrordescription");
  if (code === "NO_RESULT" || code === "NO_RELATED") description = tr(interaction, "error.noresult");
  else if (code === "NON_NSFW" || code === "AGE" || code === "UNAVAILABLE_VIDEO") {
    description = tr(interaction, "error.agerestricted");
  } else if (code === "YT_BOT_CHECK") description = tr(interaction, "error.ytbotcheck");
  else if (code === "YT_RATELIMIT") description = tr(interaction, "error.ytratelimit");
  else if (code === "FFMPEG_NOT_INSTALLED") description = tr(interaction, "error.ffmpeg");
  else if (code === "VOICE_MISSING_PERMS" || code === "VOICE_FULL" || code === "VOICE_CONNECT_FAILED") {
    description = tr(interaction, "error.botnoperm");
  } else if (code === "NO_UP_NEXT") description = tr(interaction, "error.nosongqueue");
  const detail = String(err?.message || "").replace(/\s+/g, " ").slice(0, 180);
  const embed = new EmbedBuilder()
    .setTitle(tr(interaction, "error.musicerrortitle"))
    .setDescription(description)
    .setColor(config.embed.error)
    .setFooter(footer());
  if (detail && detail !== description) {
    embed.addFields({ name: "Details", value: clip(detail, 180) });
  }
  return embed;
}

module.exports = {
  footer,
  clip,
  formatNumber,
  progressBar,
  songEmbed,
  nowPlayingEmbed,
  simpleEmbed,
  controlRow,
  errorEmbed,
};
