interface AssessmentQuestion {
    question: string;
}

interface AssessmentRange {
    min: number;
    max: number;
    title: string;
    description: string;
    advice?: string;
}

export interface AssessmentQuiz {
    title: string;
    description: string;
    questions: AssessmentQuestion[];
    ranges: AssessmentRange[];
}

export interface AssessmentResult {
    quizTitle: string;
    yesCount: number;
    totalQuestions: number;
    range: AssessmentRange;
    completedAt: string;
}