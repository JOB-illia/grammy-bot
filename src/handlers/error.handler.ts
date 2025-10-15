import { Bot, GrammyError, HttpError } from 'grammy';
import type { MyContext } from '../types';
import { notifyUserError } from '../features/admin/notifications';
import { queueManager } from '../managers/queue.manager';
import { updateUserProgress } from '../services/firebase';

export function setupErrorHandler(bot: Bot<MyContext>) {
    bot.catch(async (err) => {
        const ctx = err.ctx;
        console.error(`Error while handling update ${ctx.update.update_id}:`);
        const e: any = err.error;

        if (ctx.from) {
            await notifyUserError(
                ctx.from.id.toString(),
                e?.message || 'Unknown error',
                ctx.update.message?.text || 'Unknown action'
            );
        }

        if (e instanceof GrammyError) {
            console.error('Error in request:', e.description);

            if (ctx.from) {
                const userId = ctx.from.id.toString();

                if (e.error_code === 403) {
                    console.log(`User ${userId} blocked the bot`);
                    queueManager.stopProcessing(userId);
                    updateUserProgress(userId, -1).catch(console.error);
                } else if (e.error_code === 429) {
                    console.log(`Rate limit hit for user ${userId}`);
                } else if (e.error_code >= 500) {
                    console.log(`Server error for user ${userId}: ${e.error_code}`);
                    queueManager.stopProcessing(userId);
                }
            }
        } else if (e instanceof HttpError) {
            console.error('Could not contact Telegram:', e);
            queueManager.clear();
        } else {
            console.error('Unknown error:', e);
        }
    });
}