const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Events,
} = require("discord.js");
const chalk = require("chalk");
const { DisTube, Events: DisTubeEvents } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { DeezerPlugin } = require("@distube/deezer");
const config = require("./config");
const { initI18n } = require("./lib/i18n");
const { resolveFfmpegPath } = require("./lib/ffmpeg");
const { YouTubePlugin } = require("./plugins/youtube");
const { DirectPlugin } = require("./plugins/direct");
const { startHealthServer } = require("./server");
const { simpleEmbed } = require("./lib/embeds");
const { forget } = require("./lib/session");
const { humanListeners } = require("./lib/voice");
const { t } = require("i18next");

function localeOf(queue) {
  return queue?.textChannel?.guild?.preferredLocale || "en-US";
}

function announce(queue, titleKey, descriptionKey, color) {
  const channel = queue?.textChannel;
  if (!channel) return;
  const lng = localeOf(queue);
  const embed = simpleEmbed(
    t(titleKey, { ns: "common", lng }),
    t(descriptionKey, { ns: "common", lng }),
    color
  );
  channel.send({ embeds: [embed] }).catch((err) => console.error("[announce]", err.message));
}

async function main() {
  await initI18n();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  client.config = config;
  client.nowPlaying = new Map();
  client.emptyTimers = new Map();

  const ffmpegPath = resolveFfmpegPath();
  const youtube = new YouTubePlugin();
  client.youtube = youtube;
  client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    joinNewVoiceChannel: false,
    nsfw: false,
    savePreviousSongs: true,
    ffmpeg: { path: ffmpegPath },
    plugins: [
      youtube,
      new SoundCloudPlugin(),
      new DirectPlugin(),
      new SpotifyPlugin(),
      new DeezerPlugin(),
    ],
  });

  require("./loader")(client);
  require("./handlers/controls")(client);
  startHealthServer(client, config);

  client.distube.on(DisTubeEvents.INIT_QUEUE, (queue) => {
    queue.autoplay = false;
  });

  client.distube.on(DisTubeEvents.PLAY_SONG, (queue, song) => {
    if (!queue.previousSongs.length) return;
    const lng = localeOf(queue);
    const embed = simpleEmbed(
      t("music.nowplaying", { ns: "common", lng }),
      `**[${song.name}](${song.url})**\n${song.formattedDuration || ""}`,
      config.embed.success
    );
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
  });

  client.distube.on(DisTubeEvents.FINISH, (queue) => {
    try {
      queue.voice?.leave();
    } catch (err) {
      console.error("[finish]", err.message);
    }
    announce(queue, "music.finished_title", "music.finished_desc", config.embed.info);
    forget(client, queue.id);
  });

  client.distube.on(DisTubeEvents.DISCONNECT, (queue) => {
    const timer = client.emptyTimers.get(queue.id);
    if (timer) clearTimeout(timer);
    client.emptyTimers.delete(queue.id);
    forget(client, queue.id);
  });

  client.distube.on(DisTubeEvents.ERROR, (error, queue) => {
    console.error("[DisTube]", error);
    const channel = queue?.textChannel;
    if (!channel) return;
    const lng = localeOf(queue);
    const code = error?.errorCode || error?.code || "";
    const key =
      code === "YT_BOT_CHECK"
        ? "error.ytbotcheck"
        : code === "YT_RATELIMIT"
          ? "error.ytratelimit"
          : code === "FFMPEG_NOT_INSTALLED"
            ? "error.ffmpeg"
            : "error.musicerrordescription";
    const embed = simpleEmbed(
      t("error.musicerrortitle", { ns: "common", lng }),
      t(key, { ns: "common", lng }),
      config.embed.error
    );
    channel.send({ embeds: [embed] }).catch(() => {});
  });

  if (process.env.DEBUG) {
    client.distube.on(DisTubeEvents.DEBUG, (message) => console.log(chalk.gray(`[debug] ${message}`)));
    client.distube.on(DisTubeEvents.FFMPEG_DEBUG, (message) => console.log(chalk.gray(`[ffmpeg] ${message}`)));
  }

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    const botChannel = client.distube.voices.get(guild.id)?.channel;
    if (!botChannel) return;
    if (oldState.channelId !== botChannel.id && newState.channelId !== botChannel.id) return;
    if (humanListeners(botChannel) > 0) {
      const pending = client.emptyTimers.get(guild.id);
      if (pending) clearTimeout(pending);
      client.emptyTimers.delete(guild.id);
      return;
    }
    if (client.emptyTimers.has(guild.id)) return;
    const timer = setTimeout(() => {
      client.emptyTimers.delete(guild.id);
      const still = client.distube.voices.get(guild.id)?.channel;
      if (!still || humanListeners(still) > 0) return;
      const queue = client.distube.getQueue(guild.id);
      if (queue) announce(queue, "music.empty_title", "music.empty_desc", config.embed.warning);
      client.distube.voices.leave(guild.id);
      queue?.stop().catch(() => {});
    }, config.leaveEmptyDelay);
    client.emptyTimers.set(guild.id, timer);
  });

  client.once(Events.ClientReady, async () => {
    console.log(chalk.hex("#067A00").bold("[Bot]:"), chalk.bold.blue(`${client.user.username} ready`));
    console.log(
      chalk.bold.magenta("[SlashCommands]:"),
      chalk.bold.blue(`${client.slashCommands.size} commands loaded.`)
    );
    const statuses = config.ready;
    setInterval(() => {
      const name = statuses[Math.floor(Math.random() * statuses.length)];
      client.user.setPresence({
        activities: [{ name, type: ActivityType.Listening }],
        status: "online",
      });
    }, config.ready_event_loop_time);
  });

  if (!config.hasToken) {
    console.error(
      chalk.hex("#FF0000").bold("[Bot]:"),
      "config.js içindeki token alanına sadece Discord bot tokenini yaz. Başka anahtar yok."
    );
    youtube.close();
    process.exit(1);
  }

  await client.login(config.token);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
