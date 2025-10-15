import type { MyContext, AssessmentQuiz } from '../../types';
import { sleep } from '../../utils/sleep';

export async function sendAssessmentQuiz(ctx: MyContext, lesson: any): Promise<boolean> {
    if (!lesson.assessment) {
        console.error('No assessment data in lesson');
        return false;
    }

    const assessment = lesson.assessment as AssessmentQuiz;

    ctx.session.currentAssessment = assessment;
    ctx.session.currentAssessmentQuestionIndex = 0;
    ctx.session.assessmentAnswers = [];
    ctx.session.isWaitingForAssessment = true;

    ctx.session.isProcessing = false;

    if (lesson.content) {
        await ctx.reply(lesson.content, { parse_mode: 'Markdown' });
        await sleep(1000);
    }

    await sleep(500);
    await sendAssessmentQuestion(ctx);
    return true;
}

export async function sendAssessmentQuestion(ctx: MyContext): Promise<void> {
    const assessment = ctx.session.currentAssessment;
    if (!assessment) return;

    const questionIndex = ctx.session.currentAssessmentQuestionIndex!;
    const question = assessment.questions[questionIndex];

    if (!question) {
        const { finishAssessment } = await import('./assessment.results');
        await finishAssessment(ctx);
        return;
    }

    const questionNumber = questionIndex + 1;
    const totalQuestions = assessment.questions.length;

    const keyboard = {
        inline_keyboard: [[
            { text: '✅ Tak', callback_data: 'assessment_yes' },
            { text: '❌ Nie', callback_data: 'assessment_no' }
        ]]
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