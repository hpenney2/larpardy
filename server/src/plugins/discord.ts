import {
  ActionRowBuilder,
  EntryPointCommandHandlerType,
  Events,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { FastifyZod } from "../shared.js";

export default async function routes(fastify: FastifyZod, options: Object) {
  const updateTitleInput = new TextInputBuilder()
    .setCustomId("title")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const updateTitleLabel = new LabelBuilder()
    .setLabel("Update title")
    .setDescription("What should the title be?")
    .setTextInputComponent(updateTitleInput);

  const updateDateInput = new TextInputBuilder()
    .setCustomId("time")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const updateDateLabel = new LabelBuilder()
    .setLabel("Date and time")
    .setDescription("The log won't be visible until this time.")
    .setTextInputComponent(updateDateInput);

  const updateBodyInput = new TextInputBuilder()
    .setCustomId("body")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const updateBodyLabel = new LabelBuilder()
    .setLabel("Update body")
    .setDescription("This support Markdown.")
    .setTextInputComponent(updateBodyInput);

  const isoTextDisplay = new TextDisplayBuilder().setContent(
    "-# Please use the [ISO 8601](https://time.lol/) format for the date.",
  );

  const updateLogModal = new ModalBuilder()
    .addLabelComponents(updateTitleLabel, updateDateLabel)
    .addTextDisplayComponents(isoTextDisplay)
    .addLabelComponents(updateBodyLabel);

  fastify.discord.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isPrimaryEntryPointCommand()) {
      console.log(
        `activity launched by ${interaction.user.globalName} (@${interaction.user.username} / ${interaction.user.id} / interaction ID ${interaction.id})`,
      );

      if (
        interaction.command?.handler === EntryPointCommandHandlerType.AppHandler
      )
        await interaction.launchActivity();
      // await interaction.reply({ embeds: [{ type: EmbedType.Link }] });
    } else if (interaction.isChatInputCommand()) {
      try {
        switch (interaction.commandName) {
          case "updates": {
            // await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            if (!(await fastify.db.isAdmin(interaction.user.id))) {
              await interaction.reply({
                content: "You don't have permission to do that.",
                flags: MessageFlags.Ephemeral,
              });
              return;
            }

            switch (interaction.options.getSubcommand()) {
              case "new": {
                await interaction.showModal(
                  updateLogModal
                    .setCustomId("updatesNew")
                    .setTitle("New update"),
                );
                break;
              }

              case "edit": {
                const logSelect = new StringSelectMenuBuilder()
                  .setCustomId("updatesEdit_log")
                  .setOptions(
                    (await fastify.db.getUpdateLogs(true))
                      .map((update) =>
                        new StringSelectMenuOptionBuilder()
                          .setLabel(
                            `<${update.id}> ${update.title} @ ${new Date(update.updated_at).toLocaleString()}`,
                          )
                          .setValue(update.id),
                      )
                      .slice(0, 25),
                  );

                await interaction.reply({
                  components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                      logSelect,
                    ),
                  ],
                  content: "What log do you want to edit?",
                  flags: MessageFlags.Ephemeral,
                });

                break;
              }

              case "delete": {
                const deleteSelect = new StringSelectMenuBuilder()
                  .setCustomId("delete")
                  .setOptions(
                    (await fastify.db.getUpdateLogs(true))
                      .map((update) =>
                        new StringSelectMenuOptionBuilder()
                          .setLabel(
                            `<${update.id}> ${update.title} @ ${new Date(update.updated_at).toLocaleString()}`,
                          )
                          .setValue(update.id),
                      )
                      .slice(0, 25),
                  );
                const deleteModal = new ModalBuilder()
                  .setCustomId("updatesDelete")
                  .setTitle("Delete update")
                  .addLabelComponents(
                    new LabelBuilder()
                      .setLabel("Which update log?")
                      .setStringSelectMenuComponent(deleteSelect),
                  );
                await interaction.showModal(deleteModal);
                break;
              }
            }

            break;
          }
          default:
            await interaction.reply({
              content: "This command isn't supported.",
              flags: MessageFlags.Ephemeral,
            });
            break;
        }
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while completing your command.",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "There was an error while completing your command.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } else if (interaction.isModalSubmit()) {
      // there are only admin modals!
      if (!(await fastify.db.isAdmin(interaction.user.id))) {
        await interaction.reply({
          content: "You don't have permission to do that.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const idParts = interaction.customId.split("_");
      switch (idParts[0]) {
        case "updatesNew": {
          const dateString = interaction.fields.getTextInputValue("time");
          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
            await interaction.reply({
              content: `The date you entered, "${dateString}", is invalid.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const title = interaction.fields.getTextInputValue("title");
          const body = interaction.fields.getTextInputValue("body");

          await fastify.db.createUpdateLog(title, body, date);

          await interaction.editReply(
            `Update log created with title "${title}" for ${date}.`,
          );

          console.log(
            `user ${interaction.user.id} created a new update log with title "${title}" and date ${date}"`,
          );

          break;
        }

        case "updatesDelete": {
          const id = interaction.fields.getStringSelectValues("delete")[0];
          if (id == null) {
            await interaction.reply({
              content: `No option was selected.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          console.log(
            `user ${interaction.user.id} requested to delete update log #${id}`,
          );

          const success = await fastify.db.deleteUpdateLog(id);
          if (success) {
            await interaction.editReply(`Update log #${id} has been deleted.`);
          } else {
            await interaction.editReply(
              `Failed to delete update log #${id}. Does it still exist?`,
            );
          }

          break;
        }

        case "updatesEdit": {
          const id = idParts[1];
          if (id == null) {
            await interaction.reply({
              content: `No option was selected.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const dateString = interaction.fields.getTextInputValue("time");
          const date = new Date(dateString);
          if (isNaN(date.getTime())) {
            await interaction.reply({
              content: `The date you entered, "${dateString}", is invalid.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          const title = interaction.fields.getTextInputValue("title");
          const body = interaction.fields.getTextInputValue("body");

          const success = await fastify.db.editUpdateLog(id, title, body, date);

          console.log(
            `user ${interaction.user.id} requested to edit update log #${id}`,
          );

          if (success) {
            await interaction.editReply(`Update log #${id} has been edited.`);
          } else {
            await interaction.editReply(
              `Failed to edit update log #${id}. Does it still exist?`,
            );
          }

          break;
        }
      }
    } else if (interaction.isMessageComponent()) {
      switch (interaction.customId) {
        case "updatesEdit_log": {
          if (!interaction.isStringSelectMenu()) return;

          if (!(await fastify.db.isAdmin(interaction.user.id))) {
            await interaction.reply({
              content: "You don't have permission to do that.",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const id = interaction.values[0];

          if (id == null) {
            await interaction.reply({
              content: `No option was selected.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const log = await fastify.db.getUpdateLog(id);
          if (log == null) {
            await interaction.reply({
              content: `Log no longer exists.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          await interaction.showModal(
            new ModalBuilder()
              .addLabelComponents(
                updateTitleLabel.setTextInputComponent(
                  updateTitleInput.setValue(log.title),
                ),
                updateDateLabel.setTextInputComponent(
                  updateDateInput.setValue(
                    log.updated_at instanceof Date
                      ? log.updated_at.toISOString()
                      : log.updated_at,
                  ),
                ),
              )
              .addTextDisplayComponents(isoTextDisplay)
              .addLabelComponents(
                updateBodyLabel.setTextInputComponent(
                  updateBodyInput.setValue(log.content),
                ),
              )
              .setCustomId(`updatesEdit_${id}`)
              .setTitle(`Edit update #${id}`),
          );
        }
      }
    }
  });
}
