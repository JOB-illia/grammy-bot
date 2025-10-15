import type { MyContext, QuizResult } from '../../types';
import { sleep } from '../../utils/sleep';
import { splitMessage } from '../../utils/message-splitter';
import { scheduleUserProgress } from '../course/progress-queue';

export async function finishQuiz(ctx: MyContext): Promise<void> {
    const quiz = ctx.session.currentQuiz;
    if (!quiz) return;

    const totalQuestions = quiz.questions.length;
    const correctAnswers = ctx.session.quizAnswers.filter((answer, index) =>
        answer === quiz.questions[index].correct
    ).length;

    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = percentage >= quiz.passScore;

    const quizResult: QuizResult = {
        quizTitle: quiz.title,
        score: correctAnswers,
        percentage,
        passed,
        answers: quiz.questions.map((question, index) => ({
            question: question.question,
            selectedAnswer: ctx.session.quizAnswers[index],
            correctAnswer: question.correct,
            isCorrect: ctx.session.quizAnswers[index] === question.correct,
            explanation: question.explanation
        })),
        completedAt: new Date().toISOString()
    };

    if (passed) {
        ctx.session.quizResults.push(quizResult);

        ctx.session.isWaitingForQuiz = false;
        ctx.session.currentQuiz = null;
        ctx.session.currentQuestionIndex = 0;
        ctx.session.quizAnswers = [];
        ctx.session.quizAttempts = 0;

        ctx.session.currentLessonIndex++;

        await ctx.reply(`🎉 *Gratulacje! Test zaliczony!*`, { parse_mode: 'Markdown' });

        await sleep(1000);
        await showDetailedQuizResults(ctx, quizResult);

        await sleep(2000);
        scheduleUserProgress(ctx);
    } else {
        const retryKeyboard = {
            inline_keyboard: [[{
                text: '🔄 Spróbuj ponownie',
                callback_data: 'retry_quiz'
            }]]
        };

        let resultMessage = `❌ *Test niezaliczony*\n\n` +
            `Nie martw się! Możesz spróbować ponownie.\n` +
            `📚 Przejrzyj materiały i kliknij przycisk poniżej:`;

        await ctx.reply(resultMessage, {
            parse_mode: 'Markdown',
            reply_markup: retryKeyboard
        });

        await sleep(1000);
        await showDetailedQuizResults(ctx, quizResult);
    }
}

async function showDetailedQuizResults(ctx: MyContext, result: QuizResult): Promise<void> {
    let detailsMessage = `📋 *Szczegółowe wyniki:*\n\n`;

    result.answers.forEach((answer, index) => {
        const icon = answer.isCorrect ? '✅' : '❌';
        const questionNum = index + 1;
        const selectedOption = String.fromCharCode(65 + answer.selectedAnswer);
        const correctOption = String.fromCharCode(65 + answer.correctAnswer);

        detailsMessage += `${icon} *Pytanie ${questionNum}:*\n`;
        detailsMessage += `${answer.question}\n`;
        detailsMessage += `Twoja odpowiedź: ${selectedOption}`;

        if (!answer.isCorrect) {
            detailsMessage += ` | Poprawna: ${correctOption}`;
        }

        detailsMessage += '\n\n';
    });

    const maxLength = 4000;
    if (detailsMessage.length > maxLength) {
        const parts = splitMessage(detailsMessage, maxLength);
        for (const part of parts) {
            await ctx.reply(part, { parse_mode: 'Markdown' });
            await sleep(500);
        }
    } else {
        await ctx.reply(detailsMessage, { parse_mode: 'Markdown' });
    }
}

export async function showQuizResults(ctx: MyContext): Promise<void> {
    if (!ctx.session.quizResults || ctx.session.quizResults.length === 0) {
        await ctx.reply('📝 Nie masz jeszcze żadnych zaliczonych testów');
        return;
    }

    let message = `📊 *Twoje wyniki testów:*\n\n`;

    ctx.session.quizResults.forEach((result, index) => {
        const date = new Date(result.completedAt).toLocaleDateString('pl-PL');
        message += `${index + 1}. **${result.quizTitle}**\n`;
        message += `   📈 Wynik: ${result.percentage}% (${result.score} pkt)\n`;
        message += `   📅 Data: ${date}\n\n`;
    });

    const avgScore = Math.round(
        ctx.session.quizResults.reduce((sum, result) => sum + result.percentage, 0) / ctx.session.quizResults.length
    );

    message += `📊 *Średnia ze wszystkich testów: ${avgScore}%*`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
}