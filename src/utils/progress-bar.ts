export function getProgressBar(current: number, total: number): string {
    const percentage = (current / total) * 100;
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
}