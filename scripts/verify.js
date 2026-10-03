const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const { Readable } = require("stream");
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const { generateDependencyReport } = require("@discordjs/voice");

const { initI18n } = require("../lib/i18n");
const { resolveFfmpegPath } = require("../lib/ffmpeg");
const { YouTubePlugin, parseYouTubeUrl, extractPlayable, classifyYouTubeError } = require("../plugins/youtube");
const { DirectPlugin } = require("../plugins/direct");
const config = require("../config");

const failures = [];

function check(name, ok, detail) {
  if (ok) console.log(`ok  ${name}`);
  else {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    failures.push(name);
  }
}

function ffmpegRead(ffmpeg, url) {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-i",
      url,
      "-t",
      "1",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ];
    const proc = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let err = "";
    proc.stdout.on("data", (chunk) => chunks.push(chunk));
    proc.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    proc.on("error", reject);
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out ${err}`));
    }, 15000);
    proc.on("close", (code) => {
      clearTimeout(timer);
      const size = Buffer.concat(chunks).length;
      if (size < 1000) reject(new Error(`ffmpeg code ${code}, ${size} bytes, ${err.slice(-500)}`));
      else resolve(size);
    });
  });
}

async function main() {
  const ffmpeg = resolveFfmpegPath();
  let version = "";
  try {
    version = execFileSync(ffmpeg, ["-version"], { encoding: "utf8" }).split("\n")[0];
  } catch (err) {
    version = "";
    check("ffmpeg", false, err.message);
  }
  if (version) check("ffmpeg", true, version);

  await initI18n();
  const { t } = require("i18next");
  for (const lng of ["en-US", "tr", "fr"]) {
    const text = t("error.nosonglist", { ns: "common", lng });
    check(`i18n ${lng}`, text && !text.startsWith("error."), text);
    const botCheck = t("error.ytbotcheck", { ns: "common", lng });
    check(`i18n bot-check ${lng}`, botCheck && !/ytbotcheck|YOUTUBE_COOKIE/i.test(botCheck), botCheck);
    const help = t("help.commands.play", { ns: "common", lng });
    check(`help ${lng}`, help && !help.startsWith("help."), help);
  }
  check(
    "english resume string",
    t("succes.musicresummed", { ns: "common", lng: "en-US" }) === "Resumed."
  );

  const samples = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/playlist?list=PLtest", "playlist", "PLtest"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest", "video", "dQw4w9WgXcQ"],
    ["never gonna give you up", null, null],
  ];
  for (const [input, type, id] of samples) {
    const parsed = parseYouTubeUrl(input);
    check(
      `parse ${input}`,
      type ? parsed?.type === type && parsed?.id === id : parsed === null,
      JSON.stringify(parsed)
    );
  }
  check(
    "bot-check classifier",
    classifyYouTubeError(new Error("Sign in to confirm you're not a bot")) === "YT_BOT_CHECK"
  );
  const extracts = [
    ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["şunu çal https://www.youtube.com/watch?v=dQw4w9WgXcQ lütfen", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["bak https://youtube.com/shorts/dQw4w9WgXcQ.", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["youtu.be/dQw4w9WgXcQ dinle", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["https://www.youtube.com/playlist?list=PLtest", "https://www.youtube.com/playlist?list=PLtest"],
    ["Duman Senden Daha Güzel", "Duman Senden Daha Güzel"],
  ];
  for (const [input, expected] of extracts) {
    check(`extract ${input}`, extractPlayable(input) === expected, extractPlayable(input));
  }

  const commands = fs.readdirSync(path.join(__dirname, "..", "commands")).filter((file) => file.endsWith(".js"));
  check("commands present", commands.length >= 8, String(commands.length));
  for (const file of commands) {
    const command = require(path.join(__dirname, "..", "commands", file));
    check(
      `command ${file}`,
      command.name && typeof command.run === "function" && command.description
    );
  }

  const direct = new DirectPlugin();
  check("direct audio", direct.validate("https://cdn.example/song.mp3") === true);
  check("direct rejects page", direct.validate("https://example.com/watch") === false);

  const opusOk = (() => {
    try {
      require("@discordjs/opus");
      return "native";
    } catch {
      try {
        require("opusscript");
        return "opusscript";
      } catch {
        return "";
      }
    }
  })();
  check("opus encoder", Boolean(opusOk), opusOk || "missing");

  const report = generateDependencyReport();
  check("dave protocol", report.includes("@snazzah/davey") && !report.includes("@snazzah/davey: not found"), report);
  check("libsodium", report.includes("libsodium-wrappers") && !/libsodium-wrappers:\s+not found/.test(report));

  const wav = path.join(os.tmpdir(), `musicbot-verify-${process.pid}.wav`);
  execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-f", "wav", wav], {
    stdio: "pipe",
  });
  const plugin = new YouTubePlugin();
  plugin.init({ debug() {} });
  await plugin.ready;
  plugin.downloadAudio = async () => Readable.toWeb(fs.createReadStream(wav));
  const url = await plugin.getStreamURL({ id: "dQw4w9WgXcQ" });
  check("proxy url", url.startsWith("http://127.0.0.1:") && url.endsWith("/audio/dQw4w9WgXcQ"), url);
  try {
    const bytes = await ffmpegRead(ffmpeg, url);
    check("ffmpeg reads proxied audio", bytes > 1000, String(bytes));
  } catch (err) {
    check("ffmpeg reads proxied audio", false, err.message);
  }
  plugin.close();
  fs.unlinkSync(wav);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const yt = new YouTubePlugin();
  const distube = new DisTube(client, {
    plugins: [yt, direct],
    ffmpeg: { path: ffmpeg },
    nsfw: false,
  });
  check("distube", distube.version.startsWith("5."), distube.version);
  check("youtube plugin type", yt.type === "extractor");
  await yt.ready;
  yt.close();
  client.destroy();

  check("placeholder token is not treated as real", config.hasToken === false || Boolean(process.env.DISCORD_TOKEN));
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  const youtubeSource = fs.readFileSync(path.join(__dirname, "..", "plugins", "youtube.js"), "utf8");
  check("no mongoose", !indexSource.includes("mongoose") && !fs.existsSync(path.join(__dirname, "..", "models", "music.js")));
  check("no extra token prompts", !/YOUTUBE_COOKIE|SPOTIFY_CLIENT|MONGO/.test(indexSource + youtubeSource));
  const pkg = require("../package.json");
  check(
    "package dropped broken extractors",
    !pkg.dependencies["@distube/ytdl-core"] &&
      !pkg.dependencies["discord-player"] &&
      !pkg.dependencies["@distube/yt-dlp"] &&
      !pkg.dependencies["ffmpeg-static"] &&
      !pkg.dependencies.mongoose
  );
  check("help command", commands.includes("help.js"));
  require("../index");
  check("index module loads", true);

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
