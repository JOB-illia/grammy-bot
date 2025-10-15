import type { MyContext } from "../types";
import { scheduleUserProgress } from "../features/course/progress-queue";
import { bot } from "../bot";

export async function notifyOnRestore(
  ctx: MyContext,
  next: () => Promise<void>,
) {
  await next();

  if ((ctx as any)._restored) {
    const kb = {
      inline_keyboard: [
        [
          {
            text: "↩️ Повторити попередній урок",
            callback_data: "resume_prev",
          },
          { text: "➡️ Продовжити", callback_data: "resume_continue" },
        ],
      ],
    };

    await ctx.reply(
      "⚙️ Ми оновили бота, але твій контекст відновлено.\n" +
        "Можеш повторити попередній урок або просто продовжити.",
      { reply_markup: kb },
    );
  }
}

bot.callbackQuery("resume_prev", async (ctx) => {
  ctx.answerCallbackQuery();
  ctx.session.currentLessonIndex = Math.max(
    0,
    ctx.session.currentLessonIndex - 1,
  );
  ctx.session.isProcessing = false;
  await scheduleUserProgress(ctx);
});

bot.callbackQuery("resume_continue", async (ctx) => {
  ctx.answerCallbackQuery();
  ctx.session.isProcessing = false;
  await scheduleUserProgress(ctx);
});
