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

// Sadece bunu doldur. Mongo, YouTube çerezi, Spotify anahtarı yok.
const fileConfig = {
  token: "",
};

const token = process.env.DISCORD_TOKEN || process.env.TOKEN || fileConfig.token;

module.exports = {
  token,
  guildId: process.env.GUILD_ID || "",
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
};

const placeholders = new Set(["", "TOKEN", "your-token", "BOT_TOKEN", "MONGOURL"]);
module.exports.hasToken = !placeholders.has(String(token || "").trim());
