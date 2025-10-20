import type { Bot } from "grammy";
import type { MyContext } from "../types";

import { startCommand } from "./start.command";
import { pauseCommand } from "./pause.command";
import { resumeCommand } from "./resume.command";
import { skipCommand } from "./skip.command";
import { progressCommand } from "./progress.command";
import { supportCommand } from "./support.command";
import { adminCommand } from "./admin.command";
import { reportCommand } from "./report.command";
import { statsCommand } from "./stats.command";
import { quizResultsCommand } from "./quizResults.command";
import { assessmentResultsCommand } from "./assessmentResults.command";
import { getPhones } from "./get-phones.command";
import { restoreCommand } from "./restore.command";
import { waBroadcastCommand } from "./waBroadcast.command";
import { generateCertificateCommand } from "./generate-sertificate";
import { webinarReport, webinarReset } from "./webinar.command";

export function registerCommands(bot: Bot<MyContext>) {
  bot.command("start", startCommand);
  bot.command("report", reportCommand);
  bot.command("get", getPhones);
  bot.command("pause", pauseCommand);
  bot.command("resume", resumeCommand);
  bot.command("skip", skipCommand);
  bot.command("restore", restoreCommand);
  bot.command("assessmentresults", assessmentResultsCommand);
  bot.command("progress", progressCommand);
  bot.command("quizresults", quizResultsCommand);
  bot.command("admin", adminCommand);
  bot.command("stats", statsCommand);
  bot.command("support", supportCommand);
  bot.command("wa", waBroadcastCommand);
  bot.command("cert", generateCertificateCommand);
  bot.command("webinar", webinarReport);
  bot.command("resetWebinar", webinarReset);
}
