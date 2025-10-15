import PQueue from 'p-queue';
import type { MyContext } from '../../types';
import { queueConfig } from '../../config/queue.config';
import { queueManager } from '../../managers/queue.manager';
import { startAutoProgress, handleProgressError } from './auto-progress';

export const progressQueue = new PQueue({
    concurrency: queueConfig.maxConcurrent,
    intervalCap: queueConfig.rateCap,
    interval: queueConfig.rateInterval,
});

const usersInQueue = new Set<string>();

export function scheduleUserProgress(ctx: MyContext) {
    const userId = ctx.from!.id.toString();

    if (usersInQueue.has(userId)) {
        console.log(`User ${userId} already queued`);
        return;
    }

    usersInQueue.add(userId);

    progressQueue.add(async () => {
        console.log(`Queue job started for ${userId}`);
        try {
            await startAutoProgress(ctx);
        } catch (err) {
            console.error(`Error in queued progress for ${userId}:`, err);
            try {
                await handleProgressError(ctx, err);
            } catch (e) {
                console.error('Error while handling queued progress error:', e);
            }
        } finally {
            usersInQueue.delete(userId);
            queueManager.stopProcessing(userId);
            ctx.session.isProcessing = false;
            console.log(`Queue job finished for ${userId}`);
        }
    }).catch(err => {
        usersInQueue.delete(userId);
        console.error('Failed to enqueue progress job:', err);
    });
}