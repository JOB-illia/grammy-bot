import type { MyContext } from "../types";
import { getUser, saveUser } from "../services/firebase";
import { notifyUserStarted } from "../features/admin/notifications";
import { scheduleUserProgress } from "../features/course/progress-queue";
import { sleep } from "../utils/sleep";
import { loadCourse } from "../services/courseLoader";
import { getProgressBar } from "../utils/progress-bar";

export async function startCommand(ctx: MyContext) {
  try {
    const userId = ctx.from!.id;
    const username = ctx.from!.username || "unknown";
    const firstName = ctx.from!.first_name || "";

    // Перевіряємо чи користувач вже був
    const existingUser = await getUser(userId.toString());

    if (existingUser && existingUser.currentDay > 0) {
      console.log("USER ME", existingUser);

      ctx.session.currentDay = existingUser.currentDay;
      ctx.session.currentLessonIndex = existingUser.currentDay;
      ctx.session.completedLessons = existingUser.completedLessons || [];
      ctx.session.isWaitingForNext = false;
      ctx.session.isProcessing = false;
      ctx.session.isWaitingForQuiz = false;
      ctx.session.currentQuiz = null;
      ctx.session.currentQuestionIndex = 0;
      ctx.session.quizAnswers = [];
      ctx.session.quizAttempts = 0;
      ctx.session.isWaitingForAssessment = false;
      ctx.session.currentAssessment = null;
      ctx.session.currentAssessmentQuestionIndex = 0;
      ctx.session.assessmentAnswers = [];
      ctx.session.quizResults = [];
      ctx.session.assessmentResults = [];
      ctx.session.lastAssessmentAdvice = "";
      ctx.session.waitingForName = [];

      const course = await loadCourse();
      const totalLessons = course.length;
      const progress = Math.round(
        (ctx.session.completedLessons.length / totalLessons) * 100,
      );

      await ctx.reply(
        `👋 Witaj ponownie, ${firstName}!\n\n` +
          `✅ *Twój postęp został przywrócony!*\n\n` +
          `📊 Ukończone lekcje: ${ctx.session.completedLessons.length}/${totalLessons}\n` +
          `📈 Postęp: ${progress}%\n` +
          `${getProgressBar(ctx.session.completedLessons.length, totalLessons)}\n\n` +
          `⚡ Kontynuuję kurs automatycznie...`,
        { parse_mode: "Markdown" },
      );

      await saveUser({
        userId: userId.toString(),
        username,
        firstName,
        startDate: existingUser.startDate,
        isActive: true,
        currentDay: existingUser.currentDay,
        createdAt: existingUser.startDate,
      });

      if (process.env.COURSE_MODE === "instant") {
        await sleep(2000);
        scheduleUserProgress(ctx);
      }

      return;
    }

    // ✅ НОВИЙ КОРИСТУВАЧ - СТАНДАРТНА РЕЄСТРАЦІЯ

    await saveUser({
      userId: userId.toString(),
      username,
      firstName,
      startDate: new Date().toISOString(),
      isActive: true,
      currentDay: 0,
      createdAt: new Date().toISOString(),
    });

    // Скидаємо всю сесію для нового користувача
    ctx.session.currentDay = 0;
    ctx.session.currentLessonIndex = 0;
    ctx.session.completedLessons = [];
    ctx.session.isWaitingForNext = false;
    ctx.session.isProcessing = false;
    ctx.session.isWaitingForQuiz = false;
    ctx.session.currentQuiz = null;
    ctx.session.currentQuestionIndex = 0;
    ctx.session.quizAnswers = [];
    ctx.session.quizResults = [];
    ctx.session.quizAttempts = 0;
    ctx.session.isWaitingForAssessment = false;
    ctx.session.currentAssessment = null;
    ctx.session.currentAssessmentQuestionIndex = 0;
    ctx.session.assessmentAnswers = [];
    ctx.session.assessmentResults = [];
    ctx.session.lastAssessmentAdvice = "";
    ctx.session.waitingForName = [];

    await ctx.reply(
      `👋 Witaj, ${firstName}!\n\n` +
        `🎓 *Witamy na kursie!*\n\n` +
        `${
          process.env.COURSE_MODE === "scheduled"
            ? "📅 Nowe lekcje będą wysyłane codziennie o 10:00"
            : "⚡ Lekcje będą wysyłane automatycznie"
        }\n\n`,
    );

    await notifyUserStarted(userId.toString(), username, firstName);

    if (process.env.COURSE_MODE === "instant") {
      await sleep(1000);
      scheduleUserProgress(ctx);
    }
  } catch (error) {
    console.error("Error in start command:", error);
    await ctx.reply("❌ Błąd podczas uruchamiania bota. Spróbuj ponownie.");
  }
}
