import { GrammyError } from "grammy";
import type { MyContext } from "../../types";
import { MESSAGES } from "../../config/constants";
import { queueManager } from "../../managers/queue.manager";
import { loadCourse } from "../../services/courseLoader";
import { updateUserProgress } from "../../services/firebase";
import { sendLessonWithRetry } from "./lesson.sender";
import { sendQuiz } from "../quiz/quiz.sender";
import { sendAssessmentQuiz } from "../assessment/assessment.sender";
import { finishCourse } from "./course.service";
import { sleep } from "../../utils/sleep";

export async function startAutoProgress(ctx: MyContext): Promise<void> {
  const userId = ctx.from!.id.toString();

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

  try {
    const course = await loadCourse();

    while (
      ctx.session.currentLessonIndex < course.length &&
      ctx.session.isProcessing
    ) {
      if (!queueManager.isProcessing(userId)) {
        ctx.session.isProcessing = false;
        break;
      }

      if (
        ctx.session.isWaitingForNext ||
        ctx.session.isWaitingForQuiz ||
        ctx.session.isWaitingForAssessment
      ) {
        break;
      }

      const lesson = course[ctx.session.currentLessonIndex];

      if (!lesson) {
        await ctx.reply("🎉 *Gratulacje!* Ukończyłeś cały kurs! 🏆", {
          parse_mode: "Markdown",
        });
        await finishCourse(ctx);
        break;
      }

      if (lesson.type === "quiz") {
        await sendQuiz(ctx, lesson);
        break;
      } else if (lesson.type === "assessment_quiz") {
        await sendAssessmentQuiz(ctx, lesson);
        break;
      } else {
        const hasNextButton = await sendLessonWithRetry(ctx, lesson);

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
          ctx.session.isWaitingForNext = true;
          ctx.session.currentLessonIndex++;

          ctx.session.isProcessing = false;
          queueManager.stopProcessing(userId);

          break;
        }

        ctx.session.currentLessonIndex++;

        if (ctx.session.currentLessonIndex < course.length) {
          if (lesson.delay && lesson.delay > 0) {
            await sleep(lesson.delay);
          }
        }
      }
    }

    if (
      ctx.session.currentLessonIndex >= course.length &&
      !ctx.session.isWaitingForNext &&
      !ctx.session.isWaitingForQuiz &&
      !ctx.session.isWaitingForAssessment
    ) {
      await finishCourse(ctx);
    }
  } catch (error) {
    console.error(`Error in auto progress for user ${userId}:`, error);
    await handleProgressError(ctx, error);
  }
}

export async function handleProgressError(
  ctx: MyContext,
  error: any,
): Promise<void> {
  const userId = ctx.from!.id.toString();
  ctx.session.isProcessing = false;
  queueManager.stopProcessing(userId);

  if (error instanceof GrammyError) {
    if (error.error_code === 403) {
      console.log(`User ${userId} blocked the bot`);
      return;
    } else if (error.error_code === 429) {
      await ctx.reply(MESSAGES.ERROR_RATE_LIMIT);
      return;
    }
  }

  await ctx.reply(MESSAGES.ERROR_GENERIC);
}
