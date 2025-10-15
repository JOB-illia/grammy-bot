import type { Bot } from "grammy";
import { callbackQueryData } from "./data";
import {
  getFileIdDocument,
  getFileIdPhoto,
  getFileIdVideo,
} from "./getFilesId";
import { MyContext } from "../types";
import { messageHandler } from "../commands/generate-sertificate";

export function registerBotOn(bot: Bot<MyContext>) {
  bot.on("callback_query:data", callbackQueryData);

  // VIDEO DEBUG
  bot.on("message:document", getFileIdDocument);
  bot.on("message:video", getFileIdVideo);
  bot.on("message:photo", getFileIdPhoto);
  bot.on("message:text", messageHandler);
}
