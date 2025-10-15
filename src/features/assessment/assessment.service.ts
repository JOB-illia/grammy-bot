import type { MyContext } from '../../types';
import { sleep } from '../../utils/sleep';
import { scheduleUserProgress } from '../course/progress-queue';

export async function handleAssessmentAnswer(ctx: MyContext, answer: boolean): Promise<void> {
    const assessment = ctx.session.currentAssessment;
    if (!assessment) return;

    ctx.session.assessmentAnswers!.push(answer);

    const answerText = answer ? 'Tak' : 'Nie';
    const icon = answer ? '✅' : '❌';

    await ctx.reply(`${icon} *${answerText}*`, { parse_mode: 'HTML' });

    ctx.session.currentAssessmentQuestionIndex!++;

    await sleep(1000);

    if (ctx.session.currentAssessmentQuestionIndex! < assessment.questions.length) {
        const { sendAssessmentQuestion } = await import('./assessment.sender');
        await sendAssessmentQuestion(ctx);
    } else {
        const { finishAssessment } = await import('./assessment.results');
        await finishAssessment(ctx);
    }
}

export async function continueAfterAssessment(ctx: MyContext): Promise<void> {
    ctx.session.isWaitingForAssessment = false;
    ctx.session.currentAssessment = null;
    ctx.session.currentAssessmentQuestionIndex = 0;
    ctx.session.assessmentAnswers = [];
    ctx.session.lastAssessmentAdvice = undefined;

    ctx.session.currentLessonIndex++;

    scheduleUserProgress(ctx);
}