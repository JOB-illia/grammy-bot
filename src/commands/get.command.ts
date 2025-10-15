import type { MyContext } from '../types';
import { isAdmin } from '../config/bot.config';
import { exportPhonesToExcel } from '../features/admin/export.service';

export async function getCommand(ctx: MyContext) {
    try {
        if (!isAdmin(ctx.from!.id.toString())) {
            return;
        }

        await exportPhonesToExcel(ctx);
    } catch (error) {
        console.error('Error in get command:', error);
        await ctx.reply('❌ Błąd podczas generowania raportu');
    }
}