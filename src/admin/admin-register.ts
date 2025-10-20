// admin-register.ts
import { adminState } from "../conversations/admin/admin";
import { adminMenu } from "../features/admin";

const ADMIN_IDS = new Set<number>([428205877]);

export function registerAdmin(bot: any) {
  bot.command("admin", async (ctx: any) => {
    if (!ADMIN_IDS.has(ctx.from!.id)) return;

    const uid = ctx.from!.id;
    ctx.session.mode = "admin"; // опційно, якщо хочете флажок у сесії
    adminState.set(uid, { step: "awaitContent" });

    await ctx.reply(
      "⏸️ Курс поставлено на паузі\n\n" +
        "📢 Режим розсилки (FSM, без Firestore логів)\n" +
        "Надішліть повідомлення для розсилки (текст/фото/відео/док/voice).\n\n" +
        "Команди: /exit — вийти, /cancel — скасувати.",
      {
        parse_mode: "Markdown",
        reply_markup: adminMenu,
      },
    );
  });

  bot.command(["exit", "cancel"], async (ctx: any) => {
    if (!ADMIN_IDS.has(ctx.from!.id)) return;
    adminState.delete(ctx.from!.id);
    ctx.session.mode = null;
    await ctx.reply("✅ Вийшов з admin mode. Повертаю стандартну роботу.");
  });
}
