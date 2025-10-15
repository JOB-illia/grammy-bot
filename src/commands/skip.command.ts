import type { MyContext } from '../types';
import { scheduleUserProgress } from '../features/course/progress-queue';

export async function skipCommand(ctx: MyContext) {
    try {
        if (ctx.session.isWaitingForQuiz) {
            await ctx.reply('❌ Nie możesz pominąć testu wiedzy. Musisz go ukończyć aby kontynuować.');
            return;
        }

        if (ctx.session.isWaitingForAssessment) {
            await ctx.reply('❌ Nie możesz pominąć testu samooceny. Musisz go ukończyć aby kontynuować.');
            return;
        }

        if (ctx.session.isProcessing) {
            ctx.session.currentLessonIndex++;
            ctx.session.isWaitingForNext = false;
            await ctx.reply('⏭ Pomijam bieżącą lekcję...');
            scheduleUserProgress(ctx);
        } else {
            await ctx.reply('❌ Kurs nie jest aktywny. Użyj /resume');
        }
    } catch (error) {
        console.error('Error in skip command:', error);
        await ctx.reply('❌ Błąd podczas pomijania lekcji');
    }
}