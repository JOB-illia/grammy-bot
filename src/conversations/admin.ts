// newsletter.ts
import { getUsers } from "../services/firebase";

// Розширений стан адмін-флоу
export type AdminState = {
  step: "awaitContent" | "awaitButtons" | "awaitAudience" | "awaitMinLesson" | "awaitConfirm";
  payload?: any;           // оригінальне повідомлення адміна (text/photo/video/...)
  filteredUsers?: any[];   // проміжний список користувачів
  minLesson?: number;      // мінімальний урок для фільтрації
  keyboard?: any | null;   // inline_keyboard (reply_markup)
};

// Хелпер: скидання стану в дефолт
function resetState(state: AdminState) {
  state.step = "awaitContent";
  state.payload = undefined;
  state.filteredUsers = undefined;
  state.minLesson = undefined;
  state.keyboard = null;
}

// Хелпер: побудова reply_markup з текстового вводу адміна
// Формат рядків: "Текст -> payload"
// payload може бути або URL, або callback_data
function buildInlineKeyboardFromText(input: string) {
  const lines = input
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const inline_keyboard: any[][] = [];

  for (const line of lines) {
    const [labelPart, payloadPart] = line.split("->").map((s) => s?.trim());
    if (!labelPart || !payloadPart) continue;

    if (/^https?:\/\//i.test(payloadPart)) {
      inline_keyboard.push([{ text: labelPart, url: payloadPart }]);
    } else {
      // ⚠️ Telegram limit: callback_data до ~64 байт
      inline_keyboard.push([{ text: labelPart, callback_data: payloadPart }]);
    }
  }

  if (!inline_keyboard.length) return null;
  return { inline_keyboard };
}

