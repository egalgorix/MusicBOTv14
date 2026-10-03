const { ExtractorPlugin, Song } = require("distube");

const AUDIO_EXT = /\.(mp3|ogg|opus|wav|flac|m4a|aac|webm|mp4)(?:$|\?)/i;

class DirectPlugin extends ExtractorPlugin {
  validate(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      return AUDIO_EXT.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  async resolve(url, options) {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.split("/").pop() || "audio");
    return new Song(
      {
        plugin: this,
        source: "direct",
        playFromSource: true,
        id: url,
        name,
        url,
        duration: 0,
      },
      options
    );
  }

  searchSong() {
    return null;
  }

  getRelatedSongs() {
    return [];
  }

  getStreamURL(song) {
    return song.url;
  }
}

module.exports = { DirectPlugin };
