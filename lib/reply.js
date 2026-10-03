const { t } = require("i18next");

function tr(interaction, key, options = {}) {
  return t(key, {
    ns: "common",
    lng: interaction.locale || "en-US",
    ...options,
  });
}

async function reply(interaction, payload) {
  const body = typeof payload === "string" ? { content: payload } : payload;
  try {
    if (interaction.deferred && !interaction.replied) return await interaction.editReply(body);
    if (interaction.deferred || interaction.replied) return await interaction.followUp(body);
    return await interaction.reply(body);
  } catch (err) {
    console.error("[reply]", err.message);
    return null;
  }
}

module.exports = { tr, reply };
