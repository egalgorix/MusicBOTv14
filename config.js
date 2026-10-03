const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

// Edit these, or set the environment variables in .env.example. Env wins.
const fileConfig = {
  token: "TOKEN",
  mongodb: "MONGOURL",
};

const token = pick(process.env.DISCORD_TOKEN, process.env.TOKEN, fileConfig.token);
const mongodb = pick(process.env.MONGO_URL, process.env.MONGODB, process.env.MONGOURL, fileConfig.mongodb);

module.exports = {
  token,
  mongodb,
  guildId: pick(process.env.GUILD_ID, ""),
  port: Number(process.env.PORT || 3000),
  leaveEmptyDelay: Number(process.env.LEAVE_EMPTY_DELAY || 15000),
  ready: ["Power By FastUptime", "Produced by FastUptime", "www.fastuptime.com"],
  ready_event_loop_time: 5000,
  embed: {
    error: "FF0000",
    success: "00FF00",
    info: "0000ff",
    warning: "ffff00",
  },
  footer: {
    text: "2022-2026 FastUptime All Rights Reserved.",
    icon: "https://www.technopat.net/sosyal/data/avatars/o/472/472796.jpg?1648288120",
  },
  roles: {
    supporter: "1069586139272458334",
  },
  youtube: {
    cookie: process.env.YOUTUBE_COOKIE || "",
    client: process.env.YOUTUBE_CLIENT || "WEB",
    poToken: process.env.YOUTUBE_PO_TOKEN || "",
    playerId: process.env.YOUTUBE_PLAYER_ID || "",
  },
};

function isPlaceholder(value, placeholders) {
  if (!value) return true;
  return placeholders.includes(String(value).trim());
}

module.exports.hasToken = !isPlaceholder(token, ["TOKEN", "your-token", "BOT_TOKEN"]);
module.exports.hasMongo = !isPlaceholder(mongodb, ["MONGOURL", "your-mongo-url", "mongodb://localhost/placeholder"]);
