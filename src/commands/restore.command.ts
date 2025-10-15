import { getUser } from "../services/firebase";
import { loadCourse } from "../services/courseLoader";
import type { MyContext } from "../types";

export async function restoreCommand(ctx: MyContext) {
  try {
    const userId = ctx.from!.id.toString();
    const existingUser = await getUser(userId);

    if (!existingUser || existingUser.currentDay === 0) {
      await ctx.reply(
        "ℹ️ Nie znaleziono zapisanego postępu.\n\n" +
          "Jeśli dopiero zaczynasz, użyj /start",
      );
      return;
    }

    // Відновлюємо прогрес
    ctx.session.currentDay = existingUser.currentDay;
    ctx.session.currentLessonIndex = existingUser.currentDay;
    ctx.session.completedLessons = existingUser.completedLessons || [];
    ctx.session.isWaitingForNext = false;
    ctx.session.isProcessing = false;

    // Скидаємо стан тестів
    ctx.session.isWaitingForQuiz = false;
    ctx.session.currentQuiz = null;
    ctx.session.isWaitingForAssessment = false;
    ctx.session.currentAssessment = null;

    const course = await loadCourse();
    const progress = Math.round(
      (ctx.session.completedLessons.length / course.length) * 100,
    );

    await ctx.reply(
      `✅ *Postęp przywrócony!*\n\n` +
        `📊 Lekcje: ${ctx.session.completedLessons.length}/${course.length}\n` +
        `📈 Postęp: ${progress}%\n\n` +
        `Użyj /resume aby kontynuować`,
      { parse_mode: "Markdown" },
    );
  } catch (error) {
    console.error("Error in restore command:", error);
    await ctx.reply("❌ Błąd podczas przywracania postępu");
  }
}
