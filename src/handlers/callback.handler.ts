import { Bot } from 'grammy';
import type { MyContext } from '../types';
import { handleQuizAnswer } from '../features/quiz/quiz.service';
import { handleAssessmentAnswer, continueAfterAssessment } from '../features/assessment/assessment.service';
import { scheduleUserProgress } from '../features/course/progress-queue';
import { sleep } from '../utils/sleep';

export function registerCallbackHandlers(bot: Bot<MyContext>) {
    bot.on('callback_query:data', async (ctx) => {
        try {
            await ctx.answerCallbackQuery();
            const data = ctx.callbackQuery.data;

            // Assessment handlers
            if (data === 'assessment_yes') {
                if (ctx.session.isWaitingForAssessment) {
                    await handleAssessmentAnswer(ctx, true);
                }
                return;
            }

            if (data === 'assessment_no') {
                if (ctx.session.isWaitingForAssessment) {
                    await handleAssessmentAnswer(ctx, false);
                }
                return;
            }

            if (data === 'show_assessment_advice') {
                if (ctx.session.lastAssessmentAdvice) {
                    await ctx.reply(
                        `💡 *Porady:*\n\n${ctx.session.lastAssessmentAdvice}`,
                        { parse_mode: 'Markdown' }
                    );
                }
                return;
            }

            if (data === 'assessment_continue') {
                await continueAfterAssessment(ctx);
                return;
            }

            // Quiz handlers
            if (data.startsWith('quiz_answer_')) {
                const answerIndex = parseInt(data.replace('quiz_answer_', ''));
                if (ctx.session.isWaitingForQuiz) {
                    await handleQuizAnswer(ctx, answerIndex);
                }
                return;
            }

            if (data === 'retry_quiz') {
                if (ctx.session.currentQuiz) {
                    ctx.session.currentQuestionIndex = 0;
                    ctx.session.quizAnswers = [];
                    ctx.session.quizAttempts = (ctx.session.quizAttempts || 0) + 1;

                    await ctx.reply(
                        `🔄 *Повторний test - próba ${ctx.session.quizAttempts}*\n\nZaczynamy ponownie!`,
                        { parse_mode: 'Markdown' }
                    );
                    await sleep(1000);

                    const { sendQuizQuestion } = await import('../features/quiz/quiz.sender');
                    await sendQuizQuestion(ctx);
                }
                return;
            }

            // Next button handler
            if (data.includes('next') || data.includes('dalej')) {
                if (ctx.session.isWaitingForNext) {
                    ctx.session.isWaitingForNext = false;
                    scheduleUserProgress(ctx);
                }
            }
        } catch (error) {
            console.error('Error in callback query:', error);
        }
    });
}