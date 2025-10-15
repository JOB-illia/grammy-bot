import type { NextFunction } from "grammy";

import { getUser } from "../services/firebase";
import { MyContext } from "../types";

export const getSessionUser = async (ctx: MyContext, next: NextFunction) => {
  if (ctx.message?.text === "/start" || ctx.message?.text === "/restore") {
    return next();
  }

  if (ctx.from && ctx.callbackQuery?.data) {
    const userId = ctx.from.id.toString();

    const existingUser = await getUser(userId);

    const hasEmptySession =
      ctx.session.currentDay === 0 &&
      ctx.session.currentLessonIndex === 0 &&
      ctx.session.completedLessons.length === 0;

    if (existingUser && existingUser.currentDay > 0 && hasEmptySession) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Sesja wygasła",
        show_alert: false,
      });

      await ctx.reply(
        "⚠️ *Twoja sesja wygasła*\n\n" +
          "Przepraszamy! Podczas aktualizacji bota Twoja sesja została utracona.\n\n" +
          "💾 *Dobra wiadomość:* Twój postęp został zapisany!\n\n" +
          "✨ Naciśnij /start aby automatycznie przywrócić postęp i kontynuować kurs",
        { parse_mode: "Markdown" },
      );

      return;
    }
  }

  await next();
};
