const http = require("http");
const { Readable } = require("stream");
const { ExtractorPlugin, Playlist, Song, DisTubeError } = require("distube");
const { Innertube, ClientType } = require("youtubei.js");

const CLIENTS = {
  WEB: ClientType.WEB,
  MWEB: ClientType.MWEB,
  ANDROID: ClientType.ANDROID,
  IOS: ClientType.IOS,
  TV: ClientType.TV,
  TV_EMBEDDED: ClientType.TV_EMBEDDED,
  WEB_EMBEDDED: ClientType.WEB_EMBEDDED,
};

const VIDEO_ID = /^[\w-]{11}$/;

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value.text === "string") return value.text;
  if (typeof value.toString === "function") {
    const text = value.toString();
    if (text && text !== "[object Object]") return text;
  }
  return "";
}

function parseViews(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = textOf(value).replace(/,/g, "").replace(/\s*views?/i, "").trim();
  if (!text) return 0;
  const match = text.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) {
    const digits = Number(text.replace(/[^\d]/g, ""));
    return Number.isFinite(digits) ? digits : 0;
  }
  const amount = Number(match[1]);
  const unit = (match[2] || "").toUpperCase();
  const multiplier = unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1;
  return Math.round(amount * multiplier);
}

function canonicalYouTube(parsed) {
  if (!parsed) return null;
  if (parsed.type === "playlist") return `https://www.youtube.com/playlist?list=${encodeURIComponent(parsed.id)}`;
  return `https://www.youtube.com/watch?v=${parsed.id}`;
}

function extractPlayable(input) {
  const trimmed = String(input || "").trim();
  const whole = parseYouTubeUrl(trimmed);
  if (whole) return canonicalYouTube(whole);
  const candidates = [
    ...(trimmed.match(/https?:\/\/[^\s<>]+/gi) || []),
    ...(trimmed.match(/(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)\/[^\s<>]+|youtu\.be\/[\w-]+/gi) || []),
  ];
  for (const raw of candidates) {
    const cleaned = raw.replace(/[)\].,!?>]+$/g, "");
    const parsed = parseYouTubeUrl(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    if (parsed) return canonicalYouTube(parsed);
  }
  return trimmed;
}

function parseYouTubeUrl(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (VIDEO_ID.test(trimmed)) return { type: "video", id: trimmed };
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const youtubeHost =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com";
  if (!youtubeHost) return null;
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return VIDEO_ID.test(id || "") ? { type: "video", id } : null;
  }
  const list = url.searchParams.get("list");
  const video = url.searchParams.get("v");
  const pathId = url.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/);
  if (url.pathname === "/playlist" || (list && !video && !pathId)) {
    return list ? { type: "playlist", id: list } : null;
  }
  if (pathId) return { type: "video", id: pathId[1] };
  if (video && VIDEO_ID.test(video)) return { type: "video", id: video };
  return null;
}

function classifyYouTubeError(err) {
  const message = String(err?.message || err || "");
  if (/sign in to confirm|not a bot|LOGIN_REQUIRED|confirm you.?re not a bot/i.test(message)) {
    return "YT_BOT_CHECK";
  }
  if (/429|too many requests/i.test(message)) return "YT_RATELIMIT";
  if (/age.?restrict|confirm your age|AGE_CHECK_REQUIRED/i.test(message)) return "AGE";
  if (/private|unavailable|UNPLAYABLE/i.test(message)) return "UNAVAILABLE_VIDEO";
  return err?.code || err?.errorCode || "";
}

function toNodeStream(stream) {
  if (stream && typeof stream.pipe === "function") return stream;
  if (stream && typeof stream.getReader === "function") return Readable.fromWeb(stream);
  throw new Error("YouTube returned an unsupported audio stream");
}

class YouTubePlugin extends ExtractorPlugin {
  constructor(options = {}) {
    super();
    this.options = options;
    this.port = 0;
    this.server = null;
    this.ready = Promise.resolve();
    this.session = null;
    this.sessionPromise = null;
    this.pendingStreams = new Map();
  }

  init(distube) {
    super.init(distube);
    this.ready = this.listen();
  }

