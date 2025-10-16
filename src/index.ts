// src/index.ts (оновлена частина обробки callback_query)
import { bot } from "./bot";
import { run, sequentialize } from "@grammyjs/runner";
import dotenv from "dotenv";
import cron from "node-cron";

import { hydrateMiddleware } from "./middleware/hydrate.middleware";
import { sessionMiddleware } from "./middleware/session.middleware";
import { adminMenu } from "./features/admin";
import { registerCommands } from "./commands";
import { setupErrorHandler } from "./handlers/error.handler";
import { initializeServices, setupScheduler } from "./services";
import { conversations, createConversation } from "@grammyjs/conversations";
import { adminConversation } from "./conversations/admin";
import { emailBroadcastConversation } from "./conversations/emailBroadcast";
import { ensureSession } from "./middleware/ensure-session";
import { TaskScheduler } from "./services/task-scheduler";
import { messageHandler } from "./commands/generate-sertificate";

dotenv.config();

// Глобальний планувальник завдань
export const taskScheduler = new TaskScheduler();

// Middleware
bot.use(hydrateMiddleware);
bot.use(sessionMiddleware);
bot.use(ensureSession);

// Conversations ПЕРЕД sequentialize
bot.use(conversations());
bot.use(createConversation(adminConversation));
bot.use(createConversation(emailBroadcastConversation));

// Admin menu
bot.use(adminMenu);

// Sequentialize ТІЛЬКИ для команд і повідомлень, НЕ для callback_query
bot.on(
  "message",
  sequentialize((ctx) => String(ctx.from?.id ?? "")),
);

// Реєстрація команд
registerCommands(bot);

