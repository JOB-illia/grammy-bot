// src/conversations/admin.ts
import { Conversation } from "@grammyjs/conversations";
import { MyContext } from "../types";
import { getUsers } from "../services/firebase";

export async function adminConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext,
) {
  await ctx.reply(
    "📢 *Режим розсилки*\n\n" +
      "Надішліть повідомлення для розсилки.\n" +
      "Підтримуються: текст, фото, відео, документи, група медіа.\n\n" +
      "Надішліть /cancel для скасування.",
    { parse_mode: "Markdown" },
  );

  const message = await conversation.wait();

  if (message.message?.text === "/cancel") {
    await ctx.reply("❌ Розсилку скасовано");
    return;
  }

  const users = await getUsers();

  await ctx.reply(
    `👥 Знайдено ${users.length} активних користувачів.\n\n` +
      `Розпочати розсилку?\n` +
      `Надішліть "Так" для підтвердження або /cancel для скасування.`,
  );

  const confirmation = await conversation.wait();

  if (confirmation.message?.text?.toLowerCase() !== "так") {
    await ctx.reply("❌ Розсилку скасовано");
    return;
  }

  // Починаємо розсилку
  await ctx.reply("🚀 Розпочинаю розсилку...");

  let successCount = 0;
  let failCount = 0;
  const failedUsers: string[] = [];

  for (const user of users) {
    try {
      await copyMessageToUser(ctx, message.message!, user.login || user.userId);
      successCount++;

      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send to ${user.userId}:`, error);
      failCount++;
      failedUsers.push(user.username || user.userId);
    }
  }

  // Звіт про розсилку
  let report =
    `✅ *Розсилка завершена!*\n\n` +
    `📊 Статистика:\n` +
    `• Успішно: ${successCount}\n` +
    `• Помилок: ${failCount}`;

  await ctx.reply(report);
}

async function copyMessageToUser(ctx: MyContext, message: any, userId: string) {
  const bot = ctx.api;

  // Обробка різних типів повідомлень
  if (message.text) {
    await bot.sendMessage(userId, message.text, {
      entities: message.entities,
    });
  } else if (message.photo) {
    const photo = message.photo[message.photo.length - 1].file_id;
    await bot.sendPhoto(userId, photo, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else if (message.video) {
    await bot.sendVideo(userId, message.video.file_id, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else if (message.document) {
    await bot.sendDocument(userId, message.document.file_id, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else if (message.audio) {
    await bot.sendAudio(userId, message.audio.file_id, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else if (message.voice) {
    await bot.sendVoice(userId, message.voice.file_id, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else if (message.sticker) {
    await bot.sendSticker(userId, message.sticker.file_id);
  } else if (message.video_note) {
    await bot.sendVideoNote(userId, message.video_note.file_id);
  } else if (message.animation) {
    await bot.sendAnimation(userId, message.animation.file_id, {
      caption: message.caption,
      caption_entities: message.caption_entities,
    });
  } else {
    throw new Error("Unsupported message type");
  }
}
