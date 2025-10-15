import { LIMITS } from '../config/constants';

export function splitMessage(text: string, maxLength: number = LIMITS.MESSAGE_MAX_LENGTH): string[] {
    const parts: string[] = [];
    let currentPart = '';

    const lines = text.split('\n');

    for (const line of lines) {
        if ((currentPart + line + '\n').length > maxLength) {
            if (currentPart) {
                parts.push(currentPart.trim());
                currentPart = '';
            }
        }
        currentPart += line + '\n';
    }

    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }

    return parts;
}