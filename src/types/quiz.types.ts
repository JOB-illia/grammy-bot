export interface QuizQuestion {
    question: string;
    options: string[];
    correct: number;
    explanation?: string;
}

export interface Quiz {
    title: string;
    passScore: number;
    questions: QuizQuestion[];
}

export interface QuizResult {
    quizTitle: string;
    score: number;
    percentage: number;
    passed: boolean;
    answers: Array<{
        question: string;
        selectedAnswer: number;
        correctAnswer: number;
        isCorrect: boolean;
        explanation?: string;
    }>;
    completedAt: string;
}