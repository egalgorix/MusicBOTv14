const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const config = require("../config");
const { tr, reply } = require("../lib/reply");
const { requireQueue } = require("../lib/voice");
const { ownerId } = require("../lib/session");
const { simpleEmbed } = require("../lib/embeds");

const VOLUME_BUTTONS = new Set(["volume", "volumes"]);
const LOOP_BUTTONS = new Set(["loop", "loops"]);
const VOLUME_MODALS = new Set(["formvolume", "formvolumes"]);

function volumeModal(customId, inputId) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle("Set Volume");
  const input = new TextInputBuilder()
    .setCustomId(inputId)
    .setLabel("Volume")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(3)
    .setPlaceholder("1 - 100")
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function sameChannel(interaction, queue) {
  const voice = interaction.member?.voice?.channel;
  return Boolean(voice && queue.voiceChannel && voice.id === queue.voiceChannel.id);
}

module.exports = function registerControls(client) {
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && VOLUME_BUTTONS.has(interaction.customId)) {
      const queue = client.distube.getQueue(interaction.guildId);
      if (!queue) return reply(interaction, { content: tr(interaction, "error.nosonglist"), ephemeral: true });
      if (!sameChannel(interaction, queue)) {
        return reply(interaction, { content: tr(interaction, "error.notsamechannel"), ephemeral: true });
      }
      const modalId = interaction.customId === "volumes" ? "formvolumes" : "formvolume";
      const inputId = interaction.customId === "volumes" ? "setvolumes" : "setvolume";
      return interaction.showModal(volumeModal(modalId, inputId)).catch((err) => {
        console.error("[volume-modal]", err.message);
      });
    }

    if (interaction.isModalSubmit() && VOLUME_MODALS.has(interaction.customId)) {
      const field = interaction.customId === "formvolumes" ? "setvolumes" : "setvolume";
      const volume = Number.parseInt(interaction.fields.getTextInputValue(field), 10);
      const queue = client.distube.getQueue(interaction.guildId);
      if (!queue) return reply(interaction, { content: tr(interaction, "error.nosonglist"), ephemeral: true });
      if (!sameChannel(interaction, queue)) {
        return reply(interaction, { content: tr(interaction, "error.notsamechannel"), ephemeral: true });
      }
      if (!Number.isInteger(volume) || volume < 1 || volume > 100) {
        return reply(interaction, { content: tr(interaction, "error.volumeinvalid"), ephemeral: true });
      }
      queue.setVolume(volume);
      return reply(interaction, {
        content: tr(interaction, "succes.volumeset", { volume }),
        ephemeral: true,
      });
    }

    if (interaction.isButton() && LOOP_BUTTONS.has(interaction.customId)) {
      const queue = await requireQueue(interaction);
      if (!queue) return;
      const owner = ownerId(client, interaction.guildId);
      if (owner && interaction.user.id !== owner) {
        return reply(interaction, { content: tr(interaction, "error.onlyuser"), ephemeral: true });
      }
      const song = queue.songs[0];
      const enabling = queue.repeatMode === 0;
      queue.setRepeatMode(enabling ? 1 : 0);
      const embed = simpleEmbed(
        tr(interaction, enabling ? "succes.songloopon" : "succes.songloopoff"),
        `**[${song.name}](${song.url})**`,
        enabling ? config.embed.success : config.embed.error
      );
      if (song.uploader?.name) {
        embed.addFields({
          name: tr(interaction, "music.author"),
          value: song.uploader.url
            ? `[${song.uploader.name}](${song.uploader.url})`
            : song.uploader.name,
          inline: true,
        });
      }
      embed.addFields({
        name: tr(interaction, "music.time"),
        value: song.formattedDuration || "—",
        inline: true,
      });
      if (song.thumbnail) embed.setImage(song.thumbnail);
      return reply(interaction, { embeds: [embed] });
    }
  });
};