export async function handleNewsletter(ctx: any, state: AdminState) {
  // Логування для відладки (залишив як у вас)
  console.log(ctx.msg?.text, ctx);
  console.log(state.step, state);

  // Глобальний cancel
  if ((ctx.msg?.text ?? "").trim().toLowerCase() === "/cancel") {
    await ctx.reply("❌ Розсилку скасовано");
    resetState(state);
    return;
  }

  switch (state.step) {
    // 1) Чекаємо контент для розсилки
    case "awaitContent": {
      const msg = ctx.update?.message;

      if (!msg) {
        await ctx.reply("Надішліть повідомлення (текст/медіа) для розсилки.");
        return;
      }

      state.payload = msg;
      state.step = "awaitButtons";

      await ctx.reply(
        "➕ Додати кнопки?\n" +
        "Надішліть у форматі:\n" +
        "  Текст кнопки -> next:webinar-yes\n" +
        "Кілька кнопок — кожна з нового рядка.\n" +
        "Напишіть 'ні' щоб пропустити."
      );

      return;
    }

    // 2) Чекаємо опис кнопок або пропуск
    case "awaitButtons": {
      const raw = (ctx.msg?.text ?? "").trim();

      if (raw && raw.toLowerCase() !== "ні") {
        state.keyboard = buildInlineKeyboardFromText(raw);


        console.log('BUTTONS', JSON.stringify(state.keyboard, null, 2));

        if (!state.keyboard) {
          await ctx.reply("⚠️ Не вдалося розпізнати кнопки. Пропущу цей крок.");
        }
      } else {
        state.keyboard = null;
      }

      state.step = "awaitAudience";
      await ctx.reply(
        "🎯 Оберіть аудиторію:\n" +
        "1️⃣ Всі користувачі\n" +
        "2️⃣ Тільки активні\n" +
        "3️⃣ Хто пройшов тести\n" +
        "4️⃣ За прогресом курсу\n\n" +
        "Надішліть номер."
      );
      return;
    }

    // 3) Вибір аудиторії
    case "awaitAudience": {
      const choice = ctx.msg?.text?.trim();
      if (!["1", "2", "3", "4"].includes(choice)) {
        await ctx.reply("❌ Невірний вибір. Надішліть 1, 2, 3 або 4.");
        return;
      }

      let targetUsers = await getUsers();

      if (choice === "2") {
        targetUsers = targetUsers.filter((u: any) => u.isActive);
      }
      if (choice === "3") {
        await ctx.reply("⏳ Шукаю користувачів з пройденими тестами...");
        // Рекомендація: зберігати індекс результатів тестів окремо від session
        targetUsers = targetUsers.filter((u: any) => u.hasPassedTests === true);
      }
      if (choice === "4") {
        state.step = "awaitMinLesson";
        state.filteredUsers = targetUsers;
        await ctx.reply("📊 Введіть мінімальний номер уроку (наприклад 5):");
        return;
      }

      state.filteredUsers = targetUsers;
      state.step = "awaitConfirm";
      await ctx.reply(
        `👥 К-сть користувачів: ${targetUsers.length}. Надішліть "Так" для старту або /cancel.`
      );
      return;
    }

    // 3b) Додаткова фільтрація за мінімальним уроком
    case "awaitMinLesson": {
      const min = parseInt(ctx.msg?.text ?? "", 10);
      if (!Number.isFinite(min) || min < 0) {
        await ctx.reply("❌ Неправильне число. Скасував.");
        resetState(state);
        return;
      }

      state.minLesson = min;
      const users = (state.filteredUsers ?? []).filter(
        (u: any) => Number(u?.currentDay ?? 0) >= min
      );

      state.filteredUsers = users;
      state.step = "awaitConfirm";

      await ctx.reply(
        `👥 К-сть користувачів: ${users.length}. Надішліть "Так" для старту або /cancel.`
      );
      return;
    }

    // 4) Підтвердження та відправка
    case "awaitConfirm": {
      const ok = (ctx.msg?.text ?? "").trim().toLowerCase();
      if (ok !== "так") {
        await ctx.reply("❌ Розсилку скасовано");
        resetState(state);
        return;
      }

      const users = state.filteredUsers ?? [];
      const reply_markup = state.keyboard ?? state.payload?.reply_markup ?? undefined;

      await ctx.reply("🚀 Стартую розсилку...");
      let success = 0,
        fail = 0;
      const failed: string[] = [];

      for (const user of users) {
        try {
          await copyMessageToUser(ctx, state.payload, user.userId, reply_markup);
          success++;
          // Трохи тротлінгу, щоб не ловити лімітів
          await new Promise((r) => setTimeout(r, 50));
        } catch (e) {
          console.error(`Failed to ${user.userId}`, e);
          fail++;
          failed.push(user.username || user.userId);
        }
      }

      let report = `✅ Готово!\nУспішно: ${success}\nПомилок: ${fail}`;
      if (failed.length && failed.length <= 10) {
        report += `\n❌ Не доставлено: ${failed.join(", ")}`;
      }
      await ctx.reply(report);

      // Закриваємо флоу
      resetState(state);
      return;
    }
  }
}

// Копіювання повідомлення з підтримкою reply_markup (інлайн-кнопок)
export async function copyMessageToUser(
  ctx: any,
  message: any,
  userId: string,
  reply_markup?: any
) {
  const bot = ctx.api;

  // Для тексту — прокидуємо entities і клавіатуру
  if (message.text) {
    await bot.sendMessage(userId, message.text, {
      entities: message.entities,
      reply_markup,
    });
    return;
  }

  if (message.caption || message.photo || message.video || message.document || message.audio || message.voice || message.sticker || message.video_note || message.animation) {
    if (message.photo) {
      const photo = message.photo.at(-1).file_id;
      await bot.sendPhoto(userId, photo, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
    if (message.video) {
      await bot.sendVideo(userId, message.video.file_id, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
    if (message.document) {
      await bot.sendDocument(userId, message.document.file_id, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
    if (message.audio) {
      await bot.sendAudio(userId, message.audio.file_id, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
    if (message.voice) {
      await bot.sendVoice(userId, message.voice.file_id, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
    if (message.sticker) {
      await bot.sendSticker(userId, message.sticker.file_id, {
        reply_markup,
      });
      return;
    }
    if (message.video_note) {
      await bot.sendVideoNote(userId, message.video_note.file_id, {
        reply_markup,
      });
      return;
    }
    if (message.animation) {
      await bot.sendAnimation(userId, message.animation.file_id, {
        caption: message.caption,
        caption_entities: message.caption_entities,
        reply_markup,
      });
      return;
    }
  }

  throw new Error("Unsupported message type");
}
