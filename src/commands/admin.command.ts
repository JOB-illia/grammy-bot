import type { MyContext } from '../types';
import { isAdmin } from '../config/bot.config';
import { MESSAGES } from '../config/constants';
import { adminMenu } from '../features/admin/admin.menu';

export async function adminCommand(ctx: MyContext) {
    try {
        if (!isAdmin(ctx.from!.id.toString())) {
            await ctx.reply(MESSAGES.NO_ACCESS);
            return;
        }

        ctx.session.isAdmin = true;
        await ctx.reply('👨‍💼 *Panel administratora:*', {
            parse_mode: 'Markdown',
            reply_markup: adminMenu
        });
    } catch (error) {
        console.error('Error in admin command:', error);
        await ctx.reply('❌ Błąd dostępu do panelu administratora');
    }
}