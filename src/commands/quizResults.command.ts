import type { MyContext } from '../types';
import { showQuizResults } from '../features/quiz/quiz.results';

export async function quizResultsCommand(ctx: MyContext) {
    await showQuizResults(ctx);
}