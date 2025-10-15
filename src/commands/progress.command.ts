import type { MyContext } from '../types';
import { loadCourse } from '../services/courseLoader';
import { getProgressBar } from '../utils/progress-bar';

export async function progressCommand(ctx: MyContext) {
    try {
        const progress = ctx.session.completedLessons.length;
        const total = (await loadCourse()).length;
        const isActive = ctx.session.isProcessing ? '🟢 Aktywny' : '🔴 Wstrzymany';
        const quizResults = ctx.session.quizResults.length;
        const assessmentResults = ctx.session.assessmentResults?.length || 0;

        let message = `📊 *Twój postęp:*\n\n` +
            `Status: ${isActive}\n` +
            `Ukończone lekcje: ${progress}/${total}\n` +
            `Postęp: ${Math.round((progress/total) * 100)}%\n` +
            `${getProgressBar(progress, total)}`;

        if (quizResults > 0) {
            message += `\n\n📝 *Testy wiedzy:*\n`;
            message += `Zaliczone: ${quizResults}\n`;

            const avgScore = Math.round(
                ctx.session.quizResults.reduce((sum, result) => sum + result.percentage, 0) / quizResults
            );
            message += `Średnia ocena: ${avgScore}%`;
        }

        if (assessmentResults > 0) {
            message += `\n\n🔍 *Testy samooceny:*\n`;
            message += `Ukończone: ${assessmentResults}`;

            const lastAssessment = ctx.session.assessmentResults![assessmentResults - 1];
            message += `\nOstatni wynik: ${lastAssessment.yesCount}/${lastAssessment.totalQuestions} "Tak"`;
        }

        if (ctx.session.isWaitingForQuiz) {
            message += '\n\n📝 *Aktualnie w trakcie testu wiedzy*';
        } else if (ctx.session.isWaitingForAssessment) {
            message += '\n\n🔍 *Aktualnie w trakcie testu samooceny*';
        }

        await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in progress command:', error);
        await ctx.reply('❌ Błąd podczas wyświetlania postępu');
    }
}