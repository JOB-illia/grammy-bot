import type { MyContext } from '../types';
import { isAdmin } from '../config/bot.config';
import { getUsers } from '../services/firebase';
import { loadCourse } from '../services/courseLoader';

export async function statsCommand(ctx: MyContext) {
    try {
        if (!isAdmin(ctx.from!.id.toString())) {
            return;
        }

        const users = await getUsers();
        const course = await loadCourse();

        const userProgress = users.map(user => user.currentDay || 0);
        const avgProgress = userProgress.reduce((sum, progress) => sum + progress, 0) / users.length;

        const statsMessage =
            `📈 *Szczegółowe statystyki:*\n\n` +
            `📚 Kurs: ${course.length} lekcji\n` +
            `👥 Użytkownicy: ${users.length}\n` +
            `📊 Średni postęp: ${Math.round(avgProgress)} lekcji\n` +
            `🎯 Współczynnik ukończenia: ${Math.round((avgProgress / course.length) * 100)}%\n` +
            `📧 Z emailem: ${users.filter(u => u.email).length}\n\n` +
            `🕐 ${new Date().toLocaleString('pl-PL')}`;

        await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error in stats command:', error);
        await ctx.reply('❌ Błąd podczas pobierania statystyk');
    }
}