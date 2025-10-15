import type { MyContext, Quiz } from '../../types';
import { sleep } from '../../utils/sleep';

export async function sendQuiz(ctx: MyContext, lesson: any): Promise<boolean> {
    if (!lesson.quiz) {
        console.error('No quiz data in lesson');
        return false;
    }

    const quiz = lesson.quiz as Quiz;

    ctx.session.currentQuiz = quiz;
    ctx.session.currentQuestionIndex = 0;
    ctx.session.quizAnswers = [];
    ctx.session.isWaitingForQuiz = true;
    ctx.session.quizAttempts = (ctx.session.quizAttempts || 0) + 1;

    ctx.session.isProcessing = false;

    if (lesson.content) {
        await ctx.reply(lesson.content, { parse_mode: 'Markdown' });
        await sleep(1000);
    }

    await ctx.reply(
        `🧠 *${quiz.title}*\n\n` +
        `📝 Pytań: ${quiz.questions.length}\n` +
        `📊 Próg zaliczenia: ${quiz.passScore}%\n` +
        `🔄 Próba: ${ctx.session.quizAttempts}\n\n` +
        `Gotowy? Zaczynamy test!`,
        { parse_mode: 'Markdown' }
    );

    await sleep(2000);
    await sendQuizQuestion(ctx);
    return true;
}

export async function sendQuizQuestion(ctx: MyContext): Promise<void> {
    const quiz = ctx.session.currentQuiz;
    if (!quiz) return;

    const questionIndex = ctx.session.currentQuestionIndex;
    const question = quiz.questions[questionIndex];

    if (!question) {
        const { finishQuiz } = await import('./quiz.results');
        await finishQuiz(ctx);
        return;
    }

    const questionNumber = questionIndex + 1;
    const totalQuestions = quiz.questions.length;

    const keyboard = {
        inline_keyboard: question.options.map((option, index) => [{
            text: `${String.fromCharCode(65 + index)}) ${option}`,
            callback_data: `quiz_answer_${index}`
        }])
    };

    await ctx.reply(
        `❓ *Pytanie ${questionNumber}/${totalQuestions}*\n\n` +
        `${question.question}`,
        {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        }
    );
}