import {
  Events,
  EmbedBuilder,
  type Interaction,
  Message,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  TextChannel,
  GuildMemberRoleManager,
} from "discord.js";
import { DataTypes } from "sequelize";

/**
 * The globally accessible module object.
 */
export const story = {
  // Module Logging Color
  moduleColor: "#5a189a",

  the: 23135851162,

  // Define the config object so TypeScript knows it exists.
  config: {} as { [key: string]: any },
  word_model: {
    definition: {
      word: {
        type: DataTypes.STRING(255),
        primaryKey: true, // Ensures no duplicate strings
      },
      frequency: {
        type: DataTypes.INTEGER(),
        defaultValue: 9999999,
      },
    },
    options: { tableName: "words" },
  },
  story_model: {
    definition: {
      type: {
        type: DataTypes.STRING(255),
        defaultValue: "normal",
      },
      current_story: {
        // 16 * 1024  = 16384. Just arbitrary
        type: DataTypes.STRING(16384),
        defaultValue: "",
      },
      current_story_length: {
        type: DataTypes.INTEGER(),
        defaultValue: 0,
      },
      longest_story: {
        type: DataTypes.STRING(16384),
        defaultValue: "",
      },
      longest_story_length: {
        type: DataTypes.INTEGER(),
        defaultValue: 0,
      },
      longest_story_author: {
        type: DataTypes.STRING(255),
        defaultValue: "",
      },
      last_user: {
        type: DataTypes.STRING(255),
        defaultValue: "",
      },
      last_username: {
        type: DataTypes.STRING(255),
        defaultValue: "",
      },
      last_word_frequency: {
        type: DataTypes.BIGINT(),
        defaultValue: 23135851162,
      },
      xp_loss_damper: {
        type: DataTypes.FLOAT(),
        defaultValue: 5,
      },
      xp_gain_damper: {
        type: DataTypes.FLOAT(),
        defaultValue: 1,
      },
      xp_gain_frequency_niche: {
        type: DataTypes.BIGINT(),
        defaultValue: 2674351, // Frequency of the word "glimpse"
      },
    },
    options: { tableName: "story" },
  },

  async getStoryDB(Hexley: any) {
    return await Hexley.frameworks.database.getTableDefinitionEntry(
      Hexley,
      process.env.DB_NAME,
      this.story_model,
      { where: { type: "normal" } },
    );
  },
  async saveStoryDB(Hexley: any, storyDB: any) {
    await Hexley.frameworks.database.updateTableDefinitionEntry(
      Hexley,
      process.env.DB_NAME,
      this.story_model,
      storyDB,
      { where: { type: "normal" } },
    );
  },
  async getWord(Hexley: any, word: string) {
    return await Hexley.frameworks.database.getTableDefinitionEntry(
      Hexley,
      process.env.DB_NAME,
      this.word_model,
      { where: { word: word } },
    );
  },

  async storyNewMessage(Hexley: any, message: Message) {
    if (
      message.channelId !== process.env.STORY_CHANNEL_ID ||
      message.author.bot
    ) {
      return;
    }
    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} Received message: \"${message.content}\"`,
      );
    const halfProcessed = message.content.trim();
    const fullyProcessed = message.content
      .trim()
      .toLowerCase()
      .replaceAll(",", "")
      .replaceAll(".", "")
      .replaceAll("!", "")
      .replaceAll("?", "")
      // .replaceAll(" ", "")
      .replaceAll(";", "")
      .replaceAll(":", "")
      .replaceAll("%", "")
      .replaceAll("(", "")
      .replaceAll(")", "")
      .replaceAll("/", "")
      .replaceAll("\\", "")
      .replaceAll('"', "")
      .replaceAll("'", "")
      .replaceAll("`", "");

    const storyDB = await this.getStoryDB(Hexley);

    let valid = true;
    let angryMessage = "";
    if (!storyDB) {
      valid = false;
      if (Hexley.debugMode)
        Hexley.log(
          `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} Story database not found!`,
        );
      return;
    }

    let xp = 0;
    let frequency = this.the;

    let twiceInARow = false;

    if (valid) {
      if (storyDB.last_user === message.author.id) {
        //valid = false;
        angryMessage = `<@${message.author.id}> you can't add to the story twice in a row!`;
        twiceInARow = true;
      }
      storyDB.last_user = message.author.id;
      storyDB.last_username = message.author.username;
    }

    if (valid) {
      const result = await this.getWord(Hexley, fullyProcessed);

      const maybeNumber = Number(fullyProcessed);

      if (!result && isNaN(maybeNumber)) {
        valid = false;
        angryMessage = `<@${message.author.id}> sent an invalid word!`;
        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} \"${fullyProcessed}\" is not a real word!`,
          );
      } else {
        valid = true;
        if (!result || !result.frequency) {
          frequency = this.the;
        } else {
          frequency = result.frequency;
        }

        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} Found word: \"${fullyProcessed}\"`,
          );
      }
    }

    if (valid) {
      const last_30_items = `${storyDB.current_story}${halfProcessed}`
        .split(" ")
        .slice(-30);
      const last_30_items_string = last_30_items.join(" ");
      const sendMessage = `"${last_30_items_string}". You are a harsh judge of sentences.
      You must respond with only one of the following:

      GOOD

      BAD

      Then, on the next line, give a short Reason.

      Rules

      Do not fix, change, or reinterpret earlier words.

      Do not assume hidden meaning or context.

      Do not invent grammar (commas, periods, etc.).

      Incompleteness is acceptable — fragments are allowed.

      If the words so far make sense together and can be continued, say GOOD.

      If the words so far are nonsensical and cannot be continued without fixing, say BAD.

      Every word must fit in sequence with the previous ones. If even slightly off, say BAD.

      Be harsh: unusual ≠ GOOD. Only sequences that actually make sense as written can be GOOD.

      Example Inputs and Outputs

      Input:
      The Cat Exploded Cake Haha H B H
      Output:
      BAD
      Reason: “The Cat Exploded Cake” is nonsensical, so continuation is not possible.

      Input:
      The Cat Is
      Output:
      GOOD
      Reason: Incomplete, but the words so far make sense together and can be continued.

      Input:
      The dog chased the
      Output:
      GOOD
      Reason: Incomplete, but the words so far make sense together and can be continued.

      Input:
      Tree sings loudly
      Output:
      BAD
      Reason: “Tree sings” is nonsensical, so continuation is not possible.`;

      const ai_opinion = await Hexley.frameworks.llmFramework.chat(
        Hexley,
        sendMessage,
      );
      if (ai_opinion) {
        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} AI opinion: ${ai_opinion.text}`,
          );
        if (ai_opinion.text.includes("BAD")) {
          valid = false;
          angryMessage = `<@${message.author.id}> that doesn't make sense!`;
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} \"${fullyProcessed}\" doesn't make sense!`,
            );
        } else {
          if (!ai_opinion.text.includes("GOOD")) {
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} AI did not respond with GOOD or BAD.`,
            );
          }
          // Until next time...
          valid = true;
        }
      } else {
        Hexley.log(
          `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} AI opinion not received for word: \"${fullyProcessed}\"`,
        );
      }
    }

    if (valid) {
      xp = Math.max(
        1,
        Math.round(
          storyDB.xp_gain_frequency_niche / frequency / storyDB.xp_gain_damper,
        ),
      );

      message.react("✅");
      storyDB.current_story_length += 1;
      storyDB.current_story += `${halfProcessed} `;
      if (storyDB.longest_story_length < storyDB.current_story_length) {
        storyDB.longest_story_length = storyDB.current_story_length;
        storyDB.longest_story = storyDB.current_story.trim();
        storyDB.longest_story_author = message.author.username;
      }
      storyDB.last_word_frequency = frequency;
      if (Hexley.frameworks.experience) {
        Hexley.frameworks.experience.addXP(Hexley, message.author.id, xp);
      } else {
        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} Hexley.frameworks.experience is not loaded!`,
          );
      }
    } else {
      if (twiceInARow) {
        // Man that's your own fault not the matter of your own last word frequency
        xp = Math.max(
          1,
          Math.round(storyDB.current_story_length / storyDB.xp_loss_damper),
        );
      } else {
        xp = Math.max(
          1,
          Math.round(
            storyDB.current_story_length / storyDB.xp_loss_damper -
              // If the word before is an especially uncommon one, you get
              // a slightly less bad punishment
              storyDB.xp_gain_frequency_niche /
                storyDB.last_word_frequency /
                storyDB.xp_loss_damper,
          ),
        );
      }

      message.react("❌");
      if (angryMessage !== "" && message.channel instanceof TextChannel) {
        message.channel.send(
          `Incorrect! ${angryMessage} Restarting story... (lost ${xp} xp)`,
        );
      }
      storyDB.current_story_length = 0;
      storyDB.current_story = "";
      storyDB.last_word_frequency = 23135851162; // frequency of the word "the"
      storyDB.last_user = "";

      if (Hexley.frameworks.experience) {
        Hexley.frameworks.experience.removeXP(Hexley, message.author.id, xp);
      } else {
        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} Hexley.frameworks.experience is not loaded!`,
          );
      }
    }

    // Update the DB
    await this.saveStoryDB(Hexley, storyDB);
  },

  async storyHighScore(Hexley: any, interaction: ChatInputCommandInteraction) {
    const storyDB = await this.getStoryDB(Hexley);

    const fullReply = `${storyDB.longest_story_length} words:\n\n${storyDB.longest_story}`;
    const cutOffAt = 1997;
    let replies: string[] = [];

    for (let i = 0; i < fullReply.length; i += cutOffAt) {
      replies.push(fullReply.slice(i, i + cutOffAt));
    }

    if (replies[0]) {
      await interaction.reply(replies[0]);
    }

    for (let i = 1; i < replies.length; i++) {
      const reply = replies[i];
      if (reply) {
        await interaction.followUp(reply);
      }
    }
  },

  async storyCurrentStory(
    Hexley: any,
    interaction: ChatInputCommandInteraction,
  ) {
    const storyDB = await this.getStoryDB(Hexley);

    const fullReply = `${storyDB.current_story_length} words:\n\n${storyDB.current_story}`;
    const cutOffAt = 1997;
    let replies: string[] = [];

    for (let i = 0; i < fullReply.length; i += cutOffAt) {
      replies.push(fullReply.slice(i, i + cutOffAt));
    }

    if (replies[0]) {
      await interaction.reply(replies[0]);
    }

    for (let i = 1; i < replies.length; i++) {
      const reply = replies[i];
      if (reply) {
        await interaction.followUp(reply);
      }
    }
  },

  async storyInfo(Hexley: any, interaction: ChatInputCommandInteraction) {
    const storyDB = await this.getStoryDB(Hexley);

    let embed = new EmbedBuilder()
      .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
      .setTitle("Story Mini-game").setDescription(`**High Score length:**
${storyDB.longest_story_length}

**Set by:**
${storyDB.longest_story_author}

**Current Story length:**
${storyDB.current_story_length}

**Last user to add:**
${storyDB.last_username}

**Description:**
Make a funny story one word at a time! Words which do not exist will reset the game (some slang is allowed), and you cannot add to the story twice in a row!`);

    await interaction.reply({ embeds: [embed] });
  },

  async storyUpdateXPLossDamper(
    Hexley: any,
    interaction: ChatInputCommandInteraction,
  ) {
    const storyDB = await this.getStoryDB(Hexley);

    const number = interaction.options.getInteger("amount");

    storyDB.xp_loss_damper = number;

    await interaction.reply({
      content: `Changed XP loss damper to ${number}`,
      flags: MessageFlags.Ephemeral,
    });

    await this.saveStoryDB(Hexley, storyDB);
  },

  async storyUpdateXPGainDamper(
    Hexley: any,
    interaction: ChatInputCommandInteraction,
  ) {
    const storyDB = await this.getStoryDB(Hexley);

    const number = interaction.options.getInteger("amount");

    storyDB.xp_gain_damper = number;

    await interaction.reply({
      content: `Changed XP gain damper to ${number}`,
      flags: MessageFlags.Ephemeral,
    });

    await this.saveStoryDB(Hexley, storyDB);
  },

  async storyUpdateXPFrequencyNiche(
    Hexley: any,
    interaction: ChatInputCommandInteraction,
  ) {
    const storyDB = await this.getStoryDB(Hexley);

    let frequency = interaction.options.getInteger("frequency");
    const word = interaction.options.getString("word");
    if (!frequency && !word) {
      await interaction.reply({
        content: "Please provide a frequency or word.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!frequency && word) {
      const result = await this.getWord(Hexley, word.trim().toLowerCase());
      if (!result) {
        await interaction.reply({
          content: "Word not found.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      frequency = result.frequency;
    }

    storyDB.xp_gain_damper = frequency;

    await interaction.reply({
      content: `Changed XP frequency niche to ${frequency} (word: ${word})`,
      flags: MessageFlags.Ephemeral,
    });

    await this.saveStoryDB(Hexley, storyDB);
  },

  async storyAddDataBase(
    Hexley: any,
    interaction: ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(Hexley.frameworks.discord.getUserRoleColor(interaction.member))
      .setDescription("Yeah");

    if (
      !(
        interaction.member instanceof GuildMember &&
        interaction.member.roles.cache.has(process.env.MODERATOR_ROLE_ID!)
      )
    ) {
      embed.setTitle("You don't have permission to run that command!");

      await interaction.editReply({
        embeds: [embed],
      });

      return;
    }

    let file = interaction.options.getString("file");
    if (file === null) {
      embed.setTitle("You need to enter a file!");
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyAddDataBase]", this.moduleColor)} Adding database ${file}`,
      );

    const fileContent = Hexley.frameworks.filesystem.readFile(Hexley, file);
    if (fileContent === null) {
      embed.setTitle(`File ${file} does not exist`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    embed.setTitle(`???`);

    const records = await Hexley.frameworks.database.parseCSV(
      Hexley,
      fileContent,
    );
    let promises: Promise<any>[] = [];
    for (const record of records) {
      const word = record.word;
      const frequency = record.count;
      if (frequency === "count") {
        continue;
      }
      promises.concat(
        Hexley.frameworks.database.addTableDefinitionEntry(
          Hexley,
          process.env.DB_NAME,
          this.word_model,
          { word: word, frequency: Number(frequency) },
          { word: word, frequency: Number(frequency) },
        ),
      );
    }

    await Promise.all(promises);

    await interaction.editReply({ embeds: [embed] });
  },

  async storyNewInteraction(Hexley: any, interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      let isMod = false;
      let modRole = process.env.MODERATOR_ROLE_ID;
      if (!modRole) {
        modRole = "";
      }
      if (
        interaction.member &&
        interaction.member.roles instanceof GuildMemberRoleManager &&
        interaction.member.roles.cache.has(modRole)
      ) {
        isMod = true;
      }

      const trimmedCommand = interaction.commandName.trim().toLowerCase();
      let modReply = true;
      if (isMod) {
        switch (trimmedCommand) {
          case "storyadddatabase":
            await this.storyAddDataBase(Hexley, interaction);
            break;
          case "storyupdatexplossdamper":
            await this.storyUpdateXPLossDamper(Hexley, interaction);
            break;
          case "storyupdatexpgaindamper":
            await this.storyUpdateXPGainDamper(Hexley, interaction);
            break;
          case "storyupdatexpfrequencyniche":
            await this.storyUpdateXPFrequencyNiche(Hexley, interaction);
            break;
          default:
            modReply = false;
            break;
        }
      }

      switch (trimmedCommand) {
        case "storyhighscore":
          await this.storyHighScore(Hexley, interaction);
          break;
        case "story":
          await this.storyInfo(Hexley, interaction);
          break;
        case "storycurrentstory":
          await this.storyCurrentStory(Hexley, interaction);
          break;
        default:
          if (!modReply) {
            await interaction.reply({
              content: `Invalid command or you don't have permission: ${trimmedCommand}`,
              flags: MessageFlags.Ephemeral,
            });
          }

          break;
      }
    }
  },

  /**
   * Main Entry Point for the Story module.
   * @param {any} Hexley - The main Hexley global object.
   */
  storyInit(Hexley: any) {
    Hexley.log(
      `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} Initializing story Module...`,
    );

    const channelId = process.env.STORY_CHANNEL_ID;
    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} Story channel ID is set to: ${channelId}`,
      );

    if (!Hexley.databaseLoaded) {
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} ${Hexley.frameworks.aurora.colorText("Database not loaded", Hexley.frameworks.aurora.tintRedBright)}`,
      );
      return;
    }

    Hexley.frameworks.database
      .getDatabaseTables(Hexley, process.env.DB_NAME)
      .then((tables: string[]) => {
        if (!tables.includes("words")) {
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} The \"words\" table doesn't exist! Creating.`,
            );

          Hexley.frameworks.database
            .initTableDefinition(Hexley, process.env.DB_NAME, this.word_model)
            .then((_: any[]) => {});
        }

        if (!tables.includes("story")) {
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} The \"story\" table doesn't exist! Creating.`,
            );

          Hexley.frameworks.database.initTableDefinition(
            Hexley,
            process.env.DB_NAME,
            this.story_model,
          );

          Hexley.frameworks.database.addTableDefinitionEntry(
            Hexley,
            process.env.DB_NAME,
            this.story_model,
            {
              type: "normal",
              current_story: "",
              current_story_length: 0,
              longest_story: "",
              longest_story_length: 0,
              longest_story_author: "",
              last_user: "",
              last_username: "",
              last_word_frequency: this.the,
              xp_loss_damper: 5,
              xp_gain_damper: 1,
              xp_gain_frequency_niche: 2674351, // Frequency of the word "glimpse"
            },
            { where: { type: "normal" } },
          );
        }
      });

    if (Hexley.discordLoaded) {
      Hexley.frameworks.discord.client.on(
        Events.MessageCreate,
        async (message: Message) => {
          await this.storyNewMessage(Hexley, message);
        },
      );

      Hexley.frameworks.discord.client.on(
        Events.InteractionCreate,
        async (interaction: Interaction) => {
          await this.storyNewInteraction(Hexley, interaction);
        },
      );
    }

    Hexley.log(
      `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} Initialized Story Module successfully!`,
    );
  },
};
