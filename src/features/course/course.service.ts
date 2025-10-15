import type { MyContext } from '../../types';
import { MESSAGES } from '../../config/constants';
import { queueManager } from '../../managers/queue.manager';
import { scheduleUserProgress } from './progress-queue';

export async function pauseCourse(ctx: MyContext): Promise<void> {
    const userId = ctx.from!.id.toString();
    ctx.session.isProcessing = false;
    ctx.session.isWaitingForQuiz = false;
    ctx.session.isWaitingForAssessment = false;
    queueManager.stopProcessing(userId);
    await ctx.reply(MESSAGES.PAUSE, { parse_mode: 'Markdown' });
}

export async function resumeCourse(ctx: MyContext): Promise<void> {
    if (!ctx.session.isProcessing && !ctx.session.isWaitingForQuiz && !ctx.session.isWaitingForAssessment) {
        scheduleUserProgress(ctx);
    } else if (ctx.session.isWaitingForQuiz) {
        await ctx.reply(MESSAGES.FINISH_QUIZ);
    } else if (ctx.session.isWaitingForAssessment) {
        await ctx.reply(MESSAGES.FINISH_ASSESSMENT);
    } else {
        await ctx.reply(MESSAGES.ALREADY_PROCESSING);
    }
}

export async function resetCourse(ctx: MyContext): Promise<void> {
    const userId = ctx.from!.id.toString();

    ctx.session.currentDay = 0;
    ctx.session.currentLessonIndex = 0;
    ctx.session.completedLessons = [];
    ctx.session.isWaitingForNext = false;
    ctx.session.isProcessing = false;

    // Reset quiz
    ctx.session.isWaitingForQuiz = false;
    ctx.session.currentQuiz = null;
    ctx.session.currentQuestionIndex = 0;
    ctx.session.quizAnswers = [];
    ctx.session.quizResults = [];
    ctx.session.quizAttempts = 0;

    // Reset assessment
    ctx.session.isWaitingForAssessment = false;
    ctx.session.currentAssessment = null;
    ctx.session.currentAssessmentQuestionIndex = 0;
    ctx.session.assessmentAnswers = [];
    ctx.session.assessmentResults = [];

    queueManager.stopProcessing(userId);
    await ctx.reply(MESSAGES.COURSE_RESET);
}

export async function finishCourse(ctx: MyContext): Promise<void> {
    const userId = ctx.from!.id.toString();
    ctx.session.isProcessing = false;
    queueManager.stopProcessing(userId);
}