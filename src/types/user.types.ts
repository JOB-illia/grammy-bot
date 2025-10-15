export interface User {
    userId: string;
    username: string;
    firstName: string;
    startDate: string;
    isActive: boolean;
    currentDay: number;
    email?: string;
    totalQuizzes?: number;
    averageQuizScore?: number;
    login?: number | string;
}