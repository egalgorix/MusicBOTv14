const mongoose = require("mongoose");

const music = new mongoose.Schema({
  guildId: { type: String, index: true },
  channelId: String,
  interactionId: String,
  music: String,
  userId: String,
  title: String,
  uploader: String,
  time: String,
  views: String,
  thumbnail: String,
  video: String,
});

module.exports = mongoose.models.music || mongoose.model("music", music);
