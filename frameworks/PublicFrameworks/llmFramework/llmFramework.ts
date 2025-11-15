import {
  GenerateContentResponseUsageMetadata,
  GoogleGenAI,
} from "@google/genai";

/**
 * The globally accessible framework for managing Hexley modules.
 */
export const llmFramework = {
  // Framework Logging Color
  frameworkColor: "#cfabff",

  gemini: undefined as GoogleGenAI | undefined,

  /**
   * Chat with a selected Chatbot
   * @param {any} Hexley - The main Hexley global object.
   * @param {string} message - The message for the chatbot.
   * @param {string | undefined} model - the model to use for the chatbot. By default it will select any initalised model.
   * @param {any | undefined} options - model specific options.
   */
  async chat(
    Hexley: any,
    message: string,
    model: string | undefined = undefined,
    options: any | undefined = undefined,
  ) {
    let response: string | undefined;
    let properModel = model;

    if (!properModel) {
      if (this.gemini) {
        properModel = "gemini";
      } else {
        Hexley.log(
          `${Hexley.frameworks.aurora.colorText("[llmFramework/chat]", this.frameworkColor)} Cannot find a model that is initialized!`,
        );
        return undefined;
      }
    }

    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[llmFramework/chat]", this.frameworkColor)} Chatting with ${properModel}, message: "${message}"`,
      );

    const timeStart = new Date().getTime();

    switch (properModel) {
      case "gemini":
        if (this.gemini) {
          let model = "gemini-2.5-flash-lite";
          if (options) {
            model = options.model || model;
          }
          const geminiResponse = await this.gemini.models.generateContent({
            model: model,
            contents: message,
          });
          if (geminiResponse.text) {
            response = geminiResponse.text;
          }
        } else {
          Hexley.log(
            `${Hexley.frameworks.aurora.colorText("[llmFramework/chat]", this.frameworkColor)} Gemini is not initialized! Not using.`,
          );
        }
        break;
      default:
        Hexley.log(
          `${Hexley.frameworks.aurora.colorText("[llmFramework/chat]", this.frameworkColor)} Unsupported model: ${properModel}`,
        );
    }

    const ms = new Date().getTime() - timeStart;

    if (Hexley.debugMode)
      Hexley.log(
        `${Hexley.frameworks.aurora.colorText("[llmFramework/chat]", this.frameworkColor)} Chatting complete after ${ms}ms.`,
      );

    if (!response) {
      return undefined;
    }
    return { text: response, time: ms };
  },

  /**
   * Initializes the LLM Framework.
   * @param {any} Hexley - The main Hexley global object.
   */
  initializeLLM(Hexley: any) {
    Hexley.log(
      `${Hexley.frameworks.aurora.colorText("[llmFramework/initializeLLM]", this.frameworkColor)} Initializing...`,
    );

    const testMessage =
      "Say something simple to prove you are working, include your AI (e.g, ChatGPT, gemini) name. Nice and short.";

    if (
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim().length > 0
    ) {
      this.gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      this.chat(Hexley, testMessage, "gemini").then((result) => {
        if (result) {
          if (Hexley.debugMode)
            Hexley.log(
              `${Hexley.frameworks.aurora.colorText("[llmFramework/initializeLLM]", this.frameworkColor)} Gemini Initialized! Response to test: \"${result.text}\" after ${result.time}ms`,
            );
        }
      });
    }

    Hexley.log(
      `${Hexley.frameworks.aurora.colorText("[llmFramework/initializeLLM]", this.frameworkColor)} Initialized! LLM Framework is now loaded into memory.`,
    );
  },
};
