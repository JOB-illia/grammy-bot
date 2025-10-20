import { sleep } from "../utils/sleep";
import { MyContext } from "../types";
import {
  continueAfterAssessment,
  handleAssessmentAnswer,
} from "../features/assessment";
import { handleQuizAnswer, sendQuizQuestion } from "../features/quiz";
import { scheduleUserProgress } from "../features/course";
import { sendAdminNotification } from "../features/admin";
import { updateUserWebinar } from "../services/firebase";

export const callbackQueryData = async (ctx: MyContext) => {
  try {
    console.log("callback_query:", {
      from: ctx.from?.id,
      chat: ctx.callbackQuery?.message?.chat?.id,
      data: ctx.callbackQuery?.data,
    });

    await ctx.answerCallbackQuery();
    const data = (ctx.callbackQuery?.data as string) ?? "";

    if (data === "assessment_yes") {
      if (ctx.session.isWaitingForAssessment) {
        await handleAssessmentAnswer(ctx, true);
      }
      return;
    }

    if (data === "assessment_no") {
      if (ctx.session.isWaitingForAssessment) {
        await handleAssessmentAnswer(ctx, false);
      }
      return;
    }

    if (data === "show_assessment_advice") {
      if (ctx.session.lastAssessmentAdvice) {
        await ctx.reply(`💡 *Porady:*\n\n${ctx.session.lastAssessmentAdvice}`, {
          parse_mode: "Markdown",
        });
      }
      return;
    }

    if (data === "assessment_continue") {
      await continueAfterAssessment(ctx);
      return;
    }

    if (data.startsWith("quiz_answer_")) {
      const answerIndex = parseInt(data.replace("quiz_answer_", ""));
      if (ctx.session.isWaitingForQuiz) {
        await handleQuizAnswer(ctx, answerIndex);
      }
      return;
    }

    if (data === "retry_quiz") {
      if (ctx.session.currentQuiz) {
        ctx.session.currentQuestionIndex = 0;
        ctx.session.quizAnswers = [];
        ctx.session.quizAttempts = (ctx.session.quizAttempts || 0) + 1;

        await ctx.reply(
          `🔄 *Повторний test - próba ${ctx.session.quizAttempts}*\n\nZaczynamy ponownie!`,
          { parse_mode: "Markdown" },
        );
        await sleep(1000);
        await sendQuizQuestion(ctx);
      }
      return;
    }

    console.log('DATA BUTTONS', data);

    if (data === 'next:webinar-yes') {
      console.log('TAK TAK TAK');
      const message = `<b>Проголосував за вебінар</b>
👤 ID: ${ctx.from?.id}
🔧 Akcja: <b>Буде на вебінарі</b>
🕐 Czas: ${new Date().toLocaleString('pl-PL')}
            `

      await sendAdminNotification(message)

      if (ctx.from?.id) {
        await updateUserWebinar(ctx.from.id.toString(), 'yes')
      }
    }

    if (data === 'next:webinar-no') {
      console.log('NO NO NO');
      const message = `<b>Проголосувала за вебінар</b>
👤 ID: ${ctx.from?.id}
🔧 Akcja: <b>Не буде</b>
🕐 Czas: ${new Date().toLocaleString('pl-PL')}
            `

      await sendAdminNotification(message)

      if (ctx.from?.id) {
        await updateUserWebinar(ctx.from.id.toString(), 'no')
      }
    }


    if (data.includes("next") || data.includes("dalej")) {
      if (ctx.session.isWaitingForNext) {
        ctx.session.isWaitingForNext = false;

        scheduleUserProgress(ctx);
      }
    }
  } catch (error) {
    console.error("Error in callback query:", error);
  }
};
