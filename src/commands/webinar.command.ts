import { MyContext } from "../types";
import { getUsers, resetWebinarForAllUsers } from "../services/firebase";

const ADMIN_CHAT_ID = 428205877

export async function webinarReport(ctx: MyContext) {
  try {
    if (!ctx.from) return;
    if (ADMIN_CHAT_ID && ctx.from.id !== ADMIN_CHAT_ID) {
      return ctx.reply("⛔ Недостатньо прав.");
    }

    await ctx.reply("⏳ Збираю статистику вебінару...");

    const users = await getUsers();
    let yes = 0, no = 0, unknown = 0;

    for (const u of users) {
      const v = (u?.webinar ?? null);
      if (v === "yes") yes++;
      else if (v === "no") no++;
      else unknown++;
    }

    const total = users.length;

    const report =
      "📊 *Звіт по вебінару*\n" +
      `👥 Всього: *${total}*\n` +
      `✅ Підтвердило: *${yes}*\n` +
      `❌ Сказали, що не буде: *${no}*\n` +
      `❓ Не проголосували: *${unknown}*`;

    return await ctx.api.sendMessage(ADMIN_CHAT_ID || ctx.chat!.id, report, {
      parse_mode: "Markdown",
    });
  } catch (e) {
    console.error("report-webinar error:", e);
    return await ctx.reply("⚠️ Помилка під час формування звіту.");
  }
}

export async function webinarReset(ctx: MyContext) {
  try {
    if (!ctx.from) return;
    if (ADMIN_CHAT_ID && ctx.from.id !== ADMIN_CHAT_ID) {
      return ctx.reply("⛔ Недостатньо прав.");
    }

    await ctx.reply("🧹 Скидаю поле `webinar` у всіх користувачів...");

    const res = await resetWebinarForAllUsers(); // { updated, failed }
    const msg =
      "✅ Готово.\n" +
      `Оновлено записів: *${res.updated}*\n` +
      (res.failed ? `З помилками: *${res.failed}*` : "Без помилок.");

    return await ctx.api.sendMessage(ADMIN_CHAT_ID || ctx.chat!.id, msg, {
      parse_mode: "Markdown",
    });
  } catch (e) {
    console.error("reset-webinar error:", e);
    return await ctx.reply("⚠️ Не вдалося скинути поле `webinar`.");
  }
}