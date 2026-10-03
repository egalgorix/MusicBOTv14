const path = require("path");
const { readdirSync } = require("fs");
const i18next = require("i18next");
const Backend = require("i18next-fs-backend");

const localesDir = path.join(__dirname, "..", "locales");

async function initI18n() {
  const namespaces = readdirSync(path.join(localesDir, "en-US"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
  await i18next.use(Backend).init({
    ns: namespaces,
    defaultNS: "commands",
    fallbackLng: "en-US",
    preload: readdirSync(localesDir),
    interpolation: { escapeValue: false },
    backend: {
      loadPath: path.join(localesDir, "{{lng}}", "{{ns}}.json"),
    },
  });
  return i18next;
}

module.exports = { initI18n };
