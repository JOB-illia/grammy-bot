// src/features/course/auto-progress.ts
import { GrammyError } from "grammy";
import type { MyContext } from "../../types";
import { MESSAGES } from "../../config/constants";
import { queueManager } from "../../managers/queue.manager";
import { loadCourse } from "../../services/courseLoader";
import {
  updateUserProgress,
  FirestoreSessionStorage,
} from "../../services/firebase";
import { sendLessonWithRetry } from "./lesson.sender";
import { sendQuiz } from "../quiz/quiz.sender";
import { sendAssessmentQuiz } from "../assessment/assessment.sender";
import { finishCourse } from "./course.service";
import { taskScheduler } from "../../index";

const storage = new FirestoreSessionStorage();

export async function startAutoProgress(ctx: MyContext): Promise<void> {
  const userId = ctx.from!.id.toString();

  console.log(`[AUTO-PROGRESS] Starting for user ${userId}`);
  console.log(
    `[AUTO-PROGRESS] Initial state: lesson=${ctx.session.currentLessonIndex}, isProcessing=${ctx.session.isProcessing}, isWaitingForNext=${ctx.session.isWaitingForNext}`,
  );

  // Перевірки стану
  if (ctx.session.isWaitingForQuiz) {
    await ctx.reply("📝 Dokończ najpierw aktualny test");
    return;
  }

  if (ctx.session.isWaitingForAssessment) {
    await ctx.reply("🔍 Dokończ najpierw samoocenę");
    return;
  }

  if (ctx.session.isProcessing && queueManager.isProcessing(userId)) {
    await ctx.reply("⏳ Lekcje są już w trakcie wysyłania...");
    return;
  }

  if (ctx.session.isProcessing && !queueManager.isProcessing(userId)) {
    ctx.session.isProcessing = false;
  }

  if (!queueManager.startProcessing(userId)) {
    await ctx.reply("⏳ System przeciążony. Spróbuj później.");
    return;
  }

  ctx.session.isProcessing = true;
  // Зберігаємо стан
  await storage.write(userId, ctx.session);

  try {
    await processNextLesson(ctx);
  } catch (error) {
    console.error(`[AUTO-PROGRESS ERROR] for user ${userId}:`, error);
    await handleProgressError(ctx, error);
  }
}

async function processNextLesson(ctx: MyContext): Promise<void> {
  const userId = ctx.from!.id.toString();
  const course = await loadCourse();

  // Перевіряємо чи є ще уроки
  if (ctx.session.currentLessonIndex >= course.length) {
    await ctx.reply("🎉 *Gratulacje!* Ukończyłeś cały kurs! 🏆", {
      parse_mode: "Markdown",
    });
    await finishCourse(ctx);
    return;
  }

  // Перевіряємо стани
  if (
    !ctx.session.isProcessing ||
    ctx.session.isWaitingForNext ||
    ctx.session.isWaitingForQuiz ||
    ctx.session.isWaitingForAssessment
  ) {
    return;
  }

  const lesson = course[ctx.session.currentLessonIndex];

  if (!lesson) {
    await finishCourse(ctx);
    return;
  }

  // Обробка різних типів уроків
  if (lesson.type === "quiz") {
    await sendQuiz(ctx, lesson);

    // При квізі зупиняємо обробку - чекаємо відповідей
    ctx.session.isProcessing = false;
    queueManager.stopProcessing(userId);
    await storage.write(userId, ctx.session);
    return;
  } else if (lesson.type === "assessment_quiz") {
    await sendAssessmentQuiz(ctx, lesson);

    // При асесменті зупиняємо обробку - чекаємо відповідей
    ctx.session.isProcessing = false;
    queueManager.stopProcessing(userId);
    await storage.write(userId, ctx.session);
    return;
  } else {
    // Звичайний урок
    const hasNextButton = await sendLessonWithRetry(ctx, lesson);

    // Зберігаємо прогрес
    if (
      !ctx.session.completedLessons.includes(ctx.session.currentLessonIndex)
    ) {
      ctx.session.completedLessons.push(ctx.session.currentLessonIndex);
      updateUserProgress(userId, ctx.session.currentLessonIndex).catch(
        (error) =>
          console.error(`Firebase update error for user ${userId}:`, error),
      );
    }

    if (hasNextButton) {
      // ВАЖЛИВО: встановлюємо прапорці ПЕРЕД збільшенням індексу
      ctx.session.isWaitingForNext = true;
      ctx.session.currentLessonIndex++;
      ctx.session.isProcessing = false;

      // Зберігаємо стан в Firestore
      await storage.write(userId, ctx.session);

      queueManager.stopProcessing(userId);
    } else {
      // Урок без кнопки - плануємо наступний
      ctx.session.currentLessonIndex++;
      await storage.write(userId, ctx.session);

      if (ctx.session.currentLessonIndex < course.length) {
        const delayMs = lesson.delay || 0;

        if (delayMs > 0) {
          // Плануємо наступний урок через затримку
          ctx.session.isProcessing = false;
          queueManager.stopProcessing(userId);
          await storage.write(userId, ctx.session);

          taskScheduler.schedule(
            userId,
            async () => {
              // Перевіряємо чи користувач ще активний
              if (
                !ctx.session.isWaitingForQuiz &&
                !ctx.session.isWaitingForAssessment
              ) {
                ctx.session.isProcessing = true;
                await storage.write(userId, ctx.session);

                if (queueManager.startProcessing(userId)) {
                  await processNextLesson(ctx);
                }
              }
            },
            delayMs,
          );
        } else {
          // Відразу обробляємо наступний урок
          await processNextLesson(ctx);
        }
      } else {
        // Кінець курсу
        await finishCourse(ctx);
      }
    }
  }
}

export async function handleProgressError(
  ctx: MyContext,
  error: any,
): Promise<void> {
  const userId = ctx.from!.id.toString();

  ctx.session.isProcessing = false;
  ctx.session.isWaitingForNext = false;
  queueManager.stopProcessing(userId);
  taskScheduler.cancelUserTasks(userId);

  // Зберігаємо стан
  await storage.write(userId, ctx.session);

  if (error instanceof GrammyError) {
    if (error.error_code === 403) {
      console.log(`User ${userId} blocked the bot`);
      return;
    } else if (error.error_code === 429) {
      await ctx.reply(MESSAGES.ERROR_RATE_LIMIT);

      // Перепланувати спробу через 30 секунд
      taskScheduler.schedule(
        userId,
        async () => {
          await startAutoProgress(ctx);
        },
        30000,
      );
      return;
    }
  }

  await ctx.reply(MESSAGES.ERROR_GENERIC);
}
