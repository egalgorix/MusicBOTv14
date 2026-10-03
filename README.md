# MusicBOTv14

Discord müzik botu. 2023’te YouTube’un oynatıcı imzasını değiştirmesiyle ölen `ytdl-core` / `discord-player` v5 yolundan çıkarıldı ve bugünkü Discord ses katmanına (DAVE) taşındı.

The 2023 YouTube extractor break is the failure this update assumes. `ytdl-core` and the old `@distube/ytdl-core` plugin stopped returning audio (`Could not extract functions`, then `Sign in to confirm you're not a bot`). The bot still joined the channel and posted a title, then stayed silent. Discord later removed the old voice ciphers (November 2024) and made DAVE mandatory (March 2026), so a 2023-era `@discordjs/voice` also connects and is kicked.

## Ne değişti

- YouTube artık `youtubei.js` ile çözülüyor. Ses, Node’un TLS’i üzerinden indirilip yerel bir proxy’den FFmpeg’e veriliyor. Eski `ytdl-core` yok.
- Bot kontrolü (`Sign in to confirm you're not a bot`) veya 429 gelirse komut, kör bir FFmpeg hatası yerine ne yapılacağını söylüyor. Giriş yapılmış bir tarayıcı çerezi `YOUTUBE_COOKIE` ile verilebilir.
- Ses: `discord.js` 14.27, `@discordjs/voice` 0.19 ve `@snazzah/davey`. Eski `xsalsa20` şifresi artık yetmiyor.
- Ayrıcalıklı intent’ler (`MessageContent`, `GuildMembers`, `GuildPresences`) kaldırıldı. Slash komutlu bir müzik botunun portalda bu izinler açık değilse açılışta düşmesinin nedeni buydu.
- `mongoose` 8: `remove()` ve `useNewUrlParser` gitti. Mongo yoksa bot yine de çalar.
- `/nowplaying` çeviri import’u eksik olduğu için çöküyordu. İngilizce dosyada duraklatma metni yoktu, devam metni Türkçe kalmıştı. Bitti / boş kanal olayları yanlış sunucuya bakıyordu.
- Ses ve döngü düğmeleri tek yerde. Ses alanı artık sayı, paragraf değil.

Spotify, SoundCloud ve Deezer bağlantıları duruyor. Düz metin araması YouTube’a gider.

## Kurulum

Node.js **22.12 veya üzeri**.

```bash
npm install
node .
```

`@discordjs/opus` için Node 22 önceden derlenmiş paket yayınlamıyor. `npm install` derleme araçları yoksa düşerse:

```bash
npm install --ignore-scripts
npm rebuild @discordjs/opus
```

Derlenemezse `opusscript` yedek olarak duruyor. Yerel `@discordjs/opus` tercih edilir.

Token’ı koda yazmayın. `.env.example` dosyasını `.env` yapın:

```bash
DISCORD_TOKEN=...
# anında slash kaydı için (boşsa komutlar global yazılır, bir saate kadar sürebilir)
GUILD_ID=
MONGO_URL=
PORT=3000
```

`config.js` içindeki `TOKEN` / `MONGOURL` yer tutucuları da hâlâ okunur. Ortam değişkeni varsa o kazanır.

YouTube bot kontrolüne takılırsa tarayıcıda youtube.com’a giriş yapıp istek başlığındaki `Cookie` değerini `YOUTUBE_COOKIE` olarak koyun. İsteğe bağlı: `YOUTUBE_CLIENT` (`WEB`, `ANDROID`, `IOS`, `TV`), `YOUTUBE_PO_TOKEN`, `YOUTUBE_PLAYER_ID`.

FFmpeg paketin içinde gelir (`@ffmpeg-installer/ffmpeg`, 2018 sürümü). YouTube baytları Node indirdiği için bu eski sürüm çoğu şarkıda yeter. Doğrudan dosya bağlantıları modern TLS isterse `FFMPEG_PATH` ile daha yeni bir ikili verin.

Sağlık kontrolü `0.0.0.0:$PORT` üzerinde `/` ve `/health`.

Komutlar: `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/list`, `/nowplaying`, `/ping`. Çalma kartındaki 🔊 ses, 🌀 şarkı döngüsü.

```bash
npm run verify
```

Bu, YouTube’a bağlanmadan FFmpeg + yerel ses proxy’sini, çevirileri, komutları ve DAVE bağımlılığını kontrol eder. Canlı YouTube çekimi bu ortamdan doğrulanamaz; YouTube ağı sık sık veri merkezi IP’lerini keser.

## English

Same bot, same commands. Playback no longer uses `ytdl-core`. Set `DISCORD_TOKEN`. If YouTube answers with a bot check, set `YOUTUBE_COOKIE` from a logged-in browser session. Voice requires DAVE (`@snazzah/davey`), which is installed with `@discordjs/voice` 0.19.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
