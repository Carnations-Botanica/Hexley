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
        type: DataTypes.INTEGER,
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
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      longest_story: {
        type: DataTypes.STRING(16384),
        defaultValue: "",
      },
      longest_story_length: {
        type: DataTypes.INTEGER,
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
        type: DataTypes.BIGINT,
        defaultValue: 23135851162,
      },
      xp_loss_damper: {
        type: DataTypes.FLOAT(),
        defaultValue: 5,
      },
      xp_gain_damper: {
        type: DataTypes.FLOAT,
        defaultValue: 1,
      },
      xp_gain_frequency_niche: {
        type: DataTypes.BIGINT,
        defaultValue: 2674351, // Frequency of the word "glimpse"
      },
    },
    options: { tableName: "story" },
  },

  /**
   * Checks if a member has the internal/admin role.
   * @param {GuildMember} member - The member to check.
   * @returns {boolean} True if the member has the admin role.
   */
  _isAdmin(member: GuildMember): boolean {
    const adminRoleId = process.env.INTERNAL_ROLE_ID;
    if (!adminRoleId) return false;
    return member.roles.cache.has(adminRoleId);
  },

  async getStoryDB(Hexley: any) {
    return await Hexley.frameworks.database.get(this.story_model, {
      type: "normal",
    });
  },
  async saveStoryDB(Hexley: any, storyDB: any) {
    await Hexley.frameworks.database.update(this.story_model, storyDB, {
      type: "normal",
    });
  },

  async getWord(Hexley: any, word: string) {
    return await Hexley.frameworks.database.get(this.word_model, {
      word: word,
    });
  },

  async storyNewMessage(Hexley: any, message: Message) {
    if (
      message.channelId !== Hexley.modules.story.config.STORY_CHANNEL_ID ||
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
        valid = false;
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
      const sendMessage = `ROLE

      You are a strict judge of short text fragments.
      Your job is to classify ONLY the last 30 words provided by the user.

      OUTPUT FORMAT (MANDATORY)

      Your entire output must be exactly:
      GOOD
      Reason: <short reason>

      or

      BAD
      Reason: <short reason>

      No extra text.
      CORE RULE

      A fragment is GOOD if:

      It makes sense as written, even if incomplete, and

      It can be naturally continued in English without changing any previous words.

      A fragment is BAD if:

      It is impossible to continue logically without rewriting earlier words,

      Or the sequence is self-contradictory or nonsensical.

      STRICT CLARIFICATIONS (to avoid model confusion)

      Greetings (e.g., “Hi”, “Hello”, “Hey there”) MUST ALWAYS be considered GOOD, because they can be naturally continued (e.g., “Hi there”, “Hi everyone”).

      Any common phrase beginning of a sentence (like “how are”, “the cat”, “walking along the”) MUST be considered GOOD unless the words contradict each other directly.

      Fragments DO NOT need to be full sentences.

      Spelling errors, missing punctuation, and informal wording are ALWAYS permitted.

      Nonsense only counts if the sequence itself is impossible to continue
      (e.g., “the purple idea car slept upwardly under the democracy fridge” → BAD).

      Give the benefit of the doubt whenever a normal continuation exists.

      If even ONE plausible continuation exists, classify as GOOD.

      Do NOT judge meaning, quality, style, or grammar. Only sequential coherence.

      If the fragment reads like random or loosely-associated words rather than a meaningful sequence, you must classify it as BAD.

      Do NOT judge whether the phrase is standard English. If the sequence could be interpreted as the start of a question or statement, it MUST be marked GOOD.

      SCOPE

      Judge only the last 30 words. Ignore everything that comes earlier.
      Look *specifically* at the last word - does it fit the rules with the words before?

      THIS IS YOUR SENTENCE:
      "${last_30_items_string}"`;

      const ai_opinion = await Hexley.frameworks.llm.chat(Hexley, sendMessage);
      if (ai_opinion) {
        if (Hexley.debugMode)
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[story/storyNewMessage]", this.moduleColor)} AI opinion: ${ai_opinion.text}`,
          );
        if (ai_opinion.text.includes("BAD")) {
          valid = false;

          let reason: string = ai_opinion;
          if (ai_opinion.text.includes("Reason:")) {
            reason = ai_opinion.text.split("Reason:")[1].trim();
          }

          angryMessage = `<@${message.author.id}> that doesn't make sense!
AI Reason: ${reason}`;
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
        this._isAdmin(interaction.member)
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

    embed.setTitle(`Added ${file} to word database`);

    const records = await Hexley.frameworks.database.parseCSV(
      Hexley,
      fileContent,
    );
    let wordFreq: Record<string, number>[] = [];

    for (const record of records) {
      const word = record.word;
      const frequency = record.count;
      if (frequency === "count") {
        continue;
      }
      wordFreq.push({ word, frequency: Number(frequency) });
    }

    await Hexley.frameworks.database.bulkCreate("words", wordFreq);

    await interaction.editReply({ embeds: [embed] });
  },

  async storyNewInteraction(Hexley: any, interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      let isMod = false;
      if (
        interaction.member &&
        interaction.member instanceof GuildMember &&
        this._isAdmin(interaction.member)
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

    const channelId = Hexley.modules.story.config.STORY_CHANNEL_ID;
    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} Story channel ID is set to: ${channelId}`,
      );
    /*
    if (!Hexley.databaseLoaded) {
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} ${Hexley.frameworks.aurora.colorText("Database not loaded", Hexley.frameworks.aurora.tintRedBright)}`,
      );
      return;
    }
*/
    Hexley.frameworks.database
      .getTables(Hexley, process.env.DB_NAME)
      .then((tables: string[]) => {
        if (!tables.includes("words")) {
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} The \"words\" table doesn't exist! Creating.`,
            );

          Hexley.frameworks.database
            .initTable(this.word_model)
            .then((_: any[]) => {});
        }

        if (!tables.includes("story")) {
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[story/storyInit]", this.moduleColor)} The \"story\" table doesn't exist! Creating.`,
            );

          Hexley.frameworks.database.initTable(this.story_model);

          Hexley.frameworks.database.add(
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

    if (Hexley.resources.framework.discord.isLoaded) {
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
