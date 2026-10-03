# MusicBOTv14

Discord müzik botu. Çalışması için **sadece Discord bot tokeni** gerekir. MongoDB, YouTube çerezi, Spotify anahtarı yok.

Şarkı adını yazar. YouTube video, Shorts, `youtu.be` ve çalma listesi linkini de ayıklar, bulur ve çalar.

## Kurulum

Node.js **22.12 veya üzeri**.

`config.js` içinde yalnızca `token` alanını doldur:

```js
token: "discord-bot-tokenin",
```

Sonra:

```bash
npm install
node .
```

`@discordjs/opus` Node 22 için hazır paket yayınlamıyorsa:

```bash
npm install --ignore-scripts
npm rebuild @discordjs/opus
```

## Komutlar

Ses kanalına gir, sonra:

- `/play Duman Senden Daha Güzel`
- `/play https://youtu.be/...`
- `/play https://www.youtube.com/playlist?list=...`
- `/pause` `/resume` `/skip` `/stop` `/list` `/nowplaying` `/ping` `/help`

Çalma kartındaki 🔊 ses, 🌀 döngü. `/help` aynı listeyi sunucunun dilinde gösterir.

## English

Only a Discord bot token, in `config.js`. No database and no YouTube cookie. `/play` accepts a song name or a YouTube link and resolves it.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
