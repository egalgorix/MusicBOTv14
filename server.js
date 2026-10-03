const express = require("express");

function startHealthServer(client, config) {
  const app = express();
  app.disable("x-powered-by");

  app.get(["/", "/health"], (req, res) => {
    const user = client.user;
    const body = {
      ok: true,
      name: "MusicBOTv14",
      ready: Boolean(user),
      username: user?.username || null,
      guilds: client.guilds?.cache?.size || 0,
      mongo: Boolean(client.mongoReady),
      uptime: Math.round(process.uptime()),
    };
    if (req.accepts(["html", "json"]) === "html") {
      res.type("html").send(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MusicBOTv14</title>
<body style="margin:0;font-family:Georgia,serif;background:#12141a;color:#f4f1ea">
<main style="max-width:40rem;margin:4rem auto;padding:0 1.25rem">
  <p style="letter-spacing:.16em;text-transform:uppercase;color:#d4a017">FastUptime</p>
  <h1 style="font-weight:500;font-size:2.4rem;margin:.2rem 0 1rem">Music bot is ${body.ready ? "online" : "starting"}</h1>
  <p style="line-height:1.5;color:#c8c2b4">YouTube playback no longer depends on ytdl-core. Voice uses Discord's current DAVE encryption. This page is only a health check.</p>
  <pre style="background:#1c2029;padding:1rem;border-radius:12px;overflow:auto">${JSON.stringify(body, null, 2)}</pre>
</main>
</body>
</html>`);
      return;
    }
    res.json(body);
  });

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[Web] health check on 0.0.0.0:${config.port}`);
  });
  server.on("error", (err) => {
    console.error(`[Web] ${err.message}`);
  });
  return server;
}

module.exports = { startHealthServer };