  listen() {
    if (this.server) return Promise.resolve(this.port);
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(String(err?.message || "stream failed").slice(0, 300));
        } else {
          res.destroy();
        }
      });
    });
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        this.port = server.address().port;
        resolve(this.port);
      });
    });
  }

  close() {
    for (const entry of this.pendingStreams.values()) {
      try {
        entry.stream?.cancel?.();
      } catch {
        // already being read
      }
      entry.stream?.destroy?.();
    }
    this.pendingStreams.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  clientOrder() {
    return [CLIENTS.WEB, CLIENTS.ANDROID, CLIENTS.IOS, CLIENTS.TV_EMBEDDED, CLIENTS.TV];
  }

  sessionOptions() {
    return {
      generate_session_locally: true,
      retrieve_player: true,
      lang: "en",
      location: "US",
      client_type: CLIENTS.WEB,
    };
  }

  async ensureSession() {
    if (this.session) return this.session;
    if (!this.sessionPromise) {
      this.sessionPromise = Innertube.create(this.sessionOptions())
        .then((session) => {
          this.session = session;
          return session;
        })
        .catch((err) => {
          this.sessionPromise = null;
          throw err;
        });
    }
    return this.sessionPromise;
  }

  resetSession() {
    this.session = null;
    this.sessionPromise = null;
  }

  validate(url) {
    return Boolean(parseYouTubeUrl(url));
  }

  songFromNode(node, options = {}) {
    if (!node) return null;
    const id = node.video_id || (VIDEO_ID.test(node.id || "") ? node.id : null);
    if (!id) return null;
    const duration = Number(node.duration?.seconds ?? node.length_seconds ?? 0) || 0;
    const thumbs = node.thumbnails || (node.best_thumbnail ? [node.best_thumbnail] : []);
    const thumbnail = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url;
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id,
        name: textOf(node.title) || id,
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail,
        duration,
        isLive: Boolean(node.is_live),
        views: parseViews(node.view_count || node.short_view_count || node.views),
        uploader: {
          name: node.author?.name || textOf(node.author) || "YouTube",
          url: node.author?.url,
        },
      },
      options
    );
  }

  songFromInfo(info, options = {}) {
    const basic = info.basic_info || {};
    const id = basic.id;
    if (!id) throw new DisTubeError("CANNOT_RESOLVE_SONG", "youtube");
    const status = info.playability_status?.status;
    if (status === "LOGIN_REQUIRED") {
      const error = new Error("YouTube refused this video. Try the song name or another link.");
      error.code = "YT_BOT_CHECK";
      error.errorCode = "YT_BOT_CHECK";
      throw error;
    }
    if (status === "UNPLAYABLE" || status === "ERROR") {
      throw new DisTubeError("UNAVAILABLE_VIDEO");
    }
    const thumbs = basic.thumbnail || [];
    return new Song(
      {
        plugin: this,
        source: "youtube",
        playFromSource: true,
        id,
        name: basic.title || id,
        url: basic.url_canonical || `https://www.youtube.com/watch?v=${id}`,
        thumbnail: thumbs[thumbs.length - 1]?.url || thumbs[0]?.url,
        duration: Number(basic.duration) || 0,
        isLive: Boolean(basic.is_live),
        views: parseViews(basic.view_count),
        likes: parseViews(basic.like_count),
        ageRestricted: status === "AGE_CHECK_REQUIRED" || status === "CONTENT_CHECK_REQUIRED",
        uploader: {
          name: basic.channel?.name || basic.author || "YouTube",
          url: basic.channel?.url,
        },
      },
      options
    );
  }

  async resolve(url, options) {
    const parsed = parseYouTubeUrl(url);
    if (!parsed) throw new DisTubeError("CANNOT_RESOLVE_SONG", url);
    const yt = await this.ensureSession();
    if (parsed.type === "playlist") {
      let playlist = await yt.getPlaylist(parsed.id);
      const items = [...(playlist.items || [])];
      let pages = 0;
      while (playlist.has_continuation && items.length < 100 && pages < 4) {
        playlist = await playlist.getContinuation();
        items.push(...(playlist.items || []));
        pages += 1;
      }
      const songs = items.map((item) => this.songFromNode(item, options)).filter(Boolean);
      if (!songs.length) throw new DisTubeError("EMPTY_PLAYLIST");
      const info = playlist.info || {};
      return new Playlist(
        {
          source: "youtube",
          id: parsed.id,
          name: info.title || "YouTube playlist",
          url: `https://www.youtube.com/playlist?list=${parsed.id}`,
          thumbnail: info.thumbnails?.[info.thumbnails.length - 1]?.url,
          songs,
        },
        options
      );
    }
    const info = await yt.getBasicInfo(parsed.id);
    return this.songFromInfo(info, options);
  }

  async searchSong(query, options) {
    const yt = await this.ensureSession();
    const search = await yt.search(query);
    const video = (search.results || []).find(
      (result) => result?.type === "Video" && (result.video_id || VIDEO_ID.test(result.id || ""))
    );
    return video ? this.songFromNode(video, options) : null;
  }

  async getRelatedSongs(song) {
    try {
      const yt = await this.ensureSession();
      const info = await yt.getInfo(song.id);
      const related = [];
      for (const node of info.watch_next_feed || []) {
        const built = this.songFromNode(node, {});
        if (built && built.id !== song.id) related.push(built);
        if (related.length >= 5) break;
      }
      return related;
    } catch (err) {
      this.distube?.debug?.(`[YouTubePlugin] related songs failed: ${err.message}`);
      return [];
    }
  }

  async downloadAudio(id) {
    const clients = this.clientOrder();
    let lastError;
    for (const client of clients) {
      try {
        const yt = await this.ensureSession();
        const stream = await yt.download(id, {
          type: "audio",
          quality: "best",
          format: "any",
          client,
        });
        if (!stream) throw new Error("Empty YouTube audio stream");
        return stream;
      } catch (err) {
        lastError = err;
        const code = classifyYouTubeError(err);
        this.distube?.debug?.(
          `[YouTubePlugin] ${client} failed for ${id}: ${err.message}`
        );
        if (code === "YT_BOT_CHECK" || code === "YT_RATELIMIT") {
          this.resetSession();
        }
      }
    }
    const code = classifyYouTubeError(lastError);
    const error = new Error(
      lastError?.message || "Could not extract a YouTube audio stream. ytdl-core has been broken since 2023."
    );
    error.code = code || "YT_STREAM";
    error.errorCode = error.code;
    throw error;
  }

  async getStreamURL(song) {
    await this.ready;
    if (!this.port) throw new Error("YouTube audio proxy is not listening");
    const stream = await this.downloadAudio(song.id);
    const previous = this.pendingStreams.get(song.id);
    previous?.stream?.cancel?.();
    previous?.stream?.destroy?.();
    this.pendingStreams.set(song.id, { stream, at: Date.now() });
    const timer = setTimeout(() => {
      const current = this.pendingStreams.get(song.id);
      if (current?.stream === stream) {
        this.pendingStreams.delete(song.id);
        try {
          stream.cancel?.();
        } catch {
          // already being read
        }
        stream.destroy?.();
      }
    }, 20000);
    timer.unref?.();
    return `http://127.0.0.1:${this.port}/audio/${song.id}`;
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const match = url.pathname.match(/^\/audio\/([\w-]{11})$/);
    if (!match || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    if (req.method === "HEAD") {
      res.writeHead(200, { "Content-Type": "application/octet-stream", "Accept-Ranges": "none" });
      res.end();
      return;
    }
    const id = match[1];
    const pending = this.pendingStreams.get(id);
    let webStream = pending?.stream;
    if (webStream) this.pendingStreams.delete(id);
    else webStream = await this.downloadAudio(id);
    const nodeStream = toNodeStream(webStream);
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Accept-Ranges": "none",
    });
    const stop = () => {
      if (!nodeStream.destroyed) nodeStream.destroy();
      if (!res.writableEnded) res.destroy();
    };
    req.on("aborted", stop);
    nodeStream.on("error", (err) => {
      this.distube?.debug?.(`[YouTubePlugin] stream error: ${err.message}`);
      stop();
    });
    res.on("error", stop);
    nodeStream.pipe(res);
  }
}

module.exports = {
  YouTubePlugin,
  parseYouTubeUrl,
  extractPlayable,
  canonicalYouTube,
  classifyYouTubeError,
  textOf,
  parseViews,
};
