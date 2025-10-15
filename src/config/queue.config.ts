export const queueConfig = {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '10', 10),
    rateCap: parseInt(process.env.RATE_CAP || '25', 10),
    rateInterval: parseInt(process.env.RATE_INTERVAL_MS || '1000', 10),
    delayBetweenLessons: parseInt(process.env.DELAY_BETWEEN_LESSONS_MS || String(30 * 1000), 10),
};