import type { MyContext } from "../types";
import { isAdmin } from "../config/bot.config";
import { MESSAGES } from "../config/constants";
import { adminMenu } from "../features/admin/admin.menu";
import { adminState } from "../conversations/admin/admin";

export async function adminCommand(ctx: MyContext) {
  try {
    if (!isAdmin(ctx.from!.id.toString())) {
      await ctx.reply(MESSAGES.NO_ACCESS);
      return;
    }

    const userId = ctx.from!.id;
    ctx.session.mode = "admin";
    ctx.session.isAdmin = true;

    // тут стопаємо ваші фонові процеси
    // queueManager.stopProcessing(String(userId));
    // taskScheduler.cancelUserTasks(String(userId));

    adminState.set(userId, { step: "awaitContent" });

    await ctx.reply(
      "⏸️ Курс поставлено на паузу\n\n" +
        "📢 Режим розсилки (без логів у Firestore)\n" +
        "Надішліть повідомлення для розсилки (текст/фото/відео/док/voice).\n\n" +
        "Команди: /exit — вийти, /cancel — скасувати.",
      {
        parse_mode: "Markdown",
        reply_markup: adminMenu,
      },
    );
  } catch (error) {
    console.error("Error in admin command:", error);
    await ctx.reply("❌ Błąd dostępu do panelu administratora");
  }
}
