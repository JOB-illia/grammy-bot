import type { MyContext } from '../../types';

export async function handleQuizAnswer(ctx: MyContext, answerIndex: number): Promise<void> {
    const quiz = ctx.session.currentQuiz;
    if (!quiz) return;

    const question = quiz.questions[ctx.session.currentQuestionIndex];
    if (!question) return;

    ctx.session.quizAnswers.push(answerIndex);

    const isCorrect = answerIndex === question.correct;
    const correctOption = String.fromCharCode(65 + question.correct);
    const selectedOption = String.fromCharCode(65 + answerIndex);

    let resultMessage = isCorrect
        ? `✅ *Poprawnie!*\n\n${selectedOption}) ${question.options[answerIndex]}`
        : `❌ *Niepoprawnie*\n\n` +
        `Twoja odpowiedź: ${selectedOption}) ${question.options[answerIndex]}\n` +
        `Poprawna odpowiedź: ${correctOption}) ${question.options[question.correct]}`;

    if (question.explanation) {
        resultMessage += `\n\n💡 *Wyjaśnienie:*\n${question.explanation}`;
    }

    await ctx.reply(resultMessage, { parse_mode: 'Markdown' });

    ctx.session.currentQuestionIndex++;

    if (ctx.session.currentQuestionIndex < quiz.questions.length) {
        const { sendQuizQuestion } = await import('./quiz.sender');
        await sendQuizQuestion(ctx);
    } else {
        const { finishQuiz } = await import('./quiz.results');
        await finishQuiz(ctx);
    }
}