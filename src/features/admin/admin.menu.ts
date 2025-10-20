import { Menu } from "@grammyjs/menu";
import type { MyContext } from "../../types";
import { sendDailyReport } from "./reports";
import { getUsers } from "../../services/firebase";
import { queueManager } from "../../managers/queue.manager";
import { queueConfig } from "../../config/queue.config";
import { resetCourse } from "../course/course.service";
import { adminState } from "../../conversations/admin/admin";
import { handleNewsletter } from "../../conversations/admin";

export const adminMenu = new Menu<MyContext>("admin-menu")
  .text("📊 Denný Raport", async (ctx) => {
    try {
      await sendDailyReport();
      await ctx.reply("✅ Raport wysłany");
    } catch (error) {
      console.error("Error sending daily report:", error);
      await ctx.reply("❌ Błąd podczas generowania raportu");
    }
  })
  .row()
  .text("📢 Newsletter", async (ctx) => {
    try {
      const uid = ctx.from?.id;
      const state = uid ? adminState.get(uid) : undefined;

      const raw = ctx.msg?.text ?? ctx.update?.callback_query?.data ?? "";
      const isExit =
        typeof raw === "string" && /^\/(exit|cancel)(@\w+)?$/.test(raw);

      console.log("da");

      if (state && !isExit) {
        console.log("da");

        await handleNewsletter(ctx, state);
        return;
      }
    } catch (error) {
      console.error("Error entering admin conversation:", error);
      await ctx.reply("❌ Błąd podczas uruchamiania newslettera");
    }
  })
  // .text("📧 Email rozsylka", async (ctx) => {
  //   try {
  //     await ctx.conversation.enter("emailBroadcastConversation");
  //   } catch (error) {
  //     console.error("Error entering email conversation:", error);
  //     await ctx.reply("❌ Błąd podczas uruchamiania email rozsylki");
  //   }
  // })
  .row()
  .text("👥 Users", async (ctx) => {
    try {
      const users = await getUsers();
      const activeNow = queueManager.getActiveCount();
      await ctx.reply(
        `👥 *Statystyki użytkowników:*\n\n` +
          `Łącznie: ${users.length}\n` +
          `Aktywnych: ${users.filter((u) => u.isActive).length}\n` +
          `Aktywnych teraz: ${activeNow}\n` +
          `Z email: ${users.filter((u) => u.email).length}`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Error getting users stats:", error);
      await ctx.reply("❌ Błąd podczas pobierania statystyk");
    }
  })
  .row()
  .text("📊 Status systemu", async (ctx) => {
    try {
      const queueSize = queueManager.getActiveCount();
      const memoryUsage = process.memoryUsage();
      await ctx.reply(
        `⚙️ *Status systemu:*\n\n` +
          `Aktywnych kolejek: ${queueSize}\n` +
          `Max równoległych: ${queueConfig.maxConcurrent}\n` +
          `Opóźnienie między lekcjami: ${queueConfig.delayBetweenLessons / 1000}s\n` +
          `RAM: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      console.error("Error getting system stats:", error);
      await ctx.reply("❌ Błąd podczas pobierania statusu systemu");
    }
  })
  .text("🔄 Reset kursu", async (ctx) => {
    try {
      await resetCourse(ctx);
    } catch (error) {
      console.error("Error resetting course:", error);
      await ctx.reply("❌ Błąd podczas resetowania kursu");
    }
  });
