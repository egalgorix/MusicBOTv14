const fs = require("fs");

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === "ffmpeg") return candidate;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function resolveFfmpegPath() {
  let staticPath = null;
  try {
    staticPath = require("ffmpeg-static");
  } catch {
    staticPath = null;
  }
  let installerPath = null;
  try {
    installerPath = require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    installerPath = null;
  }
  return (
    firstExisting([process.env.FFMPEG_PATH, staticPath, installerPath]) || "ffmpeg"
  );
}

module.exports = { resolveFfmpegPath };
