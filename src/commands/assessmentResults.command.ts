import type { MyContext } from '../types';
import { showAssessmentResults } from '../features/assessment/assessment.results';

export async function assessmentResultsCommand(ctx: MyContext) {
    await showAssessmentResults(ctx);
}