// ГОЛОВНИЙ ОБРОБНИК callback_query - ОДИН для всіх кнопок
bot.on("callback_query:data", async (ctx) => {
  const startTime = Date.now();
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id.toString();

  console.log(`[CALLBACK] User ${userId} clicked: "${data}"`);
  console.log(
    `[CALLBACK] Session before: isWaitingForNext=${ctx.session?.isWaitingForNext}, isProcessing=${ctx.session?.isProcessing}, currentLesson=${ctx.session?.currentLessonIndex}`,
  );

  try {
    // Відповідаємо на callback одразу
    await ctx.answerCallbackQuery();

    // Перевіряємо сесію
    if (!ctx.session || Object.keys(ctx.session).length === 0) {
      console.log(`[CALLBACK] No session for user ${userId}, restoring...`);

      const { FirestoreSessionStorage, getUser } = await import(
        "./services/firebase"
      );
      const storage = new FirestoreSessionStorage();
      const saved = await storage.read(userId);

      if (saved) {
        ctx.session = saved as any;
        console.log(
          `[CALLBACK] Session restored from Firestore for user ${userId}`,
        );
      } else {
        const user = await getUser(userId);
        if (user) {
          ctx.session = {
            currentDay: user.currentDay ?? 0,
            currentLessonIndex: user.currentDay ?? 0,
            completedLessons: user.completedLessons ?? [],
            isWaitingForNext: false,
            isProcessing: false,
            isWaitingForQuiz: false,
            currentQuiz: null,
            currentQuestionIndex: 0,
            quizAnswers: [],
            quizResults: [],
            quizAttempts: 0,
            isWaitingForAssessment: false,
            currentAssessment: null,
            currentAssessmentQuestionIndex: 0,
            assessmentAnswers: [],
            assessmentResults: [],
            lastAssessmentAdvice: "",
            waitingForName: [],
            isAdmin: false,
          } as any;
          console.log(`[CALLBACK] Session restored from DB for user ${userId}`);
        }
      }
    }

    // ОБРОБКА КНОПКИ "NEXT" АБО "DALEJ" (включаючи "Jasne")
    if (
      data === "next" ||
      data === "dalej" ||
      data.includes("next") ||
      data.includes("dalej")
    ) {
      console.log(`[CALLBACK] Processing NEXT button for user ${userId}`);
      console.log(
        `[CALLBACK] isWaitingForNext: ${ctx.session.isWaitingForNext}`,
      );
      console.log(`[CALLBACK] isProcessing: ${ctx.session.isProcessing}`);
      console.log(
        `[CALLBACK] currentLessonIndex: ${ctx.session.currentLessonIndex}`,
      );

      if (ctx.session.isWaitingForNext) {
        console.log(
          `[CALLBACK] User was waiting for next, continuing course...`,
        );

        // Скидаємо прапор очікування
        ctx.session.isWaitingForNext = false;

        // Зберігаємо зміни
        const { FirestoreSessionStorage } = await import("./services/firebase");
        const storage = new FirestoreSessionStorage();
        await storage.write(userId, ctx.session);

        // Імпортуємо та викликаємо продовження курсу
        const { scheduleUserProgress } = await import(
          "./features/course/progress-queue"
        );

        // Запускаємо наступний урок
        scheduleUserProgress(ctx);

        console.log(`[CALLBACK] Course progress scheduled for user ${userId}`);
      } else {
        console.log(
          `[CALLBACK] User was NOT waiting for next, might be after bot restart`,
        );

        // Після рестарту бота - просто продовжуємо з поточного уроку
        if (
          !ctx.session.isProcessing &&
          !ctx.session.isWaitingForQuiz &&
          !ctx.session.isWaitingForAssessment
        ) {
          console.log(
            `[CALLBACK] Starting progress for user ${userId} (probably after restart)`,
          );

          // Скидаємо прапорці та запускаємо прогрес
          ctx.session.isWaitingForNext = false;

          const { FirestoreSessionStorage } = await import(
            "./services/firebase"
          );
          const storage = new FirestoreSessionStorage();
          await storage.write(userId, ctx.session);

          const { scheduleUserProgress } = await import(
            "./features/course/progress-queue"
          );
          scheduleUserProgress(ctx);

          console.log(`[CALLBACK] Started progress for user ${userId}`);
        } else {
          console.log(
            `[CALLBACK] User ${userId} is already processing or in quiz/assessment`,
          );

          // Можливо isProcessing застряг - спробуємо все одно
          if (
            ctx.session.isProcessing &&
            !ctx.session.isWaitingForQuiz &&
            !ctx.session.isWaitingForAssessment
          ) {
            console.log(
              `[CALLBACK] Force resetting processing flag and continuing`,
            );

            ctx.session.isProcessing = false;
            ctx.session.isWaitingForNext = false;

            const { FirestoreSessionStorage } = await import(
              "./services/firebase"
            );
            const storage = new FirestoreSessionStorage();
            await storage.write(userId, ctx.session);

            const { scheduleUserProgress } = await import(
              "./features/course/progress-queue"
            );
            scheduleUserProgress(ctx);
          }
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[CALLBACK] NEXT button processed in ${elapsed}ms`);
      return;
    }

    // Assessment handlers
    if (data === "assessment_yes") {
      console.log(`[CALLBACK] Processing assessment_yes for user ${userId}`);
      if (ctx.session.isWaitingForAssessment) {
        const { handleAssessmentAnswer } = await import(
          "./features/assessment"
        );
        await handleAssessmentAnswer(ctx, true);
      }
      return;
    }

    if (data === "assessment_no") {
      console.log(`[CALLBACK] Processing assessment_no for user ${userId}`);
      if (ctx.session.isWaitingForAssessment) {
        const { handleAssessmentAnswer } = await import(
          "./features/assessment"
        );
        await handleAssessmentAnswer(ctx, false);
      }
      return;
    }

    if (data === "show_assessment_advice") {
      console.log(`[CALLBACK] Showing assessment advice for user ${userId}`);
      if (ctx.session.lastAssessmentAdvice) {
        await ctx.reply(`💡 *Porady:*\n\n${ctx.session.lastAssessmentAdvice}`, {
          parse_mode: "Markdown",
        });
      }
      return;
    }

    if (data === "assessment_continue") {
      console.log(`[CALLBACK] Continuing after assessment for user ${userId}`);
      const { continueAfterAssessment } = await import("./features/assessment");
      await continueAfterAssessment(ctx);
      return;
    }

    // Quiz handlers
    if (data.startsWith("quiz_answer_")) {
      const answerIndex = parseInt(data.replace("quiz_answer_", ""));
      console.log(
        `[CALLBACK] Processing quiz answer ${answerIndex} for user ${userId}`,
      );
      if (ctx.session.isWaitingForQuiz) {
        const { handleQuizAnswer } = await import("./features/quiz");
        await handleQuizAnswer(ctx, answerIndex);
      }
      return;
    }

    if (data === "retry_quiz") {
      console.log(`[CALLBACK] Retrying quiz for user ${userId}`);
      if (ctx.session.currentQuiz) {
        ctx.session.currentQuestionIndex = 0;
        ctx.session.quizAnswers = [];
        ctx.session.quizAttempts = (ctx.session.quizAttempts || 0) + 1;

        await ctx.reply(
          `🔄 *Повторний test - próba ${ctx.session.quizAttempts}*\n\nZaczynamy ponownie!`,
          { parse_mode: "Markdown" },
        );

        taskScheduler.schedule(
          userId,
          async () => {
            const { sendQuizQuestion } = await import(
              "./features/quiz/quiz.sender"
            );
            await sendQuizQuestion(ctx);
          },
          1000,
        );
      }
      return;
    }

    // Resume handlers
    if (data === "resume_prev") {
      console.log(`[CALLBACK] Resume previous lesson for user ${userId}`);
      ctx.session.currentLessonIndex = Math.max(
        0,
        ctx.session.currentLessonIndex - 1,
      );
      ctx.session.isProcessing = false;
      const { scheduleUserProgress } = await import(
        "./features/course/progress-queue"
      );
      await scheduleUserProgress(ctx);
      return;
    }

    if (data === "resume_continue") {
      console.log(`[CALLBACK] Resume continue for user ${userId}`);
      ctx.session.isProcessing = false;
      const { scheduleUserProgress } = await import(
        "./features/course/progress-queue"
      );
      await scheduleUserProgress(ctx);
      return;
    }

    console.log(
      `[CALLBACK] Unknown callback data: "${data}" from user ${userId}`,
    );
  } catch (error) {
    console.error(`[CALLBACK ERROR] User ${userId}, data: "${data}":`, error);
    await ctx.reply("❌ Wystąpił błąd. Spróbuj ponownie lub użyj /start");
  }
});

// Обробка медіа-повідомлень
bot.on("message:document", async (ctx) => {
  const fileId = ctx.message.document?.file_id;
  console.log("📄 DOCUMENT FILE_ID:", fileId);
  await ctx.reply(`file_id:\n${fileId}`);
});

bot.on("message:video", async (ctx) => {
  const fileId = ctx.message.video?.file_id;
  console.log("📦 VIDEO FILE_ID:", fileId);
  await ctx.reply(`file_id:\n${fileId}`);
});

bot.on("message:photo", async (ctx) => {
  const photo = ctx.message.photo;
  const fileId = photo[photo.length - 1].file_id;
  console.log("📸 PHOTO FILE_ID:", fileId);
  await ctx.reply(`file_id:\n${fileId}`);
});

bot.on("message:text", messageHandler);

// Error handler
setupErrorHandler(bot);

// SCHEDULED MODE
if (process.env.COURSE_MODE === "scheduled") {
  cron.schedule("0 10 * * *", async () => setupScheduler());
}

let runnerHandle: ReturnType<typeof run> | null = null;

// Graceful shutdown
process.once("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  taskScheduler.stop();
  if (runnerHandle?.isRunning()) {
    await runnerHandle.stop();
  }
  process.exit(0);
});

process.once("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  taskScheduler.stop();
  if (runnerHandle?.isRunning()) {
    await runnerHandle.stop();
  }
  process.exit(0);
});

async function start() {
  try {
    await initializeServices();

    taskScheduler.start();

    const botInfo = await bot.api.getMe();

    console.log(`Bot @${botInfo.username} started!`);
    console.log(`Mode: ${process.env.COURSE_MODE}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);

    runnerHandle = run(bot, {
      runner: {
        fetch: {
          allowed_updates: ["message", "callback_query", "inline_query"],
        },
      },
    });

    console.log("Runner started with concurrent update processing");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

start().catch((error) => {
  console.error("Critical startup error:", error);
  process.exit(1);
});
