import { bot } from '../bot/instance';
import { queueManager } from '../managers/queue.manager';
import { progressQueue } from '../features/course/progress-queue';

export function setupGracefulShutdown(): void {
    process.once('SIGINT', () => {
        console.log('Received SIGINT, shutting down gracefully...');
        queueManager.clear();
        progressQueue.clear();
        bot.stop();
        process.exit(0);
    });

    process.once('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        queueManager.clear();
        progressQueue.clear();
        bot.stop();
        process.exit(0);
    });
}