import type { MyContext } from '../types';
import { isAdmin } from '../config/bot.config';
import { sendDailyReport } from '../features/admin/reports';

export async function reportCommand(ctx: MyContext) {
    try {
        if (!isAdmin(ctx.from!.id.toString())) {
            return;
        }

        await sendDailyReport();
        await ctx.reply('📊 Raport wysłany');
    } catch (error) {
        console.error('Error in report command:', error);
        await ctx.reply('❌ Błąd podczas generowania raportu');
    }
}