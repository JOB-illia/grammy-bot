import { Conversation } from "@grammyjs/conversations";
import { MyContext } from "../types";
import {
  getActiveOrders,
  getActivePotentialOrders,
} from "../services/firebase";
import { sendEmail } from "../services/emailService";

const PROGRESS_EVERY = 10; // кожні N відправлень шлемо короткий звіт у чат

export async function emailBroadcastConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  // 1) Джерело бази
  await ctx.reply(
    "📦 Оберіть базу для розсилки:\n• Введіть `orders` або `potentialOrders`\nАбо /cancel для скасування.",
  );
  const baseMsg = await conversation.wait();

  if (baseMsg.message?.text === "/cancel")
    return void ctx.reply("❌ Розсилку скасовано");

  const baseChoice = (baseMsg.message?.text || "").trim().toLowerCase();
  if (!["orders", "potentialorders"].includes(baseChoice)) {
    await ctx.reply(
      "⚠️ Невірний вибір. Доступні: `orders` або `potentialOrders`.",
    );
    return;
  }

  // 2) Тестовий режим
  await ctx.reply(
    "🧪 Це тестовий запуск?\n" +
      "• Введіть `так` — надішлю ЛИШЕ на job.klenchys.i@gmail.com\n" +
      "• Введіть `ні` — розсилка по вибраній базі\nАбо /cancel.",
  );
  const testMsg = await conversation.wait();
  if (testMsg.message?.text === "/cancel")
    return void ctx.reply("❌ Розсилку скасовано");

  const isTest = (testMsg.message?.text || "").trim().toLowerCase() === "так";

  // 3) Тема
  await ctx.reply("✉️ Введіть тему листа (або /cancel):");
  const subjectMsg = await conversation.wait();
  if (subjectMsg.message?.text === "/cancel")
    return void ctx.reply("❌ Розсилку скасовано");

  const subject = (subjectMsg.message?.text || "").trim();
  if (!subject) {
    await ctx.reply("⚠️ Тема порожня. Скасовую.");
    return;
  }

  // 4) Контент (повний HTML)
  await ctx.reply(
    "🧩 Вставте *повний HTML* листа (починаючи з `<!DOCTYPE ...>` або `<html>`).\n" +
      "Можна надіслати *текстом* або *файлом .html*.\nВведіть /cancel для скасування.",
    { parse_mode: "Markdown" },
  );

  const contentMsg = await conversation.wait();
  if (contentMsg.message?.text === "/cancel")
    return void ctx.reply("❌ Розсилку скасовано");

  // Підтримка як тексту, так і документа .html
  let html = "";
  if (contentMsg.message?.document) {
    // якщо прийшов файл — витягнемо текст
    const file = await ctx.api.getFile(contentMsg.message.document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const res = await fetch(fileUrl);
    html = await res.text();
  } else {
    html = contentMsg.message?.text || "";
  }

  if (!html.toLowerCase().includes("<html")) {
    await ctx.reply(
      "⚠️ Схоже, це не повний HTML (не знайдено `<html>`). Перевірте ще раз.",
    );
    return;
  }

  // 5) Підтвердження
  await ctx.reply(
    [
      "✅ Перевірка перед стартом:",
      `• База: *${baseChoice}*`,
      `• Режим: *${isTest ? "ТЕСТ" : "БОЙ"}*`,
      `• Тема: *${escapeMd(subject)}*`,
      `• HTML довжина: *${html.length.toLocaleString()}*`,
      "",
      "Надіслати? Введіть `Так` або /cancel.",
    ].join("\n"),
    { parse_mode: "Markdown" },
  );

  const confirmMsg = await conversation.wait();
  if (confirmMsg.message?.text?.toLowerCase() !== "так") {
    return void ctx.reply("❌ Розсилку скасовано");
  }

  // 6) Завантажуємо список емейлів
  let recipients: {
    email?: string;
    firstName?: string;
    username?: string;
    userId?: string;
  }[] = [];

  if (isTest) {
    recipients = [{ email: "job.klenchys.i@gmail.com" }];
  } else {
    recipients =
      baseChoice === "orders"
        ? await getActiveOrders()
        : await getActivePotentialOrders();
  }

  const total = recipients.filter((u) => !!u.email).length;
  if (!total) {
    await ctx.reply("😕 У вибраній базі немає валідних email.");
    return;
  }

  await ctx.reply(`🚀 Стартую розсилку на ${total} адрес...`);

  // 7) Відправка з логами
  let success = 0;
  let fail = 0;
  const failed: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const user = recipients[i];
    const to = (user.email || "").trim();
    if (!to) continue;

    try {
      await sendEmail({
        to,
        subject,
        html, // ключове: шлемо те, що ви вставили
        userName: user.firstName || user.username || "",
      });
      success++;
    } catch (err) {
      fail++;
      failed.push(to);
    }

    // Кожні PROGRESS_EVERY — короткий звіт
    const processed = success + fail;
    if (processed % PROGRESS_EVERY === 0 || processed === total) {
      await ctx.reply(
        `📊 Прогрес: ${processed}/${total}\n✅ Успішно: ${success}\n❌ Помилок: ${fail}`,
      );
    }
  }

  // 8) Фінальний звіт
  const lines = [
    "🏁 *Розсилка завершена!*",
    `• Всього: ${total}`,
    `• ✅ Успішно: ${success}`,
    `• ❌ Помилок: ${fail}`,
  ];

  if (failed.length) {
    const preview = failed.slice(0, 15).join("\n");
    lines.push("", "*Не доставлено (перші 15):*", "```\n" + preview + "\n```");
    if (failed.length > 15) lines.push(`... і ще ${failed.length - 15}`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}

function escapeMd(s: string) {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
